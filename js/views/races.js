import { html, raw, titleCase, nameMatcher, setTitle, compareText } from '../util.js';
import { t, getLang } from '../i18n.js';
import { href, replaceQuery } from '../router.js';
import { icon } from '../icons.js';

// filtros da lista (estado na URL): nome, tamanho, livro, "possui" e ordenação; em tamanho e livro vale qualquer
// opção marcada, em "possui" valem todas, e entre grupos valem todos
const HAS = {
  subraces: (r) => Boolean(r.subraces?.length),
  spells: (r) => Boolean(r.innate_spells),
  darkvision: (r) => Boolean(r.darkvision),
};
const SORTS = {
  az: (a, b) => compareText(a.name, b.name),
  za: (a, b) => compareText(b.name, a.name),
  speed: (a, b) => (b.speed?.ft ?? 0) - (a.speed?.ft ?? 0) || compareText(a.name, b.name),
};

const SIZES = { T: ['miúdo', 'Tiny'], S: ['pequeno', 'Small'], M: ['médio', 'Medium'], L: ['grande', 'Large'] };

export const sizeText = (codes) =>
  (codes ?? []).map((c) => SIZES[c]?.[getLang() === 'pt' ? 0 : 1] ?? c).join(' / ') || '—';

export function speedText(speed) {
  if (!speed) return '—';
  return getLang() === 'pt' ? `${String(speed.m).replace('.', ',')} m` : `${speed.ft} ft.`;
}

const sizeKey = (r) => (r.size ?? []).join('|');
const sizeLabel = (key) =>
  key
    .split('|')
    .map((s) => titleCase(s))
    .join(` ${t('races.or')} `);
const list = (v) => (v ? String(v).split(',').filter(Boolean) : []);

function readState(query) {
  return {
    name: query.name ? String(query.name) : '',
    size: list(query.size),
    source: list(query.source),
    has: list(query.has).filter((h) => h in HAS),
    sort: query.sort in SORTS ? query.sort : 'az',
  };
}

const matchers = (st) => ({
  name: st.name
    ? (
        (m) => (r) =>
          m(r.name, ...(r.subraces ?? []))
      )(nameMatcher(st.name))
    : null,
  size: st.size.length ? (r) => st.size.includes(sizeKey(r)) : null,
  source: st.source.length ? (r) => r.sources_rels.some((s) => st.source.includes(s.source_abbreviation)) : null,
  has: st.has.length ? (r) => st.has.every((h) => HAS[h](r)) : null,
});

// aplica todos os filtros, menos o grupo indicado (para as contagens de cada opção)
function filterRaces(R, st, except = null) {
  const m = matchers(st);
  return R.races.filter((r) => Object.entries(m).every(([k, fn]) => k === except || !fn || fn(r)));
}

function optionHtml(group, value, label, count, checked) {
  return html`<label class="facet-option">
    <input type="checkbox" data-group="${group}" value="${value}" ${checked ? 'checked' : ''} />
    <span class="facet-label">${label}</span>
    <span class="facet-count">${count}</span>
  </label>`;
}

// cartão com a mesma disposição de antes (ícone, nome, tamanho e deslocamento; sub-espécies; livro), no visual
// da ficha de magia
function raceCardHtml(R, race) {
  const src = race.sources_rels?.[0];
  const book = src && R.sourceByAbbr.get(src.source_abbreviation);
  const sizes = (race.size ?? []).map((s) => titleCase(s)).join(` ${t('races.or')} `);
  return html`<a class="race-tile" href="${href.race(race.slug)}">
    <span class="sp-head race-tile-head">
      <span class="race-tile-icon">${raw(icon.people(22))}</span>
      <span>
        <span class="sp-name race-tile-name">${titleCase(race.name)}</span>
        <span class="sp-source race-tile-meta">${sizes} · ${speedText(race.speed)}</span>
      </span>
    </span>
    <span class="sp-body race-tile-subs ${race.subraces?.length ? '' : 'text-muted'}">
      ${
        race.subraces?.length
          ? `${t('races.subraces')}: ${race.subraces.map((s) => titleCase(s)).join(', ')}`
          : t('races.noSubraces')
      }
    </span>
    <span class="sp-foot race-tile-source"
      >${raw(icon.book(14))} ${book ? titleCase(book.name) : (src?.source_abbreviation ?? '')}${
        src?.page ? ` · ${t('common.page')} ${src.page}` : ''
      }</span
    >
  </a>`;
}

