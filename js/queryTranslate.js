// Os filtros guardam no endereço os nomes do idioma atual (classe "bardo", escola "evocação", livro "LJF" ou
// "Livro do Jogador", tamanho "médio"...). Ao trocar de idioma, cada valor vira o equivalente no outro idioma,
// pareando as duas bases pelo slug de cada magia, classe, subclasse e espécie.

// campos de magia usados como filtro
const SPELL_FIELDS = [
  'spell_school_name',
  'casting_time_unit',
  'range_unit',
  'duration_unit',
  'attack',
  'saving_throw',
  'damage_type',
];
// chaves que não são valores traduzíveis (busca livre, âncoras, ordenação, item do resumo)
const KEEP = new Set(['name', 's', 'item', 'sort', 'page', 'per_page']);

function valueMap(from, to) {
  const map = new Map();
  const add = (a, b) => {
    if (a == null || b == null || typeof a !== 'string' || typeof b !== 'string') return;
    if (!map.has(a)) map.set(a, b);
    if (!map.has(a.toLowerCase())) map.set(a.toLowerCase(), b);
  };
  const bySlug = (list) => new Map((list ?? []).map((x) => [x.slug, x]));
  const pairSources = (a, b) =>
    (a?.sources_rels ?? []).forEach((r, i) => add(r.source_abbreviation, b?.sources_rels?.[i]?.source_abbreviation));

  const spells = bySlug(to.spells);
  for (const s of from.spells ?? []) {
    const o = spells.get(s.slug);
    if (!o) continue;
    for (const f of SPELL_FIELDS) add(s[f], o[f]);
    pairSources(s, o);
  }
  const klasses = bySlug(to.klasses);
  for (const k of from.klasses ?? []) {
    const o = klasses.get(k.slug);
    if (!o) continue;
    add(k.name, o.name);
    add(k.spell_list_name, o.spell_list_name);
    pairSources(k, o);
  }
  const subs = new Map((to.specializations ?? []).map((x) => [`${x.klass_slug}/${x.slug}`, x]));
  for (const sp of from.specializations ?? []) add(sp.name, subs.get(`${sp.klass_slug}/${sp.slug}`)?.name);
  const races = bySlug(to.races);
  for (const r of from.races ?? []) {
    const o = races.get(r.slug);
    if (!o) continue;
    add(r.name, o.name);
    (r.size ?? []).forEach((v, i) => add(v, o.size?.[i]));
    pairSources(r, o);
  }
  // nome do livro pelo código já pareado
  const toByAbbr = new Map((to.sources ?? []).map((x) => [x.abbreviation, x]));
  for (const src of from.sources ?? []) add(src.name, toByAbbr.get(map.get(src.abbreviation))?.name);
  return map;
}

// traduz os valores da query de um endereço "#/caminho?a=b,c"; listas ("a,b") e tamanhos ("pequeno|médio") por parte
export function translateHash(hash, from, to) {
  const at = hash.indexOf('?');
  if (at < 0 || !from || !to) return hash;
  const map = valueMap(from, to);
  const params = new URLSearchParams(hash.slice(at + 1));
  for (const [key, value] of [...params]) {
    if (KEEP.has(key)) continue;
    const next = value
      .split(/([,|])/)
      .map((part) => map.get(part) ?? map.get(part.toLowerCase()) ?? part)
      .join('');
    params.set(key, next);
  }
  const q = params.toString();
  return hash.slice(0, at) + (q ? `?${q}` : '');
}
