import { sortByName } from './util.js';

const cache = new Map();

// Cada idioma tem seu arquivo; enquanto data/rules.en.json não existir, usa o português.
export function loadRules(lang) {
  if (!cache.has(lang)) {
    const promise = fetchJson(`data/rules.${lang}.json`)
      .catch((err) => (lang === 'pt' ? Promise.reject(err) : fetchJson('data/rules.pt.json')))
      .then(buildIndex)
      .catch((err) => {
        cache.delete(lang);
        throw err;
      });
    cache.set(lang, promise);
  }
  return cache.get(lang);
}

const classCache = new Map();

// Detalhes completos (pt e en) ficam num arquivo por classe, carregado só quando a página abre.
export function loadClass(slug) {
  if (!classCache.has(slug)) {
    classCache.set(
      slug,
      fetchJson(`data/classes/${encodeURIComponent(slug)}.json`).catch((err) => {
        classCache.delete(slug);
        throw err;
      }),
    );
  }
  return classCache.get(slug);
}

const speciesCache = new Map();

// opções e recursos da página de regras (invocações, infusões, disciplinas, manobras...)
let optionsCache = null;
export function loadOptions() {
  if (!optionsCache)
    optionsCache = fetchJson('data/options.json').catch((err) => {
      optionsCache = null;
      throw err;
    });
  return optionsCache;
}

// resumo de regras (dnd5e-quickref), com os textos nos dois idiomas
let quickrefCache = null;
export function loadQuickref() {
  if (!quickrefCache)
    quickrefCache = fetchJson('data/quickref.json').catch((err) => {
      quickrefCache = null;
      throw err;
    });
  return quickrefCache;
}

export function loadSpecies(slug) {
  if (!speciesCache.has(slug)) {
    speciesCache.set(
      slug,
      fetchJson(`data/species/${encodeURIComponent(slug)}.json`).catch((err) => {
        speciesCache.delete(slug);
        throw err;
      }),
    );
  }
  return speciesCache.get(slug);
}

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}

function fixData(d) {
  const sorcerer = d.klasses.find((k) => k.slug === 'sorcerer');
  const lv10 = sorcerer?.class_levels.find((l) => l.level === 10);
  if (lv10 && lv10.spells_known === 1) lv10.spells_known = 11; // erro do dado original; SRD: 11
  for (const s of d.spells) {
    for (const k of [
      'material_component',
      'material_component_cost',
      'damage',
      'heal',
      'casting_conditions',
      'damage_type',
    ]) {
      if (s[k] === '') s[k] = null;
    }
  }
}

function buildIndex(d) {
  fixData(d);
  const by = (list, key) => new Map(list.map((x) => [x[key], x]));
  const spells = sortByName(d.spells);
  const R = {
    raw: d,
    spells,
    spellByName: by(spells, 'name'),
    spellBySlug: by(spells, 'slug'),
    klasses: sortByName(d.klasses),
    klassByName: by(d.klasses, 'name'),
    klassBySlug: by(d.klasses, 'slug'),
    specializations: sortByName(d.specializations),
    races: sortByName(d.races),
    raceByName: by(d.races, 'name'),
    raceBySlug: by(d.races, 'slug'),
    abilities: [...d.abilities].sort((a, b) => a.order - b.order),
    abilityByAbbr: by(d.abilities, 'abbreviation'),
    sources: sortByName(d.sources),
    sourceByAbbr: by(d.sources, 'abbreviation'),
    spellSchools: sortByName(d.spell_schools),
    spellLists: by(d.spell_lists, 'name'),
    levelSpellByName: by(d.level_spells, 'name'),
    casterTypes: by(d.spellcaster_types, 'name'),
  };
  R.listSpellNames = new Map();
  for (const list of d.spell_lists) {
    const src = list.origin_name ? (R.spellLists.get(list.origin_name) ?? list) : list;
    R.listSpellNames.set(list.name, new Set(src.spells_names));
  }
  return R;
}

export function listHasSpell(R, listName, spellName) {
  return Boolean(listName) && Boolean(R.listSpellNames.get(listName)?.has(spellName));
}

export function listSpells(R, listName) {
  const names = listName ? R.listSpellNames.get(listName) : null;
  return names ? [...names].map((n) => R.spellByName.get(n)).filter(Boolean) : [];
}

export function listLevelSpells(R, listName) {
  const list = R.spellLists.get(listName);
  if (!list) return [];
  return list.level_spells_names.map((n) => R.levelSpellByName.get(n)).filter(Boolean);
}

export function specializationsOf(R, klassName) {
  return R.specializations.filter((s) => s.klass_name === klassName);
}

// Espaços do tipo de conjurador + level_spells da lista (o Arcano Místico leva o bruxo ao 9º); -1 se não conjura.
export function klassMaxSpellLevel(R, klass) {
  if (klass.max_spell_level !== undefined) return klass.max_spell_level;
  const type = R.casterTypes.get(klass.spellcaster_type_name);
  const levels = [
    ...(type ? type.levels.map((l) => l.spell_level) : []),
    ...listLevelSpells(R, klass.spell_list_name).map((l) => l.spell_level ?? 0),
  ];
  return levels.length ? Math.max(...levels) : -1;
}

export function specMaxSpellLevel(R, spec) {
  const levels = listLevelSpells(R, spec.spell_list_name).map((l) => l.spell_level ?? 0);
  return levels.length ? Math.max(...levels) : -1;
}

// Subclasse só aparece se a classe dona ainda não tem a magia e alcança o nível dela.
export function spellCasters(R, spell) {
  const klasses = R.klasses.filter((k) => listHasSpell(R, k.spell_list_name, spell.name));
  const names = new Set(klasses.map((k) => k.name));
  const specs = R.specializations.filter((s) => {
    if (!listHasSpell(R, s.spell_list_name, spell.name) || names.has(s.klass_name)) return false;
    const klass = R.klassByName.get(s.klass_name);
    return spell.level <= Math.max(klass ? klassMaxSpellLevel(R, klass) : -1, specMaxSpellLevel(R, s));
  });
  return [
    ...klasses.map((k) => ({ name: k.name, slug: k.slug })),
    ...specs.map((s) => ({ name: s.name, slug: s.klass_slug ?? R.klassByName.get(s.klass_name)?.slug, sub: s.slug })),
  ];
}