export function render(container, { R, query }) {
  setTitle(t('races.title'));
  const st = readState(query);
  const books = new Set(R.races.flatMap((r) => r.sources_rels.map((s) => s.source_abbreviation)));
  container.innerHTML = html`<nav class="crumbs" aria-label="breadcrumb">
      <a href="#/">${t('nav.home')}</a> › <span>${titleCase(t('races.title'))}</span>
    </nav>
    <header class="list-head">
      <span class="chip chip-species">${t('list.category')}</span>
      <h1>${titleCase(t('races.title'))}</h1>
    </header>
    <div class="ornament" aria-hidden="true"><span></span><i></i><span></span></div>
    <div class="list-layout">
      <aside class="facets">
        <button type="button" class="facets-toggle" aria-expanded="false">${titleCase(t('filters.title'))}</button>
        <div class="facets-body"></div>
      </aside>
      <section class="list-main">
        <div class="list-bar"></div>
        <div class="race-grid" aria-live="polite"></div>
      </section>
    </div>`;

  const facets = container.querySelector('.facets-body');
  const bar = container.querySelector('.list-bar');
  const grid = container.querySelector('.race-grid');
  const toggle = container.querySelector('.facets-toggle');
  toggle.addEventListener('click', () => {
    const open = container.querySelector('.facets').classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  function save() {
    replaceQuery({
      name: st.name || null,
      size: st.size.join(',') || null,
      source: st.source.join(',') || null,
      has: st.has.join(',') || null,
      sort: st.sort === 'az' ? null : st.sort,
    });
  }

  function drawFacets() {
    const sizeKeys = [...new Set(R.races.map(sizeKey))].sort(
      (a, b) => a.split('|').length - b.split('|').length || b.localeCompare(a),
    );
    const count = (group, test) => filterRaces(R, st, group).filter(test).length;
    const sources = R.sources.filter((s) => books.has(s.abbreviation));
    facets.innerHTML = html`<label class="facet-search">
        ${raw(icon.search(16))}
        <input type="search" value="${st.name}" placeholder="${t('list.filterName')}" aria-label="${t('common.name')}" />
      </label>
      <fieldset class="facet">
        <legend>${t('races.size')}</legend>
        ${sizeKeys.map((k) =>
          raw(
            optionHtml(
              'size',
              k,
              sizeLabel(k),
              count('size', (r) => sizeKey(r) === k),
              st.size.includes(k),
            ),
          ),
        )}
      </fieldset>
      <fieldset class="facet">
        <legend>${t('common.source')}</legend>
        ${sources.map((s) =>
          raw(
            optionHtml(
              'source',
              s.abbreviation,
              titleCase(s.name),
              count('source', (r) => r.sources_rels.some((x) => x.source_abbreviation === s.abbreviation)),
              st.source.includes(s.abbreviation),
            ),
          ),
        )}
      </fieldset>
      <fieldset class="facet">
        <legend>${t('list.has')}</legend>
        ${Object.keys(HAS).map((h) => raw(optionHtml('has', h, t(`races.has.${h}`), filterRaces(R, st).filter(HAS[h]).length, st.has.includes(h))))}
      </fieldset>
      <button type="button" class="link-btn facet-clear">${t('list.clear')}</button>`;
  }

  function drawResults() {
    const races = filterRaces(R, st).sort(SORTS[st.sort]);
    const chips = [
      ...st.size.map((v) => ['size', v, sizeLabel(v)]),
      ...st.source.map((v) => ['source', v, titleCase(R.sourceByAbbr.get(v)?.name ?? v)]),
      ...st.has.map((v) => ['has', v, t(`races.has.${v}`)]),
    ];
    bar.innerHTML = html`<strong class="list-count">${races.length === 1 ? t('list.result') : t('list.results', { n: races.length })}</strong>
      ${chips.map(([g, v, label]) =>
        raw(
          html`<button type="button" class="active-chip" data-group="${g}" value="${v}" aria-label="${t('list.removeFilter', { name: label })}">${label} <span aria-hidden="true">✕</span></button>`,
        ),
      )}
      <label class="list-sort">
        <span>${t('list.sort')}</span>
        <select class="form-control">
          ${Object.keys(SORTS).map((k) => raw(html`<option value="${k}" ${k === st.sort ? 'selected' : ''}>${t(`list.sort.${k}`)}</option>`))}
        </select>
      </label>`;
    grid.innerHTML = races.length
      ? races.map((r) => raceCardHtml(R, r)).join('')
      : html`<div class="alert" role="status">${t('races.empty')}</div>`;
  }

  function update({ facetsToo = true } = {}) {
    save();
    if (facetsToo) drawFacets();
    drawResults();
  }

  facets.addEventListener('change', (e) => {
    const box = e.target.closest('input[type="checkbox"]');
    if (!box) return;
    const group = st[box.dataset.group];
    if (box.checked) group.push(box.value);
    else group.splice(group.indexOf(box.value), 1);
    update();
  });
  let typing;
  facets.addEventListener('input', (e) => {
    if (e.target.type !== 'search') return;
    clearTimeout(typing);
    typing = setTimeout(() => {
      st.name = e.target.value;
      save();
      drawResults();
      // atualiza as contagens sem recriar o campo que está sendo digitado
      const field = facets.querySelector('.facet-search input');
      const pos = field.selectionStart;
      drawFacets();
      const again = facets.querySelector('.facet-search input');
      again.focus();
      again.setSelectionRange(pos, pos);
    }, 150);
  });
  facets.addEventListener('click', (e) => {
    if (!e.target.closest('.facet-clear')) return;
    Object.assign(st, { name: '', size: [], source: [], has: [] });
    update();
  });
  bar.addEventListener('click', (e) => {
    const chip = e.target.closest('.active-chip');
    if (!chip) return;
    const group = st[chip.dataset.group];
    group.splice(group.indexOf(chip.value), 1);
    update();
  });
  bar.addEventListener('change', (e) => {
    if (e.target.tagName !== 'SELECT') return;
    st.sort = e.target.value;
    update({ facetsToo: false });
  });

  drawFacets();
  drawResults();
}
