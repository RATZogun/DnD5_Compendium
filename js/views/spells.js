import { html, raw, compareText, setTitle, enhanceStatblocks } from '../util.js';
import { t } from '../i18n.js';
import { replaceQuery } from '../router.js';
import { createFilterPanel } from '../components/filters.js';
import { paginationHtml, bindPagination } from '../components/pagination.js';
import { spellCardHtml } from '../components/spellCard.js';
import { SPELL_DEFAULTS, spellFilterFields, filterSpells, pickFilters, hasActiveFilters } from '../spellFilter.js';
import { SPELLS_BACK_KEY } from './spellShow.js';

// guarda a busca atual para o "Voltar aos resultados" da página da magia
function rememberList() {
  try {
    sessionStorage.setItem(SPELLS_BACK_KEY, location.hash);
  } catch {
    // sem armazenamento: o voltar leva à lista sem filtros
  }
}

const SORTERS = {
  name_asc: (a, b) => compareText(a.name, b.name),
  name_desc: (a, b) => compareText(b.name, a.name),
  level_asc: (a, b) => a.level - b.level || compareText(a.name, b.name),
  level_desc: (a, b) => b.level - a.level || compareText(a.name, b.name),
};

export function render(container, { R, query }) {
  setTitle(t('spells.title'));
  let filters = pickFilters(query);
  let orderBy = 'name_asc';
  let page = 1;
  let perPage = 10;

  container.innerHTML = html` <h1>${t('spells.title')}</h1>
    <div id="spells-filters"></div>
    <div id="spells-list" aria-live="polite"></div>`;
  const list = container.querySelector('#spells-list');

  createFilterPanel(container.querySelector('#spells-filters'), {
    fields: spellFilterFields(R),
    defaults: SPELL_DEFAULTS,
    state: filters,
    open: hasActiveFilters(filters),
    onChange: (st) => {
      filters = st;
      page = 1;
      replaceQuery(st);
      rememberList();
      draw();
    },
  });

  bindPagination(list, {
    onPage: (p) => {
      page = p;
      draw();
      list.scrollIntoView({ block: 'start' });
    },
    onPerPage: (n) => {
      perPage = n;
      page = 1;
      draw();
    },
  });
  list.addEventListener('change', (e) => {
    if (e.target.matches('[data-order]')) {
      orderBy = e.target.value;
      draw();
    }
  });

  function draw() {
    const filtered = filterSpells(R, filters).sort(SORTERS[orderBy]);
    const total = filtered.length;
    if (!total) {
      list.innerHTML = html`<div class="alert" role="status">${t('spells.empty')}</div>`;
      return;
    }
    const size = Math.min(perPage, total);
    page = Math.min(Math.max(1, page), Math.ceil(total / size));
    const slice = filtered.slice((page - 1) * size, page * size);
    const pager = paginationHtml({ page, perPage: size, total });
    list.innerHTML = html` <div class="list-toolbar">
        <label class="order"
          >${t('spells.orderBy')}
          <select class="form-control" data-order>
            ${Object.keys(SORTERS).map((o) => raw(html`<option value="${o}" ${o === orderBy ? 'selected' : ''}>${t(`spells.order.${o}`)}</option>`))}
          </select>
        </label>
      </div>
      ${raw(pager)}
      <div class="cards">${slice.map((s) => raw(spellCardHtml(R, s)))}</div>
      ${raw(pager)}`;
    enhanceStatblocks(list);
  }

  rememberList();
  draw();
}
