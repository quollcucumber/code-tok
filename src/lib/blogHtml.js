import DOMPurify from 'dompurify'
import renderMathInElement from 'katex/contrib/auto-render'
import 'katex/dist/katex.min.css'

// Codeforces blogs embed LaTeX with $$$...$$$ (inline) and $$$$$$...$$$$$$ (display).
const MATH_DELIMITERS = [
  { left: '$$$$$$', right: '$$$$$$', display: true },
  { left: '$$$', right: '$$$', display: false },
]

// Sanitizes blog HTML and bakes KaTeX output into the returned string, so the
// rendered math survives any later re-application of the HTML to the DOM.
export function prepareBlogHtml(html) {
  const el = document.createElement('div')
  el.innerHTML = DOMPurify.sanitize(html)
  renderMathInElement(el, { delimiters: MATH_DELIMITERS, throwOnError: false })
  return el.innerHTML
}
