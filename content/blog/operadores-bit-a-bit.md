---
title: Operadores bit a bit em Java
slug: operadores-bit-a-bit
date: 2020-06-19
banner_image: setup.jpg
description: Na carreira de desenvolvedor, seja back-end ou front-end, não é muito comum a utilização de operadores bit a bit, porém conhecê-los é parte importante para a resolução de muitos problemas. Neste artigo conheceremos o conceito e avaliaremos uma aplicação prática.
categories:
- Java
- Tutoriais
meta_description: Na carreira de desenvolvedor, seja back-end ou front-end, não é muito comum a utilização de operadores bit a bit, porém conhecê-los é parte importante para a resolução de muitos problemas. Neste artigo conheceremos o conceito e avaliaremos uma aplicação prática.
browser_title: Operadores bit a bit!
comments: true
---

Na carreira de desenvolvedor, seja back-end ou front-end, não é muito comum a utilização de operadores bit a bit. Porém, conhecê-los é parte importante para a resolução de muitos problemas. Neste artigo conheceremos o conceito e avaliaremos uma aplicação prática.

Os operadores bit a bit (*bitwise*) são utilizados para a manipulação individual dos bits de um número inteiro (`byte`, `short`, `int` e `long`). Vamos analisá-los para entender como cada um funciona.

### Operador AND (&)

O operador `&` retorna `1` se, e somente se, as entradas `a` e `b` forem `1`.

| a | b | a & b |
|:-:|:-:|:-----:|
| 0 | 0 |   0   |
| 0 | 1 |   0   |
| 1 | 0 |   0   |
| 1 | 1 |   1   |

Exemplo:

```java
int a = 3; // 0011 (em binário)
int b = 5; // 0101 (em binário)
System.out.println(a & b); // exibe 1

  0011
& 0101
------
  0001
```

### Operador OR (|)

O operador `|` retorna `1` se a entrada `a` ou `b` possuir o valor `1`.

| a | b | a \| b |
|:-:|:-:|:------:|
| 0 | 0 |   0    |
| 0 | 1 |   1    |
| 1 | 0 |   1    |
| 1 | 1 |   1    |

Exemplo:

```java
int a = 3; // 0011 (em binário)
int b = 5; // 0101 (em binário)
System.out.println(a | b); // exibe 7

  0011
| 0101
------
  0111
```

### Operador XOR (^)

O operador `^` retorna `1` se a entrada `a` for diferente da entrada `b`.

| a | b | a ^ b |
|:-:|:-:|:-----:|
| 0 | 0 |   0   |
| 0 | 1 |   1   |
| 1 | 0 |   1   |
| 1 | 1 |   0   |

Exemplo:

```java
int a = 3; // 0011 (em binário)
int b = 5; // 0101 (em binário)
System.out.println(a ^ b); // exibe 6

  0011
^ 0101
------
  0110
```

### Operador Complemento (~)

O operador `~` inverte cada bit da entrada: `1` torna-se `0` e `0` torna-se `1`.

| a | ~a |
|:-:|:--:|
| 0 |  1 |
| 1 |  0 |

Exemplo:

```java
int a = 3; // 0011 (em binário)
System.out.println(~a); // exibe -4

~ 0011
------
  1100
```

Um detalhe importante: `1100` em binário sem sinal equivale a `12` em decimal, porém o resultado exibido é `-4`. Isso ocorre porque a JVM utiliza a representação em complemento de dois, onde o bit mais à esquerda indica o sinal e os bits restantes representam o valor.

### Operador de deslocamento à direita com sinal (>>)

O operador `>>` desloca os bits do número para a direita, preenchendo as posições à esquerda com o bit de sinal — `0` para números positivos e `1` para negativos.

Exemplo:

```java
int a = 6; // 0110 (em binário)
System.out.println(a >> 1); // desloca 1 bit à direita, exibe 3

>> 0110
-------
   0011

int b = -4; // 11111111 11111111 11111111 11111100 (em binário, complemento de dois)
System.out.println(b >> 1); // desloca 1 bit à direita, exibe -2

>> 11111111 11111111 11111111 11111100
---
   11111111 11111111 11111111 11111110
```

