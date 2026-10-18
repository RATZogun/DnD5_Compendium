import { t, getLang } from './i18n.js';

const ACCENTS = {
  á: 'a',
  à: 'a',
  ã: 'a',
  â: 'a',
  ä: 'a',
  é: 'e',
  è: 'e',
  ê: 'e',
  ë: 'e',
  í: 'i',
  ì: 'i',
  î: 'i',
  ï: 'i',
  ó: 'o',
  ò: 'o',
  õ: 'o',
  ô: 'o',
  ö: 'o',
  ú: 'u',
  ù: 'u',
  û: 'u',
  ü: 'u',
  ç: 'c',
  ñ: 'n',
};

export function toASCII(str) {
  return String(str ?? '')
    .toLowerCase()
    .replace(/[\u0080-\uffff]/g, (c) => ACCENTS[c] ?? c);
}

// Busca do original: ignora caixa e acentos, e cada espaço vira ".*" ("bola fogo" casa "bola de fogo").
export function nameMatcher(query) {
  const q = toASCII(query).trim();
  if (!q) return () => true;
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '.*'), 'i');
  return (...values) => values.some((v) => typeof v === 'string' && re.test(toASCII(v)));
}

export function escapeHtml(str) {
  return String(str ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

// Escapa toda interpolação; HTML já montado precisa vir embrulhado em raw().
export function html(strings, ...values) {
  return strings.reduce((out, s, i) => {
    if (i >= values.length) return out + s;
    const v = values[i];
    const str = Array.isArray(v)
      ? v.map((x) => (x instanceof Raw ? x.value : escapeHtml(x))).join('')
      : v instanceof Raw
        ? v.value
        : v == null || v === false
          ? ''
          : escapeHtml(v);
    return out + s + str;
  }, '');
}
class Raw {
  constructor(value) {
    this.value = value;
  }
}
export const raw = (value) => new Raw(value);

const SMALL_WORDS = {
  pt: new Set(
    'de da do das dos e o a os as em no na nos nas com contra por para sobre sem ou ao à aos às um uma pelo pela pelos pelas entre até via'.split(
      ' ',
    ),
  ),
  en: new Set('a an the and or of to in on at by for from with as but nor vs via into over'.split(' ')),
};

// Títulos: cada palavra com inicial maiúscula, menos artigos e preposições ("Bola de Fogo", "Faca d'Alma").
export function titleCase(str, lang = getLang()) {
  const small = SMALL_WORDS[lang] ?? SMALL_WORDS.pt;
  return String(str ?? '')
    .split(' ')
    .map((word, i) =>
      word
        .split('-')
        .map((part, j) => {
          const lower = part.toLowerCase();
          if ((i > 0 || j > 0) && small.has(lower)) return lower;
          if (/^d['’]/i.test(part) && i > 0) return part;
          return part.charAt(0).toUpperCase() + part.slice(1);
        })
        .join('-'),
    )
    .join(' ');
}

export function capitalize(str) {
  const s = String(str ?? '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const compareText = (a, b) =>
  String(a ?? '').localeCompare(String(b ?? ''), getLang() === 'pt' ? 'pt-BR' : 'en', {
    sensitivity: 'base',
    numeric: true,
  });
export const sortByName = (list) => [...list].sort((a, b) => compareText(a.name, b.name));

export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export const toSnake = (k) => k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
export const toCamel = (k) => k.replace(/_([a-z])/g, (m, c) => c.toUpperCase());

export function parseQuery(search) {
  const out = {};
  new URLSearchParams(search).forEach((value, key) => {
    let v = value;
    if (value === 'true') v = true;
    else if (value === 'false') v = false;
    else if (/^-?\d+$/.test(value)) v = parseInt(value, 10);
    out[toCamel(key)] = v;
  });
  return out;
}

// Booleanos sempre explícitos (=true/=false): o original perdia o valor ao recarregar.
export function buildQuery(obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || v === '') continue;
    p.set(toSnake(k), String(v));
  }
  return p.toString();
}

export function setTitle(...parts) {
  document.title = [...parts, t('site.title')].filter(Boolean).join(' | ');
}
