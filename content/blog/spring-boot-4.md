---
title: "Spring Boot 4: o que mudou nos principais projetos do ecossistema Spring, e como migrar"
slug: spring-boot-4
date: 2026-08-18
banner_image: spring-boot-4.png
description: Um mapa prático das mudanças do Spring Boot 4 e do Spring Framework 7, cobrindo modularização, null-safety com JSpecify, HTTP Service Clients, API Versioning, CSRF por padrão no Spring Security 7, AOT Repositories do Spring Data, observabilidade com OpenTelemetry, migração pra Jackson 3 e um caminho prático de migração, com exemplos de código testados para cada mudança.
categories:
  - Java
  - Tutoriais
comments: true
---

Spring Framework 7.0 e Spring Boot 4.0 saíram em novembro de 2025. O Spring Boot 4.1 veio logo depois, em 2026, e é a versão que este post usa em todo exemplo. A maioria dos projetos ainda está no Boot 3.x, e essa distância não é gigante, mas também não é cosmética: tem um starter trocando de nome, um comportamento de segurança mudando de padrão, e um jeito novo de gerar código de repository que muda quando um erro de query aparece.

Este post cobre as mudanças de maior impacto prático nos principais projetos do ecossistema Spring: o próprio Boot, o Framework 7 por baixo, Security 7, Data e observabilidade. Cada seção vem com código testado, com saída real, sem nada hipotético.

## Conteúdo

