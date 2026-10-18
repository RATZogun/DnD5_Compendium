// "Vistos recentemente": guarda só tipo e slug no navegador; o nome vem dos dados no idioma atual.
import { href } from './router.js';
import { titleCase } from './util.js';

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
export function recentItems(R) {
  return read()
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
      return null;
    })
    .filter(Boolean);
}
