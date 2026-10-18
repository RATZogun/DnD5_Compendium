import { nameMatcher, titleCase } from './util.js';
import { t } from './i18n.js';
import { uniqueOptions } from './components/filters.js';
import { listHasSpell, klassMaxSpellLevel, specMaxSpellLevel, specializationsOf } from './data.js';

export const SPELL_DEFAULTS = Object.freeze({
  name: '',
  levelMin: null,
  levelMax: null,
  spellSchoolName: null,
  isRitual: null,
  klassName: null,
  specializationName: null,
  type: null,
  damageType: null,
  attack: null,
  savingThrow: null,
  castingTimeUnit: null,
  rangeUnit: null,
  doesNeedConcentration: null,
  canEvolve: null,
  sourceAbbreviation: null,
  hasVerbalComponent: null,
  hasSomaticComponent: null,
  hasMaterialComponent: null,
  isMaterialConsumed: null,
  raceName: null,
});

const NONE = ['nenhum', 'none'];

export function spellFilterFields(R) {
  const S = R.spells;
  const levels = S.map((s) => s.level);
  const books = new Set(S.flatMap((s) => (s.sources_rels ?? []).map((r) => r.source_abbreviation)));
  const components = t('spellFilter.components');
  return [
    { key: 'name', label: t('common.name'), type: 'text' },
    {
      keys: ['levelMin', 'levelMax'],
      label: t('spellFilter.level'),
      type: 'range',
      min: Math.min(...levels),
      max: Math.max(...levels),
    },
    {
      key: 'spellSchoolName',
      label: t('spellFilter.school'),
      type: 'select',
      options: () => R.spellSchools.map((s) => ({ value: s.name, label: s.name })),
    },
    { key: 'isRitual', label: t('spellFilter.ritual'), type: 'boolean' },
    {
      key: 'klassName',
      label: t('spellFilter.class'),
      type: 'select',
      options: () =>
        R.klasses
          .filter(
            (k) =>
              hasSpells(R, { klassName: k.name }) ||
              specializationsOf(R, k.name).some((s) => hasSpells(R, { klassName: k.name, specializationName: s.name })),
          )
          .map((k) => ({ value: k.name, label: k.name })),
      onChange: (st) => {
        if (
          st.specializationName &&
          !specializationsOf(R, st.klassName).some((s) => s.name === st.specializationName)
        ) {
          st.specializationName = null;
        }
      },
    },
    {
      key: 'specializationName',
      label: t('spellFilter.specialization'),
      type: 'select',
      visible: (st) => Boolean(st.klassName),
      options: (st) =>
        specializationsOf(R, st.klassName)
          .filter((s) => hasSpells(R, { klassName: st.klassName, specializationName: s.name }))
          .map((s) => ({ value: s.name, label: s.name })),
    },
    {
      key: 'type',
      label: t('spellFilter.type'),
      type: 'select',
      options: () => ['damage', 'heal', 'other'].map((v) => ({ value: v, label: t(`spellFilter.type.${v}`) })),
    },
    {
      key: 'damageType',
      label: t('spellFilter.damageType'),
      type: 'select',
      visible: (st) => st.type === 'damage',
      options: () => uniqueOptions(S, 'damage_type'),
    },
    {
      key: 'attack',
      label: t('spellFilter.attack'),
      type: 'select',
      options: () => uniqueOptions(S, 'attack', { first: NONE }),
    },
    {
      key: 'savingThrow',
      label: t('spellFilter.save'),
      type: 'select',
      options: () => uniqueOptions(S, 'saving_throw', { first: NONE }),
    },
    {
      key: 'castingTimeUnit',
      label: t('spellFilter.castingTime'),
      type: 'select',
      options: () => uniqueOptions(S, 'casting_time_unit'),
    },
    { key: 'rangeUnit', label: t('spellFilter.range'), type: 'select', options: () => uniqueOptions(S, 'range_unit') },
    { key: 'doesNeedConcentration', label: t('spellFilter.concentration'), type: 'boolean' },
    { key: 'canEvolve', label: t('spellFilter.canEvolve'), type: 'boolean' },
    {
      key: 'sourceAbbreviation',
      label: t('common.source'),
      type: 'select',
      options: () =>
        R.sources
          .filter((s) => books.has(s.abbreviation))
          .map((s) => ({ value: s.abbreviation, label: titleCase(s.name) })),
    },
    { key: 'hasVerbalComponent', label: t('spellFilter.verbal'), type: 'boolean', fieldset: components },
    { key: 'hasSomaticComponent', label: t('spellFilter.somatic'), type: 'boolean', fieldset: components },
    { key: 'hasMaterialComponent', label: t('spellFilter.material'), type: 'boolean', fieldset: components },
    {
      key: 'isMaterialConsumed',
      label: t('spellFilter.consumed'),
      type: 'boolean',
      fieldset: components,
      visible: (st) => st.hasMaterialComponent === true,
    },
  ];
}

