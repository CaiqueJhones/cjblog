---
title: "Java 8"
date: 2015-07-19
banner_image: java-8.png
description: Neste artigo iremos ver aspectos importantes da linguagem de programação Java a partir da sua versão 8.
categories:
- Java
- Tutoriais
meta_description: Neste artigo iremos ver aspectos importantes da linguagem de programação Java a partir da sua versão 8.
browser_title: Java 8!
comments: true
---

O Java 8, lançado em março de 2014, trouxe diversas melhorias no design da linguagem e novas APIs, como *Streams* e *Java Time*. Neste artigo iremos analisar as principais mudanças no design da linguagem que promete deixar o código mais conciso, reduzindo grande parte dos *boilerplates* e abraçando conceitos oriundos do paradigma de programação funcional.

## Conteúdo

* [Expressões Lambdas](#expressoes-lambdas)
* [Interfaces funcionais](#interfaces-funcionais)
* [Default Methods](#default-methods)
* [Method References](#method-references)
* [Conclusão](#conclusao)

## <a name="expressoes-lambdas">Expressões Lambdas</a>

Uma das principais características implementada na linguagem foi a expressão lambda, com ela podemos implementar um método abstrato de uma interface de maneira muito mais concisa do que as classes anônimas. Vamos analisar uma nova forma de fazer iteração em coleções:

```java
String nome = "Fabrício";
String sobrenome = "Santos";
String trabalho = "Agricultor";

List<String> attr = Arrays.asList(nome, sobrenome, trabalho);

System.out.println("---------Forma tradicional----------");
for(String s : attr) {
  System.out.println(s);
}

System.out.println("---------Com expressão lambda-------");
attr.forEach(s -> System.out.println(s));
```

A saída deste programa será:

```no
---------Forma tradicional----------
Fabrício
Santos
Agricultor
---------Com expressão lambda-------
Fabrício
Santos
Agricultor
```

No exemplo acima, definimos uma lista de strings, em seguida exibimos seu conteúdo de duas formas: a primeira com um *for each* tradicional e a segunda utilizando um método chamado `forEach`, que encontra-se na interface `java.lang.Iterable` na qual `List` é herdada, seu argumento é do tipo `java.util.function.Consumer`, uma interface que contem um **único método abstrato**, o `accept(T t)`. 

No método `forEach`, passamos como parâmetro a expressão lambda `s -> System.out.println(s)`, que é uma maneira mais concisa de escrever:

```java
attr.forEach(new Consumer<String> {
  public void accept(String s) {
    System.out.println(s);
  }
});
```

Observe que o `s` antes do símbolo `->` é equivalente ao parâmetro `String s` do método `accept`. O que vem depois do símbolo é equivalente ao corpo do método. 

> Para implementar uma interface com uma expressão lambda, é necessário que a interface contenha um único método abstrato, pois será o mesmo que a expressão lambda irá representar.

Temos ainda outras formas de declarar expressões lambdas, como apresentadas nos exemplos abaixo:

```java
int val = 10;
Runnable r = () -> {
  System.out.println(val);
};
Thread th = new Thread(r);
th.start();

Test t = (a, b) -> {
  int s = a + b;
  return s;
};
System.out.println("A soma de 1 + 2 = " + t.sum(1 + 2));

interface Test {
  int sum(int a, int b);
}

JButton button = new JButton("Click");
button.addActionListener(event -> System.out.println("Fui clicado!"));
```

Podemos notar que:

* Quando o método não possui argumentos, como é o caso do `run` da interace `Runnable`, temos que usar `()` antes do símbolo `->`.
* Para um corpo que possui mais de uma instrução devemos coloca-lo entre chaves.
* Para casos que o método possui dois ou mais argumentos temos a sintaxe `(a, b) ->`. Os parenteses só podem ser omitidos quando temos um único argumento.
* Podemos utilizar varáveis locais do método em que a lambda está contida, assim como ocorre com as classe anônimas, a única exigência é que a variável local seja `final`.

> A partir do Java 8 você não precisa mais explicitar que a variável local é final quando a mesma não sofre mutações, o próprio compilador irá traduzir como final.

## <a name="interfaces-funcionais">Interfaces funcionais</a>

O Java 8 trouxe um novo pacote chamado de `java.util.function` que contém uma série de interfaces que podem e devem ser aproveitadas para a utilização das expressões lambdas, essas interfaces possuem apenas **um único método abstrato**, esta característica faz com que elas sejam definidas como **interfaces funcionais**. Algumas interfaces antigas como `Runnable` e `ActionListerner` apesar de não sofrerem nenhum tipo de alteração na versão 8 da linguagem, também são definidas assim.

### Criando interfaces funcionais

Para criar uma interface funcional é muito simples, basta criar um interface comum que contenha um único método abstrato, a partir daí sua interface já poderá ser usada com uma expressão lambda, vamos a um exemplo:

```java
public interface Print {
  void draw(String txt);
}

Print p = txt -> System.out.println(txt);
p.draw("Artigo sobre interfaces funcionais");
```

Temos ainda a opção de anotar a nossa interface para que ela seja explicitamente uma interface funcional, desta forma:

```java
@FunctionalInterface
public interface Print {
  void draw(String txt);
}
```

Isto garante que caso a interface ganhe um novo método abstrato acidentalmente, esta excessão seja lançada:

```no
Exception in thread "main" java.lang.Error: Unresolved compilation problem:
The target type of this expression must be a functional interface
```

## <a name="default-methods">Default Methods</a>

Vimos na seção [Expressões Lambdas](#expressões-lambdas) o método `forEach` que está presente na interface `Iterable`, mas como este método funciona e por que códigos anteriores ao Java 8 não quebram com a inclusão deste novo método? Vamos analisá-lo:

```java
default void forEach(Consumer<? super T> action) {
  Objects.requireNonNull(action);
  for (T t : this) {
    action.accept(t);
  }
}
```

Isso mesmo! Agora podemos utilizar métodos com código dentro de interfaces. Para criar um método default basta utilizar a palavra reservada `default`. Vamos analisar também a interface Consumer:

```java
package java.util.function;

import java.util.Objects;

@FunctionalInterface
public interface Consumer<T> {

  void accept(T t);

  default Consumer<T> andThen(Consumer<? super T> after) {
    Objects.requireNonNull(after);
    return (T t) -> { accept(t); after.accept(t); };
  }
}
```

Notamos que existe um *default method*, vamos ver o que ele faz:

```java
Consumer<String> m1 = t -> System.out.print("Bem vindo: ");
Consumer<String> m2 = t -> System.out.println(t);

List<String> list = Arrays.asList(
  "Lambda",
  "Interfaces funcionais",
  "Default methods"
);

list.forEach(m1.andThen(m2));
```

A saída será:

```no
Bem vindo: Lambda
Bem vindo: Interfaces funcionais
Bem vindo: Default methods
```

Bem útil não é mesmo? A API Collections ganhou vários métodos default que aumenta consideravelmente as capacidades da API, dentre eles temos o `removeIf` e o `replaceAll`, muito úteis quando estamos trabalhando com listas:

```java
List<String> list = new ArrayList<>();
list.add("Lambda");
list.add("Interfaces funcionais");
list.add("Default methods");

list.removeIf(s -> s.contains("i"));

list.forEach(s -> System.out.println(s));
```

A saída será:

```no
Lambda
Default methods
```

Apesar de podermos agora escrever métodos dentro de interfaces isso não representa que o Java passou a aceitar heranças múltiplas, já que as interfaces não armazenam estado.

## <a name="method-references">Method References</a>

O *method reference* é um recurso bastante parecido com as expressões lambdas e sua sintaxe é bastante simples, vamos a um exemplo:

```java
public class Author {
  private String name;

  // construtor, gets e sets

  public void imprime() {
    System.out.println(name);
  }
}

Author caique = new Author("Caique Jhones");
Author junior = new Author("Junior dos Santos");
Author flavio = new Author("Flávio José");

List<Author> autores = Arrays.asList(caique, junior, flavio);

Consumer<Author> comLambda = a -> a.imprime();
Consumer<Author> comReference = Author::imprime;

autores.forEach(comLambda);
System.out.println("-------------");
autores.forEach(comReference);
```

A saída:

```no
Caique Jhones
Junior dos Santos
Flávio José
-------------
Caique Jhones
Junior dos Santos
Flávio José
```

Perceba que foi utilizado o nome da classe juntamente com o delimitador `::` concatenado com o nome do método **sem os parênteses**, isso equivale a expressão lambda só que com um código mais enxuto. Esse novo conceito da linguagem será útil na utilização das novas API's e deixará o código mais conciso. Não existe reflexão em *method reference* tudo é feito em tempo de compilação.

### Referências à métodos de instância

Um *method reference* do tipo `Author::imprime` só pode ser atribuído a uma interface funcional que receba como argumento uma instância da classe `Author`, que é o caso da interface `Consumer`:

```java
public interface Consumer<T> {
    void accept(T t);
}
```

a partir daí o compilador pode executar o método `imprime` da instância recebida no método `accept`. Podemos também utilizar uma instância de `Author`, o *method reference* fica desta forma: `caique::imprime`, e a partir daí utilizá-lo em uma interface funcional que não recebe nenhum parâmetro. Exemplo:

```java
Runnable r = caique::imprime;
new Thread(r).start();
```

Não confunda a chamada `Author::imprime` com `caique::imprime`, pois o primeiro executará o método de qualquer `Author` que será passado por parâmetro dentro da interface funcional, já o segundo, executará o método da instância que o chamou.

### Referências à construtores

Podemos ainda referenciar os construtores para criarmos novas instâncias, como um *factory*, da seguinte forma:

```java
//Com construtor padrão
Supplier<Author> factory = Author::new;
Author semNome = factory.get();

//Com contrutor que recebe um argumento
Function<String, Author> fac = Author::new;
Author caique = fac.apply("Caique Jhones");
```

Para criarmos uma instância, passamos a refêrencia de método `Author::new` para uma interface funcional que será responsável por devolver uma nova instância. No caso de um construtor padrão, utilizamos a interface `java.util.function.Supplier` com seu método `get`. Para um construtor com um único argumento, podemos utilizar a interface `java.util.function.Function` com o método `apply`. Para casos onde há dois parâmetros, podemos ainda utilizar a interface `java.util.function.BiFunction`. Evidentemente a API não supre todos os casos possíveis, mas nada impede que nós mesmos criemos as interfaces correspondentes.

Os arrays também não ficaram de fora, para usarmos o *method reference*, utilizamos a sintaxe `array[]::new`, a novidade aqui é que a sintaxe ganha os colchetes, exemplo: `float[]::new`.

Além disso podemos ainda referenciar um métodos da classe mãe, com um `super::nomeDoMetodo` e métodos estáticos como `Integer::parseInt`. Vale salientar que para cada operação, deve-se ter uma interface funcional que será a referência, aqui vimos algumas, mas existem diversas outras como: `java.util.function.ToIntFunction`, `java.util.function.ToIntBiFunction` e diversas variações dos tipos primitivos, que evitam o *autoboxing*.

## <a name="conclusao">Conclusão</a>

Neste tutorial vimos uma parte importante do novo desing da linguagem Java a partir da versão 8, neste ponto, o leitor poderá compreender como funciona a API de *Stream*, os novos métodos nas interfaces do *Collection framework* e diversos outros métodos adicionados em várias classes e interfaces do JDK.
