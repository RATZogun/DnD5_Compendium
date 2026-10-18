import { html, raw, nameMatcher, setTitle, titleCase } from '../util.js';
import { t, ordinal } from '../i18n.js';
import { href, replaceQuery } from '../router.js';
import { createFilterPanel } from '../components/filters.js';
import { sourcesHtml } from '../components/spellCard.js';
import { listSpells, listLevelSpells, klassMaxSpellLevel } from '../data.js';
import { pickFilters, hasActiveFilters } from '../spellFilter.js';

const KLASS_DEFAULTS = Object.freeze({
  name: '',
  spellcastingAbilityAbbreviation: null,
  mustLearnSpells: null,
  canLearnExtraSpells: null,
  mustPrepareSpells: null,
  canCastCantrips: null,
  canCastRituals: null,
  canUseMagicFocus: null,
});

const FLAGS = [
  ['mustLearnSpells', 'must_learn_spells', 'classes.mustLearn'],
  ['canLearnExtraSpells', 'can_learn_extra_spells', 'classes.canLearnExtra'],
  ['mustPrepareSpells', 'must_prepare_spells', 'classes.mustPrepare'],
  ['canCastCantrips', 'can_cast_cantrips', 'classes.canCastCantrips'],
  ['canCastRituals', 'can_cast_rituals', 'classes.canCastRituals'],
  ['canUseMagicFocus', 'can_use_magic_focus', 'classes.canUseFocus'],
];
const DASH = '–';

// Só o Segredo Mágico do bardo soma às magias conhecidas; o Arcano Místico do bruxo não ocupa espaço.
const KNOWN_SPELL_REGULARITIES = new Set(['consome espaço de magia', 'consumes spell slot']);

function klassFilterFields(R) {
  return [
    { key: 'name', label: t('common.name'), type: 'text' },
    {
      key: 'spellcastingAbilityAbbreviation',
      label: t('classes.spellcastingAbility'),
      type: 'select',
      options: () =>
        R.abilities
          .filter((a) => R.klasses.some((k) => k.spellcasting_ability_abbreviation === a.abbreviation))
          .map((a) => ({ value: a.abbreviation, label: a.name })),
    },
    ...FLAGS.map(([key, , label]) => ({ key, label: t(label), type: 'boolean' })),
  ].map((f) => {
    if (f.key === 'mustLearnSpells')
      return {
        ...f,
        onChange: (st) => {
          if (st.mustLearnSpells !== true) st.canLearnExtraSpells = null;
        },
      };
    if (f.key === 'canLearnExtraSpells') return { ...f, visible: (st) => st.mustLearnSpells === true };
    return f;
  });
}

function filterKlasses(R, f) {
  const byName = nameMatcher(f.name);
  return R.klasses.filter((k) => {
    if (f.spellcastingAbilityAbbreviation && k.spellcasting_ability_abbreviation !== f.spellcastingAbilityAbbreviation)
      return false;
    for (const [key, field] of FLAGS) if (f[key] != null && k[field] !== f[key]) return false;
    return byName(k.name);
  });
}

const casterType = (R, klass) => R.casterTypes.get(klass.spellcaster_type_name) ?? null;
const maxOf = (list, key) => list.reduce((m, x) => Math.max(m, x[key] ?? 0), 0);

export function klassSpecializations(R, klass) {
  return R.raw.specializations.filter((s) => s.klass_name === klass.name);
}

// Classe + subclasses, com o mesmo teto de nível do filtro de Magias.
function availableSpellsCount(R, klass) {
  if (!casterType(R, klass) || !klass.spell_list_name) return null;
  const maxLevel = klassMaxSpellLevel(R, klass);
  const names = new Set();
  for (const listName of [klass.spell_list_name, ...klassSpecializations(R, klass).map((s) => s.spell_list_name)]) {
    for (const s of listSpells(R, listName)) if (s.level <= maxLevel) names.add(s.name);
  }
  return names.size;
}

