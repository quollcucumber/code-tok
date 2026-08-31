import DOMPurify from 'dompurify'
import renderMathInElement from 'katex/contrib/auto-render'
import 'katex/dist/katex.min.css'

// Codeforces blogs embed LaTeX with $$$...$$$ (inline) and $$$$$$...$$$$$$ (display).
const MATH_DELIMITERS = [
  { left: '$$$$$$', right: '$$$$$$', display: true },
  { left: '$$$', right: '$$$', display: false },
]

// Older problem statements in the open-r1/codeforces dataset use $$...$$
// (inline, mid-sentence) instead of the modern $$$...$$$ style.
const PROBLEM_MATH_DELIMITERS = [...MATH_DELIMITERS, { left: '$$', right: '$$', display: false }]

function prepareHtml(html, delimiters) {
  const el = document.createElement('div')
  el.innerHTML = DOMPurify.sanitize(html)
  renderMathInElement(el, { delimiters, throwOnError: false })
  return el.innerHTML
}

// Sanitizes blog HTML and bakes KaTeX output into the returned string, so the
// rendered math survives any later re-application of the HTML to the DOM.
export function prepareBlogHtml(html) {
  return prepareHtml(html, MATH_DELIMITERS)
}

export function prepareProblemHtml(html) {
  return prepareHtml(html, PROBLEM_MATH_DELIMITERS)
}
