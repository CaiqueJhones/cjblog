<template>
  <div>
    <div class="posts">
      <article v-for="(post, index) in pagedPosts" :key="index" class="post">
        <div v-if="post.banner_image" class="banner-image">
          <img :src="`/${post.banner_image}`" :alt="`${post.title}`"/>
        </div>

        <h1 class="post-title">
          <nuxt-link :to="`/blog/${post.link}`">{{ post.title }}</nuxt-link>
        </h1>

        <p class="post-meta">
          <span class="categories">{{ post.categories.join(', ')}}</span> |
          <span class="post-date">{{ format(post.date) }} • Caique Oliveira</span>
        </p>
        <p>{{ post.description }}</p>
      </article>
    </div>
    <div class="pagination">
      <span
        v-if="isFirst"
        class="pagination-item newer btn-disabled">
        Mais novo
      </span>
      <button
        v-else
        v-scroll-to="'.main-wrapper'"
        class="pagination-item newer btn"
        @click="page--">
        Mais novo
      </button>
      <span
        v-if="isLast"
        class="pagination-item older btn-disabled">
        Mais antigo
      </span>
      <button
        v-else
        v-scroll-to="'.main-wrapper'"
        class="pagination-item older btn"
        @click="page++">
        Mais antigo
      </button>
    </div>
  </div>
</template>
<script>
import { compareDesc, format } from 'date-fns'

export default {
  asyncData() {
    async function asyncImport(post) {
      const md = await import(`~/posts/${post}`)
      const link = post.split('.')[0]
      return { attributes: md.attributes, link }
    }

    return Promise.all(process.env.posts.map(asyncImport)).then(res => {
      res = res.sort((r1, r2) => compareDesc(r1.attributes.date, r2.attributes.date))
      return {
        posts: res.map(r => { return { ...r.attributes, link: r.link } })
      }
    })
  },
  data() {
    return {
      page: 0,
      size: 5,
      total: process.env.posts.length
    }
  },
  computed: {
    pagedPosts() {
      const start = this.page * this.size
      const end = start + this.size
      return this.posts.slice(start, end)
    },
    isFirst() {
      return this.page === 0
    },
    isLast() {
      const maxIndexPage = Math.max(0, Math.ceil(this.total / this.size) - 1)
      return this.page === maxIndexPage
    }
  },
  methods: {
    format(date) {
      return format(date, 'DD/MM/YYYY')
    }
  }
}
</script>
