<template>
  <div id="sidebar" class="sidebar">
    <img src="~/assets/images/myAvatar.png" alt="Caique Oliveira" />

    <div class="sidebar-info">
      <p>
        Blog sobre programação, com tutoriais e bate papo sobre as
        novidades do mundo de desenvolvimento.
      </p>
    </div>

    <nav class="sidebar-nav" @click="close">
      <nuxt-link
        no-prefetch
        to="/"
        class="sidebar-nav-item"
        :class="{ active: '/' === $route.path }">
        Início
      </nuxt-link>
      <nuxt-link
        no-prefetch
        to="/archive"
        class="sidebar-nav-item"
        :class="{ active: '/archive' === $route.path }">
        Arquivos
      </nuxt-link>
      <nuxt-link
        no-prefetch
        to="/about"
        class="sidebar-nav-item"
        :class="{ active: '/about' === $route.path }">
        Sobre
      </nuxt-link>
    </nav>

    <div class="sidebar-info small">
      <p>
        Copyright &copy; Caique Oliveira - {{ new Date().getFullYear() }}. Powered by
        <a href="https://nuxtjs.org" target="_blank">Nuxt</a> and Gaya Template
      </p>
    </div>
  </div>
</template>
<script>
export default {
  methods: {
    close() {
      document.getElementById("sidebar-checkbox").checked = false
    }
  }
}
</script>
