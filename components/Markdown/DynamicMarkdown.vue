<script>
import hljs from 'highlight.js/lib/highlight'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import css from 'highlight.js/lib/languages/css'
import xml from 'highlight.js/lib/languages/xml'
import c from 'highlight.js/lib/languages/cpp'
import plain from 'highlight.js/lib/languages/plaintext'

import 'highlight.js/styles/dracula.css'

hljs.registerLanguage('java', java)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('css', css)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('c', c)
hljs.registerLanguage('no', plain)

export default {
  props: {
    // eslint-disable-next-line
    renderFunc: String,
    // eslint-disable-next-line
    staticRenderFuncs: String
  },

  mounted() {
    const targets = document.querySelectorAll('pre code')
    targets.forEach(target => hljs.highlightBlock(target))
  },

  created() {
    // eslint-disable-next-line
    this.templateRender = new Function(this.renderFunc)()
    // eslint-disable-next-line
    this.$options.staticRenderFns = new Function(this.staticRenderFuncs)()
  },

  render(createElement) {
    return this.templateRender ? this.templateRender() : createElement('div', 'Rendering')
  }
}
</script>
