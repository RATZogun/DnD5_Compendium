import { html, raw, titleCase, nameMatcher, setTitle } from '../util.js';
import { t, getLang } from '../i18n.js';
import { href, replaceQuery } from '../router.js';
import { createFilterPanel } from '../components/filters.js';
import { sourcesHtml } from '../components/spellCard.js';
import { pickFilters } from '../spellFilter.js';

const RACE_DEFAULTS = Object.freeze({ name: '', size: null, sourceAbbreviation: null });

function raceFilterFields(R) {
  const sizes = [...new Set(R.races.flatMap((r) => r.size ?? []))].sort();
  const books = new Set(R.races.flatMap((r) => r.sources_rels.map((s) => s.source_abbreviation)));
  return [
    { key: 'name', label: t('common.name'), type: 'text' },
    { key: 'size', label: t('races.size'), type: 'select', options: () => sizes.map((s) => ({ value: s, label: s })) },
    {
      key: 'sourceAbbreviation',
      label: t('common.source'),
      type: 'select',
      options: () =>
        R.sources
          .filter((s) => books.has(s.abbreviation))
          .map((s) => ({ value: s.abbreviation, label: titleCase(s.name) })),
    },
  ];
}

function filterRaces(R, f) {
  let r = R.races;
  if (f.size) r = r.filter((x) => (x.size ?? []).includes(f.size));
  if (f.sourceAbbreviation)
    r = r.filter((x) => x.sources_rels.some((s) => s.source_abbreviation === f.sourceAbbreviation));
  if (f.name) {
    const match = nameMatcher(f.name);
    r = r.filter((x) => match(x.name, ...(x.subraces ?? [])));
  }
  return r;
}

const SIZES = { T: ['miúdo', 'Tiny'], S: ['pequeno', 'Small'], M: ['médio', 'Medium'], L: ['grande', 'Large'] };

export const sizeText = (codes) =>
  (codes ?? []).map((c) => SIZES[c]?.[getLang() === 'pt' ? 0 : 1] ?? c).join(' / ') || '—';

export function speedText(speed) {
  if (!speed) return '—';
  return getLang() === 'pt' ? `${String(speed.m).replace('.', ',')} m` : `${speed.ft} ft.`;
}

function raceCardHtml(R, race) {
  return html` <article class="panel race-card">
    <header class="panel-heading">
      <h3 class="title"><a href="${href.race(race.slug)}">${titleCase(race.name)}</a></h3>
    </header>
    <div class="panel-body">
      <p>
        <strong>${titleCase(t('races.size'))}</strong>: ${(race.size ?? []).join(' / ') || '—'} ·
        <strong>${titleCase(t('races.speed'))}</strong>: ${speedText(race.speed)}
      </p>
      ${race.subraces?.length ? raw(html`<p><strong>${titleCase(t('races.subraces'))}</strong>: ${race.subraces.map((s) => titleCase(s)).join(', ')}</p>`) : ''}
    </div>
    <footer class="panel-footer">${raw(sourcesHtml(R, race.sources_rels))}</footer>
  </article>`;
}

export function render(container, { R, query }) {
  setTitle(t('races.title'));
  let filters = pickFilters(query, RACE_DEFAULTS);

  container.innerHTML = html` <h1>${t('races.title')}</h1>
    <div id="races-filters"></div>
    <div id="races-list" class="cards" aria-live="polite"></div>`;
  const list = container.querySelector('#races-list');
  createFilterPanel(container.querySelector('#races-filters'), {
    fields: raceFilterFields(R),
    defaults: RACE_DEFAULTS,
    state: filters,
    open: Object.keys(query).length > 0,
    onChange: (st) => {
      filters = st;
      replaceQuery(st);
      draw();
    },
  });

  function draw() {
    const races = filterRaces(R, filters);
    list.innerHTML = races.length
      ? races.map((r) => raceCardHtml(R, r)).join('')
      : html`<div class="alert" role="status">${t('races.empty')}</div>`;
  }

  draw();
}
