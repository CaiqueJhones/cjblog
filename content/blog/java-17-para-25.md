---
title: "Java 17 para 25: o que mudou nas duas LTS mais recentes"
slug: java-17-para-25
date: 2026-07-29
banner_image: java-17-para-25.png
description: Um mapa prático das mudanças entre Java 17 LTS (2021) e Java 25 LTS (2025), cobrindo pattern matching, virtual threads, structured concurrency, FFM API, Vector API, Stream Gatherers, Class-File API, headers compactos e cache AOT, com laboratórios reais rodáveis para cada JEP.
categories:
- Java
- Tutoriais
meta_description: Um mapa prático das mudanças entre Java 17 LTS (2021) e Java 25 LTS (2025), com laboratórios reais rodáveis para cada JEP relevante.
browser_title: Java 17 para 25!
comments: true
---

Java 17 saiu em setembro de 2021. Java 25 saiu em setembro de 2025. São as duas LTS mais recentes, oito versões de distância uma da outra, e boa parte dos times ainda está no 17 ou acabou de sair dele. Faz sentido: LTS existe justamente para não obrigar ninguém a acompanhar release a release.

O problema é que "pular" quatro anos de Java de uma vez costuma dar a sensação de estar lendo uma lista de features soltas, sem noção do que realmente vale a pena mudar num projeto real e o que ainda é experimental. Este post tenta resolver isso: cobre as mudanças de maior impacto prático entre o 17 e o 25, cada uma com um laboratório de código rodável no JDK 25. Todo o código deste post vive no repositório companion [`java17-to-25-lab`](https://github.com/CaiqueJhones/java17-to-25-lab), com cada trecho copiado direto de lá.

## Conteúdo

- [Linguagem: pattern matching e records](#linguagem-pattern-matching)
- [Coleções: Sequenced Collections](#sequenced-collections)
- [Concorrência: virtual threads, structured concurrency e scoped values](#concorrencia)
- [Sintaxe enxuta: da cerimônia ao script](#sintaxe-enxuta)
- [Novas portas para fora do Java puro: FFM API e Vector API](#ffm-vector-api)
- [Streams e bytecode: Gatherers e Class-File API](#gatherers-classfile-api)
- [Ainda em preview: tipos primitivos em patterns](#primitive-patterns)
- [Removido de vez: o Security Manager](#security-manager)
- [JVM e performance: headers compactos, GC geracional e cache AOT](#jvm-performance)
- [Considerações finais](#consideracoes-finais)
- [Referências](#referencias)

## <a name="linguagem-pattern-matching">Linguagem: pattern matching e records</a>

Essa é a família de mudanças que mais aparece no dia a dia de quem escreve Java, porque toca em algo tão comum quanto um `switch`.

### Pattern Matching for switch (JEP 441)

No Java 17, `switch` só aceitava constantes: `int`, `enum`, `String`. Decidir comportamento por *tipo* de um objeto exigia uma cadeia de `if (x instanceof Foo foo)` com cast manual em cada ramo. O JEP 441 (final no Java 21) estende o `switch` para aceitar type patterns, guarded patterns (a cláusula `when`), um `case null` explícito e, quando o seletor é uma hierarquia `sealed`, checagem de exaustividade em tempo de compilação:

```java
sealed interface Shape permits Circle, Rectangle, Triangle {}
record Circle(double radius) implements Shape {}
record Rectangle(double width, double height) implements Shape {}
record Triangle(double base, double height) implements Shape {}

static String describe(Shape shape) {
    return switch (shape) {
        case null -> "sem forma (null)";
        case Circle c when c.radius() < 1 -> "círculo pequeno (r=" + c.radius() + ")";
        case Circle c -> "círculo (r=" + c.radius() + ")";
        case Rectangle r when r.width() == r.height() -> "quadrado (lado=" + r.width() + ")";
        case Rectangle r -> "retângulo (" + r.width() + "x" + r.height() + ")";
        case Triangle t -> "triângulo (base=" + t.base() + ", altura=" + t.height() + ")";
    };
    // sem "default": Shape é sealed com 3 subtipos, null tratado explicitamente,
    // o compilador sabe que a cobertura já é exaustiva.
}
```

Repare que não existe `default`. O compilador conhece os três subtipos permitidos de `Shape` e sabe que `null` já está coberto. Se alguém adicionar um quarto record implementando `Shape` e esquecer de tratar esse caso aqui, o build quebra em tempo de compilação, não em produção às três da manhã.

### Record Patterns (JEP 440)

Records existem desde o Java 16, mas até o Java 17 desconstruir um record era manual: pegar a instância e chamar cada accessor (`p.x()`, `p.y()`...). O JEP 440 (final no Java 21) deixa o próprio pattern desconstruir o record em variáveis, inclusive de forma aninhada, quando um record guarda outro record dentro:

```java
record Point(int x, int y) {}
record Line(Point start, Point end) {}

static String handle(Object o) {
    return switch (o) {
        case Point(var x, var y) when x == 0 && y == 0 -> "Point na origem";
        case Point(var x, var y) -> "Point(%d, %d)".formatted(x, y);
        case Line(Point(var x1, var y1), Point(var x2, var y2)) ->
                "Line de (%d,%d) até (%d,%d)".formatted(x1, y1, x2, y2);
        default -> "não reconhecido: " + o;
    };
}
```

O `Line` desse exemplo guarda dois `Point`. Em Java 17, extrair os quatro números exigiria `line.start().x()`, `line.start().y()`, `line.end().x()`, `line.end().y()`, repetidos em cada lugar que precisasse deles. Aqui, os quatro caem em variáveis locais numa única linha de `case`.

### Unnamed Variables & Patterns (JEP 456)

Um detalhe menor, mas dos que aparecem em praticamente todo código depois que você se acostuma: em Java 17, toda variável, mesmo uma que nunca é lida, precisa de nome. Um `catch (NumberFormatException e)` onde `e` nunca é usado, um parâmetro de lambda que a assinatura exige mas o corpo ignora. O JEP 456 (final no Java 22) introduz `_` como marcador de "não preciso desse valor":

```java
try {
    Integer.parseInt("não é número");
} catch (NumberFormatException _) {
    System.out.println("catch com _: só precisávamos saber que falhou");
}

for (var _ : events) {
    total++;
}

BiConsumer<String, Integer> onEvent = (_, count) -> counter.addAndGet(count);
```

Uma pegadinha: `_` não é uma variável reutilizável. Usar `_` duas vezes no mesmo escopo esperando reaproveitar o mesmo valor simplesmente não compila. É um marcador especial que o compilador reconhece, não um nome de verdade.

## <a name="sequenced-collections">Coleções: Sequenced Collections</a>

Antes do JEP 431 (final no Java 21), "primeiro" e "último" elemento eram resolvidos de um jeito diferente para cada tipo de coleção: `list.get(0)`/`list.get(size() - 1)` para `List`, `getFirst()`/`getLast()` só em `Deque`, e nada disso existia para `LinkedHashSet` ou `LinkedHashMap` além de iterar manualmente. As interfaces `SequencedCollection`, `SequencedSet` e `SequencedMap` unificam isso:

```java
List<String> steps = List.of("build", "test", "package", "deploy");
steps.getFirst();      // em vez de steps.get(0)
steps.getLast();       // em vez de steps.get(steps.size() - 1)
steps.reversed();       // view, não cópia

var visitados = new LinkedHashSet<String>();
visitados.add("home"); visitados.add("produtos"); visitados.add("carrinho");
visitados.getFirst();  // antes: iterator().next(), sem alternativa melhor
visitados.getLast();   // antes: converter pra List primeiro

SequencedMap<String, Integer> ranking = new LinkedHashMap<>();
ranking.put("ouro", 1); ranking.put("prata", 2); ranking.put("bronze", 3);
ranking.firstEntry();
ranking.putFirst("platina", 0);
ranking.reversed().keySet();
```

O detalhe que costuma pegar quem não testou: `reversed()` devolve uma **view**, não uma cópia. Ela repassa a mutabilidade da coleção original. Um `List.of(...)` imutável continua imutável através da view reversa; tentar `add()` nela lança a mesma exceção que lançaria na lista original.

## <a name="concorrencia">Concorrência: virtual threads, structured concurrency e scoped values</a>

Essa é a área que mais justifica o upgrade do 17 para o 25. A mudança de mentalidade é maior aqui do que em qualquer outra parte deste post, e os números falam mais alto que qualquer explicação.

### Virtual Threads (JEP 444)

Em Java 17, toda `Thread` é uma platform thread: mapeada 1:1 numa thread do sistema operacional, com stack de ~1MB e custo de criação alto. Serviços com muita concorrência de I/O (chamadas HTTP, JDBC síncrono) ficavam presos a pools limitados, dezenas ou centenas de threads, e o resto do trabalho simplesmente enfileirava e esperava.

O JEP 444 (final no Java 21) introduz virtual threads: continuam sendo `Thread` de verdade, mesma API, mas gerenciadas pela JVM e multiplexadas sobre um pool pequeno de *carrier threads*. Quando uma virtual thread bloqueia num `Thread.sleep` ou numa chamada de I/O, ela libera a carrier thread para outra virtual thread rodar. O lab dispara 10.000 tarefas que simulam uma chamada bloqueante de 50ms:

```java
try (ExecutorService platformPool = Executors.newFixedThreadPool(200)) {
    run("platform threads (pool fixo de 200)", platformPool);
}

try (ExecutorService virtualPool = Executors.newVirtualThreadPerTaskExecutor()) {
    run("virtual threads (uma por tarefa)", virtualPool);
}
```

Com o pool fixo de 200 platform threads, só 200 tarefas rodam de cada vez, e o total leva **2524ms**. Com uma virtual thread por tarefa, sem pool nenhum, as 10.000 rodam praticamente ao mesmo tempo (multiplexadas sobre poucas carrier threads reais de verdade) e terminam em **97ms**. É uma diferença de ordem de grandeza, não uma otimização de 10%, e o código de negócio não muda uma linha: é o mesmo `Callable`, só o `ExecutorService` troca.

> Virtual threads não tornam código de CPU mais rápido. O ganho é exclusivamente para código que bloqueia esperando I/O, que é o perfil dominante da maioria dos serviços backend.

### Structured Concurrency (JEP 505, ainda em preview)

Em Java 17, disparar chamadas concorrentes com `ExecutorService` + `Future` não dava nenhuma garantia estrutural. Se a task A falhasse, a task B continuava rodando sozinha, sem ninguém para propagar o erro ou cancelar o que sobrou. `StructuredTaskScope` trata um grupo de subtasks como uma unidade: elas nascem dentro do escopo, e o `try-with-resources` só sai depois que todas terminaram, foram canceladas, ou já não importam mais.

```java
static void failFast() {
    var start = Instant.now();
    try (var scope = StructuredTaskScope.open(Joiner.<String>allSuccessfulOrThrow())) {
        scope.fork(() -> { throw new IllegalStateException("pagamento fora do ar"); });
        scope.fork(() -> {
            Thread.sleep(Duration.ofSeconds(2));
            return "nunca deveria terminar rodando";
        });
        scope.join();
    } catch (Exception e) {
        var elapsed = Duration.between(start, Instant.now());
        System.out.println("falhou em " + elapsed.toMillis() + "ms: " + e.getCause());
    }
}
```

Uma subtask falha na hora. A outra dormiria dois segundos inteiros. Com `Future` cru, esse `Thread.sleep` continuaria rodando até o fim, mesmo sem ninguém esperando o resultado: uma thread pendurada, desperdiçando recurso. Com `StructuredTaskScope`, o escopo cancela a subtask que ainda dormia assim que fica claro que o resultado não importa mais. O método inteiro retorna em **3ms**, não em 2000ms.

Vale o alerta: no Java 25 esse JEP está na 5ª preview, precisa de `--enable-preview`, e é a API que mais mudou entre uma preview e outra (de constructors, para `ShutdownOnFailure`/`ShutdownOnSuccess`, para o `open()` + `Joiner` atual). Não é recomendado para produção sem revisar o JEP mais recente do JDK que estiver rodando.

### Scoped Values (JEP 506)

Passar um dado "de ambiente" (usuário autenticado, request-id, tenant) por uma cadeia de chamadas sem poluir toda assinatura de método sempre dependeu de `ThreadLocal`. O problema é que `ThreadLocal` é mutável, qualquer método pode chamar `set()` a qualquer momento, e exige `remove()` manual num `finally`. Esquecer isso é fonte clássica de vazamento de dado entre execuções, principalmente com pools de thread reutilizadas, e virtual threads (existindo aos milhões) tornam esse custo ainda mais visível.

```java
private static final ScopedValue<String> CURRENT_USER = ScopedValue.newInstance();

ScopedValue.where(CURRENT_USER, "alice")
        .where(REQUEST_ID, "req-001")
        .run(Main::handleRequest);

// fora do bloco, o valor nunca existiu pra essa parte do código
System.out.println("depois do bind: isBound=" + CURRENT_USER.isBound());
```

`ScopedValue` (final no Java 25) é vinculado só durante a execução do `Runnable`/`Callable` passado para `run(...)`. É imutável dentro desse escopo e desaparece sozinho quando o bloco termina, sem `remove()`, sem risco de esquecer o cleanup. E combina naturalmente com `StructuredTaskScope`: subtasks forkadas dentro do escopo herdam os valores automaticamente, algo que com `ThreadLocal` exigiria `InheritableThreadLocal` e ainda assim não teria a mesma garantia de limpeza.

## <a name="sintaxe-enxuta">Sintaxe enxuta: da cerimônia ao script</a>

Três JEPs, todos finais no Java 25, com um fio condutor comum: reduzir cerimônia sem tirar poder de expressão.

### Compact Source Files & Instance Main Methods (JEP 512)

Até o Java 17, mesmo o "Hello, World" mais simples exigia `public class`, `public static void main(String[] args)` e import explícito para qualquer coisa fora de `java.lang`. O JEP 512 introduz *compact source files*: um `.java` sem declaração de classe (o compilador embrulha o conteúdo numa classe implícita), com `main()` como método de instância. Dá para rodar direto, sem `javac`, sem Maven:

```java
void main() {
    IO.println("Hello, World! (sem 'public class', sem 'static', sem import)");

    var linguagens = List.of("Java 17", "Java 21", "Java 25");
    for (var linguagem : linguagens) {
        IO.println("- " + linguagem);
    }
}
```

```bash
java Main.java
```

Sem classe, sem `import java.util.List;`, e a nova `java.lang.IO` substitui `System.out.println`/`Scanner` para os casos simples. O `List.of(...)` funciona porque, dentro de um arquivo compacto, `java.base` inteiro já está implicitamente disponível. Isso não substitui um projeto Maven de verdade, mas para um script rápido, um protótipo, ou até para ensinar Java a alguém que nunca programou, tira uma barreira de entrada que sempre foi meio artificial.

### Flexible Constructor Bodies (JEP 513)

Em Java 17, `super(...)`/`this(...)` era obrigatoriamente a primeira instrução do construtor. Validar argumentos antes de chamar o construtor da superclasse exigia um método estático auxiliar chamado dentro da própria expressão do `super(...)`, misturando validação e transformação numa única linha difícil de ler. O JEP 513 permite um "prólogo" de instruções antes de `super()`, desde que ele não toque na instância ainda não construída:

```java
Manager(String rawName, int teamSize) {
    // prólogo: roda ANTES de super(), sem acessar `this`
    if (teamSize < 0) {
        throw new IllegalArgumentException("teamSize não pode ser negativo: " + teamSize);
    }
    var normalizedName = (rawName == null || rawName.isBlank()) ? "desconhecido" : rawName.trim();

    super(normalizedName); // só agora a instância começa a existir
    this.teamSize = teamSize;
}
```

A validação de `teamSize` negativo lança exceção antes mesmo do construtor de `Employee` rodar, com variáveis locais comuns, sem gambiarra. Tentar mover `this.teamSize = teamSize` para antes do `super(...)` continua não compilando: o prólogo serve para validação e cálculo, não para inicializar campos antes da hora.

### Module Import Declarations (JEP 511)

Em código que usa bastante da biblioteca padrão, o bloco de imports de Java 17 crescia rápido: um `import` por pacote, `java.util.List`, `java.util.Map`, `java.math.BigDecimal`, `java.time.Duration`. O JEP 511 permite importar de uma vez todos os pacotes exportados por um módulo:

```java
import module java.base;

List<String> nomes = List.of("alice", "bob", "carol");
Map<String, Integer> tamanhos = nomes.stream().collect(Collectors.toMap(n -> n, String::length));
BigDecimal preco = new BigDecimal("19.90").multiply(BigDecimal.valueOf(3));
Duration decorrido = Duration.between(inicio, Instant.now());
Path caminho = Path.of("java17-to-25-lab", "10-module-import-declarations");
```

Uma única linha substitui o que em Java 17 seriam pelo menos seis imports separados. E não exige que o projeto seja modular: funciona também em código "classpath" comum, sem `module-info.java`, como qualquer módulo Maven tradicional.

## <a name="ffm-vector-api">Novas portas para fora do Java puro: FFM API e Vector API</a>

### Foreign Function & Memory API (JEP 454)

Chamar uma função nativa em Java 17 significava JNI: cabeçalho C, ponte em C/C++, compilar uma `.so`/`.dll` específica da plataforma, carregar com `System.loadLibrary(...)`. Muito código de cola para pouca lógica, com gerenciamento de memória nativa manual e fácil de vazar. A FFM API (final no Java 22) permite chamar funções nativas direto do Java:

```java
Linker linker = Linker.nativeLinker();

MethodHandle strlen = linker.downcallHandle(
        linker.defaultLookup().find("strlen").orElseThrow(),
        FunctionDescriptor.of(ValueLayout.JAVA_LONG, ValueLayout.ADDRESS));

try (Arena arena = Arena.ofConfined()) {
    String texto = "Hello, Foreign Function & Memory API!";
    MemorySegment nativo = arena.allocateFrom(texto);
    long tamanho = (long) strlen.invoke(nativo);
    System.out.println("strlen(...) = " + tamanho);
}
```

Esse código chama a `strlen` da libc do sistema operacional, sem nenhuma linha de C, sem `.so` própria. O `Arena` confinado libera a memória nativa automaticamente ao sair do `try-with-resources`, o equivalente em JNI exigiria lembrar de liberar cada alocação manualmente.

### Vector API (JEP 508, ainda incubator)

Em Java 17, não existia forma portátil de escrever código explicitamente vetorizado (SIMD): somar vários `float`s de uma vez usando as instruções de vetor da CPU. A alternativa era escrever um loop escalar comum e torcer para o JIT auto-vetorizar, algo que ele faz de forma limitada e imprevisível. O Vector API expõe operações vetoriais explícitas:

```java
static float[] somaVetorial(float[] a, float[] b) {
    var resultado = new float[a.length];
    int i = 0;
    int limite = SPECIES.loopBound(a.length);
    for (; i < limite; i += SPECIES.length()) {
        var va = FloatVector.fromArray(SPECIES, a, i);
        var vb = FloatVector.fromArray(SPECIES, b, i);
        va.add(vb).intoArray(resultado, i);
    }
    for (; i < a.length; i++) {
        resultado[i] = a[i] + b[i]; // cauda que não preenche um vetor inteiro
    }
    return resultado;
}
```

No lab, `SPECIES_PREFERRED` reporta 8 `float`s processados por instrução numa CPU com AVX2/256-bit. Somando dois arrays de 20 milhões de posições, depois de aquecer a JVM (cinco chamadas descartadas antes de medir, porque a primeira execução mede interpretação e compilação JIT, não código otimizado), a versão escalar levou **49ms** e a vetorial **17ms**. Sem aquecimento o resultado sai invertido, com a versão vetorial "perdendo" só por rodar depois.

Vale lembrar: o Vector API é incubator desde o Java 16. Atravessou nove releases sem finalizar, porque expor detalhes de hardware numa API portátil e estável é genuinamente difícil. Não é recomendado para código de produção sem revisar a cada upgrade de JDK.

## <a name="gatherers-classfile-api">Streams e bytecode: Gatherers e Class-File API</a>

### Stream Gatherers (JEP 485)

O Stream API, desde o Java 8, só tinha operações intermediárias fixas: `map`, `filter`, `flatMap`. Qualquer operação com estado, como agrupar em janelas ou remover duplicatas consecutivas, não tinha como ser plugada no meio de uma pipeline: virava loop manual ou dependência externa (RxJava, Guava). `Gatherer` (final no Java 24) resolve isso:

```java
List<List<Integer>> lotes = numeros.gather(Gatherers.windowFixed(3)).toList();

List<Integer> somaAcumulada = Stream.of(1, 2, 3, 4, 5)
        .gather(Gatherers.scan(() -> 0, Integer::sum))
        .toList();

static <T> Gatherer<T, ?, T> distinctConsecutive() {
    return Gatherer.<T, Object[], T>ofSequential(
            () -> new Object[] {null, Boolean.FALSE},
            (state, elemento, downstream) -> {
                var jaEmitiu = (Boolean) state[1];
                if (!jaEmitiu || !elemento.equals(state[0])) {
                    state[0] = elemento;
                    state[1] = Boolean.TRUE;
                    return downstream.push(elemento);
                }
                return true;
            });
}
```

`windowFixed(3)` quebra o stream em lotes de tamanho fixo, útil para inserts em lote. `scan` emite o resultado intermediário a cada passo, diferente de `reduce`, que só entrega o resultado final. E o `distinctConsecutive()` acima é um `Gatherer` totalmente customizado, o equivalente ao `uniq` do Unix, que não existe pronto nem em `Gatherers` nem em `Stream`. É esse encaixe, poder escrever a sua própria operação intermediária com estado e plugá-la via `.gather(...)`, que faltava desde sempre.

### Class-File API (JEP 484)

Ler, gerar ou transformar bytecode programaticamente sempre dependeu de bibliotecas de terceiros, ASM à frente delas, porque o JDK não expunha uma API pública e estável para isso. Frameworks como Spring e Hibernate embutiam ASM e precisavam de uma versão nova a cada mudança no formato `.class`. O JEP 484 (final no Java 24) expõe `java.lang.classfile` como API padrão:

```java
ClassDesc generatedClass = ClassDesc.of("Generated");
MethodTypeDesc answerType = MethodTypeDesc.of(ConstantDescs.CD_int);

byte[] bytecode = ClassFile.of().build(generatedClass, classBuilder ->
        classBuilder.withMethodBody(
                "answer", answerType, ClassFile.ACC_PUBLIC | ClassFile.ACC_STATIC,
                codeBuilder -> codeBuilder.loadConstant(42).ireturn()));

MethodHandles.Lookup lookup = MethodHandles.lookup().defineHiddenClass(bytecode, true);
MethodHandle answer = lookup.findStatic(lookup.lookupClass(), "answer", MethodType.methodType(int.class));
System.out.println((int) answer.invoke()); // 42
```

Esse trecho gera, em memória, uma classe `Generated` com um método estático `answer()` que devolve `42`. Nenhum `.java` escrito, nenhum ASM, só a API padrão do JDK. A classe é carregada como *hidden class* e invocada via `MethodHandle`, o mesmo mecanismo que sustenta lambdas e proxies dinâmicos por baixo dos panos.

## <a name="primitive-patterns">Ainda em preview: tipos primitivos em patterns</a>

Em Java 17, `switch` só aceitava `char`/`byte`/`short`/`int` (e seus boxes), `String` e `enum` como seletor. `switch` sobre `double`, `float`, `long` ou `boolean` simplesmente não compilava, e `instanceof` só testava tipos de referência, nunca primitivos. O JEP 507 (3ª preview no Java 25) estende os três para aceitar todos os tipos primitivos, com case constants desses tipos e patterns de narrowing entre eles:

```java
static String classificar(double temperatura) {
    return switch (temperatura) {
        case 0.0 -> "ponto de congelamento da água";
        case 100.0 -> "ponto de ebulição da água";
        default -> "outro valor: " + temperatura + "°C";
    };
}

static String descrever(int i) {
    return switch (i) {
        case byte b -> "cabe num byte (" + b + ")";
        case short s -> "cabe num short (" + s + ")";
        default -> "só cabe num int (" + i + ")";
    };
}
```

`classificar(double)` simplesmente não compilava em Java 17. `descrever(int)` testa, na ordem declarada, se o `int` recebido cabe em cada tipo primitivo cada vez menor, sem cast manual nem `Math.min`/`max` de limites.

Essa é, entre tudo que este post cobre, a API que mais ainda pode mudar. Já foi reproposta três vezes (JEP 455, depois 488, agora 507) e seguiu em preview mesmo depois do Java 25, chegando à 4ª e 5ª preview em releases posteriores. Vale conferir o JEP mais recente da sua versão do JDK antes de depender dela em código real.

## <a name="security-manager">Removido de vez: o Security Manager</a>

O Security Manager era um mecanismo de sandboxing baseado em "código chamador": checava a pilha de chamadas para decidir se uma operação sensível, ler arquivo, abrir socket, era permitida. Na prática, era usado por pouquíssimos projetos, tinha custo de performance real em toda a JVM e um modelo difícil de raciocinar corretamente. O JEP 411 (Java 17) já tinha deprecado o mecanismo. O JEP 486 (final no Java 24) torna a remoção definitiva:

```java
System.out.println("getSecurityManager() = " + System.getSecurityManager()); // sempre null

try {
    System.setSecurityManager(new SecurityManager());
} catch (UnsupportedOperationException e) {
    System.out.println("setSecurityManager() falhou como esperado: " + e.getMessage());
}
```

`getSecurityManager()` sempre devolve `null`. `setSecurityManager(...)` sempre lança `UnsupportedOperationException`, mesmo tentando instalar um `SecurityManager` vazio e permissivo. Não existe mais flag de linha de comando para reativar: `-Djava.security.manager=allow` deixou de existir.

> Se algum código legado ainda depende de `setSecurityManager(...)` para isolar plugins ou sandboxes de scripting, isso quebra em runtime a partir do Java 24, não é um aviso de depreciação, é exceção direto. A alternativa recomendada é isolamento por processo (containers), não sandboxing dentro da mesma JVM.

## <a name="jvm-performance">JVM e performance: headers compactos, GC geracional e cache AOT</a>

Essa última seção é diferente das anteriores. Nenhuma linha de código muda por causa dela: são flags de JVM e comportamento de baixo nível, mas o impacto em produção pode ser maior do que qualquer mudança de sintaxe deste post.

### Compact Object Headers (JEP 519)

Todo objeto na heap carrega um header. Em Java 17, 128 bits (16 bytes) em plataformas 64-bit: mark word de 64 bits mais ponteiro de classe. Para objetos pequenos, esse header pode ser maior que os próprios dados úteis. O JEP 519 (final no Java 25, opt-in) comprime tudo para 64 bits totais, ativado via `-XX:+UseCompactObjectHeaders`.

O lab retém 20 milhões de objetos pequenos (dois campos `int` cada) e mede a heap usada:

| Flag | heap usada | bytes/objeto |
|---|---|---|
| default | 563MB | ~28,2 |
| `-XX:+UseCompactObjectHeaders` | 403MB | ~20,2 |

Cerca de **28% menos heap**, alinhado com os ~22% que o próprio JEP cita em benchmarks gerais. O detalhe que importa: o objeto de teste tem dois campos `int` de propósito. Com um campo só, header normal e compacto arredondam para o mesmo tamanho final por causa do alinhamento de 8 bytes, e a diferença desaparece. O ganho real depende do tamanho médio dos seus objetos, não só de ligar a flag.

### GC geracional em Shenandoah (JEP 521)

Em Java 17, ZGC e Shenandoah tratavam a heap inteira como uma geração só: todo objeto era varrido do mesmo jeito, recém-nascido ou vivo há muito tempo. Como a maioria dos objetos morre jovem, coletores sem geração desperdiçam trabalho revarrendo objetos antigos à toa. O ZGC ganhou modo geracional final no Java 21 (default desde o Java 23). O Shenandoah chegou lá no Java 25, via JEP 521.

Nos logs de GC do lab, comparando G1, ZGC geracional e Shenandoah geracional sob a mesma carga de lixo de curta duração: G1 mostra pausas "stop-the-world" nomeadas e claras (`Pause Young (Normal)`), na casa de 1ms. ZGC geracional concentra o trabalho em eventos concorrentes (`Major/Minor Collection`), sem uma pausa grande para destacar no log padrão. Shenandoah geracional mostra fases explícitas (`Pause Init Mark`, `Pause Final Mark`) tipicamente na casa de microssegundos, a marca registrada do Shenandoah desde sempre.

### AOT Cache (JEP 514 / JEP 515)

Em Java 17, toda subida da JVM recomeça do zero: cada classe usada precisa ser carregada e linkada, e o JIT reaprende do interpretador para C1/C2 quais métodos valem compilar. Para aplicações de vida curta (serverless, CLIs, containers que escalam horizontalmente), esse custo se repete a cada instância nova. O cache AOT, evolução do CDS clássico, guarda de uma execução de treino tanto as classes já carregadas quanto os perfis de execução dos métodos "quentes":

```bash
# 1. Treino: roda a aplicação de verdade e grava o cache
java -XX:AOTCacheOutput=app.aot -cp app.jar App

# 2. Uso: parte do estado pronto em vez de começar do zero
java -XX:AOTCache=app.aot -cp app.jar App
```

Medindo 8 execuções de uma aplicação pequena que processa um catálogo de 5.000 produtos com streams, regex e agregações:

| Modo | tempo médio de startup |
|---|---|
| sem cache AOT | 64ms |
| com `-XX:AOTCache=app.aot` | 40ms |

**~37% mais rápido**, mesmo num programa pequeno. Aplicações reais com muito mais classes e frameworks pesados (Spring, Micronaut) tendem a ver ganhos proporcionalmente maiores, porque têm mais trabalho de class-loading e mais métodos quentes para recuperar do cache. Um detalhe operacional: se o `.jar` mudar (novo deploy), o cache antigo continua "funcionando", mas passa a ignorar entradas que não batem mais com o checksum das classes. Faz sentido regenerar o cache a cada deploy, como parte do pipeline de build.

## <a name="consideracoes-finais">Considerações finais</a>

Os 18 laboratórios deste post deixam alguns pontos claros.

**O que já dá para usar em produção hoje**: pattern matching, record patterns, unnamed variables, Sequenced Collections, virtual threads, scoped values, os três JEPs de sintaxe enxuta, FFM API, Stream Gatherers, Class-File API, a remoção do Security Manager, headers compactos e o cache AOT. Todos finais, a maioria já estável há uma ou mais LTS antes do Java 25. Migrar um projeto real do 17 para o 25 e adotar essas mudanças aos poucos é trabalho de refatoração incremental, não aposta.

**O que ainda é preview ou incubator**: Structured Concurrency (5ª preview no Java 25, seguiu mudando depois) e primitive types em patterns (3ª preview, reproposta três vezes) exigem `--enable-preview` e podem quebrar em upgrades futuros de JDK. Vector API é incubator desde o Java 16 e atravessou nove releases sem finalizar. Nenhuma dessas três é recomendada em código de produção sem revisar o JEP mais recente antes de cada upgrade.

**Mudança de linguagem versus mudança de JVM**: vale separar mentalmente os dois grupos. Pattern matching, records e a sintaxe enxuta afetam como você escreve código, e a curva de adoção é editar arquivos. Headers compactos, GC geracional e cache AOT afetam como a JVM roda o código que já existe, sem tocar numa linha, e a curva de adoção é testar flags em ambiente de homologação antes de levar para produção. Os dois grupos valem a pena, mas pedem processos diferentes de validação.

Para quem vai migrar um projeto real do 17 para o 25: comece pelas mudanças de linguagem que o compilador já aceita sem flag nenhuma (pattern matching, records, Sequenced Collections), meça o impacto de virtual threads em qualquer serviço com I/O bloqueante (é onde o ganho costuma ser mais visível e mais fácil de justificar), deixe o cache AOT e os headers compactos como um segundo passo de tuning depois que a aplicação já estiver rodando estável no 25, e trate qualquer JEP em preview como experimento, não como dependência de produção.

## <a name="referencias">Referências</a>

**Linguagem**

- [JEP 441 – Pattern Matching for switch](https://openjdk.org/jeps/441)
- [JEP 440 – Record Patterns](https://openjdk.org/jeps/440)
- [JEP 456 – Unnamed Variables & Patterns](https://openjdk.org/jeps/456)
- [JEP 512 – Compact Source Files and Instance Main Methods](https://openjdk.org/jeps/512)
- [JEP 513 – Flexible Constructor Bodies](https://openjdk.org/jeps/513)
- [JEP 511 – Module Import Declarations](https://openjdk.org/jeps/511)
- [JEP 507 – Primitive Types in Patterns, instanceof, and switch (Third Preview)](https://openjdk.org/jeps/507)

**Coleções e streams**

- [JEP 431 – Sequenced Collections](https://openjdk.org/jeps/431)
- [JEP 485 – Stream Gatherers](https://openjdk.org/jeps/485)

**Concorrência**

- [JEP 444 – Virtual Threads](https://openjdk.org/jeps/444)
- [JEP 505 – Structured Concurrency (Fifth Preview)](https://openjdk.org/jeps/505)
- [JEP 506 – Scoped Values](https://openjdk.org/jeps/506)

**APIs de baixo nível e bytecode**

- [JEP 454 – Foreign Function & Memory API](https://openjdk.org/jeps/454)
- [JEP 508 – Vector API (Tenth Incubator)](https://openjdk.org/jeps/508)
- [JEP 484 – Class-File API](https://openjdk.org/jeps/484)

**Segurança**

- [JEP 486 – Permanently Disable the Security Manager](https://openjdk.org/jeps/486)

**JVM e performance**

- [JEP 519 – Compact Object Headers](https://openjdk.org/jeps/519)
- [JEP 521 – Generational Shenandoah](https://openjdk.org/jeps/521)
- [JEP 514 – Ahead-of-Time Command-Line Ergonomics](https://openjdk.org/jeps/514)
- [JEP 515 – Ahead-of-Time Method Profiling](https://openjdk.org/jeps/515)

**JDK 25**

- [OpenJDK JDK 25 Project](https://openjdk.org/projects/jdk/25/)
