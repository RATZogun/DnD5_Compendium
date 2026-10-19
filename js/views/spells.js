import { html, raw, compareText, setTitle, titleCase, enhanceStatblocks } from '../util.js';
import { t } from '../i18n.js';
import { replaceQuery } from '../router.js';
import { paginationHtml, bindPagination } from '../components/pagination.js';
import { spellCardHtml } from '../components/spellCard.js';
import {
  filterSpells,
  filterValues,
  pickFilters,
  spellFacetGroups,
  spellFlags,
  spellFilterChips,
  casterKlasses,
  casterSubclasses,
  casterTest,
} from '../spellFilter.js';
import { icon } from '../icons.js';
import { SPELLS_BACK_KEY } from './spellShow.js';

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

function optionHtml(group, value, label, count, checked) {
  return html`<label class="facet-option">
    <input type="checkbox" data-group="${group}" value="${value}" ${checked ? 'checked' : ''} />
    <span class="facet-label">${label}</span>
    <span class="facet-count">${count}</span>
  </label>`;
}

export function render(container, { R, query }) {
  setTitle(t('spells.title'));
  const st = pickFilters(query);
  const groups = spellFacetGroups(R);
  const flags = spellFlags();
  for (const key of [...groups.map((g) => g.key), 'klassName', 'specializationName'])
    st[key] = filterValues(st[key]).map(String);
  let sort = query.sort in SORTS ? query.sort : 'az';
  let page = 1;
  let perPage = 10;
  // grupos abertos na barra lateral: a página abre com todos fechados (o número ao lado mostra o que está marcado)
  const open = new Set();

  container.innerHTML = html`<nav class="crumbs" aria-label="breadcrumb">
      <a href="#/">${t('nav.home')}</a> › <span>${titleCase(t('spells.title'))}</span>
    </nav>
    <header class="list-head">
      <span class="chip chip-spell">${t('list.category')}</span>
      <h1>${titleCase(t('spells.title'))}</h1>
    </header>
    <div class="ornament" aria-hidden="true"><span></span><i></i><span></span></div>
    <div class="list-layout">
      <aside class="facets">
        <button type="button" class="facets-toggle" aria-expanded="false">${titleCase(t('filters.title'))}</button>
        <div class="facets-body"></div>
      </aside>
      <section class="list-main">
        <div class="list-bar"></div>
        <div class="spell-results" aria-live="polite"></div>
      </section>
    </div>`;

  const facets = container.querySelector('.facets-body');
  const bar = container.querySelector('.list-bar');
  const results = container.querySelector('.spell-results');
  const toggle = container.querySelector('.facets-toggle');
  toggle.addEventListener('click', () => {
    const opened = container.querySelector('.facets').classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(opened));
  });

  function save() {
    const q = {};
    for (const [k, v] of Object.entries(st)) q[k] = Array.isArray(v) ? v.join(',') || null : v;
    q.sort = sort === 'az' ? null : sort;
    replaceQuery(q);
    rememberList();
  }

  // subclasses só valem com a classe delas marcada
  function dropOrphanSubclasses() {
    st.specializationName = st.specializationName.filter((sp) =>
      R.specializations.some((x) => x.name === sp && st.klassName.includes(x.klass_name)),
    );
  }

  // contagem de uma opção: todos os filtros menos o do próprio grupo
  const without = (key) => filterSpells(R, { ...st, [key]: Array.isArray(st[key]) ? [] : null });

  function drawFacets() {
    // classe e subclasse: a contagem é o total de magias de cada uma com os demais filtros
    const noCaster = filterSpells(R, { ...st, klassName: [], specializationName: [] });
    const klassGroup = {
      key: 'klassName',
      label: t('spellFilter.class'),
      base: noCaster,
      options: casterKlasses(R).map((k) => ({ value: k.name, label: titleCase(k.name) })),
      test: (s, v) => casterTest(R, v, null, st.raceName)(s),
    };
    const subs = st.klassName.flatMap((k) => casterSubclasses(R, k).map((sp) => ({ ...sp, klass: k })));
    const subGroup = subs.length
      ? {
          key: 'specializationName',
          label: t('spellFilter.specialization'),
          base: noCaster,
          options: subs.map((sp) => ({ value: sp.name, label: titleCase(sp.name), klass: sp.klass })),
          test: (s, v) => casterTest(R, subs.find((x) => x.name === v).klass, v, st.raceName)(s),
        }
      : null;
    const groupHtml = (g) => {
      const base = g.base ?? without(g.key);
      const options = g.options
        .map((o) => ({ ...o, count: base.filter((s) => g.test(s, o.value)).length }))
        .filter((o) => o.count || st[g.key].includes(String(o.value)));
      if (!options.length) return '';
      return html`<details class="facet" data-key="${g.key}" ${open.has(g.key) ? 'open' : ''}>
        <summary>${g.label}${st[g.key].length ? raw(html` <span class="facet-on">${st[g.key].length}</span>`) : ''}</summary>
        ${options.map((o) => raw(optionHtml(g.key, o.value, o.label, o.count, st[g.key].includes(String(o.value)))))}
      </details>`;
    };
    const flagBase = filterSpells(R, st);
    const flagsOn = flags.filter((f) => st[f.key] != null).length;
    facets.innerHTML = html`<label class="facet-search">
        ${raw(icon.search(16))}
        <input type="search" value="${st.name}" placeholder="${t('list.filterName')}" aria-label="${t('common.name')}" />
      </label>
      ${raw(groupHtml(groups[0]))} ${raw(groupHtml(groups[1]))}
      ${raw(groupHtml(klassGroup))} ${raw(subGroup ? groupHtml(subGroup) : '')}
      <details class="facet" data-key="flags" ${open.has('flags') ? 'open' : ''}>
        <summary>${t('list.has')}${flagsOn ? raw(html` <span class="facet-on">${flagsOn}</span>`) : ''}</summary>
        ${flags.map((f) => {
          const count = (st[f.key] === true ? flagBase : filterSpells(R, { ...st, [f.key]: null })).filter(
            f.test,
          ).length;
          return raw(optionHtml('flag', f.key, f.label, count, st[f.key] === true));
        })}
      </details>
      ${groups.slice(2).map((g) => raw(groupHtml(g)))}
      <button type="button" class="link-btn facet-clear">${t('list.clear')}</button>`;
  }

  function drawResults() {
    const list = filterSpells(R, st).sort(SORTS[sort]);
    const chips = spellFilterChips(R, st);
    bar.innerHTML = html`<strong class="list-count">${list.length === 1 ? t('list.result') : t('list.results', { n: list.length })}</strong>
      ${chips.map((c) =>
        raw(
          html`<button type="button" class="active-chip" data-key="${c.key}" value="${c.value ?? ''}" aria-label="${t('list.removeFilter', { name: c.label })}">${c.label} <span aria-hidden="true">✕</span></button>`,
        ),
      )}
      <label class="list-sort">
        <span>${t('list.sort')}</span>
        <select class="form-control" data-sort>
          ${Object.keys(SORTS).map((k) => raw(html`<option value="${k}" ${k === sort ? 'selected' : ''}>${t(SORT_LABEL[k])}</option>`))}
        </select>
      </label>`;
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
  }

  function update({ facetsToo = true } = {}) {
    page = 1;
    save();
    if (facetsToo) drawFacets();
    drawResults();
  }

  facets.addEventListener(
    'toggle',
    (e) => {
      const d = e.target.closest?.('details[data-key]');
      if (d) (d.open ? open.add : open.delete).call(open, d.dataset.key);
    },
    true,
  );
  facets.addEventListener('change', (e) => {
    const box = e.target.closest('input[type="checkbox"]');
    if (box?.dataset.group === 'flag') {
      st[box.value] = box.checked ? true : null;
      if (box.value === 'hasMaterialComponent' && !box.checked) st.isMaterialConsumed = null;
      return update();
    }
    if (box) {
      const list = st[box.dataset.group];
      if (box.checked) list.push(box.value);
      else list.splice(list.indexOf(box.value), 1);
      if (box.dataset.group === 'klassName') dropOrphanSubclasses();
      return update();
    }
  });
  let typing;
  facets.addEventListener('input', (e) => {
    if (e.target.type !== 'search') return;
    clearTimeout(typing);
    typing = setTimeout(() => {
      st.name = e.target.value;
      page = 1;
      save();
      drawResults();
      // atualiza as contagens sem perder o campo que está sendo digitado
      const pos = e.target.selectionStart;
      drawFacets();
      const again = facets.querySelector('.facet-search input');
      again.focus();
      again.setSelectionRange(pos, pos);
    }, 150);
  });
  facets.addEventListener('click', (e) => {
    if (!e.target.closest('.facet-clear')) return;
    for (const k of Object.keys(st)) st[k] = Array.isArray(st[k]) ? [] : k === 'name' ? '' : null;
    update();
  });
  bar.addEventListener('click', (e) => {
    const chip = e.target.closest('.active-chip');
    if (!chip) return;
    const { key } = chip.dataset;
    if (Array.isArray(st[key])) st[key].splice(st[key].indexOf(chip.value), 1);
    else if (key === 'levelRange') st.levelMin = st.levelMax = null;
    else st[key] = key === 'name' ? '' : null;
    if (key === 'klassName') dropOrphanSubclasses();
    update();
  });
  bar.addEventListener('change', (e) => {
    if (!e.target.matches('[data-sort]')) return;
    sort = e.target.value;
    update({ facetsToo: false });
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

  rememberList();
  drawFacets();
  drawResults();
}
