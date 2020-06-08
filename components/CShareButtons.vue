<template>
  <div class="share-buttons">
    <h5>Compartilhe</h5>
    <ul class="social-media">
      <li>
        <a
          title="Twitter"
          :href="twitterUrl"
          class="twitter wc-img-replace"
          target="_blank">
          Twitter
        </a>
      </li>
      <li>
        <a
          title="Facebook"
          :href="facebookUrl"
          class="facebook wc-img-replace"
          target="_blank">
          Facebook
        </a>
      </li>
    </ul>
  </div>
</template>
<script>
export default {
  props: {
    link: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      pageUrl: `${process.env.baseUrl}/blog/${this.link}`
    }
  },
  computed: {
    twitterUrl() {
      return `https://twitter.com/intent/tweet?text=${this.title}&url=${this.pageUrl}`
    },
    facebookUrl() {
      return `https://www.facebook.com/sharer/sharer.php?u=${this.pageUrl}&t=${this.title}`
    }
  }
}
</script>