- [Modularização: o fim do autoconfigure monolítico](#modularizacao)
- [Spring Framework 7: null-safety com JSpecify](#null-safety)
- [Spring Framework 7: HTTP Service Clients e API Versioning](#http-clients-versioning)
- [Spring Security 7: CSRF ligado por padrão](#security-csrf)
- [Spring Data: AOT Repositories](#aot-repositories)
- [Observabilidade: spring-boot-starter-opentelemetry](#observabilidade)
- [Jackson 3, com compatibilidade Jackson 2](#jackson3)
- [Como migrar na prática](#como-migrar)
- [Considerações finais](#consideracoes-finais)
- [Referências](#referencias)

## <a name="modularizacao">Modularização: o fim do autoconfigure monolítico</a>

Até o Boot 3.x, `spring-boot-autoconfigure` era um jar só, com toda auto-configuration do framework inteiro dentro: web, data, segurança, cache, mensageria. Um projeto que só usava `spring-boot-starter-web` ainda carregava, no classpath e na avaliação de condições no boot, autoconfigurações de coisas que nunca ia usar. O Boot 4 quebrou isso em módulos por tecnologia, cada um com seu próprio jar: `spring-boot-webmvc`, `spring-boot-data-jpa`, `spring-boot-security`, e por aí vai. O starter mudou de nome pra acompanhar: `spring-boot-starter-web` virou `spring-boot-starter-webmvc`.

O nome antigo não sumiu. Ele existe, mas como artefato de compatibilidade deprecated. Um projeto de teste com `spring-boot-starter-web` e outro idêntico com `spring-boot-starter-webmvc`, comparados com `mvn dependency:tree`, mostram a diferença real:

```
org.springframework.boot:spring-boot-starter-web:jar:4.1.0:compile
   ...
   \- org.springframework.boot:spring-boot-webmvc:jar:4.1.0:compile
```

`spring-boot-starter-web` puxa `spring-boot-webmvc` por baixo dos panos. Um `mvn dependency:list` comparando os dois módulos fecha a conta: as mesmas 41 dependências resolvidas nos dois casos, com uma única diferença: o nome do artefato raiz. Hoje, na prática, os dois starters entregam o mesmo classpath. A diferença que importa é outra: `spring-boot-starter-web` está marcado deprecated nos metadados do Maven Central e tende a desaparecer numa release futura.

Essa modularização não é só cosmética de nome. Ela aparece de novo, de um jeito nada óbvio, na seção de [HTTP Service Clients](#http-clients-versioning) logo abaixo: `spring-boot-starter-webmvc` sozinho não é suficiente pra usar a auto-configuration de clients HTTP declarativos. É preciso somar `spring-boot-restclient`, porque essa funcionalidade mora num módulo separado.

## <a name="null-safety">Spring Framework 7: null-safety com JSpecify</a>

Nullability em código Spring sempre foi documentação, não garantia. As anotações antigas de `org.springframework.lang` ajudavam a IDE a sugerir um aviso, mas nada travava o build se um `NullPointerException` estivesse esperando pra acontecer. O Spring Framework 7 adota o [JSpecify](https://jspecify.dev/) como padrão: `@Nullable` do pacote `org.jspecify.annotations`, e `@NullMarked` no nível de pacote pra deixar todo tipo não anotado non-null por padrão.

Sozinho, JSpecify ainda é só metadado. O que transforma isso em erro de compilação é o NullAway, do Uber, plugado via [`nullability-maven-plugin`](https://github.com/making/nullability-maven-plugin). Um `UserRepository` de exemplo devolve `@Nullable User`:

```java
@NullMarked
class UserRepository {
    @Nullable
    User findById(String id) {
        return users.get(id);
    }
}
```

Chamar `findById` sem checar o retorno antes de usar não vira warning de IDE. Vira erro de `javac`:

```
[ERROR] COMPILATION ERROR :
[ERROR] Main.java:[8,56] [NullAway] dereferenced expression 'user' is @Nullable
    (see http://t.uber.com/nullaway )
```

Removi o `if (user != null)` pra ver o que acontecia: o `mvn compile` falha nessa linha exata, antes de rodar uma linha do programa. É esse o ponto central do recurso. O NPE que antes só aparecia numa chamada específica em runtime agora impede o `mvn package` de gerar o jar.

## <a name="http-clients-versioning">Spring Framework 7: HTTP Service Clients e API Versioning</a>

Interfaces `@HttpExchange` já existiam desde o Framework 6 (Boot 3), mas registrar o proxy exigia um `@Bean` manual com `HttpServiceProxyFactory` + `RestClientAdapter`. O Boot 4 automatiza essa parte: a interface vira bean via `@ImportHttpServices`, e a URL base do grupo vem de `application.properties`, sem fábrica escrita à mão.

```java
@HttpExchange("/api/orders")
interface OrdersClient {
    @GetExchange("/{id}")
    Order findById(@PathVariable Long id);
}

@Configuration
@ImportHttpServices(group = "orders", types = OrdersClient.class)
class HttpClientConfig {
}
```

```properties
spring.http.serviceclient.orders.base-url=http://localhost:8085
```

Injetar `OrdersClient` e chamar `findById(1L)` funciona como qualquer outro bean, sem uma linha de implementação escrita. Só que testar isso na prática expõe exatamente o problema que fechou a seção anterior: com só `spring-boot-starter-webmvc` no classpath, a chamada falha em runtime com `IllegalArgumentException: URI with undefined scheme`. O proxy é criado, mas ninguém aplicou o `base-url` configurado, porque a auto-configuration que lê `spring.http.serviceclient.*` mora em `spring-boot-restclient`, um módulo separado do módulo web. Adicionar essa dependência resolve.

Versionamento de API é outra novidade do Framework 7 que o Boot auto-configura. O atributo `version` chega em `@GetMapping`/`@PostMapping` e afins, e `spring.mvc.apiversion.use.*` escolhe como essa versão viaja na requisição (header, path segment, query parameter, media type):

```properties
spring.mvc.apiversion.use.header=X-API-Version
spring.mvc.apiversion.supported=1.0,2.0
spring.mvc.apiversion.default=1.0
```

```java
@GetMapping(path = "/{id}", version = "1.0+")
AccountV1 getAccountV1(@PathVariable long id) { ... }

@GetMapping(path = "/{id}", version = "2.0")
AccountV2 getAccountV2(@PathVariable long id) { ... }
```

Testando isso na prática, `curl -H "X-API-Version: 2.0"` cai no handler certo; `curl` sem header nenhum cai no default. Nenhum `if`/`switch` checando header em lugar nenhum do código: o roteamento entre versões é resolvido pelo próprio dispatcher.

## <a name="security-csrf">Spring Security 7: CSRF ligado por padrão</a>

Essa é a mudança que mais gera 403 inexplicável depois de um upgrade. Em versões anteriores, era comum um projeto REST rodar anos sem notar proteção CSRF: bastava não usar sessão baseada em cookie que ela praticamente não aparecia no caminho. No Security 7, a proteção continua ativa em qualquer `SecurityFilterChain` que não desabilite `.csrf(...)` explicitamente, mesmo sem `formLogin()`. O endpoint sobe, responde 200 no `GET`, e todo `POST` sem token volta 403 sem explicação nenhuma no corpo da resposta.

Reproduzi o fluxo inteiro:

```bash
curl -i -X POST http://localhost:8087/orders -d '{"product":"mouse"}'
# HTTP 403
```

O jeito de resolver de verdade, não só desabilitando CSRF sem entender por quê, é obter o token e mandar de volta. E aqui apareceu um detalhe que a maioria dos tutoriais por aí erra: o valor do cookie `XSRF-TOKEN` não é o valor que vai no header. Desde o Spring Security 5.8, o handler padrão faz um XOR do token antes de expor via `CsrfToken.getToken()`, como proteção contra ataques BREACH. O valor cru fica só no cookie; o valor mascarado é o que precisa ir no header `X-XSRF-TOKEN`:

```bash
curl -c cookies.txt http://localhost:8087/orders/csrf-token
# {"headerName":"X-XSRF-TOKEN","token":"JJPeOcll...(mascarado, NÃO é o valor do cookie)"}

curl -b cookies.txt -H "X-XSRF-TOKEN: JJPeOcll..." -X POST http://localhost:8087/orders -d '{"product":"mouse"}'
# HTTP 200
```

Usar o valor do cookie direto no header, que parece óbvio à primeira vista, dá 403 de novo, mesmo com o cookie certo presente na requisição. Duas APIs relacionadas também sumiram nessa versão. `authorizeRequests()` não existe mais; `authorizeHttpRequests()` já era a alternativa recomendada há um tempo, e agora é a única opção. `WebSecurityConfigurerAdapter` foi removido de vez, então código legado que ainda estende essa classe simplesmente não compila.

Vale o contraponto: pra uma API REST de verdade stateless, autenticada por JWT/OAuth2, sem cookie de sessão em nenhum momento, CSRF não faz sentido: o ataque depende justamente do navegador mandar cookie automaticamente. `.csrf(csrf -> csrf.disable())` combinado com autenticação stateless é configuração válida ali. O problema é fazer isso sem entender por quê, num projeto que ainda usa sessão em algum canto.

## <a name="aot-repositories">Spring Data: AOT Repositories</a>

`ProductRepository.findByNameContainingIgnoreCase(String)` sempre foi "mágica": o Spring Data parseava o nome do método em runtime e montava a query JPQL, repetindo esse trabalho a cada start da aplicação. Com Spring Data 2025.1 (o padrão do Boot 4), `spring.aot.repositories.enabled` já vem `true`: no build, o processamento AOT gera uma classe Java implementando cada query method, com o JPQL já resolvido.

Rodando `mvn spring-boot:process-aot`, o arquivo gerado tem exatamente isso dentro:

```java
public List<Product> findByNameContainingIgnoreCase(String name) {
    String queryString = "SELECT p FROM Product p WHERE UPPER(p.name) LIKE UPPER(:name) ESCAPE '\\'";
    Query query = this.entityManager.createQuery(queryString);
    query.setParameter("name", "%%%s%%".formatted(name != null ? name.toUpperCase() : name));
    return (List<Product>) query.getResultList();
}
```

Nenhuma reflection em runtime pra chegar nesse JPQL: o AOT já resolveu tudo, incluindo o `LIKE ... ESCAPE`, em tempo de build. Se um método referenciar um campo que não existe na entidade, isso quebra o processamento AOT, não a primeira chamada em produção que ninguém tinha testado ainda. `mvn spring-boot:run` sozinho não carrega esse código gerado. É preciso pedir explicitamente com `-Dspring.aot.enabled=true`; sem isso, o comportamento funcional é idêntico, só que resolvido em runtime como sempre foi.

## <a name="observabilidade">Observabilidade: spring-boot-starter-opentelemetry</a>

Ligar OpenTelemetry num projeto Spring Boot antes significava escolher e alinhar na mão `micrometer-tracing-bridge-otel`, `opentelemetry-exporter-otlp`, `micrometer-registry-otlp`, torcendo pras versões baterem entre si. `spring-boot-starter-opentelemetry` resolve isso como starter único, com uma combinação de versões já testada.

Configurar isso na prática expôs o problema mais sutil deste post inteiro. Existem duas famílias de propriedades parecidas pra apontar o endpoint OTLP de traces, e só uma cria o bean de exportação de verdade nesta versão:

```properties
# parece óbvia, mas NÃO é a que funciona:
management.otlp.tracing.endpoint=http://localhost:4318/v1/traces

# essa é a que realmente resolve o bean de conexão:
management.opentelemetry.tracing.export.otlp.endpoint=http://localhost:4318/v1/traces
```

Sem rodar com `--debug` e ler o `ConditionEvaluationReport` linha por linha, esse tipo de auto-configuration que silenciosamente não configurou nada é fácil de não notar: a aplicação sobe normalmente, sem erro nenhum, só que nenhum trace nunca sai. Com a propriedade certa, os dois exports chegam no coletor:

```
[OTLP receiver] POST /v1/metrics #1 -- 8876 bytes recebidos
[OTLP receiver] POST /v1/traces #1 -- 1895 bytes recebidos
```

## <a name="jackson3">Jackson 3, com compatibilidade Jackson 2</a>

Jackson 3 renomeou os pacotes principais: `com.fasterxml.jackson.databind` virou `tools.jackson.databind`, group ID e namespace novos, não só uma versão maior. O Boot 4 já vem com Jackson 3 como padrão. Quem depende de uma lib de terceiro que só conhece o `ObjectMapper` antigo não precisa reescrever tudo de uma vez: o módulo `spring-boot-jackson2` (deprecated, mas funcional) sobe um `ObjectMapper` Jackson 2 de verdade, coexistindo com o Jackson 3.

Uma coisa que não mudou: `jackson-annotations` continua em `com.fasterxml.jackson.core`, pacote `com.fasterxml.jackson.annotation`. `@JsonProperty` é o mesmo de sempre pros dois. Serializar o mesmo record com os dois mappers dá o mesmo JSON:

```
tools.jackson.databind.ObjectMapper (Jackson 3, padrão do Boot 4):
  {"product_name":"teclado mecânico","price":450.0}
com.fasterxml.jackson.databind.ObjectMapper (Jackson 2, via spring-boot-jackson2):
  {"product_name":"teclado mecânico","price":450.0}
mesma classe, mesma anotação @JsonProperty, os dois mappers concordam: true
```

Pra código que só faz serialização/desserialização simples, a migração é praticamente transparente. O que quebra de verdade é código que importa classes internas do pacote antigo diretamente: customizers e módulos Jackson de terceiros ainda não portados pro namespace novo.

## <a name="como-migrar">Como migrar na prática</a>

O guia oficial recomenda um caminho específico: primeiro atualizar pra última versão do Boot 3.5, limpar todo warning de deprecation que aparecer, só então subir pro 4.0/4.1. Boot 4 remove métodos, classes e propriedades que já estavam deprecated no 3.x, então pular direto do 3.1 ou 3.2 pro 4 multiplica a lista de coisas quebrando de uma vez.

Um checklist rápido do que mais costuma pegar, na ordem em que apareceu neste post:

- **Starters renomeados.** `spring-boot-starter-web` → `spring-boot-starter-webmvc`, e o mesmo padrão pros outros módulos. O nome antigo ainda funciona (deprecated), mas troque cedo.
- **CSRF virou 403 silencioso.** Todo teste de integração que faz `POST`/`PUT`/`DELETE` sem token de CSRF passa a falhar. Ou o teste usa `with(csrf())` do `MockMvc`, ou a API é genuinamente stateless e `.csrf(csrf -> csrf.disable())` é a configuração certa, não gambiarra.
- **`authorizeRequests()` e `WebSecurityConfigurerAdapter` não compilam mais.** Se o projeto ainda tem isso, precisa migrar pra `authorizeHttpRequests()` e `SecurityFilterChain` como bean antes mesmo de cogitar o Boot 4.
- **Servlet 6.1 / Jakarta EE 11 como baseline.** Suporte a Undertow foi removido; quem usava esse servidor embarcado precisa migrar pra Tomcat 11 ou Jetty 12.1.
- **GraalVM native-image 25+** pra quem builda imagem nativa.
- **Jackson 2 direto no classpath** (bibliotecas de terceiro que ainda dependem dele) pode exigir o módulo de compatibilidade `spring-boot-jackson2` até tudo migrar.

Ferramentas ajudam bastante aqui: existem recipes do [OpenRewrite](https://docs.openrewrite.org/recipes/java/spring/boot4/upgradespringboot_4_0-community-edition) que automatizam boa parte da troca de starters e de APIs. Vale rodar num branch separado e revisar o diff, não aplicar direto em produção.

## <a name="consideracoes-finais">Considerações finais</a>

Nenhum dos exemplos deste post exigiu gambiarra pra funcionar, mas quase todos exigiram mais investigação do que a documentação de superfície sugere. A modularização é a mudança que mais se repete: ela não aparece só como rename de starter; ela é a causa raiz de pelo menos dois outros problemas deste post. O `HttpServiceClientAutoConfiguration` que precisa de uma dependência extra é um deles. A confusão entre `management.otlp.tracing.*` e `management.opentelemetry.tracing.export.otlp.*` é outra. Quando alguma auto-configuration parecer não estar funcionando sem erro nenhum no log, rodar com `--debug` e ler o `ConditionEvaluationReport` economiza mais tempo do que qualquer busca no Stack Overflow.

**O que já vale adotar direto**: null-safety com JSpecify, mesmo que só como documentação por enquanto, sem NullAway ainda. HTTP Service Clients no lugar de `RestTemplate`/`WebClient` cru pra integrações simples. API Versioning nativo em vez de convenção de path manual. E migrar os starters pro nome novo desde já.

**O que pede mais cuidado**: CSRF por padrão exige revisar toda superfície de API state-changing antes do deploy, não só rodar os testes e ver o que quebra. AOT Repositories vale testar num serviço não crítico primeiro: é uma boa troca mover a validação de query de runtime pra build-time, mas continua sendo uma mudança de comportamento.

## <a name="referencias">Referências</a>

**Spring Boot 4 e Spring Framework 7**

- [Spring Boot 4.0 Release Notes](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Release-Notes)
- [Spring Boot 4.0 Migration Guide](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide)
- [Modularizing Spring Boot](https://spring.io/blog/2025/10/28/modularizing-spring-boot/)
- [Null-safe applications with Spring Boot 4](https://spring.io/blog/2025/11/12/null-safe-applications-with-spring-boot-4/)
- [Null safety in Spring applications with JSpecify and NullAway](https://spring.io/blog/2025/03/10/null-safety-in-spring-apps-with-jspecify-and-null-away/)
- [HTTP Service Client Enhancements](https://spring.io/blog/2025/09/23/http-service-client-enhancements/)
- [API Versioning in Spring](https://spring.io/blog/2025/09/16/api-versioning-in-spring/)
- [Introducing Jackson 3 support in Spring](https://spring.io/blog/2025/10/07/introducing-jackson-3-support-in-spring/)

**Spring Data**

- [Spring Data Ahead of Time Repositories](https://spring.io/blog/2025/05/22/spring-data-ahead-of-time-repositories/)
- [Spring Data Ahead of Time Repositories - Part 2](https://spring.io/blog/2025/11/25/spring-data-ahead-of-time-repositories-part-2/)

**Ferramentas de migração**

- [OpenRewrite: Migrate to Spring Boot 4.0](https://docs.openrewrite.org/recipes/java/spring/boot4/upgradespringboot_4_0-community-edition)
