// "Vistos recentemente": guarda só tipo e slug no navegador; o nome vem dos dados no idioma atual.
import { href } from './router.js';
import { titleCase } from './util.js';
import { getLang } from './i18n.js';
import { loadQuickref, loadOptions } from './data.js';

const KEY = 'recent';
const MAX = 6;

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? [];
  } catch {
    return [];
  }
}

export function trackVisit(type, slug, sub = null) {
  const id = [type, slug, sub].filter(Boolean).join('/');
  const list = [{ type, slug, sub }, ...read().filter((x) => [x.type, x.slug, x.sub].filter(Boolean).join('/') !== id)];
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* storage bloqueado */
  }
}

// itens com nome, link e tipo; os que não existem mais nos dados são ignorados
export async function recentItems(R) {
  const list = read();
  const pick = (o) => o?.[getLang()] ?? o?.pt;
  const [Q, options] = await Promise.all([
    list.some((x) => x.type === 'rule') ? loadQuickref().catch(() => null) : null,
    list.some((x) => x.type === 'option') ? loadOptions().catch(() => null) : null,
  ]);
  const rules = new Map(
    (Q?.sections ?? []).flatMap((sec) => sec.groups.flatMap((g) => g.items.map((item) => [item.id, { item, sec }]))),
  );
  return list
    .map((x) => {
      if (x.type === 'spell') {
        const s = R.spellBySlug.get(x.slug);
        return s && { kind: 'spell', name: titleCase(s.name), href: href.spell(s.slug), level: s.level };
      }
      if (x.type === 'class') {
        const k = R.klassBySlug.get(x.slug);
        return k && { kind: 'class', name: titleCase(k.name), href: href.klass(k.slug) };
      }
      if (x.type === 'subclass') {
        const s = R.specializations.find((sp) => sp.klass_slug === x.slug && sp.slug === x.sub);
        return s && { kind: 'subclass', name: titleCase(s.name), href: href.subclass(x.slug, x.sub) };
      }
      if (x.type === 'species') {
        const r = R.raceBySlug.get(x.slug);
        return r && { kind: 'species', name: titleCase(r.name), href: href.race(r.slug) };
      }
      if (x.type === 'rule') {
        const found = rules.get(x.slug);
        if (!found) return null;
        const { item, sec } = found;
        return { kind: 'rule', name: titleCase(pick(item).title), href: href.rule(item.id), section: pick(sec.title) };
      }
      if (x.type === 'option') {
        const o = options?.find((op) => op.slug === x.slug);
        return o && { kind: 'option', name: titleCase(pick(o.name)), href: href.option(o.slug), type: o.type };
      }
      return null;
    })
    .filter(Boolean);
}