O efeito desse operador é equivalente a dividir a entrada por uma potência de 2. Nos exemplos acima, deslocar 1 bit equivale a dividir por 2¹.

### Operador de deslocamento à direita sem sinal (>>>)

O operador `>>>` funciona como o `>>`, mas sempre preenche com `0` as posições à esquerda, independentemente do sinal.

Exemplo:

```java
int b = -4;
System.out.println(b >>> 1); // exibe 2147483646
```

### Operador de deslocamento à esquerda (<<)

O operador `<<` desloca os bits do número para a esquerda, preenchendo as posições à direita com `0`. O efeito é equivalente a multiplicar o valor por uma potência de dois.

Exemplo:

```java
int a = 3; // 0011 (em binário)
System.out.println(a << 1); // desloca 1 bit à esquerda, exibe 6

<< 0011
-------
   0110

int b = -2; // 11111111 11111111 11111111 11111110 (em binário)
System.out.println(b << 1); // desloca 1 bit à esquerda, exibe -4

<< 11111111 11111111 11111111 11111110
---
   11111111 11111111 11111111 11111100
```

## Aplicação prática

Agora que compreendemos os operadores bit a bit, vamos criar uma classe que representa cores no padrão RGBA (Red, Green, Blue e Alpha).

Cada componente de uma cor RGBA é um valor de intensidade entre 0 e 255, que pode ser armazenado em 8 bits. Como são quatro componentes, precisamos de 32 bits no total — exatamente o tamanho do tipo primitivo `int` em Java.

Para usar uma única variável, particionamos seus 32 bits em quatro partes de 8 bits: a primeira armazena Red, a segunda Green, a terceira Blue e a quarta Alpha.

```
00000000  00000000  00000000  00000000
   RED     GREEN      BLUE     ALPHA
```

Vejamos o código:

```java
public class Color {
    private final int value;

    private Color(int r, int g, int b, int a) {
        this.value = ((r << 24) | (g << 16) | (b << 8) | a);
    }
}
```

A instrução de atribuição no construtor pode ser entendida passo a passo:

```java
int r = 100; // 00000000 00000000 00000000 01100100
int g = 150; // 00000000 00000000 00000000 10010110
int b = 200; // 00000000 00000000 00000000 11001000
int a = 255; // 00000000 00000000 00000000 11111111

// Passo 1: desloca r 24 bits à esquerda
(r << 24) // 01100100 00000000 00000000 00000000
// Passo 2: desloca g 16 bits à esquerda
(g << 16) // 00000000 10010110 00000000 00000000
// Passo 3: combina r e g com OR
r | g     // 01100100 10010110 00000000 00000000
// Passo 4: desloca b 8 bits à esquerda
(b << 8)  // 00000000 00000000 11001000 00000000
// Passo 5: combina com b
t | b     // 01100100 10010110 11001000 00000000
// Passo 6: combina com a (sem deslocamento)
t | a     // 01100100 10010110 11001000 11111111
```

Agora os métodos para extrair cada componente a partir de `value`:

Para Red, deslocamos 24 bits à direita sem sinal:

```java
public int red() {
    return this.value >>> 24;
}
```

Para Green e Blue, além do deslocamento, aplicamos `& 0xFF` para zerار os bits dos componentes à esquerda, preservando apenas os 8 bits relevantes:

```java
public int green() {
    return (this.value >>> 16) & 0xFF;
}

public int blue() {
    return (this.value >>> 8) & 0xFF;
}
```

Para Alpha, basta aplicar `& 0xFF` diretamente, sem deslocamento:

```java
public int alpha() {
    return this.value & 0xFF;
}
```

A classe completa:

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
        if (r < 0 || r > 255) component += " Red";
        if (g < 0 || g > 255) component += " Green";
        if (b < 0 || b > 255) component += " Blue";
        if (a < 0 || a > 255) component += " Alpha";
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
        return new Color(r, g, b, 0xFF);
    }
}
```

## Conclusão

Conhecer os operadores bit a bit é parte fundamental no desenvolvimento de software. Eles são úteis em diversas situações onde manipular individualmente os bits de um valor é mais prático, mais performático ou simplesmente a única abordagem viável para resolver o problema.
