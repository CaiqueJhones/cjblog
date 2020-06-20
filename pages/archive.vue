<template>
  <div class="post">
    <div class="banner-image">
      <img src="~/assets/images/books.jpg" alt="Sobre">
    </div>
    <header class="post-header">
      <h1 class="post-title">Arquivos do blog</h1>
      <p class="post-meta">
        <span class="categories"></span>
      </p>
    </header>
    <article class="post-content">
      <ul v-for="(arc, i) in Object.entries(archives)" :key="i">
        <h4>{{ arc[0] }}</h4>
        <li v-for="(post, j) in arc[1]" :key="j">
          <nuxt-link :to="`/blog/${post.link}`">{{ post.title }}</nuxt-link>
        </li>
      </ul>
    </article>
  </div>
</template>
<script>
import { compareDesc, getYear } from 'date-fns'
export default {
  scrollToTop: true,
  asyncData() {
    async function asyncImport(post) {
      const md = await import(`~/posts/${post}`)
      const link = post.split('.')[0]
      return { attributes: md.attributes, link }
    }

    return Promise.all(process.env.posts.map(asyncImport)).then(res => {
      res = res.sort((r1, r2) => compareDesc(r1.attributes.date, r2.attributes.date))
      return {
        posts: res.map(r => { return { ...r.attributes, link: r.link, year: getYear(r.attributes.date) } })
      }
    })
  },
  computed: {
    archives() {
      return this.groupBy(this.posts, 'year')
    }
  },
  methods: {
    groupBy(xs, key) {
      return xs.reduce((rv, x) => {
        (rv[x[key]] = rv[x[key]] || []).push(x)
        return rv
      }, {})
    }
  },
  head() {
    return {
      title: 'Arquivos - Caique Oliveira'
    }
  }
}
</script>
