import { html, raw, compareText, setTitle, titleCase, enhanceStatblocks } from '../util.js';
import { t } from '../i18n.js';
import { replaceQuery } from '../router.js';
import { paginationHtml, bindPagination } from '../components/pagination.js';
import { spellCardHtml } from '../components/spellCard.js';
import { pickFilters } from '../spellFilter.js';
import { normalizeSpellState, facetsLayoutHtml, initSpellFacets } from '../components/spellFacets.js';
import { SPELLS_BACK_KEY } from './spellShow.js';
import { linkRules } from '../ruleLinks.js';

// lista de magias no mesmo modelo da de espécies: filtros à esquerda (com contagens), resultados à direita
const SORTS = {
  az: (a, b) => compareText(a.name, b.name),
  za: (a, b) => compareText(b.name, a.name),
  levelAsc: (a, b) => a.level - b.level || compareText(a.name, b.name),
  levelDesc: (a, b) => b.level - a.level || compareText(a.name, b.name),
};
const SORT_LABEL = {
  az: 'list.sort.az',
  za: 'list.sort.za',
  levelAsc: 'list.sort.levelAsc',
  levelDesc: 'list.sort.levelDesc',
};

// guarda a busca atual para o "Voltar aos resultados" da página da magia
function rememberList() {
  try {
    sessionStorage.setItem(SPELLS_BACK_KEY, location.hash);
  } catch {
    // sem armazenamento: o voltar leva à lista sem filtros
  }
}

export function render(container, { R, query }) {
  setTitle(t('spells.title'));
  const st = normalizeSpellState(R, pickFilters(query));
  let sort = Object.hasOwn(SORTS, query.sort) ? query.sort : 'az';
  let page = 1;
  let perPage = 10;
  let list = [];

  container.innerHTML = html`<nav class="crumbs" aria-label="breadcrumb">
      <a href="#/">${t('nav.home')}</a> › <span>${titleCase(t('spells.title'))}</span>
    </nav>
    <header class="list-head">
      <span class="chip chip-spell">${t('list.category')}</span>
      <h1>${titleCase(t('spells.title'))}</h1>
    </header>
    <div class="ornament" aria-hidden="true"><span></span><i></i><span></span></div>
    ${raw(facetsLayoutHtml('<div class="spell-results" aria-live="polite"></div>'))}`;
  const results = container.querySelector('.spell-results');

  function save() {
    const q = {};
    for (const [k, v] of Object.entries(st)) q[k] = Array.isArray(v) ? v.join(',') || null : v;
    q.sort = sort === 'az' ? null : sort;
    replaceQuery(q);
    rememberList();
  }

  function drawResults() {
    if (!list.length) {
      results.innerHTML = html`<div class="alert" role="status">${t('spells.empty')}</div>`;
      return;
    }
    const size = Math.min(perPage, list.length);
    page = Math.min(Math.max(1, page), Math.ceil(list.length / size));
    const pager = paginationHtml({ page, perPage: size, total: list.length });
    results.innerHTML = html`${raw(pager)}
      <div class="cards">${list.slice((page - 1) * size, page * size).map((s) => raw(spellCardHtml(R, s)))}</div>
      ${raw(pager)}`;
    enhanceStatblocks(results);
    linkRules(results);
  }

  const facets = initSpellFacets(container, {
    R,
    st,
    barStart: (l) => (l.length === 1 ? t('list.result') : t('list.results', { n: l.length })),
    barEnd: () => html`<label class="list-sort">
      <span>${t('list.sort')}</span>
      <select class="form-control" data-sort>
        ${Object.keys(SORTS).map((k) => raw(html`<option value="${k}" ${k === sort ? 'selected' : ''}>${t(SORT_LABEL[k])}</option>`))}
      </select>
    </label>`,
    onChange: (filtered) => {
      list = filtered.sort(SORTS[sort]);
      page = 1;
      save();
      drawResults();
    },
  });

  container.querySelector('.list-bar').addEventListener('change', (e) => {
    if (!e.target.matches('[data-sort]')) return;
    sort = e.target.value;
    facets.update({ facetsToo: false });
  });
  bindPagination(results, {
    onPage: (p) => {
      page = p;
      drawResults();
      container.querySelector('.list-main').scrollIntoView({ block: 'start' });
    },
    onPerPage: (n) => {
      perPage = n;
      page = 1;
      drawResults();
    },
  });

  facets.update();
}
