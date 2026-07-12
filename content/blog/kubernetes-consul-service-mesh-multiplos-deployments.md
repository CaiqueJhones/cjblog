---
title: Múltiplos Deployments com Kubernetes e Consul Service Mesh
slug: kubernetes-consul-service-mesh-multiplos-deployments
date: 2026-07-11
banner_image: consul-service-mesh-routing.png
description: Como rodar múltiplas versões da mesma aplicação no Kubernetes e controlar a distribuição de tráfego entre elas usando o Consul Service Mesh, com Service Router, Service Splitter e Service Resolver.
categories:
  - Kubernetes
  - DevOps
meta_description: Como rodar múltiplas versões da mesma aplicação no Kubernetes e controlar a distribuição de tráfego entre elas usando o Consul Service Mesh, com Service Router, Service Splitter e Service Resolver.
browser_title: Múltiplos Deployments com Consul Service Mesh!
comments: true
---

Rodar mais de uma versão da mesma aplicação em produção, ao mesmo tempo, é uma prática cada vez mais comum em times que buscam reduzir o risco de releases e tomar decisões orientadas a dados. Neste artigo veremos por que isso é útil, os conceitos de _canary deployment_ e teste A/B, e como implementar controle fino de tráfego entre múltiplos deployments usando **Kubernetes**, **Consul Service Mesh** e **Helm**.

## Conteúdo

