import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = path.join(ROOT, 'index.html');

const ZOOM_CSS = `.thumb{display:block;overflow:hidden;background:var(--soft)}.latest-primary .thumb{aspect-ratio:1.34/1}.side-card .thumb{aspect-ratio:1.25/1}.card .thumb{aspect-ratio:1.45/1}.thumb img,.news-lead img,.pick-card img,.news-row img{height:100%;aspect-ratio:inherit;transition:transform .42s ease,filter .28s ease}.latest-primary:hover .thumb img,.latest-primary:focus-visible .thumb img,.side-card:hover .thumb img,.side-card:focus-visible .thumb img,.card:hover .thumb img,.card:focus-visible .thumb img,.news-lead:hover img,.news-lead:focus-visible img,.pick-card:hover img,.pick-card:focus-visible img,.news-row:hover img,.news-row:focus-visible img{transform:scale(1.04)}.latest-primary:active .thumb img,.side-card:active .thumb img,.card:active .thumb img,.latest-primary.is-opening .thumb img,.side-card.is-opening .thumb img,.card.is-opening .thumb img,.news-lead.is-opening img,.pick-card.is-opening img,.news-row.is-opening img{transform:scale(1.12);filter:brightness(.92)}.latest-primary.is-opening,.side-card.is-opening,.card.is-opening,.news-lead.is-opening,.pick-card.is-opening,.news-row.is-opening{pointer-events:none}@media(prefers-reduced-motion:reduce){.thumb img,.news-lead img,.pick-card img,.news-row img{transition:none}.latest-primary:hover .thumb img,.latest-primary:focus-visible .thumb img,.side-card:hover .thumb img,.side-card:focus-visible .thumb img,.card:hover .thumb img,.card:focus-visible .thumb img,.news-lead:hover img,.news-lead:focus-visible img,.pick-card:hover img,.pick-card:focus-visible img,.news-row:hover img,.news-row:focus-visible img,.latest-primary:active .thumb img,.side-card:active .thumb img,.card:active .thumb img,.latest-primary.is-opening .thumb img,.side-card.is-opening .thumb img,.card.is-opening .thumb img,.news-lead.is-opening img,.pick-card.is-opening img,.news-row.is-opening img{transform:none;filter:none}}`;

const CLICK_SCRIPT = `<script id="post-card-transition">(() => { const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; const selector = 'a.news-lead, a.pick-card, a.news-row, a.latest-primary, a.side-card, a.card'; document.addEventListener('click', (event) => { const card = event.target.closest(selector); if (!card || !card.href || card.target || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.defaultPrevented) return; const url = new URL(card.href, window.location.href); if (url.origin !== window.location.origin) return; if (reduce) return; event.preventDefault(); card.classList.add('is-opening'); window.setTimeout(() => { window.location.href = card.href; }, 180); }, { capture: true }); })();</script>`;

function wrapCardImages(html) {
  return html.replace(/(<a class="(?:latest-primary|side-card|card(?: compact-card)?)"[^>]*>)(<img\b[^>]*\/>)/g, (_match, open, image) => {
    if (open.includes('<span class="thumb"')) return `${open}${image}`;
    return `${open}<span class="thumb">${image}</span>`;
  });
}

function addZoomCss(html) {
  const currentCssPattern = /\.thumb\{display:block;overflow:hidden[\s\S]*?\}\}/;
  if (currentCssPattern.test(html)) return html.replace(currentCssPattern, ZOOM_CSS);
  if (html.includes('img{display:block;width:100%;object-fit:cover;background:var(--soft)}')) {
    return html.replace('img{display:block;width:100%;object-fit:cover;background:var(--soft)}', `img{display:block;width:100%;object-fit:cover;background:var(--soft)}${ZOOM_CSS}`);
  }
  return html.replace('</style>', `${ZOOM_CSS}</style>`);
}

function addClickScript(html) {
  const withoutOldScript = html.replace(/<script id="post-card-transition">[\s\S]*?<\/script>\s*/g, '');
  return withoutOldScript.replace('</body>', `${CLICK_SCRIPT}</body>`);
}

let html = await fs.readFile(INDEX, 'utf8');
html = addClickScript(addZoomCss(wrapCardImages(html)));
await fs.writeFile(INDEX, html, 'utf8');
console.log('Homepage image click transition applied.');
