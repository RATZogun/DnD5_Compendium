import { html, raw, titleCase, nameMatcher, compareText } from '../util.js';
import { t, ordinal } from '../i18n.js';
import { replaceQuery } from '../router.js';
import { loadOptions } from '../data.js';
import { pick, linkProseSpells } from './klassShow.js';
import { icon } from '../icons.js';
import { classIcon } from '../classIcons.js';
import { paginationHtml, bindPagination } from '../components/pagination.js';
import { linkRules } from '../ruleLinks.js';

// Opções e Recursos: invocações, infusões, disciplinas, manobras, runas, dádivas, metamagia, disparos arcanos e
// estilos de luta numa lista só, com filtros à esquerda e uma ficha por opção (no formato da ficha de magia)
const TYPES = ['AI', 'AS', 'ED', 'EI', 'FS', 'MM', 'MV:B', 'PB', 'RN'];
const SORTS = {
  az: (a, b) => compareText(pick(a.name), pick(b.name)),
  type: (a, b) => compareText(typeLabel(a.type), typeLabel(b.type)) || compareText(pick(a.name), pick(b.name)),
  level: (a, b) => (a.level ?? 0) - (b.level ?? 0) || compareText(pick(a.name), pick(b.name)),
};
const SORT_LABEL = { az: 'list.sort.az', type: 'options.sort.type', level: 'options.sort.level' };
const typeLabel = (k) => t(`options.type.${k}`);
const list = (v) => (v ? String(v).split(',').filter(Boolean) : []);
const bookOf = (R, o) => {
  const s = pick(o.source);
  return s ? (R.sourceByAbbr.get(s.book)?.name ?? s.book) : '';
};

function optionHtml(group, value, label, count, checked) {
  return html`<label class="facet-option">
    <input type="checkbox" data-group="${group}" value="${value}" ${checked ? 'checked' : ''} />
    <span class="facet-label">${label}</span>
    <span class="facet-count">${count}</span>
  </label>`;
}

// classe da opção, com a subclasse quando for de uma ("Guerreiro (Mestre de Batalha)", "Guerreiro, Paladino")
function klassText(R, o) {
  const names = o.classes.map((c) => titleCase(R.klassBySlug.get(c)?.name ?? c)).join(', ');
  const sub = o.subclass && R.specializations.find((x) => x.slug === o.subclass && x.klass_slug === o.classes[0]);
  return sub ? `${names} (${titleCase(sub.name)})` : names;
}

function cardHtml(R, o) {
  const s = pick(o.source);
  const cell = (label, value) =>
    html`<div class="sp-cell"><div class="sp-label">${label}</div><div class="sp-value">${value}</div></div>`;
  return html`<article class="spell-sheet opt-sheet" id="${o.slug}">
    <header class="sp-head">
      <span class="sp-school">${raw(classIcon(o.classes[0], 30))}</span>
      <div class="sp-title">
        <div class="sp-name">${titleCase(pick(o.name))}</div>
        <div class="sp-source">${titleCase(bookOf(R, o))}${s?.page ? ` · ${t('common.page')} ${s.page}` : ''}</div>
      </div>
      <span class="sp-badge">${typeLabel(o.type)}</span>
    </header>
    <div class="sp-grid opt-grid">
      ${raw(cell(t('spellFilter.class'), klassText(R, o)))} ${raw(cell(t('options.col.prereq'), pick(o.prereq) || '—'))}
      ${raw(cell(t('options.col.level'), o.level ? ordinal(o.level) : '—'))}
    </div>
    <div class="sp-body feature-body">${raw(pick(o.html))}</div>
  </article>`;
}

