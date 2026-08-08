---
title: "Collections no Java 25: guia completo de List, Set, Queue, Deque, Map e concorrência"
slug: colecoes-java-25
date: 2026-08-08
banner_image: colecoes-java-25.png
description: Um review técnico do Collections Framework no Java 25, com os internals de ArrayList, LinkedList, HashSet, TreeSet, ArrayDeque, PriorityQueue, HashMap, TreeMap e das principais coleções concorrentes, cobrindo algoritmos, complexidade e quando usar cada uma.
categories:
  - Java
  - Tutoriais
comments: true
---

`List<String> lista = new ArrayList<>();`. Você já deve ter escrito uma linha parecida centenas de vezes. O Collections Framework é a base de praticamente todo programa Java: é ele que segura a lista de pedidos, o conjunto de permissões, o mapa de configuração, qualquer coisa que apareça agrupada. Provavelmente é a API mais usada do JDK inteiro, e por isso mesmo vale a pena revisitar com calma.

Por baixo dessas classes conhecidas acontece bastante coisa interessante: um `HashMap` reorganiza buckets inteiros conforme cresce, um `ArrayDeque` evita realocações que uma `LinkedList` não evitaria, um `ConcurrentHashMap` consegue deixar duas threads escrevendo ao mesmo tempo sem se atrapalharem. Entender esses detalhes ajuda a escolher com mais segurança na hora de decidir entre `ArrayList` e `LinkedList`, ou entre `HashMap` e `ConcurrentHashMap`.

Este post é um review técnico do que temos disponível no Java 25: as implementações de `List`, `Set`, `Queue`, `Deque` e `Map`, os algoritmos por trás de cada uma, e as coleções pensadas pra concorrência. A ideia não é ensinar a API, isso o Javadoc já faz bem. A ideia é mostrar o que acontece por trás de cada escolha e quando ela realmente compensa.

## Conteúdo

