import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = path.join(ROOT, 'index.html');

const ZOOM_CSS = `.thumb{display:block;overflow:hidden;background:var(--soft)}.latest-primary .thumb{aspect-ratio:1.34/1}.side-card .thumb{aspect-ratio:1.25/1}.card .thumb{aspect-ratio:1.45/1}.thumb img{height:100%;aspect-ratio:inherit;transition:transform .42s ease}.latest-primary:hover .thumb img,.latest-primary:focus-visible .thumb img,.side-card:hover .thumb img,.side-card:focus-visible .thumb img,.card:hover .thumb img,.card:focus-visible .thumb img{transform:scale(1.06)}.latest-primary:active .thumb img,.side-card:active .thumb img,.card:active .thumb img{transform:scale(1.03)}@media(prefers-reduced-motion:reduce){.thumb img{transition:none}.latest-primary:hover .thumb img,.latest-primary:focus-visible .thumb img,.side-card:hover .thumb img,.side-card:focus-visible .thumb img,.card:hover .thumb img,.card:focus-visible .thumb img,.latest-primary:active .thumb img,.side-card:active .thumb img,.card:active .thumb img{transform:none}}`;

function wrapCardImages(html) {
  return html.replace(/(<a class="(?:latest-primary|side-card|card(?: compact-card)?)"[^>]*>)(<img\b[^>]*\/>)/g, (_match, open, image) => {
    if (open.includes('<span class="thumb"')) return `${open}${image}`;
    return `${open}<span class="thumb">${image}</span>`;
  });
}

function addZoomCss(html) {
  if (html.includes('.thumb{display:block;overflow:hidden')) return html;
  if (html.includes('img{display:block;width:100%;object-fit:cover;background:var(--soft)}')) {
    return html.replace('img{display:block;width:100%;object-fit:cover;background:var(--soft)}', `img{display:block;width:100%;object-fit:cover;background:var(--soft)}${ZOOM_CSS}`);
  }
  return html.replace('</style>', `${ZOOM_CSS}</style>`);
}

let html = await fs.readFile(INDEX, 'utf8');
html = addZoomCss(wrapCardImages(html));
await fs.writeFile(INDEX, html, 'utf8');
console.log('Homepage image zoom effect applied.');
