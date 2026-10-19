import { t, getLang, ordinal } from './i18n.js';
import { scalingOf, applyScale } from './statblockScale.js';

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

// envolve o conteúdo já renderizado num contêiner de leitura (páginas de texto longo)
export function wrapDoc(container) {
  const doc = document.createElement('article');
  doc.className = 'doc';
  doc.append(...container.childNodes);
  container.append(doc);
  titleStrongs(doc);
  enhanceStatblocks(doc);
}

const SB_SECTION =
  /^(ações( bônus| lendárias)?|reaç(ão|ões)|traços|actions|bonus actions|legendary actions|reactions?|traits)$/i;

// fichas de criatura em blocos, como no D&D Beyond e no 5etools: cabeçalho, atributos, valores de atributo,
// e seções (Traços, Ações, Ações Bônus, Reações) com título próprio
export function enhanceStatblocks(root) {
  root.querySelectorAll('.statblock:not(.sb-ready)').forEach((sb) => {
    sb.classList.add('sb-ready');
    const [head, ...rest] = sb.children;
    head?.classList.add('sb-head');
    let inSection = false;
    let traitsTitle = false;
    for (const el of rest) {
      const first = el.firstElementChild;
      if (el.tagName === 'TABLE') {
        el.classList.add('sb-abilities');
      } else if (
        el.tagName === 'P' &&
        el.children.length === 1 &&
        first?.tagName === 'STRONG' &&
        SB_SECTION.test(el.textContent.trim())
      ) {
        el.classList.add('sb-section');
        inSection = true;
      } else if (
        el.tagName === 'P' &&
        (first?.tagName === 'EM' || (first?.tagName === 'STRONG' && first.firstElementChild?.tagName === 'EM'))
      ) {
        if (!inSection && !traitsTitle) {
          const title = document.createElement('p');
          title.className = 'sb-section';
          title.innerHTML = `<strong>${escapeHtml(t('statblock.traits'))}</strong>`;
          el.before(title);
          traitsTitle = true;
        }
        el.classList.add('sb-entry');
      } else if (el.tagName === 'P' && first?.tagName === 'STRONG') {
        el.classList.add('sb-attrs');
      }
    }
    addScaleSelector(sb, head);
  });
}

// seletor de nível da magia ou de nível da classe, para fichas que evoluem
function addScaleSelector(sb, head) {
  const scaling = head && scalingOf(sb);
  if (!scaling) return;
  [...sb.children].slice(1).forEach((el) => (el.dataset.orig = el.innerHTML));
  const label =
    scaling.kind === 'spell'
      ? t('statblock.spellLevel')
      : scaling.klass
        ? t('statblock.classLevel', { klass: scaling.klass })
        : t('statblock.level');
  const box = document.createElement('label');
  box.className = 'sb-level';
  const levels = Array.from({ length: scaling.max - scaling.min + 1 }, (_, i) => scaling.min + i);
  box.innerHTML = html`<span>${titleCase(label)}</span>
    <select class="form-control">
      ${levels.map((lv) => raw(html`<option value="${lv}">${ordinal(lv)}</option>`))}
    </select>`;
  head.append(box);
  const select = box.querySelector('select');
  select.addEventListener('change', () => applyScale(sb, scaling, Number(select.value)));
  applyScale(sb, scaling, scaling.min);
}

// subtítulos em negrito no texto dos livros ("truques.", "pacto da corrente.") ganham a mesma capitalização dos títulos
export function titleStrongs(root) {
  root.querySelectorAll('strong').forEach((el) => {
    const text = el.textContent.trim();
    if (!text || text.length > 60 || text[0] === text[0].toUpperCase()) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let first = true;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim()) continue;
      const cased = titleCase(node.textContent);
      node.textContent = first ? cased : cased.replace(/^\S/, (c) => node.textContent.trimStart()[0] ?? c);
      first = false;
    }
  });
}

// seletor que reencontra o controle depois que a lista é redesenhada (filtros, ordenação, paginação)
function focusSelector(el) {
  const attr = (name) => `[${name}="${CSS.escape(el.getAttribute(name) ?? '')}"]`;
  if (el.matches('input[type="checkbox"][data-group]')) return `input${attr('data-group')}${attr('value')}`;
  if (el.matches('[data-sort], select')) return el.matches('[data-sort]') ? '[data-sort]' : 'select';
  if (el.matches('[data-per-page]')) return '[data-per-page]';
  if (el.matches('[data-page]')) return '.pagination [aria-current="page"]';
  if (el.matches('input[type="search"]')) return 'input[type="search"]';
  if (el.matches('.active-chip, .facet-clear')) return '.list-count';
  return null;
}

// redesenha (fn) sem perder o foco do teclado: o controle equivalente recebe o foco de volta, com o cursor no lugar
export function keepFocus(root, fn) {
  const el = document.activeElement;
  if (!el || el === document.body || !root.contains(el)) return fn();
  let sel = focusSelector(el);
  if (el.matches('details[data-key] > summary'))
    sel = `details[data-key="${CSS.escape(el.parentElement.dataset.key)}"] > summary`;
  const caret = typeof el.selectionStart === 'number' ? [el.selectionStart, el.selectionEnd] : null;
  const result = fn();
  const next = sel && root.querySelector(sel);
  if (next && next !== document.activeElement) {
    if (next.matches('.list-count')) next.setAttribute('tabindex', '-1');
    next.focus({ preventScroll: true });
    if (caret) {
      try {
        next.setSelectionRange(...caret);
      } catch {
        // campo numérico não aceita cursor
      }
    }
  }
  return result;
}

// redesenha uma lista filtrada mantendo o foco e avisa leitores de tela só do novo total (a região viva é um
// parágrafo oculto, não a lista inteira)
export function refreshList(root, fn) {
  const result = keepFocus(root, fn);
  const live = root.querySelector('[data-live]');
  const count = root.querySelector('.list-count')?.textContent.trim();
  if (live && count && live.textContent !== count) live.textContent = count;
  return result;
}
