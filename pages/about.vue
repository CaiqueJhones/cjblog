<template>
  <div class="post">
    <div class="banner-image">
      <img src="/programador.png" alt="Sobre">
    </div>
    <header class="post-header">
      <h1 class="post-title">Sobre</h1>
      <p class="post-meta">
        <span class="categories">Caique Oliveira</span>
      </p>
    </header>
    <article class="post-content">
      <p>
        Sou desenvolvedor de sistemas, trabalho principalmente com desenvolvimento back-end e front-end de aplicações web e mobile. No back-end tenho experiências com as linguagens Java e Kotlin e utilizo regularmente o famoso Spring Framework e seu ecossistema. No front-end gosto bastante do Vue.js, mas trabalho também com o Angular. Já no mundo mobile tenho experiência com desenvolvimento de aplicativos nativos para Android.
      </p>
      <p>
        Banner <a href="http://www.freepik.com">Designed by stories / Freepik</a>.
      </p>
    </article>
  </div>
</template>
<script>
export default {
  scrollToTop: true,
  head() {
    return {
      title: 'Sobre - Caique Oliveira'
    }
  }
}
</script>