export async function renderOptions(container, { R, query, header }) {
  let options;
  try {
    options = await loadOptions();
  } catch {
    container.innerHTML = html`${raw(header)}
      <div class="alert" role="alert">${t('common.loadError')}</div>`;
    return;
  }
  const st = {
    name: query.name ? String(query.name) : '',
    type: list(query.type).filter((k) => TYPES.includes(k)),
    klass: list(query.klass),
    book: list(query.book),
    sort: query.sort in SORTS ? query.sort : 'az',
  };
  const books = [...new Set(options.map((o) => bookOf(R, o)))].sort(compareText);
  const klassName = (c) => titleCase(R.klassBySlug.get(c)?.name ?? c);
  const klasses = [...new Set(options.flatMap((o) => o.classes))].sort((a, b) =>
    compareText(klassName(a), klassName(b)),
  );
  let page = 1;
  let perPage = 10;
  const matchers = () => ({
    name: st.name
      ? (
          (m) => (o) =>
            m(o.name.pt, o.name.en)
        )(nameMatcher(st.name))
      : null,
    type: st.type.length ? (o) => st.type.includes(o.type) : null,
    klass: st.klass.length ? (o) => o.classes.some((c) => st.klass.includes(c)) : null,
    book: st.book.length ? (o) => st.book.includes(bookOf(R, o)) : null,
  });
  const filter = (except = null) => {
    const m = matchers();
    return options.filter((o) => Object.entries(m).every(([k, fn]) => k === except || !fn || fn(o)));
  };

  container.innerHTML = html`${raw(header)}
    <div class="list-layout">
      <aside class="facets">
        <button type="button" class="facets-toggle" aria-expanded="false">${titleCase(t('filters.title'))}</button>
        <div class="facets-body"></div>
      </aside>
      <section class="list-main">
        <div class="list-bar"></div>
        <div class="opt-list" aria-live="polite"></div>
      </section>
    </div>`;
  const facets = container.querySelector('.facets-body');
  const bar = container.querySelector('.list-bar');
  const rows = container.querySelector('.opt-list');
  const toggle = container.querySelector('.facets-toggle');
  toggle.addEventListener('click', () => {
    const open = container.querySelector('.facets').classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  function save() {
    replaceQuery({
      name: st.name || null,
      type: st.type.join(',') || null,
      klass: st.klass.join(',') || null,
      book: st.book.join(',') || null,
      sort: st.sort === 'az' ? null : st.sort,
    });
  }

  function drawFacets() {
    const count = (group, test) => filter(group).filter(test).length;
    const types = [...TYPES].sort((a, b) => compareText(typeLabel(a), typeLabel(b)));
    facets.innerHTML = html`<label class="facet-search">
        ${raw(icon.search(16))}
        <input type="search" value="${st.name}" placeholder="${t('list.filterName')}" aria-label="${t('common.name')}" />
      </label>
      <fieldset class="facet">
        <legend>${t('options.col.type')}</legend>
        ${types.map((k) =>
          raw(
            optionHtml(
              'type',
              k,
              typeLabel(k),
              count('type', (o) => o.type === k),
              st.type.includes(k),
            ),
          ),
        )}
      </fieldset>
      <fieldset class="facet">
        <legend>${t('spellFilter.class')}</legend>
        ${klasses.map((c) =>
          raw(
            optionHtml(
              'klass',
              c,
              klassName(c),
              count('klass', (o) => o.classes.includes(c)),
              st.klass.includes(c),
            ),
          ),
        )}
      </fieldset>
      <fieldset class="facet">
        <legend>${t('common.source')}</legend>
        ${books.map((b) =>
          raw(
            optionHtml(
              'book',
              b,
              titleCase(b),
              count('book', (o) => bookOf(R, o) === b),
              st.book.includes(b),
            ),
          ),
        )}
      </fieldset>
      <button type="button" class="link-btn facet-clear">${t('list.clear')}</button>`;
  }

  function drawResults() {
    const found = filter().sort(SORTS[st.sort]);
    const chips = [
      ...(st.name ? [['name', '', `“${st.name}”`]] : []),
      ...st.type.map((v) => ['type', v, typeLabel(v)]),
      ...st.klass.map((v) => ['klass', v, klassName(v)]),
      ...st.book.map((v) => ['book', v, titleCase(v)]),
    ];
    bar.innerHTML = html`<strong class="list-count">${found.length === 1 ? t('list.result') : t('list.results', { n: found.length })}</strong>
      ${chips.map(([g, v, label]) =>
        raw(
          html`<button type="button" class="active-chip" data-group="${g}" value="${v}" aria-label="${t('list.removeFilter', { name: label })}">${label} <span aria-hidden="true">✕</span></button>`,
        ),
      )}
      <label class="list-sort">
        <span>${t('list.sort')}</span>
        <select class="form-control">
          ${Object.keys(SORTS).map((k) => raw(html`<option value="${k}" ${k === st.sort ? 'selected' : ''}>${t(SORT_LABEL[k])}</option>`))}
        </select>
      </label>`;
    if (!found.length) {
      rows.innerHTML = html`<div class="alert" role="status">${t('options.empty')}</div>`;
      return;
    }
    const size = Math.min(perPage, found.length);
    page = Math.min(Math.max(1, page), Math.ceil(found.length / size));
    const pager = paginationHtml({ page, perPage: size, total: found.length });
    rows.innerHTML = html`${raw(pager)}
      <div class="cards">${found.slice((page - 1) * size, page * size).map((o) => raw(cardHtml(R, o)))}</div>
      ${raw(pager)}`;
    linkProseSpells(R, rows);
    linkRules(rows);
  }

  function update({ facetsToo = true } = {}) {
    page = 1;
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
      const pos = e.target.selectionStart;
      update();
      const again = facets.querySelector('.facet-search input');
      again.focus();
      again.setSelectionRange(pos, pos);
    }, 150);
  });
  facets.addEventListener('click', (e) => {
    if (!e.target.closest('.facet-clear')) return;
    Object.assign(st, { name: '', type: [], klass: [], book: [] });
    update();
  });
  bar.addEventListener('click', (e) => {
    const chip = e.target.closest('.active-chip');
    if (!chip) return;
    if (chip.dataset.group === 'name') st.name = '';
    else st[chip.dataset.group].splice(st[chip.dataset.group].indexOf(chip.value), 1);
    update();
  });
  bar.addEventListener('change', (e) => {
    if (e.target.tagName !== 'SELECT') return;
    st.sort = e.target.value;
    update({ facetsToo: false });
  });

  bindPagination(rows, {
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

  drawFacets();
  drawResults();
}
