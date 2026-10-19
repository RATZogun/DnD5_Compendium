import { html, raw, titleCase, nameMatcher, setTitle, compareText } from '../util.js';
import { t } from '../i18n.js';
import { href, replaceQuery } from '../router.js';
import { filterSpells } from '../spellFilter.js';
import { icon } from '../icons.js';
import { classIcon } from '../classIcons.js';

// lista de classes no mesmo modelo de espécies e magias: filtros à esquerda (com contagens), cartões à direita.
// Em cada grupo vale qualquer opção marcada; em "possui" valem todas; entre grupos valem todos.
const HAS = [
  ['prepares', 'must_prepare_spells', 'classes.has.prepares'],
  ['learns', 'must_learn_spells', 'classes.has.learns'],
  ['cantrips', 'can_cast_cantrips', 'classes.has.cantrips'],
  ['rituals', 'can_cast_rituals', 'classes.has.rituals'],
  ['focus', 'can_use_magic_focus', 'classes.has.focus'],
];
const NO_CASTING = 'none';
const SORTS = {
  az: (a, b) => compareText(a.name, b.name),
  za: (a, b) => compareText(b.name, a.name),
  hitDie: (a, b) => (b.hit_die ?? 0) - (a.hit_die ?? 0) || compareText(a.name, b.name),
};
const SORT_LABEL = { az: 'list.sort.az', za: 'list.sort.za', hitDie: 'classes.sort.hitDie' };
const list = (v) => (v ? String(v).split(',').filter(Boolean) : []);

// livros pelo nome (a mesma obra pode vir com siglas diferentes nos dados)
const bookNames = (R, k) =>
  (k.sources_rels ?? []).map((s) => R.sourceByAbbr.get(s.source_abbreviation)?.name ?? s.source_abbreviation);
const abilityOf = (k) => k.spellcasting_ability_abbreviation ?? NO_CASTING;
const subclassesOf = (R, k) => R.specializations.filter((s) => s.klass_slug === k.slug);

function readState(query) {
  return {
    name: query.name ? String(query.name) : '',
    ability: list(query.ability),
    hitDie: list(query.hitDie),
    source: list(query.source),
    has: list(query.has).filter((h) => HAS.some(([key]) => key === h)),
    sort: Object.hasOwn(SORTS, query.sort) ? query.sort : 'az',
  };
}

const matchers = (R, st) => ({
  name: st.name
    ? (
        (m) => (k) =>
          m(k.name)
      )(nameMatcher(st.name))
    : null,
  ability: st.ability.length ? (k) => st.ability.includes(abilityOf(k)) : null,
  hitDie: st.hitDie.length ? (k) => st.hitDie.includes(String(k.hit_die)) : null,
  source: st.source.length ? (k) => bookNames(R, k).some((n) => st.source.includes(n)) : null,
  has: st.has.length ? (k) => st.has.every((h) => k[HAS.find(([key]) => key === h)[1]]) : null,
});

// aplica todos os filtros, menos o grupo indicado (para as contagens de cada opção)
function filterKlasses(R, st, except = null) {
  const m = matchers(R, st);
  return R.klasses.filter((k) => Object.entries(m).every(([key, fn]) => key === except || !fn || fn(k)));
}

function optionHtml(group, value, label, count, checked) {
  return html`<label class="facet-option">
    <input type="checkbox" data-group="${group}" value="${value}" ${checked ? 'checked' : ''} />
    <span class="facet-label">${label}</span>
    <span class="facet-count">${count}</span>
  </label>`;
}

