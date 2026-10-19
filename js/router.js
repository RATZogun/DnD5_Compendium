// Rotas por hash: o GitHub Pages não redireciona caminhos desconhecidos para o index.html.
import { buildQuery } from './util.js';

const routes = [];

export function route(pattern, nav, view) {
  const keys = [];
  const re = new RegExp(
    '^' +
      pattern.replace(/:(\w+)/g, (m, k) => {
        keys.push(k);
        return '([^/]+)';
      }) +
      '/?$',
  );
  routes.push({ re, keys, nav, view });
}

export function currentLocation() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const [path, search = ''] = hash.split('?');
  return { path, search };
}

// "%" solto ou sequência inválida no endereço não derruba a rota: fica o texto cru (a view mostra "não encontrado")
function safeDecode(v) {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

export function resolve() {
  const { path, search } = currentLocation();
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) {
      const params = Object.fromEntries(r.keys.map((k, i) => [k, safeDecode(m[i + 1])]));
      return { ...r, params, search };
    }
  }
  return null;
}

// replaceState não dispara hashchange, então a view não é recriada a cada filtro.
export function replaceQuery(obj) {
  const { path } = currentLocation();
  const q = buildQuery(obj);
  const url = '#' + path + (q ? '?' + q : '');
  if (url !== location.hash) history.replaceState(null, '', url);
}

const withQuery = (path, query) => {
  const q = query ? buildQuery(query) : '';
  return path + (q ? '?' + q : '');
};

export const href = {
  spells: (query) => withQuery('#/magias', query),
  spell: (slug) => `#/magias/${encodeURIComponent(slug)}`,
  klasses: (query) => withQuery('#/classes', query),
  klass: (slug) => `#/classes/${encodeURIComponent(slug)}`,
  subclass: (klass, sub) => `#/classes/${encodeURIComponent(klass)}/${encodeURIComponent(sub)}`,
  races: (query) => withQuery('#/especies', query),
  race: (slug) => `#/especies/${encodeURIComponent(slug)}`,
  rules: (section) => (section ? `#/regras/${encodeURIComponent(section)}` : '#/regras'),
  rule: (id) => `#/regras/resumo?item=${encodeURIComponent(id)}`,
  scroll: () => '#/pergaminho',
};
