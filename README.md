# cjblog

Blog pessoal de [Caique Oliveira](https://caiquejh.com.br) sobre engenharia de software e boas práticas.

Construído com [Hugo](https://gohugo.io) e tema próprio **cjblog**, usando a paleta de cores [Catppuccin Mocha](https://catppuccin.com/palette).

## Pré-requisitos

- [Hugo](https://gohugo.io/installation/) v0.158 ou superior (extended)

## Desenvolvimento

Inicie o servidor local com live reload:

```bash
hugo server -D
```

O blog ficará disponível em `http://localhost:1313`.

## Novo post

```bash
hugo new content blog/nome-do-post.md
```

O arquivo será criado em `content/blog/` com o frontmatter padrão. Edite o conteúdo e remova `draft: true` quando o post estiver pronto.

### Frontmatter disponível

```yaml
---
title: "Título do post"
slug: url-do-post # opcional, gerado a partir do título por padrão
date: 2026-01-01
banner_image: imagem.jpg # opcional, arquivo em themes/cjblog/static/images/
description: "Resumo exibido nos cards e no meta description."
categories:
  - Java
tags:
  - tutorial
comments: true
---
```

## Build para produção

```bash
hugo --minify
```

Os arquivos estáticos são gerados em `public/`.

## Estrutura

```
cjblog/
├── content/
│   ├── blog/          # posts
│   └── about.md       # página sobre
├── themes/cjblog/
│   ├── layouts/       # templates HTML
│   └── static/
│       ├── css/       # estilos (Catppuccin Mocha)
│       ├── js/        # scripts
│       └── images/    # imagens dos posts
└── hugo.toml          # configuração principal
```