// cartão no visual da ficha de magia: emblema, nome e dado de vida; conjuração; livro
function klassCardHtml(R, k) {
  const src = k.sources_rels?.[0];
  const book = src && R.sourceByAbbr.get(src.source_abbreviation);
  const subs = subclassesOf(R, k).length;
  const ability = k.spellcasting_ability_abbreviation && R.abilityByAbbr.get(k.spellcasting_ability_abbreviation);
  const spells = k.spell_list_name ? filterSpells(R, { klassName: k.name }).length : 0;
  const traits = HAS.filter(([, field]) => k[field]).map(([, , label]) => t(label));
  const meta = [
    k.hit_die ? `${titleCase(t('classes.hitDie'))} d${k.hit_die}` : '',
    subs ? t('classes.subclassesN', { n: subs }) : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return html`<a class="race-tile klass-tile" href="${href.klass(k.slug)}">
    <span class="sp-head race-tile-head">
      <span class="race-tile-icon">${raw(classIcon(k.slug, 28))}</span>
      <span>
        <span class="sp-name race-tile-name">${titleCase(k.name)}</span>
        <span class="sp-source race-tile-meta">${meta}</span>
      </span>
    </span>
    <span class="sp-body race-tile-subs ${ability ? '' : 'text-muted'}">
      ${
        ability
          ? raw(
              html`${t('classes.castsWith', { ability: titleCase(ability.name) })} ·
                ${t('classes.spellsCount', { n: spells })}${traits.length ? raw(html`<br />${traits.join(' · ')}`) : ''}`,
            )
          : t('classes.noCasting')
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
  setTitle(t('classes.title'));
  const st = readState(query);
  container.innerHTML = html`<nav class="crumbs" aria-label="breadcrumb">
      <a href="#/">${t('nav.home')}</a> › <span>${titleCase(t('classes.title'))}</span>
    </nav>
    <header class="list-head">
      <span class="chip chip-class">${t('list.category')}</span>
      <h1>${titleCase(t('classes.title'))}</h1>
    </header>
    <div class="ornament" aria-hidden="true"><span></span><i></i><span></span></div>
    <div class="list-layout">
      <aside class="facets">
        <button type="button" class="facets-toggle" aria-expanded="false">${titleCase(t('filters.title'))}</button>
        <div class="facets-body"></div>
      </aside>
      <section class="list-main">
        <div class="list-bar"></div>
        <div class="race-grid klass-grid" aria-live="polite"></div>
      </section>
    </div>`;

  const facets = container.querySelector('.facets-body');
  const bar = container.querySelector('.list-bar');
  const grid = container.querySelector('.klass-grid');
  const toggle = container.querySelector('.facets-toggle');
  toggle.addEventListener('click', () => {
    const open = container.querySelector('.facets').classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  const abilities = [...new Set(R.klasses.map(abilityOf))]
    .sort((a, b) => (a === NO_CASTING) - (b === NO_CASTING) || a.localeCompare(b))
    .map((v) => ({
      value: v,
      label: v === NO_CASTING ? t('classes.noCasting') : titleCase(R.abilityByAbbr.get(v)?.name ?? v),
    }));
  const dice = [...new Set(R.klasses.map((k) => k.hit_die).filter(Boolean))].sort((a, b) => a - b);
  const sources = [...new Set(R.klasses.flatMap((k) => bookNames(R, k)))].sort(compareText);
  const labelOf = (group, v) =>
    group === 'ability'
      ? abilities.find((a) => a.value === v)?.label
      : group === 'hitDie'
        ? `d${v}`
        : group === 'source'
          ? titleCase(v)
          : t(HAS.find(([key]) => key === v)?.[2] ?? v);

  function save() {
    replaceQuery({
      name: st.name || null,
      ability: st.ability.join(',') || null,
      hitDie: st.hitDie.join(',') || null,
      source: st.source.join(',') || null,
      has: st.has.join(',') || null,
      sort: st.sort === 'az' ? null : st.sort,
    });
  }

  function drawFacets() {
    const count = (group, test) => filterKlasses(R, st, group).filter(test).length;
    facets.innerHTML = html`<label class="facet-search">
        ${raw(icon.search(16))}
        <input type="search" value="${st.name}" placeholder="${t('list.filterName')}" aria-label="${t('common.name')}" />
      </label>
      <fieldset class="facet">
        <legend>${t('classes.spellcastingAbility')}</legend>
        ${abilities.map((a) =>
          raw(
            optionHtml(
              'ability',
              a.value,
              a.label,
              count('ability', (k) => abilityOf(k) === a.value),
              st.ability.includes(a.value),
            ),
          ),
        )}
      </fieldset>
      <fieldset class="facet">
        <legend>${t('classes.hitDie')}</legend>
        ${dice.map((d) =>
          raw(
            optionHtml(
              'hitDie',
              d,
              `d${d}`,
              count('hitDie', (k) => k.hit_die === d),
              st.hitDie.includes(String(d)),
            ),
          ),
        )}
      </fieldset>
      <fieldset class="facet">
        <legend>${t('list.has')}</legend>
        ${HAS.map(([key, field, label]) => raw(optionHtml('has', key, t(label), filterKlasses(R, st).filter((k) => k[field]).length, st.has.includes(key))))}
      </fieldset>
      <fieldset class="facet">
        <legend>${t('common.source')}</legend>
        ${sources.map((n) =>
          raw(
            optionHtml(
              'source',
              n,
              titleCase(n),
              count('source', (k) => bookNames(R, k).includes(n)),
              st.source.includes(n),
            ),
          ),
        )}
      </fieldset>
      <button type="button" class="link-btn facet-clear">${t('list.clear')}</button>`;
  }

  function drawResults() {
    const klasses = filterKlasses(R, st).sort(SORTS[st.sort]);
    const chips = [
      ...(st.name ? [['name', '', `“${st.name}”`]] : []),
      ...['ability', 'hitDie', 'has', 'source'].flatMap((g) => st[g].map((v) => [g, v, labelOf(g, v)])),
    ];
    bar.innerHTML = html`<strong class="list-count">${klasses.length === 1 ? t('list.result') : t('list.results', { n: klasses.length })}</strong>
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
    grid.innerHTML = klasses.length
      ? klasses.map((k) => klassCardHtml(R, k)).join('')
      : html`<div class="alert" role="status">${t('classes.empty')}</div>`;
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
    Object.assign(st, { name: '', ability: [], hitDie: [], source: [], has: [] });
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

  drawFacets();
  drawResults();
}
