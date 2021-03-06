<template>
  <div class="post">
    <div v-if="bannerImage" class="banner-image">
      <img :src="ogImage" :alt="bannerAlt">
    </div>
    <div v-else-if="bannerVideo" class="banner_video">
      {{ bannerVideo }}
    </div>
    <header class="post-header">
      <h1 class="post-title">{{ title }}</h1>
      {{ readingTime }}
      <p class="post-meta">
        <span class="categories">{{ categories.join(' | ') }}</span> •
        <span class="post-date">{{ format(date) }}</span>
      </p>
    </header>
    <article class="post-content">
      <dynamic-markdown
          ref="content"
          :render-func="renderFunc"
          :static-render-funcs="staticRenderFuncs" />
    </article>
    <!-- <div class="related-posts">
      <h4>Publicações relacionadas</h4>
      <ul>
        <li>
          <h5>
            <a href="#">
              Java 9
              <small>10-07-2019</small>
            </a>
          </h5>
        </li>
      </ul>
    </div> -->
    <div class="author-info">
      <c-author></c-author>
      <c-share-buttons :title="title" :link="slug"></c-share-buttons>
    </div>
    <div class="comments">
      <div id="disqus_thread"></div>
    </div>
  </div>
</template>
<script>
import { format } from 'date-fns'
import pt from 'date-fns/locale/pt'
import DynamicMarkdown from '~/components/Markdown/DynamicMarkdown.vue'
import CAuthor from '~/components/CAuthor'
import CShareButtons from '~/components/CShareButtons'
export default {
  scrollToTop: true,
  components: {
    DynamicMarkdown,
    CAuthor,
    CShareButtons
  },
  async asyncData({ params }) {
    const fileContent = await import(`~/posts/${params.slug}.md`)
    const attr = fileContent.attributes
    return {
      slug: params.slug,
      title: attr.title,
      date: attr.date,
      bannerImage: attr.banner_image,
      bannerAlt: attr.banner_alt || '',
      bannerVideo: attr.banner_video,
      categories: attr.categories,
      browserTitle: attr.browser_title,
      metaDescription: attr.meta_description,
      comments: attr.comments,
      renderFunc: fileContent.vue.render,
      staticRenderFuncs: fileContent.vue.staticRenderFns
    }
  },
  data() {
    return {
      isMounted: false
    }
  },
  computed: {
    readingTime() {
      if (this.isMounted) {
        const words = this.$refs.content.$el.textContent.split(' ').length
        const minutes = Math.ceil(words / 180)
        const label = minutes === 1 ? 'minuto' : 'minutos'
        return minutes < 1 ? 'Menos que 1 minuto de leitura' : `${minutes} ${label} de leitura`
      }
      return ''
    },
    ogImage() {
      if (this.bannerImage) {
        return `/${this.bannerImage}`
      }
      return ''
    }
  },
  mounted() {
    this.isMounted = true
    if (this.comments) {
      this.disqus()
    }
  },
  methods: {
    format(date) {
      return format(date, 'D [de] MMMM [de] YYYY', { locale: pt })
    },
    disqus() {
      const dsq = document.createElement('script')
      dsq.type = 'text/javascript'
      dsq.async = true
      dsq.src = `//${process.env.disqus}.disqus.com/embed.js`
      dsq.setAttribute('data-timestamp', +new Date())
      document.getElementsByTagName('body')[0].appendChild(dsq)
    }
  },
  head() {
    return {
      title: this.browserTitle,
      meta: [
        { hid: 'description', name: 'description', property: 'og:description', content: this.metaDescription },
        { hid: 'og:title', property: 'og:title', content: this.browserTitle },
        { hid: 'og:type', property: 'og:type', content: 'article' },
        { hid: 'og:image', property: 'og:image', content: `${process.env.baseUrl}${this.ogImage}` },
        { hid: 'og:url', property: 'og:url', content: `${process.env.baseUrl}/blog/${this.slug}` },
        { hid: 'og:site_name', property: 'og:site_name', content: 'Caique Oliveira Blog' },
        { hid: 'twitter:card', name: 'twitter:card', content: 'summary' },
        { hid: 'twitter:url', name: 'twitter:url', content: `${process.env.baseUrl}/blog/${this.slug}` },
        { hid: 'twitter:title', name: 'twitter:title', content: this.browserTitle },
        { hid: 'twitter:description', name: 'twitter:description', content: this.metaDescription },
        { hid: 'twitter:image', name: 'twitter:image', content: `${process.env.baseUrl}${this.ogImage}` }
      ]
    }
  }
}
</script>
