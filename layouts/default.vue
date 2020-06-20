<template>
  <div>
    <input id="sidebar-checkbox" type="checkbox" class="sidebar-checkbox" />
    <c-sidebar />
    <div class="main-wrapper" @click="closeNavbar">
      <div class="header">
        <div class="container">
          <div class="header-logo">
            <nuxt-link to="/">
              <img src="~/assets/images/new-logo.png" alt="Logo" />
            </nuxt-link>
          </div>
          <div class="header-title">
            <nuxt-link to="/">
              <h3>Caique Oliveira <small>blog</small></h3>
            </nuxt-link>
          </div>
        </div>
      </div>

      <div class="container content">
        <nuxt />
      </div>

      <a
        v-scroll-to="'.main-wrapper'"
        href=""
        class="wc-top"
        :class="{ 'wc-is-visible': showTop }">
        Top
      </a>
    </div>
    <label for="sidebar-checkbox" class="sidebar-toggle">
      <span></span>
    </label>
  </div>
</template>

<script>
import CSidebar from '~/components/CSidebar.vue'
export default {
  components: {
    CSidebar
  },
  data() {
    return {
      windowTop: 0
    }
  },
  computed: {
    showTop() {
      return this.windowTop > 300
    }
  },
  mounted() {
    window.addEventListener("scroll", this.onScroll)
  },
  beforeDestroy() {
    window.removeEventListener("scroll", this.onScroll)
  },
  methods: {
    onScroll() {
      const doc = document.documentElement
      this.windowTop = (window.pageYOffset || doc.scrollTop) - (doc.clientTop || 0)
    },
    closeNavbar() {
      if (document.getElementById("sidebar-checkbox").checked) {
        document.getElementById("sidebar-checkbox").checked = false
      }
    }
  }
}
</script>
