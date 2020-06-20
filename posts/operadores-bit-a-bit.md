---
title: Operadores bit à bit em Java
date: 2020-06-19
banner_image: setup.jpg
description: Na carreira de desenvolvedor web, seja back-end ou front-end não é muito comum a utilização de operadores bit à bit, porém conhecê-los é parte importante para resolução de muitos problemas. Neste artigo iremos conhecer o conceito e iremos avaliar uma aplicação prática.
categories:
- Java
- Tutoriais
meta_description: Na carreira de desenvolvedor web, seja back-end ou front-end não é muito comum a utilização de operadores bit à bit, porém conhecê-los é parte importante para resolução de muitos problemas. Neste artigo iremos conhecer o conceito e iremos avaliar uma aplicação prática.
browser_title: Operadores bit à bit!
comments: true
---

Na carreira de desenvolvedor web, seja back-end ou front-end não é muito comum a utilização de operadores bit à bit, porém conhecê-los é parte importante para resolução de muitos problemas. Neste artigo iremos conhecer o conceito e iremos avaliar uma aplicação prática.

Os operadores bit à bit (bitwise) são utilizados para a manipulação de maneira individual dos bits de um número inteiro (byte, short, int e long), vamos analisá-los para saber como cada um funciona.

### Operador AND (&)

O operador `&` retorna 1 se, e somente se, as entradas `a` e `b` forem 1.

| a | b | a & b |
|:-:|:-:|:-----:|
| 0 | 0 |   0   |
| 0 | 1 |   0   |
| 1 | 0 |   0   |
| 1 | 1 |   1   |

Exemplo,

```java
int a = 3; // 0011 (em binário)
int b = 5; // 0101 (em binário)
System.out.println(a & b); // exibe o resultado 1

  0011
& 0101
------
  0001
```

### Operador OR (|)

O operador `|` retorna 1 se a entrada `a` ou `b` possuir o valor 1.

| a | b | a \| b |
|:-:|:-:|:------:|
| 0 | 0 |   0    |
| 0 | 1 |   1    |
| 1 | 0 |   1    |
| 1 | 1 |   1    |

Exemplo,

```java
int a = 3; // 0011 (em binário)
int b = 5; // 0101 (em binário)
System.out.println(a & b); // exibe o resultado 7

  0011
& 0101
------
  0111
```

### Operador XOR (^)

O operador `^` retorna 1 se a entrada `a` for diferente da entrada `b`.

| a | b | a ^ b |
|:-:|:-:|:-----:|
| 0 | 0 |   0   |
| 0 | 1 |   1   |
| 1 | 0 |   1   |
| 1 | 1 |   0   |

Exemplo,

```java
int a = 3; // 0011 (em binário)
int b = 5; // 0101 (em binário)
System.out.println(a ^ b); // exibe o resultado 6

  0011
& 0101
------
  0110
```

### Operador Complemento (~)

O operador `~` inverte a entrada, ou seja, se a entrada for 1 o resultado é 0, caso seja 0 o resultado é 1.

| a | ~a  |
|:-:|:---:|
| 0 |  1  |
| 0 |  1  |
| 1 |  0  |
| 1 |  0  |

Exemplo,

```java
int a = 3; // 0011 (em binário)
System.out.println(~a); // exibe o resultado -4

~ 0011
------
  1100
```

Um detalhe importante nesse exemplo é que 1100 em decimal é 12, porém o resultado mostrado é -4. Isso acontece porque a JVM utiliza a representação complemento de 2, portanto o bit mais a esquerda representa o sinal e, os bits restantes, o valor.

### Operador deslocamento à direita com sinal (>>)

O operador `>>` desloca os bits do número para a direita e preenche com 0 os vazios deixados no resultado. Esse operador mantém o sinal, logo o bit mais a esquerda dependerá do sinal do número de entrada.

Exemplo,

```java
int a = 6 // 0110 (em binário)
System.out.println(a >> 1); // desloca 1 bit à direita e exibe o resultado 3

>> 0110
-------
   0011

int b = -4 // 1100 (em binário)
System.out.println(b >> 1); // desloca 1 bit à direita e exibe o resultado -2

>> 1100
-------
   1010
```

O efeito desse operador é semelhante a dividir a entrada pela potência de 2, nos exemplos acima obtemos o mesmo resultado dividindo a entrada por 2¹.

### Operador deslocamento à direita sem sinal (>>>)

O operador `>>>` é semelhante ao operador `>>`, porém não mantém o sinal do número de entrada.

Exemplo,

```java
int b = -4 // 1100 (em binário)
System.out.println(b >> 1); // exibe o resultado 2147483646
```

### Operador deslocamento à esquerda (<<)

O operador `<<` desloca os bits do número à esquerda e preenche com 0 os vazios deixados no resultado. O efeito desse operador é o mesmo que multiplicar o valor da entrada pela potência de dois.

Exemplo,

```java
int a = 3 // 0011 (em binário)
System.out.println(a >> 1); // desloca 1 bit à esquerda e exibe o resultado 6

<< 0011
-------
   0110

int b = -2 // 1010 (em binário)
System.out.println(b << 1); // desloca 1 bit à esquerda e exibe o resultado -4

<< 1010
-------
   1100
```