const isSet = (v) => v !== null && v !== undefined && v !== '';

// só entram no filtro classes e subclasses que trazem alguma magia (como no filtro de livro)
const spellCount = new WeakMap();
function hasSpells(R, f) {
  if (!spellCount.has(R)) spellCount.set(R, new Map());
  const cache = spellCount.get(R);
  const key = `${f.klassName}|${f.specializationName ?? ''}`;
  if (!cache.has(key)) cache.set(key, R.spells.some(casterPredicate(R, f)));
  return cache.get(key);
}

function casterPredicate(R, f) {
  if (!isSet(f.klassName) && !isSet(f.specializationName)) return null;
  const klass = isSet(f.klassName) ? R.klassByName.get(f.klassName) : null;
  const spec = isSet(f.specializationName)
    ? R.specializations.find((s) => s.name === f.specializationName && (!klass || s.klass_name === klass.name))
    : null;
  if (!klass && !spec) return () => false;
  if (!klass) return (s) => listHasSpell(R, spec.spell_list_name, s.name);
  const race = isSet(f.raceName) ? R.raceByName.get(f.raceName) : null;
  const maxLvl = Math.max(klassMaxSpellLevel(R, klass), spec ? specMaxSpellLevel(R, spec) : -1);
  return (s) =>
    s.level <= maxLvl &&
    (listHasSpell(R, klass.spell_list_name, s.name) ||
      (spec && listHasSpell(R, spec.spell_list_name, s.name)) ||
      (!spec && race && listHasSpell(R, race.spell_list_name, s.name)));
}

export function filterSpells(R, f, spells = R.spells) {
  const preds = [];
  const eq = (key, field) => {
    if (isSet(f[key])) preds.push((s) => s[field] === f[key]);
  };
  eq('canEvolve', 'can_evolve');
  eq('isRitual', 'is_ritual');
  eq('doesNeedConcentration', 'does_need_concentration');
  eq('hasVerbalComponent', 'does_have_verbal_component');
  eq('hasSomaticComponent', 'does_have_somatic_component');
  if (isSet(f.hasMaterialComponent)) {
    preds.push(
      (s) =>
        Boolean(s.material_component) === f.hasMaterialComponent &&
        (!f.hasMaterialComponent ||
          !isSet(f.isMaterialConsumed) ||
          s.is_material_component_consumed === f.isMaterialConsumed),
    );
  }
  const caster = casterPredicate(R, f);
  if (caster) preds.push(caster);
  if (isSet(f.sourceAbbreviation))
    preds.push((s) => (s.sources_rels ?? []).some((r) => r.source_abbreviation === f.sourceAbbreviation));
  eq('spellSchoolName', 'spell_school_name');
  eq('attack', 'attack');
  eq('castingTimeUnit', 'casting_time_unit');
  eq('rangeUnit', 'range_unit');
  eq('savingThrow', 'saving_throw');
  if (f.type === 'damage')
    preds.push((s) => Boolean(s.damage) && (!isSet(f.damageType) || s.damage_type === f.damageType));
  else if (f.type === 'heal') preds.push((s) => Boolean(s.heal));
  else if (f.type === 'other') preds.push((s) => !s.damage && !s.heal);
  if (isSet(f.levelMin)) preds.push((s) => s.level >= f.levelMin);
  if (isSet(f.levelMax)) preds.push((s) => s.level <= f.levelMax);
  if (isSet(f.name)) {
    const match = nameMatcher(String(f.name));
    preds.push((s) => match(s.name, s.original_name));
  }
  return spells.filter((s) => preds.every((p) => p(s)));
}

export function pickFilters(query, defaults = SPELL_DEFAULTS) {
  const out = { ...defaults };
  for (const k of Object.keys(defaults)) if (k in query) out[k] = query[k];
  out.name = out.name == null ? '' : String(out.name);
  return out;
}

export const hasActiveFilters = (f, defaults = SPELL_DEFAULTS) =>
  Object.keys(defaults).some((k) => isSet(f[k]) && f[k] !== defaults[k]);
