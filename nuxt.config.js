import path from 'path'
import fs from 'fs'

const posts = fs.readdirSync('./posts')

export default {
  /*
   ** Env
   */
  env: {
    posts,
    disqus: 'cjhonesblog',
    baseUrl: process.env.NODE_ENV === 'production' ? 'https://caiquejh.com.br' : 'http://localhost:3000'
  },
  /*
   ** Headers of the page
   */
  head: {
    title: 'Caique Oliveira Blog',
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      {
        hid: 'description',
        name: 'description',
        content: process.env.npm_package_description || ''
      }
    ],
    link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }]
  },
  /*
   ** Customize the progress-bar color
   */
  loading: {
    color: '#5a46ff',
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
    '@nuxtjs/eslint-module'
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
