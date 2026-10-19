import { html, raw, setTitle, enhanceStatblocks } from '../util.js';
import { t } from '../i18n.js';
import { replaceQuery } from '../router.js';
import { spellCardHtml } from '../components/spellCard.js';
import { pickFilters, hasActiveFilters } from '../spellFilter.js';
import { normalizeSpellState, facetsLayoutHtml, initSpellFacets } from '../components/spellFacets.js';

// gerador de pergaminho no mesmo modelo da lista de magias: os filtros escolhem as magias possíveis e o botão
// sorteia uma. Sem filtro na URL, começa sem truques (do 1º ao 9º nível).
const INITIAL = { levelMin: 1, levelMax: 9 };

export function render(container, { R, query }) {
  setTitle(t('scroll.pageTitle'));
  const fromUrl = pickFilters(query);
  const st = normalizeSpellState(R, hasActiveFilters(fromUrl) ? fromUrl : { ...fromUrl, ...INITIAL });
  let pool = [];
  let spell = null;

  container.innerHTML = html`<nav class="crumbs" aria-label="breadcrumb">
      <a href="#/">${t('nav.home')}</a> › <span>${t('scroll.pageTitle')}</span>
    </nav>
    <header class="list-head">
      <span class="chip chip-spell">${t('scroll.tool')}</span>
      <h1>${t('scroll.title')}</h1>
    </header>
    <div class="ornament" aria-hidden="true"><span></span><i></i><span></span></div>
    ${raw(facetsLayoutHtml('<div class="scroll-spell" aria-live="polite"></div>'))}`;
  const card = container.querySelector('.scroll-spell');

  // evita sortear a mesma magia duas vezes seguidas quando há mais de uma opção
  function generate() {
    const options = pool.length > 1 && spell ? pool.filter((s) => s !== spell) : pool;
    spell = options.length ? options[Math.floor(Math.random() * options.length)] : null;
    card.innerHTML = spell
      ? spellCardHtml(R, spell)
      : html`<div class="alert" role="status">${t('spells.empty')}</div>`;
    enhanceStatblocks(card);
  }

  initSpellFacets(container, {
    R,
    st,
    // os mesmos filtros que o gerador sempre teve
    only: ['levels', 'spellSchoolName', 'klassName', 'sourceAbbreviation'],
    barStart: (l) => t('scroll.pool', { n: l.length }),
    barEnd: (l) =>
      html`<button type="button" class="btn btn-primary scroll-generate" data-generate ${l.length ? '' : 'disabled'}>
        ${raw(html`<span aria-hidden="true">⟳</span>`)} ${t('scroll.generate')}
      </button>`,
    onChange: (filtered) => {
      pool = filtered;
      const q = {};
      for (const [k, v] of Object.entries(st)) q[k] = Array.isArray(v) ? v.join(',') || null : v;
      replaceQuery(q);
      if (!spell || !pool.includes(spell)) generate();
    },
  }).update();

  container.querySelector('.list-bar').addEventListener('click', (e) => {
    if (e.target.closest('[data-generate]')) generate();
  });
}