function progressionRows(R, klass) {
  const type = casterType(R, klass);
  if (!type) return { maxSpellLevel: 0, rows: [] };
  const maxSpellLevel = maxOf(type.levels, 'spell_level');
  const maxLevel = maxOf(type.levels, 'level');
  const extras = listLevelSpells(R, klass.spell_list_name).filter((ls) => KNOWN_SPELL_REGULARITIES.has(ls.regularity));
  const rows = [];
  for (let L = 1; L <= maxLevel; L++) {
    const row = klass.class_levels.find((l) => l.level === L);
    const cantrips = row && klass.can_cast_cantrips && row.cantrips_known > 0 ? row.cantrips_known : DASH;
    const known =
      !row || !klass.must_learn_spells || !row.spells_known
        ? DASH
        : row.spells_known + extras.filter((ls) => ls.level <= L).length;
    const slots = [];
    for (let s = 1; s <= maxSpellLevel; s++) {
      const x = type.levels.find((l) => l.level === L && l.spell_level === s);
      slots.push(x && x.slots > 0 ? x.slots : DASH);
    }
    rows.push({ level: L, cantrips, known, slots });
  }
  return { maxSpellLevel, rows };
}

function preparableSpellsText(R, klass) {
  const formula = casterType(R, klass)?.preparable_spells;
  if (!formula) return null;
  const ability = R.abilityByAbbr.get(klass.spellcasting_ability_abbreviation);
  return formula
    .replace('class_lv', t('classes.formula.classLevel', { klass: klass.name }))
    .replace('.floor', t('classes.formula.floor'))
    .replace('.ceil', t('classes.formula.ceil'))
    .replace(
      'ability_mod',
      ability
        ? t('classes.formula.abilityMod', { ability: titleCase(ability.name) })
        : t('classes.formula.abilityModGeneric'),
    );
}

function progressionHtml(R, klass) {
  const { maxSpellLevel, rows } = progressionRows(R, klass);
  if (!rows.length) return '';
  const showCantrips = klass.can_cast_cantrips;
  const showKnown = klass.must_learn_spells;
  const levels = Array.from({ length: maxSpellLevel }, (_, i) => i + 1);
  const wide = html` <div class="table-wrap progression-wide">
    <table class="data-table progression-table">
      <thead>
        <tr>
          <th rowspan="2">${titleCase(t('common.level'))}</th>
          ${showCantrips ? raw(html`<th rowspan="2" class="num">${titleCase(t('classes.cantripsKnown'))}</th>`) : ''}
          ${showKnown ? raw(html`<th rowspan="2" class="num">${titleCase(t('classes.spellsKnown'))}</th>`) : ''}
          <th colspan="${maxSpellLevel}" class="num">${titleCase(t('classes.slotsByLevel'))}</th>
        </tr>
        <tr>
          ${levels.map((s) => raw(html`<th class="num">${ordinal(s)}</th>`))}
        </tr>
      </thead>
      <tbody>
        ${rows.map((r) =>
          raw(
            html`<tr>
              <td>${ordinal(r.level)}</td>
              ${showCantrips ? raw(html`<td class="num">${r.cantrips}</td>`) : ''}
              ${showKnown ? raw(html`<td class="num">${r.known}</td>`) : ''}
              ${r.slots.map((n) => raw(html`<td class="num">${n}</td>`))}
            </tr>`,
          ),
        )}
      </tbody>
    </table>
  </div>`;
  const narrow = html` <table class="data-table progression-narrow">
    ${rows.map((r, i) =>
      raw(
        html`<tbody class="${i % 2 ? 'odd' : 'even'}">
          <tr>
            <th>${titleCase(t('common.level'))}</th>
            <td class="num">${ordinal(r.level)}</td>
          </tr>
          ${
            showCantrips
              ? raw(
                  html`<tr>
                    <th>${titleCase(t('classes.cantripsKnown'))}</th>
                    <td class="num">${r.cantrips}</td>
                  </tr>`,
                )
              : ''
          }
          ${
            showKnown
              ? raw(
                  html`<tr>
                    <th>${titleCase(t('classes.spellsKnown'))}</th>
                    <td class="num">${r.known}</td>
                  </tr>`,
                )
              : ''
          }
          ${r.slots.map((n, s) =>
            n === DASH
              ? ''
              : raw(
                  html`<tr>
                    <th>${t('classes.slotsOfLevel', { level: ordinal(s + 1) })}</th>
                    <td class="num">${n}</td>
                  </tr>`,
                ),
          )}
        </tbody>`,
      ),
    )}
  </table>`;
  return wide + narrow;
}

