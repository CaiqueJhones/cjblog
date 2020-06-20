import path from 'path'
import fs from 'fs'

const posts = fs.readdirSync('./posts')
const title = 'Caique Oliveira Blog'
const baseUrl = process.env.NODE_ENV === 'production' ? 'https://caiquejh.com.br' : 'http://localhost:3000'

export default {
  /*
   ** Env
   */
  env: {
    posts,
    disqus: 'cjhonesblog',
    title,
    baseUrl
  },
  /*
   ** Headers of the page
   */
  head: {
    title,
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      {
        hid: 'description',
        name: 'description',
        content: process.env.npm_package_description || ''
      },
      { name: 'author', content: 'Caique Oliveira' },
      { property: "og:title", content: title },
      { property: "og:type", content: 'blog' },
      { property: "og:image", content: `${baseUrl}/new-logo.png` },
      { property: "og:url", content: baseUrl },
      { property: "og:site_name", content: title },
      { name: "twitter:card", content: 'summary' },
      { name: "twitter:url", content: baseUrl },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: process.env.npm_package_description },
    ],
    link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }]
  },
  /*
   ** Customize the progress-bar color
   */
  loading: {
    color: '#017785',
    height: '3px'
  },
  /*
   ** Global CSS
   */
  css: [
    '@/assets/gaya/main.scss'
  ],
  /*
   ** Plugins to load before mounting the App
   */
  plugins: [],
  /*
  ** Nuxt.js build-modules
  */
 buildModules: [
    // Doc: https://github.com/nuxt-community/eslint-module
    '@nuxtjs/eslint-module',
    ['@nuxtjs/google-analytics', {id: 'UA-46646162-4'}]
  ],
  /*
   ** Nuxt.js modules
   */
  modules: [
    ['vue-scrollto/nuxt', { duration: 1000 }]
  ],
  /*
   ** Build configuration
   */
  build: {
    /*
     ** You can extend webpack config here
     */
    extend(config, _) {
      config.module.rules.push({
        test: /\.md$/,
        loader: 'frontmatter-markdown-loader',
        include: path.resolve(__dirname, 'posts'),
        options: {
          vue: {
            root: 'dynamicMarkdown'
          }
        }
      })
    }
  },
  generate: {
    fallback: true,
    routes: posts.map(post => {
      const name = post.split('.')[0]
      return `/${name}`
    })
  }
}