- [Motivação](#motivacao)
- [Canary Deployment vs Teste A/B](#canary-vs-ab)
- [Consul Service Mesh: visão geral](#consul-service-mesh)
- [Service Router](#service-router)
- [Service Splitter](#service-splitter)
- [Service Resolver](#service-resolver)
- [Como as três peças trabalham juntas](#como-funciona-junto)
- [Exemplo prático com Kubernetes, Consul e Helm](#exemplo-pratico)
- [Considerações finais](#consideracoes-finais)

## <a name="motivacao">Motivação</a>

Por que uma equipe manteria duas versões do mesmo serviço rodando simultaneamente em produção, em vez de simplesmente substituir a versão antiga pela nova? Alguns motivos práticos:

- **Redução de risco em releases.** Ao invés de expor 100% dos usuários a uma mudança de uma vez, é possível liberar a nova versão para uma fração pequena do tráfego e observar seu comportamento com dados reais antes de um rollout completo.
- **Rollback rápido e barato.** Se a versão nova apresentar problemas, basta redirecionar o tráfego de volta para a versão estável, sem precisar reimplantar nada.
- **Decisões de produto orientadas a dados.** Times de produto frequentemente precisam comparar duas implementações (um novo fluxo de checkout, um novo algoritmo de recomendação) e medir o impacto real em métricas de negócio antes de decidir qual delas seguirá em produção.
- **Validação de mudanças de infraestrutura.** Trocas de runtime, biblioteca ou dependência crítica podem ser validadas com uma fatia de tráfego real antes de afetar todos os usuários.

Esses cenários compartilham um requisito técnico comum: a capacidade de rotear e dividir tráfego entre diferentes versões do mesmo serviço, sem acoplar essa lógica ao código da aplicação. É exatamente esse problema que o Consul Service Mesh resolve na camada de infraestrutura.

## <a name="canary-vs-ab">Canary Deployment vs Teste A/B</a>

Apesar de utilizarem o mesmo mecanismo técnico (múltiplas versões coexistindo e recebendo frações de tráfego), **canary deployment** e **teste A/B** resolvem problemas diferentes e não devem ser confundidos.

**Canary Deployment** é uma estratégia de _release_. O objetivo é validar a **estabilidade operacional** de uma nova versão antes de um rollout completo. O tráfego direcionado à nova versão começa pequeno (por exemplo, 5%) e cresce progressivamente (10%, 30%, 70%, 100%) conforme métricas como taxa de erro, latência e saúde dos pods permanecem dentro do esperado. Ao final, a versão nova substitui completamente a antiga: não há intenção de manter as duas versões convivendo por muito tempo.

**Teste A/B** é uma estratégia de **produto**. Duas (ou mais) versões coexistem por um período definido, e o tráfego é segmentado por um critério de negócio (usuário, região, dispositivo, cookie de sessão, cabeçalho HTTP), em vez de uma porcentagem aleatória. A decisão sobre qual versão prevalece é tomada com base em métricas de negócio (conversão, engajamento, receita), não em métricas puramente operacionais. É perfeitamente possível que nenhuma versão "vença": o teste pode simplesmente informar uma decisão de produto sem que uma delas seja definitivamente descartada.

> Na prática, a diferença entre os dois está na **regra de roteamento** e no **critério de decisão**, não na infraestrutura usada para implementá-los. É por isso que o mesmo conjunto de primitivas do Consul (router, splitter e resolver) serve para ambos os casos.

## <a name="consul-service-mesh">Consul Service Mesh: visão geral</a>

O Consul Service Mesh (também chamado de _Consul Connect_) adiciona, a cada Pod da malha, um _sidecar proxy_ baseado em Envoy, injetado automaticamente pelo `consul-k8s` através do _Connect Inject_. Esse proxy é responsável por:

- Estabelecer conexões **mTLS** automáticas entre serviços, sem que a aplicação precise gerenciar certificados;
- Registrar o serviço no catálogo do Consul, permitindo _service discovery_;
- Interceptar e rotear tráfego L4/L7 de acordo com regras declarativas.

É esse último ponto que nos interessa aqui. O Consul organiza o roteamento avançado de tráfego em um encadeamento de três estágios, chamado de **discovery chain**:

```goat
+--------+     +----------+     +----------+
| Router |---->| Splitter |---->| Resolver |
+--------+     +----------+     +----------+
   roteia         divide       resolve instâncias
```

Cada estágio é configurado através de um _config entry_ específico, que no Kubernetes é representado por uma CRD (Custom Resource Definition): `ServiceRouter`, `ServiceSplitter` e `ServiceResolver`. Vamos ver cada um em detalhe.

## <a name="service-router">Service Router</a>

O **Service Router** é o ponto de entrada da discovery chain. Ele intercepta a requisição e avalia atributos L7, como _path prefix_, método HTTP, cabeçalhos (_headers_) e parâmetros de query, para decidir para qual serviço ou _subset_ de serviço a requisição deve seguir. Um router só pode apontar para um splitter ou para um resolver a seguir na cadeia; ele nunca é o destino final.

Um caso de uso típico de teste A/B: direcionar usuários que possuem um cabeçalho específico (por exemplo, participantes de um grupo beta) sempre para a versão nova, independentemente de qualquer distribuição percentual.

```yaml
apiVersion: consul.hashicorp.com/v1alpha1
kind: ServiceRouter
metadata:
  name: my-app
spec:
  routes:
    - match:
        http:
          header:
            - name: x-user-group
              exact: "beta"
      destination:
        service: my-app
        serviceSubset: v2
    - match:
        http:
          header:
            - name: x-canary
              exact: "true"
      destination:
        service: my-app
        serviceSubset: v2
  # Nenhuma rota explícita casou: a requisição segue para o
  # ServiceSplitter associado ao serviço "my-app".
```

> Se nenhuma regra em `routes` casar com a requisição, o Consul aplica o comportamento padrão: encaminhar para o próximo estágio da cadeia associado ao mesmo nome de serviço, no nosso caso o `ServiceSplitter`.

## <a name="service-splitter">Service Splitter</a>

O **Service Splitter** realiza a distribuição **ponderada** (_weighted_) de tráfego entre serviços ou _subsets_ de serviço. É a peça central para implementar canary deployment: começamos com um peso pequeno para a versão nova e o aumentamos gradualmente.

```yaml
apiVersion: consul.hashicorp.com/v1alpha1
kind: ServiceSplitter
metadata:
  name: my-app
spec:
  splits:
    - weight: 90
      serviceSubset: v1
    - weight: 10
      serviceSubset: v2
```

A soma dos pesos (`weight`) declarados em `splits` deve totalizar 100. Em um rollout canary progressivo, essa configuração seria atualizada ao longo do tempo (90/10, depois 70/30, depois 30/70) até que a versão `v2` receba 100% do tráfego e a `v1` seja desativada.

> Splitters podem ser encadeados: um splitter pode apontar para outro splitter como destino. Nesse caso o Consul "achata" a distribuição em um único percentual efetivo. Por exemplo, se o splitter A divide 50/50 e o splitter B aponta 50% do seu tráfego para A, o resultado efetivo observado é 25%/25%/50%.

## <a name="service-resolver">Service Resolver</a>

O **Service Resolver** define **quais instâncias** de um serviço satisfazem uma requisição de descoberta: é ele quem traduz o nome abstrato de um _subset_ (como `v1` ou `v2`) em um conjunto concreto de instâncias saudáveis. Além de subsets, o resolver também é usado para configurar failover entre datacenters e pode atuar tanto em L7 quanto em L4 (tráfego de rede puro, sem inspeção HTTP).

No Consul on Kubernetes, os _subsets_ costumam ser definidos com base em **metadata do serviço**, e essa metadata é populada a partir de _annotations_ no Pod, no formato `consul.hashicorp.com/service-meta-<chave>: <valor>`. Um Pod anotado com `consul.hashicorp.com/service-meta-version: "v2"` registra automaticamente `Service.Meta.version = v2` no catálogo do Consul.

```yaml
apiVersion: consul.hashicorp.com/v1alpha1
kind: ServiceResolver
metadata:
  name: my-app
spec:
  subsets:
    v1:
      filter: 'Service.Meta.version == "v1"'
    v2:
      filter: 'Service.Meta.version == "v2"'
```

## <a name="como-funciona-junto">Como as três peças trabalham juntas</a>

Colocando tudo junto, o fluxo de uma requisição destinada ao serviço `my-app` é:

```goat
+-------------+
| Requisição  |
+-------------+
      |
      v
+----------------+
| ServiceRouter  |  regra L7 casou? destino explícito (ex: serviceSubset v2)
+----------------+
      |
      | nenhuma regra casou
      v
+------------------+
| ServiceSplitter  |  distribui por peso (ex: 90% v1 / 10% v2)
+------------------+
      |
      v
+------------------+
| ServiceResolver  |  resolve o subset em instâncias (pods) saudáveis
+------------------+
      |
      v
+--------------------------------+
| Instância real (Envoy -> app)  |
+--------------------------------+
```

1. O **Router** avalia primeiro se algum critério L7 explícito (header, path) se aplica à requisição. Se sim, ele já direciona para um subset específico: é assim que implementamos teste A/B baseado em segmentação.
2. Se nenhuma regra do router casar, a requisição cai no **Splitter**, que aplica a distribuição percentual entre subsets: é assim que implementamos canary deployment.
3. Em ambos os casos, quem efetivamente traduz o nome do subset em instâncias de Pods reais é o **Resolver**, com base na metadata registrada no catálogo do Consul.

Essa separação de responsabilidades é o que permite compor os dois padrões (canary e A/B) na mesma malha de serviço, sem duplicar lógica de roteamento na aplicação.

## <a name="exemplo-pratico">Exemplo prático com Kubernetes, Consul e Helm</a>

Vamos construir um cenário completo: duas versões (`v1` e `v2`) da mesma aplicação `my-app`, com 90% do tráfego indo para `v1`, 10% para `v2` (canary), e uma regra adicional de teste A/B que sempre direciona usuários com o header `x-user-group: beta` para a `v2`.

### 1. Instalando o Consul via Helm

```bash
helm repo add hashicorp https://helm.releases.hashicorp.com
helm repo update
```

Crie um `values.yaml` habilitando a injeção automática de sidecar (_Connect Inject_). No Helm chart atual do `consul-k8s`, esse mesmo componente (`connectInject`) também é responsável por instalar as CRDs e rodar o controller que sincroniza os config entries (`ServiceRouter`, `ServiceSplitter`, `ServiceResolver` etc.) com o catálogo do Consul, não existe mais um stanza `controller` separado como em versões antigas do chart:

```yaml
# values.yaml
global:
  name: consul
  datacenter: dc1

connectInject:
  enabled: true

server:
  replicas: 1
```

```bash
helm install consul hashicorp/consul \
  --create-namespace \
  --namespace consul \
  --values values.yaml
```

### 2. Deployments das duas versões

Ambos os deployments compartilham o mesmo `app: my-app`, mas diferem na anotação de metadata que o Consul usará para compor os subsets:

```yaml
# deployment-v1.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app-v1
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app
      version: v1
  template:
    metadata:
      labels:
        app: my-app
        version: v1
      annotations:
        consul.hashicorp.com/connect-inject: "true"
        consul.hashicorp.com/service-meta-version: "v1"
    spec:
      containers:
        - name: my-app
          image: registry.example.com/my-app:1.4.0
          ports:
            - containerPort: 8080
```

```yaml
# deployment-v2.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app-v2
spec:
  replicas: 1
  selector:
    matchLabels:
      app: my-app
      version: v2
  template:
    metadata:
      labels:
        app: my-app
        version: v2
      annotations:
        consul.hashicorp.com/connect-inject: "true"
        consul.hashicorp.com/service-meta-version: "v2"
    spec:
      containers:
        - name: my-app
          image: registry.example.com/my-app:2.0.0-rc1
          ports:
            - containerPort: 8080
```

Um único `Service` Kubernetes expõe os pods de ambas as versões: o Consul, e não o `kube-proxy`, é quem decide para qual pod específico a requisição vai:

```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: my-app
spec:
  selector:
    app: my-app
  ports:
    - port: 8080
      targetPort: 8080
```

### 3. Config entries do Consul

Primeiro, declaramos o protocolo do serviço, obrigatório para habilitar roteamento L7:

```yaml
# service-defaults.yaml
apiVersion: consul.hashicorp.com/v1alpha1
kind: ServiceDefaults
metadata:
  name: my-app
spec:
  protocol: http
```

Em seguida, o resolver, definindo os subsets `v1` e `v2` a partir da metadata dos pods:

```yaml
# service-resolver.yaml
apiVersion: consul.hashicorp.com/v1alpha1
kind: ServiceResolver
metadata:
  name: my-app
spec:
  subsets:
    v1:
      filter: 'Service.Meta.version == "v1"'
    v2:
      filter: 'Service.Meta.version == "v2"'
```

O splitter, implementando o canary 90/10:

```yaml
# service-splitter.yaml
apiVersion: consul.hashicorp.com/v1alpha1
kind: ServiceSplitter
metadata:
  name: my-app
spec:
  splits:
    - weight: 90
      serviceSubset: v1
    - weight: 10
      serviceSubset: v2
```

E o router, adicionando a regra de teste A/B que sobrepõe o canary para o grupo `beta`:

```yaml
# service-router.yaml
apiVersion: consul.hashicorp.com/v1alpha1
kind: ServiceRouter
metadata:
  name: my-app
spec:
  routes:
    - match:
        http:
          header:
            - name: x-user-group
              exact: "beta"
      destination:
        service: my-app
        serviceSubset: v2
```

### 4. Aplicando tudo

```bash
kubectl apply -f deployment-v1.yaml
kubectl apply -f deployment-v2.yaml
kubectl apply -f service.yaml
kubectl apply -f service-defaults.yaml
kubectl apply -f service-resolver.yaml
kubectl apply -f service-splitter.yaml
kubectl apply -f service-router.yaml
```

### 5. Validando o comportamento

```bash
# Confirma que os config entries foram aceitos pelo controller
kubectl get servicerouters,servicesplitters,serviceresolvers

# Consulta o catálogo do Consul para ver as instâncias registradas com metadata
consul catalog services -tags

# Testa a rota padrão (deve cair, na maioria das vezes, na v1)
curl -H "Host: my-app" http://<gateway>/

# Testa a rota de teste A/B (deve sempre cair na v2)
curl -H "x-user-group: beta" -H "Host: my-app" http://<gateway>/
```

Para avançar o canary, basta editar `service-splitter.yaml` e ajustar os pesos (por exemplo, 70/30, depois 30/70) e reaplicar com `kubectl apply -f`, sem qualquer novo deploy de código.

## <a name="consideracoes-finais">Considerações finais</a>

O Consul Service Mesh desacopla a **decisão de roteamento de tráfego** do **processo de deploy**. Isso significa que canary deployments e testes A/B deixam de exigir lógica customizada na aplicação ou no _ingress_ e passam a ser configuração declarativa, versionável e auditável, aplicada na camada de infraestrutura.

Alguns pontos de atenção ao adotar essa abordagem:

- As CRDs (`ServiceRouter`, `ServiceSplitter`, `ServiceResolver`) só têm efeito se `connectInject.enabled=true` estiver configurado no Helm chart, é esse componente que instala as CRDs e roda o controller que sincroniza os config entries com o catálogo do Consul.
- Config entries são recursos compartilhados por todo o datacenter Consul; trate-os com a mesma disciplina de revisão que se aplica a qualquer outra mudança de infraestrutura crítica.
- Como o roteamento passa a viver fora do código, é importante manter observabilidade (métricas do Envoy, Consul UI) para acompanhar o comportamento de cada subset em tempo real.

A documentação oficial da HashiCorp sobre gerenciamento de tráfego é a referência mais completa para aprofundar os detalhes de cada config entry e cenários mais avançados, como failover entre datacenters: [developer.hashicorp.com/consul/docs/manage-traffic](https://developer.hashicorp.com/consul/docs/manage-traffic).