- [Visão geral: a hierarquia do Collections Framework](#visao-geral)
- [Coleções imutáveis: List.of, Set.of, Map.of](#imutaveis)
- [List: ArrayList, LinkedList e por que Vector morreu](#list)
- [Set: HashSet, LinkedHashSet, TreeSet e EnumSet](#set)
- [Queue e Deque: ArrayDeque e PriorityQueue](#queue-deque)
- [Map: o coração do framework](#map)
- [SequencedCollection na prática](#sequenced)
- [Concorrência: as coleções do java.util.concurrent](#concorrencia)
- [Guia de decisão: qual usar quando](#guia-decisao)
- [Considerações finais](#consideracoes-finais)
- [Referências](#referencias)

## <a name="visao-geral">Visão geral: a hierarquia do Collections Framework</a>

A raiz é a interface `Collection`, que se ramifica em três famílias. `List` é uma sequência ordenada, com índice, que aceita duplicatas. `Set` não aceita duplicatas, e cada implementação define sua própria noção de ordem, ou ausência dela. `Queue` é uma fila com semântica de entrada e saída, e `Deque` estende `Queue` pras duas pontas. `Map` fica de fora dessa árvore de propósito: ele associa chave a valor, não guarda "elementos" soltos, então não faz sentido implementar `Collection`.

```goat
                    +--------------+              +-----+
                    |  Collection  |              | Map |
                    +--------------+              +-----+
                     /     |      \                  |
                    v      v       v                 v
              +------+  +-----+  +-------+   +---------------+
              | List |  | Set |  | Queue |   | HashMap       |
              +------+  +-----+  +---+---+   | TreeMap       |
                                     |       | LinkedHashMap |
                                     v       +---------------+
                                 +-------+
                                 | Deque |
                                 +-------+
```

Desde o Java 21, pelo JEP 431, existe uma quarta camada que corta essas famílias na horizontal: `SequencedCollection`, `SequencedSet` e `SequencedMap` unificam o conceito de "primeiro" e "último" elemento, que antes era resolvido de um jeito diferente pra cada tipo. Já cobrimos o básico dessas interfaces [no post sobre Java 17 para 25](/blog/java-17-para-25/#sequenced-collections), inclusive o detalhe de `reversed()` devolver view, não cópia. Aqui vamos direto pro que aquele post não cobriu: os internals de cada implementação e como elas se comportam sob concorrência.

## <a name="imutaveis">Coleções imutáveis: List.of, Set.of, Map.of</a>

Antes de entrar nas implementações mutáveis, vale fechar um buraco que a maioria dos exemplos deste post usa sem explicar: `List.of(...)`, `Set.of(...)` e `Map.of(...)`, trazidos pelo JEP 269 no Java 9. Diferentemente de um `new ArrayList<>()`, o que essas factories devolvem não é só "uma coleção que você não deveria mutar", é uma coleção genuinamente imutável, que lança exceção se você tentar:

```java
List<Integer> imutavel = List.of(1, 2, 3);
imutavel.add(4); // UnsupportedOperationException

List.of(1, null, 3); // NullPointerException -- List.of() nunca aceita null
```

Isso é diferente de duas outras coisas com nome parecido. `Arrays.asList(...)` devolve uma lista de tamanho fixo, sem `add`/`remove`, mas `set(i, valor)` funciona, porque por baixo ela é uma view sobre o array original, não uma cópia. `Collections.unmodifiableList(lista)` também não é imutável de verdade: é só uma view que bloqueia mutação _através dela_, mas se alguém segura uma referência pra `lista` original e chama `lista.add(...)`, a mudança aparece do outro lado.

```java
List<Integer> base = new ArrayList<>(List.of(1, 2, 3));
List<Integer> copia = List.copyOf(base); // cópia de verdade, desde o Java 10
base.add(4);
System.out.println(base);  // [1, 2, 3, 4]
System.out.println(copia); // [1, 2, 3] -- não mudou
```

Essas factories aparecem sem anúncio em vários lugares que você já usa. Desde o Java 16, `Stream.toList()` devolve exatamente esse tipo de lista imutável, diferente do antigo `Collectors.toList()`, que nunca deu nenhuma garantia sobre o tipo concreto devolvido. Na prática costumava ser um `ArrayList` mutável, mas isso nunca foi contrato, só implementação.

Um detalhe de implementação interessante: a ordem de iteração de `Set.of()` e `Map.of()` não é só "não documentada", ela é embaralhada de propósito. O JDK sorteia um salt aleatório, baseado em `System.nanoTime()`, uma única vez quando a JVM sobe e usa esse salt pra decidir a ordem interna dos elementos. Na mesma execução do programa, duas chamadas de `Set.of()` com os mesmos elementos sempre mostram a mesma ordem entre si, mas rodar o programa de novo pode embaralhar diferente. É proposital: existe justamente pra quebrar código que "por acaso" funcionava assumindo uma ordem estável.

## <a name="list">List: ArrayList, LinkedList e por que Vector morreu</a>

`ArrayList` é um array que cresce. Por trás do `add()`, existe um `Object[]` com capacidade maior que o tamanho lógico da lista. Quando esse array enche, o `ArrayList` aloca um array novo com 1.5x da capacidade antiga (`oldCapacity + (oldCapacity >> 1)`) e copia tudo. Isso é amortizado: a maioria dos `add()` é O(1), só o resize ocasional custa O(n). Na prática, se você já sabe o tamanho aproximado, `new ArrayList<>(tamanhoEsperado)` evita cópias desnecessárias.

`LinkedList` é uma lista duplamente encadeada. Cada elemento vive num `Node` com ponteiro pro anterior e pro próximo. Inserir ou remover no início ou no fim é O(1) de verdade, sem cópia de array. O problema é que quase ninguém precisa dessa garantia: inserir no meio de uma lista via índice continua sendo O(n) pra percorrer até lá, e acesso aleatório por índice (`get(i)`) também é O(n), contra O(1) do `ArrayList`. Na prática, `LinkedList` só vale a pena quando você já está posicionado no nó certo via `ListIterator` e insere/remove ali repetidamente, sem depender de índice. Isso é raro.

```java
List<String> arrayList = new ArrayList<>();
arrayList.add("a");
arrayList.add("b");
arrayList.addFirst("z"); // SequencedCollection, Java 21+
System.out.println(arrayList); // [z, a, b]
System.out.println(arrayList.getFirst() + " / " + arrayList.getLast()); // z / b
```

Esses detalhes de implementação aparecem em lugares que talvez você não esperasse. O Hibernate, por exemplo, mapeia um campo `List<T>` sem `@OrderColumn` como bag, uma coleção que aceita duplicatas e não garante posição fixa dos elementos (`PersistentBag`), guardado por baixo num `ArrayList` puro, com exatamente as mesmas características de crescimento e acesso que acabamos de ver. E frameworks de configuração como o `@ConfigMapping` do Quarkus fazem bind direto de uma lista do `application.properties` pra uma interface `List<String>`, sem exigir nenhum código de parsing manual.

`Vector` e `Stack` ainda existem no JDK 25, mas são peças de museu: toda operação é `synchronized`, mesmo em código single-thread, o que custa performance à toa. `Stack` além disso estende `Vector`, herdando métodos de lista que não fazem sentido numa pilha. Pra pilha ou fila, a resposta hoje é `ArrayDeque`. Pra lista sincronizada de verdade, a resposta é `Collections.synchronizedList(new ArrayList<>())` ou, melhor ainda, uma das coleções concorrentes que vemos mais adiante.

Regra de bolso: comece com `ArrayList`. Só troque por `LinkedList` se você já mediu o gargalo e ele é especificamente inserção/remoção nas pontas ou via iterator, não índice.

## <a name="set">Set: HashSet, LinkedHashSet, TreeSet e EnumSet</a>

`HashSet` é, por baixo dos panos, um `HashMap<E, Object>` em que o elemento vira chave e o valor é uma constante interna (`PRESENT`). Isso significa que ele herda tudo do `HashMap`: hashing, buckets, resize, e a ordem de iteração não é garantida. Ela pode mudar entre execuções, ou até depois de um resize interno.

```java
Set<String> hash = new HashSet<>();
hash.add("banana");
hash.add("abacaxi");
hash.add("caju");
System.out.println(hash); // ordem não garantida
```

É exatamente o que o Hibernate faz por baixo quando você mapeia uma associação `@OneToMany`/`@ManyToMany` como `Set<T>`: a implementação padrão (`PersistentSet`) é um `HashSet` de verdade, o que significa que a entidade mapeada precisa de `equals()`/`hashCode()` consistentes, ou registros somem ou duplicam silenciosamente dentro da coleção.

`LinkedHashSet` resolve isso mantendo, além do `HashMap` interno, uma lista duplamente encadeada de entradas na ordem de inserção. O custo é a memória extra dos ponteiros dessa lista por elemento, mas a ordem passa a ser previsível, e desde o Java 21 ele já implementa `SequencedSet` de graça:

```java
SequencedSet<String> linkedHash = new LinkedHashSet<>();
linkedHash.add("banana");
linkedHash.add("abacaxi");
linkedHash.add("caju");
System.out.println(linkedHash);           // [banana, abacaxi, caju]
System.out.println(linkedHash.getFirst()); // banana
```

É o mesmo motivo pelo qual o Spring usa `LinkedHashSet`, não `HashSet`, quando você injeta `Set<MinhaInterface>` com `@Autowired`: precisa preservar a ordem de `@Order`/`Ordered` entre os beans, e um `HashSet` puro destruiria essa ordem.

`TreeSet` mantém os elementos ordenados, pela ordem natural ou por um `Comparator` customizado, implementado como uma árvore rubro-negra. Toda operação básica, `add`, `remove`, `contains`, é O(log n), mais cara que o O(1) amortizado do `HashSet`, mas em troca você ganha `NavigableSet`: navegação relativa a um valor, sem precisar iterar tudo.

```java
NavigableSet<Integer> tree = new TreeSet<>(Set.of(5, 1, 9, 3, 7));
System.out.println(tree); // [1, 3, 5, 7, 9]
tree.ceiling(4); // 5 -- o menor elemento >= 4
tree.floor(4);   // 3 -- o maior elemento <= 4
tree.higher(5);  // 7 -- estritamente maior que 5
tree.lower(5);   // 3 -- estritamente menor que 5
```

`EnumSet` é o mais especializado dos quatro: só aceita valores de um único tipo enum, e por dentro é literalmente um bitmask: um `long` se o enum tem até 64 valores, um `long[]` se tem mais. `add`, `remove` e `contains` viram operações de bit, o que é ordens de magnitude mais rápido e mais compacto em memória do que qualquer `Set` genérico. Se seu conjunto é de enum, não há motivo pra usar outra coisa. Um uso real disso está no próprio `java.nio.file`: `PosixFilePermissions.asFileAttribute(EnumSet.of(OWNER_READ, OWNER_WRITE, ...))` é o jeito idiomático de montar permissões de arquivo Unix na hora de criar um arquivo com `Files.createFile`.

## <a name="queue-deque">Queue e Deque: ArrayDeque e PriorityQueue</a>

`ArrayDeque` é hoje a escolha default pra pilha e pra fila. Por dentro é um array circular redimensionável, igual ao `ArrayList`, mas com dois ponteiros, cabeça e cauda. Isso deixa inserir e remover nas duas pontas O(1) amortizado, sem precisar deslocar elementos. Ele substitui `Stack`, mais rápido e sem sincronização desnecessária, e, na prática, quase sempre substitui `LinkedList` como fila, com menos overhead de alocação por elemento, ou seja, menos memória e processamento gastos só pra criar cada posição. Um detalhe pra prestar atenção: `ArrayDeque` não aceita `null` como elemento. Ele usa `null` internamente como sinalizador de posição vazia.

```java
Deque<Integer> stack = new ArrayDeque<>();
stack.push(1); stack.push(2); stack.push(3);
stack.pop(); // 3 -- LIFO

Queue<Integer> queue = new ArrayDeque<>();
queue.offer(1); queue.offer(2); queue.offer(3);
queue.poll(); // 1 -- FIFO
```

`PriorityQueue` é um heap binário: cada `offer`/`poll` custa O(log n), reorganizando o heap pra manter na raiz o menor elemento, ou o definido pelo `Comparator`. `peek()` pra ver o próximo sem remover é O(1). Não é uma fila FIFO: a ordem de saída segue a prioridade, não a ordem de chegada.

```java
record Task(String name, int priority) {}

PriorityQueue<Task> pq = new PriorityQueue<>(Comparator.comparingInt(Task::priority));
pq.offer(new Task("deploy", 3));
pq.offer(new Task("hotfix", 1));
pq.offer(new Task("refactor", 5));

while (!pq.isEmpty()) {
    System.out.println(pq.poll());
}
// Task[name=hotfix, priority=1]
// Task[name=deploy, priority=3]
// Task[name=refactor, priority=5]
```

Vale reparar num detalhe aqui: iterar um `PriorityQueue` com `for-each` **não** devolve os elementos em ordem de prioridade, só `poll()` sucessivo garante isso. O iterator percorre o array interno do heap na ordem em que ele está fisicamente organizado, que não é a ordem lógica da fila.

O próprio JDK usa esse princípio internamente: o `ScheduledThreadPoolExecutor`, por trás de `Executors.newScheduledThreadPool()`, guarda as tarefas agendadas numa fila interna organizada como heap binário, a `DelayedWorkQueue`, pra sempre saber qual tarefa é a próxima a executar sem precisar reordenar a fila inteira a cada novo agendamento.

## <a name="map">Map: o coração do framework</a>

Se há uma implementação que vale a pena entender de verdade, é o `HashMap`. Por dentro, ele é um array de buckets, as posições onde as entradas ficam guardadas (`Node<K,V>[] table`). A posição de uma chave nesse array vem do hash dela, espalhado por uma função extra (`h ^ (h >>> 16)`) que mistura os bits altos com os baixos, reduzindo colisão quando o `hashCode()` original é fraco. Quando duas chaves caem no mesmo bucket, elas viram uma lista encadeada.

Um detalhe importante: se um bucket específico acumula 8 ou mais colisões **e** a tabela inteira já tem pelo menos 64 posições, esse bucket deixa de ser lista encadeada e vira uma árvore rubro-negra. Busca num bucket treeificado cai de O(n) pra O(log n). É uma proteção contra o pior caso: alguém forçando colisões de propósito, ou um `hashCode()` mal implementado que sempre devolve a mesma constante. Não é o caminho normal: na maioria dos `HashMap` do dia a dia, os buckets nunca chegam perto disso.

```goat
table (array de buckets)
 [0] -> null
 [1] -> Node(k1) -> Node(k2) -> Node(k3)    lista encadeada, poucas colisões
 [2] -> null
 [3] -> TreeNode(k4)              8+ colisões no bucket e tabela >= 64 slots
        /         \                 vira árvore rubro-negra, busca O(log n)
   TreeNode      TreeNode
```

```java
record CollidingKey(int id) {
    @Override
    public int hashCode() { return 42; } // força todas as chaves no mesmo bucket
}

Map<CollidingKey, Integer> colliding = new HashMap<>();
for (int i = 0; i < 20; i++) colliding.put(new CollidingKey(i), i);
colliding.get(new CollidingKey(10)); // 10 -- continua correto, só mais lento pra achar
```

O outro lado da história é o resize: quando o número de entradas passa de `capacidade × loadFactor`, 0.75 por padrão, a tabela dobra de tamanho e todo mundo é realocado. Isso é O(n) e acontece de vez em quando, então, igual no `ArrayList`, se você sabe o tamanho aproximado, `new HashMap<>(tamanhoEsperado)` economiza resizes.

`LinkedHashMap` adiciona ordenação por cima do `HashMap`, assim como o `LinkedHashSet` faz com `HashSet`. Além da ordem de inserção, ele suporta `accessOrder = true`, que reordena a cada `get()`, movendo o elemento acessado pro fim. Combinado com `removeEldestEntry`, isso vira um cache LRU em poucas linhas:

```java
class LruCache<K, V> extends LinkedHashMap<K, V> {
    private final int maxSize;
    LruCache(int maxSize) {
        super(16, 0.75f, true); // accessOrder = true
        this.maxSize = maxSize;
    }
    @Override
    protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
        return size() > maxSize;
    }
}

var lru = new LruCache<Integer, String>(3);
lru.put(1, "um"); lru.put(2, "dois"); lru.put(3, "tres");
lru.get(1);          // acessa 1, ele vai pro fim da ordem
lru.put(4, "quatro"); // expulsa o 2, que era o menos recentemente usado
System.out.println(lru); // {3=tres, 1=um, 4=quatro}
```

O `LinkedHashMap` não é só um truque de exercício de faculdade: é literalmente o que o Jackson usa por padrão quando desserializa um objeto JSON sem tipo concreto declarado, pra `Map<String, Object>`, por exemplo. A implementação escolhida é `LinkedHashMap`, exatamente pra preservar a ordem das chaves como elas apareciam no JSON original.

`TreeMap` é pro `Map` o que `TreeSet` é pro `Set`: árvore rubro-negra, chaves ordenadas, O(log n) pras operações básicas, e `NavigableMap` com `ceilingKey`, `floorEntry` e afins.

Pra casos específicos, o JDK ainda oferece três implementações menos comuns. `EnumMap` faz pra `Map` o que `EnumSet` faz pra `Set`: chave é enum, por dentro é um array indexado pela posição ordinal do enum, e a iteração segue a ordem de declaração do enum, não a de inserção. `WeakHashMap` guarda a chave com uma referência fraca: se não existe mais nenhuma referência forte pra chave em outro lugar do programa, o coletor de lixo pode remover a entrada inteira, o que é útil pra caches que não devem impedir a liberação de memória. E `IdentityHashMap` compara chaves com `==` em vez de `equals()`, útil em frameworks de serialização ou travessia de grafos de objetos, em que duas instâncias "iguais" pelo `equals()` precisam ser tratadas como entradas diferentes.

```java
String k1 = new String("chave");
String k2 = new String("chave"); // equals() == true, mas é outra instância

Map<String, Integer> identity = new IdentityHashMap<>();
identity.put(k1, 1);
identity.put(k2, 2);
identity.size(); // 2 -- num HashMap normal, seria 1
```

Não é um caso hipotético: a própria documentação do `IdentityHashMap` cita serialização e cópia profunda de grafos de objeto como o uso clássico dessa classe, que é exatamente o que o `ObjectOutputStream` do JDK precisa por baixo dos panos pra não serializar o mesmo objeto duas vezes quando duas referências apontam pro mesmo lugar.

## <a name="sequenced">SequencedCollection na prática</a>

O [post sobre Java 17 para 25](/blog/java-17-para-25/#sequenced-collections) já cobre a API básica de `SequencedCollection`/`SequencedSet`/`SequencedMap` e o detalhe de `reversed()` devolver uma view. O que vale aprofundar aqui é: quem ganhou essas interfaces de graça e quem ficou de fora.

`ArrayList`, `ArrayDeque`, `LinkedHashSet`, `LinkedHashMap` e `TreeMap`, que chega lá via `NavigableMap`, implementam `SequencedCollection`/`SequencedSet`/`SequencedMap` porque todos eles já tinham uma noção clara de ordem antes da interface existir: posição no array, ordem de inserção, ou ordenação por comparação. `HashSet` e `HashMap` ficaram de fora de propósito: eles nunca prometeram ordem nenhuma, então não faria sentido expor `getFirst()`/`getLast()` numa coleção cujo "primeiro elemento" pode mudar sozinho entre duas chamadas, sem que nada tenha sido inserido ou removido.

```java
SequencedCollection<Integer> list = new ArrayList<>(List.of(1, 2, 3));
SequencedCollection<Integer> reversed = list.reversed();
System.out.println(reversed); // [3, 2, 1]

list.addFirst(0);
System.out.println(list);     // [0, 1, 2, 3]
System.out.println(reversed); // [3, 2, 1, 0] -- a view reflete a mudança, sem recalcular nada
```

Como é uma adição recente, do Java 21, o uso mais visível ainda está em código novo: conforme frameworks como Spring Boot e Quarkus vão exigindo um baseline de JDK mais alto nas versões recentes, é cada vez mais comum ver `getFirst()`/`getLast()` substituindo o antigo `get(0)`/`get(lista.size() - 1)`.

## <a name="concorrencia">Concorrência: as coleções do java.util.concurrent</a>

Toda coleção que vimos até aqui quebra sob concorrência sem proteção externa. Não é um "pode ter comportamento estranho": um `HashMap` acessado por múltiplas threads sem sincronização pode entrar em loop infinito internamente em cenários de resize simultâneo. `java.util.concurrent` existe pra resolver isso sem forçar um `synchronized` bruto em tudo.

`ConcurrentHashMap` é o mais usado do pacote. Vale contextualizar de onde ele evoluiu: `Hashtable`, presente desde o Java 1.0, resolve concorrência do jeito mais simples possível, um único `synchronized` protegendo a tabela inteira. Funciona, mas serializa até leituras que não têm nada a ver uma com a outra. É a mesma categoria de peça de museu que `Vector` e `Stack`: ainda compila, ninguém deveria escolher pra código novo. Até o Java 7, `ConcurrentHashMap` melhorava isso dividindo a tabela em segmentos com um lock por segmento. Desde o Java 8, a estratégia mudou de novo: inserir numa posição vazia usa CAS (compare-and-swap), sem lock nenhum, e só quando já existe uma cadeia de nós naquele bucket é que a JVM sincroniza no nó cabeça daquele bucket específico, não na tabela inteira. Duas threads escrevendo em buckets diferentes nunca se bloqueiam uma à outra.

```goat
Hashtable (Java 1.0): um lock global
+---------------------------------------------+
| synchronized(this) protege a tabela inteira |
+---------------------------------------------+
  thread A escreve bucket[3]  -->  thread B espera, mesmo lendo bucket[9]

ConcurrentHashMap (Java 8+): lock por bucket + CAS
  bucket[3]: synchronized só nesse nó   <- thread A escreve aqui
  bucket[9]: CAS, sem lock nenhum       <- thread B lê/escreve, sem esperar A
```

```java
Map<String, Integer> counts = new ConcurrentHashMap<>();
try (ExecutorService pool = Executors.newVirtualThreadPerTaskExecutor()) {
    for (int i = 0; i < 10_000; i++) {
        pool.submit(() -> counts.merge("cliques", 1, Integer::sum));
    }
}
System.out.println(counts.get("cliques")); // 10000, sempre -- merge() é atômico por chave
```

Não é um exemplo de brinquedo: o Spring usa exatamente essa classe pra guardar o cache de singletons do container. O campo `singletonObjects` do `DefaultSingletonBeanRegistry`, que segura toda instância de bean já criada na aplicação, é um `ConcurrentHashMap`.

`CopyOnWriteArrayList` e `CopyOnWriteArraySet` seguem uma estratégia radicalmente diferente: toda escrita copia o array inteiro. Isso parece caro, e de fato é, se você escreve com frequência, mas em compensação leitura e iteração nunca bloqueiam e nunca lançam `ConcurrentModificationException`, porque cada iterator trabalha sobre um snapshot congelado do array no momento em que foi criado. É a escolha certa pra listas de listeners ou configuração lida o tempo todo e alterada raramente, e é literalmente o caso de uso que a própria documentação da classe recomenda: implementações do padrão observer, em que iteração acontece muito mais que mutação.

```java
List<Integer> cow = new CopyOnWriteArrayList<>(List.of(1, 2, 3));
for (Integer i : cow) {
    if (i == 2) cow.add(99); // não lança ConcurrentModificationException
}
System.out.println(cow); // [1, 2, 3, 99]
```

Pra padrões produtor/consumidor, o pacote oferece `BlockingQueue` e algumas implementações com trade-offs diferentes. `ArrayBlockingQueue` é limitada, baseada em array, com um único lock compartilhado entre `put` e `take`. `LinkedBlockingQueue` pode ser limitada ou não, baseada em nós encadeados, e usa dois locks separados, um pra inserir e outro pra remover, o que dá mais throughput, mais tarefas processadas por segundo, quando produtores e consumidores trabalham ao mesmo tempo. `PriorityBlockingQueue` é ilimitada e ordenada, a versão bloqueante do `PriorityQueue`. `SynchronousQueue` tem capacidade zero: cada `put` só retorna quando existe um `take` esperando do outro lado, um handoff direto, a tarefa passa de uma thread pra outra sem ficar parada numa fila no meio do caminho. `DelayQueue` só libera elementos depois que o delay configurado neles expira, útil pra agendamento.

```java
BlockingQueue<Integer> bq = new ArrayBlockingQueue<>(5);
Thread consumer = new Thread(() -> {
    try {
        for (int i = 0; i < 5; i++) {
            Integer v = bq.poll(2, TimeUnit.SECONDS);
            // processa v
        }
    } catch (InterruptedException ignored) {}
});
consumer.start();
for (int i = 0; i < 5; i++) bq.put(i); // bloqueia se a fila encher
consumer.join();
```

Essas escolhas não são só teoria de curso: são exatamente o que os factory methods de `Executors` usam por baixo pra decidir como enfileirar tarefas esperando por uma thread livre. `Executors.newFixedThreadPool()` usa `LinkedBlockingQueue`; `Executors.newCachedThreadPool()` usa `SynchronousQueue`, pra forçar a criação de uma thread nova sempre que não há uma ociosa; `Executors.newScheduledThreadPool()` usa a `DelayedWorkQueue` baseada em heap que já vimos na seção de `PriorityQueue`.

Quando o bloqueio precisa acontecer nas duas pontas, não só numa fila FIFO, `BlockingDeque`, implementada por `LinkedBlockingDeque`, é a versão bloqueante do `Deque`: `putFirst`/`putLast` e `takeFirst`/`takeLast` bloqueiam a thread até ter espaço ou elemento disponível. E pra handoff direto com mais controle que o `SynchronousQueue`, existe `TransferQueue`, implementada por `LinkedTransferQueue`: `tryTransfer` só retorna sucesso quando o elemento foi de fato entregue a um consumidor esperando em `take()`, dando um jeito de aplicar backpressure real ao produtor, ou seja, de frear quem produz quando quem consome não dá conta do ritmo.

```java
BlockingDeque<Integer> bd = new LinkedBlockingDeque<>();
bd.putFirst(1);
bd.putLast(2);
bd.takeFirst(); // 1
bd.takeLast();  // 2

TransferQueue<String> tq = new LinkedTransferQueue<>();
// numa thread consumidora: tq.take() bloqueia até alguém chamar transfer/tryTransfer
tq.tryTransfer("evento", 1, TimeUnit.SECONDS); // só retorna true se alguém consumiu
```

`ConcurrentLinkedQueue` e `ConcurrentLinkedDeque` são não-bloqueantes, baseadas no algoritmo de Michael-Scott: inserção e remoção usam CAS em vez de lock, então nenhuma thread jamais fica parada esperando outra. O trade-off é que `size()` não é O(1) nelas, já que precisa percorrer a estrutura toda, diferente da maioria das outras coleções.

Por fim, `ConcurrentSkipListMap` e `ConcurrentSkipListSet` são a versão concorrente e ordenada do `TreeMap`/`TreeSet`, implementadas com uma skip list em vez de árvore rubro-negra. Árvores balanceadas são difíceis de manter corretas sob escrita concorrente sem lock, e skip lists se prestam bem melhor a isso. Complexidade O(log n) esperada, sem lock global, mantendo a ordenação.

```java
var skip = new ConcurrentSkipListMap<Integer, String>();
skip.put(3, "tres"); skip.put(1, "um"); skip.put(2, "dois");
System.out.println(skip);          // {1=um, 2=dois, 3=tres} -- sempre ordenado
System.out.println(skip.firstKey()); // 1
```

## <a name="guia-decisao">Guia de decisão: qual usar quando</a>

Complexidade amortizada/esperada pras operações mais comuns, sem benchmarks reais, só a análise assintótica de cada algoritmo:

| Implementação                     | get/contains    | insert                               | delete            | ordenada?       |
| --------------------------------- | --------------- | ------------------------------------ | ----------------- | --------------- |
| `ArrayList`                       | O(1) por índice | O(1) amortizado no fim, O(n) no meio | O(n)              | não             |
| `LinkedList`                      | O(n)            | O(1) nas pontas                      | O(1) nas pontas   | não             |
| `ArrayDeque`                      | O(1) nas pontas | O(1) amortizado nas pontas           | O(1) nas pontas   | não             |
| `PriorityQueue`                   | O(1) peek       | O(log n)                             | O(log n)          | por prioridade  |
| `HashSet` / `HashMap`             | O(1) amortizado | O(1) amortizado                      | O(1) amortizado   | não             |
| `LinkedHashSet` / `LinkedHashMap` | O(1) amortizado | O(1) amortizado                      | O(1) amortizado   | inserção/acesso |
| `TreeSet` / `TreeMap`             | O(log n)        | O(log n)                             | O(log n)          | sim             |
| `EnumSet` / `EnumMap`             | O(1)            | O(1)                                 | O(1)              | ordinal do enum |
| `ConcurrentHashMap`               | O(1) amortizado | O(1) amortizado                      | O(1) amortizado   | não             |
| `CopyOnWriteArrayList`            | O(1)            | O(n) (copia tudo)                    | O(n) (copia tudo) | não             |
| `ConcurrentSkipListMap/Set`       | O(log n)        | O(log n)                             | O(log n)          | sim             |

## <a name="consideracoes-finais">Considerações finais</a>

Se você tirar uma coisa só deste post: os defaults do dia a dia continuam sendo os defaults certos. `ArrayList` pra lista, `HashMap` pra mapa, `ArrayDeque` pra pilha ou fila. Eles são O(1) amortizado ou perto disso pra praticamente tudo que a maioria dos programas faz, e o JDK já cuida dos casos ruins por baixo, treeificação de bucket, resize amortizado, sem você precisar pensar nisso.

As implementações ordenadas (`TreeSet`, `TreeMap`, `LinkedHashSet`, `LinkedHashMap`) valem a pena no momento em que a ordem vira parte do contrato do seu código, não antes. Trocar `HashMap` por `TreeMap` só porque "ordenado parece mais seguro" custa O(log n) em vez de O(1) sem necessidade nenhuma.

Coleções concorrentes são a parte em que mais vejo overengineering, resolver um problema simples com uma solução complicada demais: usar `ConcurrentHashMap` numa estrutura que só é acessada por uma thread, ou `CopyOnWriteArrayList` numa lista que muda a cada request, adiciona complexidade e, no segundo caso, degrada performance de verdade, já que cada escrita copia o array inteiro. A pergunta certa antes de escolher uma coleção concorrente é: essa estrutura realmente é acessada por mais de uma thread ao mesmo tempo, e com que frequência ela é escrita, comparada a lida? Se a resposta é "quase nunca escrita, lida o tempo todo", `CopyOnWriteArrayList` é ótima. Se é "escrita e lida o tempo todo por várias threads", `ConcurrentHashMap` ou as filas bloqueantes resolvem melhor. E se só uma thread toca aquilo, nenhuma das duas é necessária.

## <a name="referencias">Referências</a>

**Especificação e Javadoc**

- [JEP 431 – Sequenced Collections](https://openjdk.org/jeps/431)
- [JEP 269 – Convenience Factory Methods for Collections](https://openjdk.org/jeps/269)
- [Javadoc – java.util (Collections Framework)](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/package-summary.html)
- [Javadoc – java.util.concurrent](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/package-summary.html)

**Internals de HashMap e árvores balanceadas**

- [Javadoc – HashMap (implementation notes)](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/HashMap.html)
- [Javadoc – TreeMap](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/TreeMap.html)

**Concorrência**

- [Javadoc – ConcurrentHashMap](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/ConcurrentHashMap.html)
- [Javadoc – CopyOnWriteArrayList](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/CopyOnWriteArrayList.html)
- [Javadoc – ConcurrentSkipListMap](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/ConcurrentSkipListMap.html)
- [Javadoc – TransferQueue](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/TransferQueue.html)

**Relacionado neste blog**

- [Java 17 para 25: o que mudou nas duas LTS mais recentes](/blog/java-17-para-25/)
