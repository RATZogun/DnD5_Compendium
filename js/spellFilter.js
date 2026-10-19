import { nameMatcher, titleCase, compareText } from './util.js';
import { t, ordinal } from './i18n.js';
import { listHasSpell, klassMaxSpellLevel, specMaxSpellLevel, specializationsOf } from './data.js';

export const SPELL_DEFAULTS = Object.freeze({
  name: '',
  levels: null,
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

// opções únicas de um campo, com as indicadas em first na frente
function uniqueOptions(items, field, { first = [] } = {}) {
  const firsts = [].concat(first);
  const vals = [...new Set(items.map((x) => x[field]).filter((v) => v !== null && v !== undefined && v !== ''))];
  const head = firsts.filter((v) => vals.includes(v));
  const tail = vals.filter((v) => !firsts.includes(v)).sort(compareText);
  return [...head, ...tail].map((v) => ({ value: v, label: v }));
}

const isSet = (v) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length);

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

// filtros de lista (escola, livro, nível...) aceitam várias opções: lista ou texto separado por vírgula
export const filterValues = (v) => (isSet(v) ? (Array.isArray(v) ? v : String(v).split(',')).filter(isSet) : []);

// várias classes valem juntas (qualquer uma); as subclasses marcadas ampliam a lista da própria classe
const casterTests = new WeakMap();
export function casterTest(R, klassName, specializationName = null, raceName = null) {
  if (!casterTests.has(R)) casterTests.set(R, new Map());
  const cache = casterTests.get(R);
  const key = `${klassName}|${specializationName ?? ''}|${raceName ?? ''}`;
  if (!cache.has(key)) cache.set(key, casterPredicate(R, { klassName, specializationName, raceName }) ?? (() => true));
  return cache.get(key);
}

function casterFilter(R, f) {
  const klasses = filterValues(f.klassName);
  const specs = filterValues(f.specializationName);
  if (!klasses.length && !specs.length) return null;
  const tests = [];
  for (const k of klasses) {
    const own = specs.filter((sp) => R.specializations.some((x) => x.name === sp && x.klass_name === k));
    if (own.length) own.forEach((sp) => tests.push(casterTest(R, k, sp, f.raceName)));
    else tests.push(casterTest(R, k, null, f.raceName));
  }
  if (!klasses.length) specs.forEach((sp) => tests.push(casterTest(R, null, sp)));
  return (s) => tests.some((test) => test(s));
}

export function filterSpells(R, f, spells = R.spells) {
  const preds = [];
  const eq = (key, field) => {
    if (typeof f[key] === 'boolean') preds.push((s) => s[field] === f[key]);
    else if (isSet(f[key])) {
      const vals = filterValues(f[key]).map(String);
      preds.push((s) => vals.includes(String(s[field])));
    }
  };
  eq('canEvolve', 'can_evolve');
  eq('isRitual', 'is_ritual');
  eq('doesNeedConcentration', 'does_need_concentration');
  eq('hasVerbalComponent', 'does_have_verbal_component');
  eq('hasSomaticComponent', 'does_have_somatic_component');
  if (isSet(f.isMaterialConsumed) && !isSet(f.hasMaterialComponent))
    preds.push((s) => Boolean(s.material_component) && s.is_material_component_consumed === f.isMaterialConsumed);
  if (isSet(f.hasMaterialComponent)) {
    preds.push(
      (s) =>
        Boolean(s.material_component) === f.hasMaterialComponent &&
        (!f.hasMaterialComponent ||
          !isSet(f.isMaterialConsumed) ||
          s.is_material_component_consumed === f.isMaterialConsumed),
    );
  }
  const caster = casterFilter(R, f);
  if (caster) preds.push(caster);
  if (isSet(f.sourceAbbreviation)) {
    const books = filterValues(f.sourceAbbreviation);
    preds.push((s) => (s.sources_rels ?? []).some((r) => books.includes(r.source_abbreviation)));
  }
  eq('spellSchoolName', 'spell_school_name');
  eq('attack', 'attack');
  eq('castingTimeUnit', 'casting_time_unit');
  eq('rangeUnit', 'range_unit');
  eq('savingThrow', 'saving_throw');
  if (isSet(f.type)) {
    const types = filterValues(f.type);
    preds.push((s) => types.includes(spellType(s)));
  }
  if (isSet(f.damageType)) {
    const types = filterValues(f.damageType);
    preds.push((s) => Boolean(s.damage) && types.includes(s.damage_type));
  }
  if (isSet(f.levels)) {
    const levels = filterValues(f.levels).map(Number);
    preds.push((s) => levels.includes(s.level));
  }
  if (isSet(f.levelMin)) preds.push((s) => s.level >= f.levelMin);
  if (isSet(f.levelMax)) preds.push((s) => s.level <= f.levelMax);
  if (isSet(f.name)) {
    const match = nameMatcher(String(f.name));
    preds.push((s) => match(s.name, s.original_name));
  }
  return spells.filter((s) => preds.every((p) => p(s)));
}

export const spellType = (s) => (s.damage ? 'damage' : s.heal ? 'heal' : 'other');

// grupos de opções da barra lateral da lista de magias (dentro do grupo vale qualquer opção marcada)
export function spellFacetGroups(R) {
  const S = R.spells;
  const books = new Set(S.flatMap((s) => (s.sources_rels ?? []).map((r) => r.source_abbreviation)));
  const opts = (field, first) => uniqueOptions(S, field, { first }).map((o) => ({ ...o, label: titleCase(o.label) }));
  const by = (field) => (s, v) => String(s[field]) === String(v);
  return [
    {
      key: 'levels',
      label: t('spellFilter.level'),
      options: [...new Set(S.map((s) => s.level))]
        .sort((a, b) => a - b)
        .map((l) => ({
          value: l,
          label: l === 0 ? titleCase(t('spells.cantrip')) : t('spells.levelN', { level: ordinal(l) }),
        })),
      test: (s, v) => s.level === Number(v),
    },
    {
      key: 'spellSchoolName',
      label: t('spellFilter.school'),
      options: opts('spell_school_name'),
      test: by('spell_school_name'),
    },
    {
      key: 'type',
      label: t('spellFilter.type'),
      options: ['damage', 'heal', 'other'].map((v) => ({ value: v, label: titleCase(t(`spellFilter.type.${v}`)) })),
      test: (s, v) => spellType(s) === v,
    },
    {
      key: 'damageType',
      label: t('spellFilter.damageType'),
      options: opts('damage_type'),
      test: (s, v) => Boolean(s.damage) && s.damage_type === v,
      closed: true,
    },
    { key: 'attack', label: t('spellFilter.attack'), options: opts('attack', NONE), test: by('attack'), closed: true },
    {
      key: 'savingThrow',
      label: t('spellFilter.save'),
      options: opts('saving_throw', NONE),
      test: by('saving_throw'),
      closed: true,
    },
    {
      key: 'castingTimeUnit',
      label: t('spellFilter.castingTime'),
      options: opts('casting_time_unit'),
      test: by('casting_time_unit'),
      closed: true,
    },
    {
      key: 'rangeUnit',
      label: t('spellFilter.range'),
      options: opts('range_unit'),
      test: by('range_unit'),
      closed: true,
    },
    {
      key: 'sourceAbbreviation',
      label: t('common.source'),
      options: R.sources
        .filter((b) => books.has(b.abbreviation))
        .map((b) => ({ value: b.abbreviation, label: titleCase(b.name) })),
      test: (s, v) => (s.sources_rels ?? []).some((r) => r.source_abbreviation === v),
      closed: true,
    },
  ];
}

// marcações "possui": a caixa marcada pede o valor verdadeiro
export function spellFlags() {
  return [
    ['isRitual', 'is_ritual', t('spells.ritualTag')],
    ['doesNeedConcentration', 'does_need_concentration', titleCase(t('spellFilter.concentration'))],
    ['canEvolve', 'can_evolve', titleCase(t('spellFilter.canEvolve'))],
    ['hasVerbalComponent', 'does_have_verbal_component', t('spells.verbalTag')],
    ['hasSomaticComponent', 'does_have_somatic_component', t('spells.somaticTag')],
    ['hasMaterialComponent', null, t('spells.materialTag')],
    ['isMaterialConsumed', 'is_material_component_consumed', t('spells.consumedTag')],
  ].map(([key, field, label]) => ({
    key,
    label,
    test: (s) => (field ? Boolean(s[field]) : Boolean(s.material_component)),
  }));
}

// rótulos curtos dos filtros ativos (barra de resultados e "Voltar aos resultados" da página da magia)
export function spellFilterChips(R, f) {
  const chips = [];
  if (isSet(f.name)) chips.push({ key: 'name', value: f.name, label: `“${f.name}”` });
  for (const g of spellFacetGroups(R))
    for (const v of filterValues(f[g.key]))
      chips.push({
        key: g.key,
        value: v,
        label: g.options.find((o) => String(o.value) === String(v))?.label ?? titleCase(String(v)),
      });
  if (isSet(f.levelMin) || isSet(f.levelMax)) {
    const a = f.levelMin ?? 0;
    const b = f.levelMax ?? 9;
    chips.push({
      key: 'levelRange',
      label:
        a === b
          ? a === 0
            ? titleCase(t('spells.cantrip'))
            : t('spells.levelN', { level: ordinal(a) })
          : t('spells.levelRange', { from: ordinal(a), to: ordinal(b) }),
    });
  }
  for (const key of ['klassName', 'specializationName'])
    for (const v of filterValues(f[key])) chips.push({ key, value: v, label: titleCase(v) });
  if (isSet(f.raceName)) chips.push({ key: 'raceName', label: titleCase(f.raceName) });
  for (const fl of spellFlags())
    if (isSet(f[fl.key]))
      chips.push({ key: fl.key, label: f[fl.key] ? fl.label : `${t('spells.not')} ${fl.label.toLowerCase()}` });
  return chips;
}

// classes (e subclasses) que trazem alguma magia, para os seletores da barra lateral
export const casterKlasses = (R) =>
  R.klasses.filter(
    (k) =>
      hasSpells(R, { klassName: k.name }) ||
      specializationsOf(R, k.name).some((s) => hasSpells(R, { klassName: k.name, specializationName: s.name })),
  );
export const casterSubclasses = (R, klassName) =>
  specializationsOf(R, klassName).filter((s) => hasSpells(R, { klassName, specializationName: s.name }));

export function pickFilters(query, defaults = SPELL_DEFAULTS) {
  const out = { ...defaults };
  for (const k of Object.keys(defaults)) if (k in query) out[k] = query[k];
  out.name = out.name == null ? '' : String(out.name);
  return out;
}

export const hasActiveFilters = (f, defaults = SPELL_DEFAULTS) =>
  Object.keys(defaults).some((k) => isSet(f[k]) && f[k] !== defaults[k]);
