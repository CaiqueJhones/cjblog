---
title: "Java 8"
date: 2015-07-19
banner_image: java-8.png
description: Neste artigo veremos aspectos importantes da linguagem de programação Java a partir da versão 8.
categories:
- Java
- Tutoriais
comments: true
---

O Java 8, lançado em março de 2014, trouxe diversas melhorias no design da linguagem e novas APIs, como *Streams* e *Java Time*. Neste artigo analisaremos as principais mudanças no design da linguagem que prometem deixar o código mais conciso, reduzindo grande parte do *boilerplate* e abraçando conceitos oriundos do paradigma de programação funcional.

## Conteúdo

* [Expressões Lambda](#expressoes-lambdas)
* [Interfaces funcionais](#interfaces-funcionais)
* [Default Methods](#default-methods)
* [Method References](#method-references)
* [Conclusão](#conclusao)

## <a name="expressoes-lambdas">Expressões Lambda</a>

Uma das principais características implementadas na linguagem foi a expressão lambda. Com ela podemos implementar o método abstrato de uma interface de maneira muito mais concisa do que com classes anônimas. Vejamos uma nova forma de iterar sobre coleções:

```java
String nome = "Fabrício";
String sobrenome = "Santos";
String trabalho = "Agricultor";

List<String> attr = Arrays.asList(nome, sobrenome, trabalho);

System.out.println("---------Forma tradicional----------");
for (String s : attr) {
  System.out.println(s);
}

System.out.println("---------Com expressão lambda-------");
attr.forEach(s -> System.out.println(s));
```

A saída deste programa será:

```
---------Forma tradicional----------
Fabrício
Santos
Agricultor
---------Com expressão lambda-------
Fabrício
Santos
Agricultor
```

No exemplo acima definimos uma lista de strings e exibimos seu conteúdo de duas formas: a primeira com um *for-each* tradicional e a segunda utilizando o método `forEach`, presente na interface `java.lang.Iterable`, da qual `List` é herdeira. Seu argumento é do tipo `java.util.function.Consumer`, uma interface que contém um **único método abstrato**: o `accept(T t)`.

No método `forEach` passamos como parâmetro a expressão lambda `s -> System.out.println(s)`, que é uma forma mais concisa de escrever:

```java
attr.forEach(new Consumer<String>() {
  public void accept(String s) {
    System.out.println(s);
  }
});
```

Observe que o `s` antes do símbolo `->` equivale ao parâmetro `String s` do método `accept`. O que vem após o símbolo equivale ao corpo do método.

> Para implementar uma interface com uma expressão lambda, é necessário que ela contenha um único método abstrato, pois será exatamente esse método que a expressão lambda representará.

Existem ainda outras formas de declarar expressões lambda, como nos exemplos abaixo:

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
System.out.println("A soma de 1 + 2 = " + t.sum(1, 2));

interface Test {
  int sum(int a, int b);
}

JButton button = new JButton("Click");
button.addActionListener(event -> System.out.println("Fui clicado!"));
```

Podemos notar que:

* Quando o método não possui argumentos, como é o caso do `run` da interface `Runnable`, devemos usar `()` antes do símbolo `->`.
* Para um corpo com mais de uma instrução devemos delimitá-lo com chaves.
* Para métodos com dois ou mais argumentos a sintaxe é `(a, b) ->`. Os parênteses só podem ser omitidos quando há um único argumento.
* Podemos utilizar variáveis locais do método em que a lambda está contida, assim como ocorre com classes anônimas. A única exigência é que a variável local seja `final`.

> A partir do Java 8 você não precisa mais declarar explicitamente a variável como `final` quando ela não sofre mutações; o próprio compilador a trata como tal.

## <a name="interfaces-funcionais">Interfaces funcionais</a>

O Java 8 trouxe um novo pacote chamado `java.util.function`, que contém uma série de interfaces funcionais prontas para uso com expressões lambda. Essas interfaces possuem apenas **um único método abstrato**, característica que as define como **interfaces funcionais**. Interfaces antigas como `Runnable` e `ActionListener`, apesar de não terem sofrido alterações no Java 8, também se enquadram nessa definição.

### Criando interfaces funcionais

Para criar uma interface funcional, basta criar uma interface com um único método abstrato. A partir daí ela já poderá ser usada com uma expressão lambda:

```java
public interface Print {
  void draw(String txt);
}

Print p = txt -> System.out.println(txt);
p.draw("Artigo sobre interfaces funcionais");
```

Temos ainda a opção de anotar a interface com `@FunctionalInterface`, tornando explícita essa intenção:

```java
@FunctionalInterface
public interface Print {
  void draw(String txt);
}
```

Isso garante que, caso a interface receba um segundo método abstrato acidentalmente, o compilador lançará o seguinte erro:

```
Exception in thread "main" java.lang.Error: Unresolved compilation problem:
The target type of this expression must be a functional interface
```

## <a name="default-methods">Default Methods</a>

Vimos na seção [Expressões Lambda](#expressoes-lambdas) o método `forEach` presente na interface `Iterable`. Mas como esse método funciona sem quebrar código escrito antes do Java 8? A resposta é o *default method*:

```java
default void forEach(Consumer<? super T> action) {
  Objects.requireNonNull(action);
  for (T t : this) {
    action.accept(t);
  }
}
```

Com a palavra-chave `default` é possível definir métodos com implementação dentro de interfaces. Vejamos também a interface `Consumer`:

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

O *default method* `andThen` permite encadear dois `Consumer`. Vejamos na prática:

```java
Consumer<String> m1 = t -> System.out.print("Bem-vindo: ");
Consumer<String> m2 = t -> System.out.println(t);

List<String> list = Arrays.asList(
  "Lambda",
  "Interfaces funcionais",
  "Default methods"
);

list.forEach(m1.andThen(m2));
```

A saída será:

```
Bem-vindo: Lambda
Bem-vindo: Interfaces funcionais
Bem-vindo: Default methods
```

A API Collections ganhou vários *default methods* que ampliam consideravelmente suas capacidades, como `removeIf` e `replaceAll`:

```java
List<String> list = new ArrayList<>();
list.add("Lambda");
list.add("Interfaces funcionais");
list.add("Default methods");

list.removeIf(s -> s.contains("i"));

list.forEach(s -> System.out.println(s));
```

A saída será:

```
Lambda
Default methods
```

Apesar de ser possível escrever métodos com implementação em interfaces, isso não significa que o Java passou a aceitar herança múltipla de estado, já que interfaces não armazenam estado.

## <a name="method-references">Method References</a>

O *method reference* é um recurso semelhante às expressões lambda, porém com sintaxe ainda mais enxuta:

```java
public class Author {
  private String name;

  // construtor, getters e setters

  public void imprime() {
    System.out.println(name);
  }
}

Author caique = new Author("Caique Jhones");
Author junior = new Author("Junior dos Santos");
Author flavio = new Author("Flávio José");

List<Author> autores = Arrays.asList(caique, junior, flavio);

Consumer<Author> comLambda    = a -> a.imprime();
Consumer<Author> comReference = Author::imprime;

autores.forEach(comLambda);
System.out.println("-------------");
autores.forEach(comReference);
```

A saída:

```
Caique Jhones
Junior dos Santos
Flávio José
-------------
Caique Jhones
Junior dos Santos
Flávio José
```

A sintaxe usa o nome da classe seguido do delimitador `::` e do nome do método **sem parênteses**. Isso equivale à expressão lambda correspondente, mas com código mais conciso. Toda a resolução ocorre em tempo de compilação — não há reflexão envolvida.

### Referências a métodos de instância

Um *method reference* do tipo `Author::imprime` só pode ser atribuído a uma interface funcional que receba como argumento uma instância de `Author`, como é o caso de `Consumer`:

```java
public interface Consumer<T> {
    void accept(T t);
}
```

O compilador então executa o método `imprime` na instância recebida em `accept`. Também é possível referenciar um método em uma instância específica — `caique::imprime` — e atribuí-lo a uma interface funcional sem parâmetros:

```java
Runnable r = caique::imprime;
new Thread(r).start();
```

Não confunda `Author::imprime` com `caique::imprime`: o primeiro executará o método em qualquer `Author` passado como parâmetro; o segundo executará sempre na instância `caique`.

### Referências a construtores

É possível referenciar construtores para criar novas instâncias, funcionando como uma *factory*:

```java
// Com construtor padrão
Supplier<Author> factory = Author::new;
Author semNome = factory.get();

// Com construtor que recebe um argumento
Function<String, Author> fac = Author::new;
Author caique = fac.apply("Caique Jhones");
```

Para um construtor padrão usa-se `Supplier` com o método `get`. Para um construtor com um argumento usa-se `Function` com o método `apply`. Para dois argumentos usa-se `BiFunction`. Para casos não cobertos pela API, basta criar a interface funcional correspondente.

Arrays também suportam *method reference*: a sintaxe ganha colchetes, como em `float[]::new`.

Outros usos incluem referência ao método da superclasse com `super::nomeDoMetodo` e a métodos estáticos como `Integer::parseInt`. Para cada caso é necessária uma interface funcional compatível. O pacote `java.util.function` oferece variações como `ToIntFunction` e `ToIntBiFunction`, incluindo versões para tipos primitivos que evitam o *autoboxing*.

## <a name="conclusao">Conclusão</a>

Neste tutorial vimos uma parte importante do novo design da linguagem Java a partir da versão 8. Com esse conhecimento, o leitor estará preparado para compreender a API de *Streams*, os novos métodos nas interfaces do *Collections Framework* e as demais adições ao JDK introduzidas nessa versão.