function availableHtml(R, klass) {
  const count = availableSpellsCount(R, klass);
  if (count === null) return html`<span class="text-muted">${t('classes.noList')}</span>`;
  return html`${count} <a class="btn btn-xs" href="${href.spells({ klassName: klass.name })}">${t('classes.view')}</a>`;
}

function bodyHtml(R, klass) {
  if (!casterType(R, klass)) return '';
  const ability = R.abilityByAbbr.get(klass.spellcasting_ability_abbreviation);
  const preparable = klass.must_prepare_spells ? preparableSpellsText(R, klass) : null;
  const flags = FLAGS.filter(([key]) => key !== 'canLearnExtraSpells' || klass.must_learn_spells);
  const yesNo = (v) => t(v ? 'common.yes' : 'common.no');
  return html` <div class="panel-body">
    <div class="klass-cols">
      <dl class="klass-dl">
        <dt>${titleCase(t('classes.spellcastingAbility'))}</dt>
        <dd>${ability ? titleCase(ability.name) : '—'}</dd>
        ${
          preparable
            ? raw(
                html`<dt>${titleCase(t('classes.preparable'))}</dt>
                  <dd>${preparable}</dd>`,
              )
            : ''
        }
        <dt>${titleCase(t('classes.available'))}</dt>
        <dd>${raw(availableHtml(R, klass))}</dd>
      </dl>
      <dl class="klass-dl">
        ${flags.map(([, field, label]) =>
          raw(
            html`<dt>${titleCase(t(label))}</dt>
              <dd>${yesNo(klass[field])}</dd>`,
          ),
        )}
      </dl>
    </div>
    ${raw(progressionHtml(R, klass))}
  </div>`;
}

function summaryHtml(R, klass) {
  const subs = R.specializations.filter((s) => s.klass_slug === klass.slug).length;
  const parts = [];
  if (klass.hit_die) parts.push(`${titleCase(t('classes.hitDie'))}: d${klass.hit_die}`);
  if (subs) parts.push(t('classes.subclassCount', { title: titleCase(klass.subclass_title ?? ''), n: subs }));
  return parts.length ? html`<p class="klass-summary text-muted">${parts.join(' · ')}</p>` : '';
}

export function klassCardHtml(R, klass, { showName = true } = {}) {
  return html` <article class="panel klass-card">
    ${
      showName
        ? raw(
            html`<header class="panel-heading">
              <h3><a href="${href.klass(klass.slug)}">${titleCase(klass.name)} ›</a></h3>
              ${raw(summaryHtml(R, klass))}
            </header>`,
          )
        : ''
    }
    ${raw(bodyHtml(R, klass))}
    ${klass.sources_rels?.length ? raw(html`<footer class="panel-footer">${raw(sourcesHtml(R, klass.sources_rels))}</footer>`) : ''}
  </article>`;
}

export function render(container, { R, query }) {
  setTitle(t('classes.title'));
  let filters = pickFilters(query, KLASS_DEFAULTS);
  if (filters.mustLearnSpells !== true) filters.canLearnExtraSpells = null;

  container.innerHTML = html` <h1>${t('classes.title')}</h1>
    <div id="klasses-filters"></div>
    <div id="klasses-list" aria-live="polite"></div>`;
  const list = container.querySelector('#klasses-list');

  createFilterPanel(container.querySelector('#klasses-filters'), {
    fields: klassFilterFields(R),
    defaults: KLASS_DEFAULTS,
    state: filters,
    open: hasActiveFilters(filters, KLASS_DEFAULTS),
    onChange: (st) => {
      filters = st;
      replaceQuery(st);
      draw();
    },
  });

  function draw() {
    const filtered = filterKlasses(R, filters);
    list.innerHTML = filtered.length
      ? filtered.map((k) => klassCardHtml(R, k)).join('')
      : html`<div class="alert" role="status">${t('classes.empty')}</div>`;
  }

  draw();
}
