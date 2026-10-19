import { html, raw, titleCase } from '../util.js';
import { t, getLang } from '../i18n.js';
import { loadQuickref } from '../data.js';

// Resumo de Regras (do dnd5e-quickref): uma seção por tipo de regra, com um ícone por item; o item abre uma ficha
// com a descrição, os detalhes e a página do Livro do Jogador
const iconSvg = (d, size) =>
  html`<svg viewBox="0 0 512 512" width="${size}" height="${size}" fill="currentColor" aria-hidden="true"><path d="${d}"/></svg>`;

function tileHtml(Q, item, id) {
  const x = item[getLang()] ?? item.pt;
  return html`<button type="button" class="qr-tile" data-item="${id}">
    <span class="qr-icon">${raw(iconSvg(Q.icons[item.icon], 36))}</span>
    <span class="qr-text">
      <span class="qr-name">${titleCase(x.title)}</span>
      <span class="qr-sub">${x.subtitle}</span>
    </span>
  </button>`;
}

function sectionHtml(Q, sec, si) {
  const pick = (o) => o[getLang()] ?? o.pt;
  return html`<section class="qr-section" id="qr-${sec.id}">
    <h2 class="qr-title">${titleCase(pick(sec.title))}${sec.tag ? raw(html` <span class="qr-tag">${pick(sec.tag)}</span>`) : ''}</h2>
    ${sec.groups.map((g, gi) =>
      raw(
        html`<p class="qr-intro">${pick(g.intro)}</p>
          <div class="qr-grid">${g.items.map((item, ii) => raw(tileHtml(Q, item, `${si}.${gi}.${ii}`)))}</div>`,
      ),
    )}
  </section>`;
}

// ficha do item no formato da ficha de magia (os textos do quickref já trazem <i>, <b> e tabelas)
function sheetHtml(R, Q, sec, item) {
  const x = item[getLang()] ?? item.pt;
  // livro e página no mesmo formato das outras fichas ("Livro do Jogador · pg 192")
  const book = x.source ? titleCase(R.sourceByAbbr.get(x.source.book)?.name ?? x.source.book) : '';
  const source = x.source ? `${book} · ${t('common.page')} ${x.source.page}` : '';
  const secTitle = titleCase(sec.title[getLang()] ?? sec.title.pt);
  return html`<article class="spell-sheet qr-sheet">
    <header class="sp-head">
      <span class="sp-school">${raw(iconSvg(Q.icons[item.icon], 30))}</span>
      <div class="sp-title">
        <div class="sp-name" id="qr-dialog-title">${titleCase(x.title)}</div>
        <div class="sp-source">${source}</div>
      </div>
      <span class="sp-badge">${secTitle}</span>
      <button type="button" class="qr-close" data-close aria-label="${t('quickref.close')}">✕</button>
    </header>
    <div class="sp-body feature-body">
      ${x.subtitle ? raw(html`<p class="qr-lead">${x.subtitle}</p>`) : ''}
      ${x.description ? raw(html`<p>${raw(x.description)}</p>`) : ''}
      ${x.bullets.length ? raw(html`<ul>${x.bullets.map((b) => raw(html`<li>${raw(b)}</li>`))}</ul>`) : ''}
      ${x.note ? raw(html`<p class="qr-note">${x.note}</p>`) : ''}
    </div>
  </article>`;
}

export async function renderQuickref(container, { R, header }) {
  let Q;
  try {
    Q = await loadQuickref();
  } catch {
    container.innerHTML = html`${raw(header)}
      <div class="alert" role="alert">${t('common.loadError')}</div>`;
    return;
  }
  const pick = (o) => o[getLang()] ?? o.pt;
  container.innerHTML = html`${raw(header)}
    <p class="qr-about">${t('quickref.about')}</p>
    <nav class="qr-nav" aria-label="${t('quickref.sections')}">
      ${Q.sections.map((s) => raw(html`<a class="qr-jump" href="#" data-jump="qr-${s.id}">${titleCase(pick(s.title))}</a>`))}
    </nav>
    ${Q.sections.map((s, si) => raw(sectionHtml(Q, s, si)))}
    <dialog class="qr-dialog" aria-labelledby="qr-dialog-title"></dialog>`;

  const dialog = container.querySelector('.qr-dialog');
  container.addEventListener('click', (e) => {
    // a rota usa o hash: os atalhos rolam até a seção em vez de mudar o endereço
    const jump = e.target.closest('[data-jump]');
    if (jump) {
      e.preventDefault();
      document.getElementById(jump.dataset.jump)?.scrollIntoView({ block: 'start' });
      return;
    }
    const tile = e.target.closest('[data-item]');
    if (tile) {
      const [si, gi, ii] = tile.dataset.item.split('.').map(Number);
      const sec = Q.sections[si];
      dialog.innerHTML = sheetHtml(R, Q, sec, sec.groups[gi].items[ii]);
      dialog.showModal();
      return;
    }
    // fecha no botão ou num clique fora da ficha
    if (e.target.closest('[data-close]') || e.target === dialog) dialog.close();
  });
}