## Aplicação prática

Agora que já analisamos e compreendemos os conceitos dos operadores bit à bit, vamos criar uma classe que representa cores no padrão RGBA (RED, GREEN, BLUE e ALPHA). 
Sabemos que, cada componente de uma cor no padrão RBGA é um número de intensidade que varia entre 0 e 255. Podemos então armazenar esse intervalo em oito bits de dados, como são quatro componentes, precisaremos de 32 bits de armazenamento. Na linguagem Java temos o tipo primitivo int que comporta exatamente os 32 bits que precisamos.

Para utilizar uma única variável, precisamos particioná-la em quatro partes de oito bits, na primeira partição iremos armazenar os valores do componente RED, na segunda o componente GREEN, na terceira o componente BLUE e na última o componente ALPHA.

```no
00000000  00000000  00000000  00000000
   RED     GREEN      BLUE     ALPHA
```

Vamos ao código,

```java
public class Color {
    private final int value; // armazena o valor da cor
    private Color(int r, int g, int b, int a) {
        this.value = ((r << 24) | (g << 16) | (b << 8) | a);
    }
}
```

Criamos uma classe Color que contém um construtor que recebe os quatro componentes. A primeira linha do construtor faz a atribuição do valor. Vamos analisar passo a passo no que ocorre na instrução de atribuição:

```java
int r = 100 // 00000000 00000000 00000000 01100100
int g = 150 // 00000000 00000000 00000000 10010110
int b = 200 // 00000000 00000000 00000000 11001000
int a = 255 // 00000000 00000000 00000000 11111111
// Passo 1
(r << 24) // r = 01100100 00000000 00000000 00000000
// Passo 2
(g << 16) // g = 00000000 10010110 00000000 00000000 
// Passo 3
r | g     // t = 01100100 10010110 00000000 00000000
// Passo 4
(b << 8)  // b = 00000000 00000000 11001000 00000000
// Passo 5
t | b     // t = 01100100 10010110 11001000 00000000
// Passo 6
t | a     // t = 01100100 10010110 11001000 11111111
// Passo 7
this.value = t
```

Esses passos é um mapa mental para entender como é feita a atribuição da variável `value` com os quatro componentes informados pelo construtor. Agora vamos criar os métodos para extrair os componentes a partir da variável `value`.

Para recuperar o componente RED deslocamos 24 bits à direita e preenchemos as lacunas com zero ignorando o sinal.

```java
public int red() {
    return this.value >>> 24;
}
```

Para recuperar os componentes GREEN e BLUE além de deslocar os bits para a direita, precisamos também “limpar” os componentes da esquerda, para isso utilizamos o operador `&` com o segundo argumento 0xFF = 255 = 11111111, com isso somente os oito primeiros bits mais a direita serão conservados, todos os outros irão conter o valor zero.

```java
public int green() {
    return (this.value >>> 16) & 0xFF;
}
public int blue() {
    return (this.value >>> 8) & 0xFF;
}
```

Por fim, para obter o componente ALPHA precisamos somente “limpar” os bits da esquerda, preservando somente os oito mais à direita.
```java
public int alpha() {
    return this.value & 0xFF;
}
```

A classe completa é exibida abaixo:

```java
public class Color {

    private final int value;

    private Color(int r, int g, int b, int a) {
        validateRange(r, g, b, a);
        this.value = ((r << 24) | (g << 16) | (b << 8) | a);
    }

    public int red() {
        return this.value >>> 24;
    }

    public int green() {
        return (this.value >>> 16) & 0xFF;
    }

    public int blue() {
        return (this.value >>> 8) & 0xFF;
    }

    public int alpha() {
        return this.value & 0xFF;
    }

    public String toHTML() {
        return String.format("#%X", value);
    }

    private void validateRange(int r, int g, int b, int a) {
        String component = "";
        if (r < 0 || r > 255) {
            component += " Red";
        }
        if (g < 0 || g > 255) {
            component += " Green";
        }
        if (b < 0 || b > 255) {
            component += " Blue";
        }
        if (a < 0 || a > 255) {
            component += " Alpha";
        }
        if (!component.isEmpty()) {
            throw new IllegalArgumentException(
              "Color parameter outside of expected range:" + component);
        }
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;

        Color color = (Color) o;

        return value == color.value;
    }

    @Override
    public int hashCode() {
        return value;
    }

    @Override
    public String toString() {
        return String.format(
          "Color {Red = %d, Green = %d, Blue = %d, Alpha = %d, Hexadecimal = %s}",
          red(), green(), blue(), alpha(), toHTML());
    }

    public static Color rgba(int r, int g, int b, int a) {
        return new Color(r, g, b, a);
    }

    public static Color rgb(int r, int g, int b) {
        return new Color(r, g, b, 0x255);
    }
}
```

## Conclusão

Conhecer os operadores bit à bit de sua linguagem preferida é parte fundamental no desenvolvimento de software, eles são úteis em diversas situações onde manipular os bits de um determinado valor é mais prático ou performático, ou simplesmente é a única ferramenta possível para resolver um determinado problema.

Não deixe de comentar sobre suas impressões e se curtiu compartilhe com seus conhecidos e amigos, até a próxima!
