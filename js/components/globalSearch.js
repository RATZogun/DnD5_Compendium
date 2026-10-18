// Busca global (Ctrl K): espécies, classes, subclasses, magias e seções de página (características, traços,
// sub-espécies), com filtro por tipo e navegação por teclado.
import { html, raw, escapeHtml, titleCase, toASCII } from '../util.js';
import { t, ordinal, getLang } from '../i18n.js';
import { href } from '../router.js';
import { loadClass, loadSpecies } from '../data.js';
import { icon } from '../icons.js';

const GROUPS = ['species', 'class', 'spell', 'section'];
const PER_GROUP = 5;
const MAX_RESULTS = 60;
const SKIP_FEATURES = new Set(['hit-points', 'proficiencies', 'equipment']);
const SKIP_TRAITS = new Set(['age', 'size', 'speed', 'languages', 'creature-type', 'subrace', 'subraces']);

const pick = (obj) => (obj ? (obj[getLang()] ?? obj.pt ?? obj.en ?? '') : '');
const bookName = (R, rels) => {
  const abbr = rels?.[0]?.source_abbreviation;
  const src = abbr && R.sourceByAbbr.get(abbr);
  return src ? titleCase(src.name) : (abbr ?? '');
};

function baseIndex(R) {
  const items = [];
  for (const r of R.races) {
    const subs = r.subraces?.length ?? 0;
    const meta = [bookName(R, r.sources_rels), subs ? t('search.subraces', { n: subs }) : '']
      .filter(Boolean)
      .join(' · ');
    items.push({ group: 'species', name: titleCase(r.name), alt: '', meta, href: href.race(r.slug) });
  }
  for (const k of R.klasses) {
    items.push({
      group: 'class',
      name: titleCase(k.name),
      alt: '',
      meta: bookName(R, k.sources_rels),
      href: href.klass(k.slug),
    });
  }
  for (const s of R.specializations) {
    const meta = `${t('search.subclassOf', { klass: titleCase(s.klass_name) })} · ${bookName(R, s.sources_rels)}`;
    items.push({ group: 'class', name: titleCase(s.name), alt: '', meta, href: href.subclass(s.klass_slug, s.slug) });
  }
  for (const s of R.spells) {
    const level = s.level === 0 ? t('search.cantrip') : t('search.spellLevel', { level: ordinal(s.level) });
    items.push({
      group: 'spell',
      name: titleCase(s.name),
      alt: s.original_name && s.original_name !== s.name ? s.original_name : '',
      meta: `${level} · ${titleCase(s.spell_school_name)}`,
      href: href.spell(s.slug),
      level: s.level,
    });
  }
  return items;
}

// seções de página: carregadas na primeira abertura da busca (um arquivo por classe e por espécie)
async function sectionIndex(R) {
  const items = [];
  const section = (path, kind, link) => ({ group: 'section', name: path.join(' › '), alt: '', meta: kind, href: link });
  const klasses = await Promise.all(R.klasses.map((k) => loadClass(k.slug).catch(() => null)));
  for (const data of klasses.filter(Boolean)) {
    const klass = titleCase(pick(data.name));
    for (const f of data.features) {
      if (SKIP_FEATURES.has(f.key) || /^ability-score-improvement/.test(f.key)) continue;
      items.push(section([klass, titleCase(pick(f.name))], t('search.feature'), `${href.klass(data.slug)}?s=${f.key}`));
    }
    for (const sub of data.subclasses ?? []) {
      for (const f of sub.features ?? []) {
        const link = `${href.subclass(data.slug, sub.slug)}?s=${f.key}`;
        items.push(section([titleCase(pick(sub.name)), titleCase(pick(f.name))], t('search.feature'), link));
      }
    }
  }
  const species = await Promise.all(R.races.map((r) => loadSpecies(r.slug).catch(() => null)));
  for (const data of species.filter(Boolean)) {
    const name = titleCase(pick(data.name));
    for (const tr of data.traits ?? []) {
      if (SKIP_TRAITS.has(tr.key)) continue;
      items.push(section([name, titleCase(pick(tr.name))], t('search.trait'), `${href.race(data.slug)}?s=${tr.key}`));
    }
    for (const sub of data.subraces ?? []) {
      items.push(
        section([name, titleCase(pick(sub.name))], t('search.subrace'), `${href.race(data.slug)}?s=${sub.slug}`),
      );
    }
  }
  return items;
}

// só casa no começo de uma palavra ("elf" acha "Elfo" e "Meio-Elfo", não "Melf")
function wordStart(s, q) {
  for (let i = s.indexOf(q); i >= 0; i = s.indexOf(q, i + 1)) {
    if (i === 0 || !/[a-z0-9]/.test(s[i - 1])) return i;
  }
  return -1;
}

// pontuação: começo do nome > começo de outra palavra; o nome em inglês também conta
function score(item, q) {
  let best = 0;
  for (const [text, weight] of [
    [item.name, 1],
    [item.alt, 0.8],
  ]) {
    const s = toASCII(text);
    if (!s) continue;
    const i = wordStart(s, q);
    if (i < 0) continue;
    const base = i === 0 ? 3 : 2;
    best = Math.max(best, (base + q.length / s.length) * weight);
  }
  return best;
}

function highlight(text, q) {
  const i = wordStart(toASCII(text), q);
  if (!q || i < 0) return escapeHtml(text);
  return (
    escapeHtml(text.slice(0, i)) +
    `<mark>${escapeHtml(text.slice(i, i + q.length))}</mark>` +
    escapeHtml(text.slice(i + q.length))
  );
}

const GROUP_ICON = {
  species: () => icon.people(18),
  class: () => icon.book(18),
  spell: () => icon.flame(18),
  section: () => icon.hash(18),
};

export function initGlobalSearch(getR) {
  const overlay = document.createElement('div');
  overlay.className = 'gs-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `<div class="gs-dialog" role="dialog" aria-modal="true">
      <div class="gs-input-row">${icon.search(20)}<input class="gs-input" type="search" autocomplete="off" spellcheck="false"><kbd class="gs-esc">Esc</kbd></div>
      <div class="gs-chips" role="tablist"></div>
      <div class="gs-results" role="listbox"></div>
      <div class="gs-hints"></div>
    </div>`;
  document.body.append(overlay);
  const dialog = overlay.querySelector('.gs-dialog');
  const input = overlay.querySelector('.gs-input');
  const chips = overlay.querySelector('.gs-chips');
  const results = overlay.querySelector('.gs-results');
  const hints = overlay.querySelector('.gs-hints');

  let index = null;
  let indexR = null;
  let sectionsLoading = null;
  let filter = 'all';
  let active = 0;
  let shown = [];
  let lastFocus = null;

  function ensureIndex() {
    const R = getR();
    if (!R) return false;
    if (indexR !== R) {
      indexR = R;
      index = baseIndex(R);
      sectionsLoading = sectionIndex(R).then((items) => {
        if (indexR === R) {
          index = index.concat(items);
          if (!overlay.hidden) update();
        }
      });
    }
    return true;
  }

  function update() {
    const q = toASCII(input.value).trim();
    const matches = q
      ? index
          .map((item) => ({ item, s: score(item, q) }))
          .filter((x) => x.s > 0)
          .sort((a, b) => b.s - a.s || a.item.name.localeCompare(b.item.name))
          .map((x) => x.item)
      : [];
    const counts = Object.fromEntries(GROUPS.map((g) => [g, matches.filter((m) => m.group === g).length]));
    const total = matches.length;
    chips.innerHTML = [['all', total], ...['species', 'class', 'spell'].map((g) => [g, counts[g]])]
      .map(
        ([g, n]) =>
          html`<button type="button" class="gs-chip gs-chip-${g}" role="tab" aria-selected="${String(filter === g)}" data-filter="${g}">
            ${t(`search.group.${g}`)} · ${n}
          </button>`,
      )
      .join('');
    hints.innerHTML = html`<span><kbd>↑</kbd><kbd>↓</kbd> ${t('search.hint.navigate')}</span><span><kbd>↵</kbd> ${t('search.hint.open')}</span><span><kbd>Esc</kbd> ${t('search.hint.close')}</span>`;

    shown = [];
    let body = '';
    if (!q) {
      body = html`<p class="gs-empty">${t('search.prompt')}</p>`;
    } else if (!total) {
      body = html`<p class="gs-empty">${t('search.none', { q: input.value.trim() })}</p>`;
    } else {
      const groups = filter === 'all' ? GROUPS : [filter];
      for (const g of groups) {
        const list = matches.filter((m) => m.group === g).slice(0, filter === 'all' ? PER_GROUP : MAX_RESULTS);
        if (!list.length) continue;
        body += html`<p class="gs-group">${t(`search.groupTitle.${g}`)}</p>`;
        for (const item of list) {
          const i = shown.push(item) - 1;
          body += html`<a class="gs-item gs-item-${item.group}" href="${item.href}" role="option" data-i="${i}" aria-selected="${String(i === active)}">
            <span class="gs-icon">${raw(GROUP_ICON[item.group]())}</span>
            <span class="gs-name">${raw(highlight(item.name, q))}${item.alt ? raw(html` <small>${raw(highlight(item.alt, q))}</small>`) : ''}</span>
            <span class="gs-meta">${item.meta}</span>
            <span class="gs-enter" aria-hidden="true">↵</span>
          </a>`;
        }
      }
      if (filter !== 'section' && sectionsLoading && !index.some((x) => x.group === 'section')) {
        body += html`<p class="gs-empty gs-loading">${t('search.loadingSections')}</p>`;
      }
    }
    active = Math.min(active, Math.max(0, shown.length - 1));
    results.innerHTML = body;
    markActive(false);
  }

  function markActive(scroll = true) {
    results.querySelectorAll('.gs-item').forEach((el) => {
      const on = Number(el.dataset.i) === active;
      el.setAttribute('aria-selected', String(on));
      if (on && scroll) el.scrollIntoView({ block: 'nearest' });
    });
  }

  function open(text = '') {
    if (!ensureIndex()) return;
    lastFocus = document.activeElement;
    overlay.hidden = false;
    document.body.classList.add('gs-open');
    input.placeholder = t('search.placeholder');
    dialog.setAttribute('aria-label', t('search.title'));
    input.value = text;
    filter = 'all';
    active = 0;
    update();
    input.focus();
    input.setSelectionRange(text.length, text.length);
  }

  function close() {
    overlay.hidden = true;
    document.body.classList.remove('gs-open');
    lastFocus?.focus?.();
  }

  input.addEventListener('input', () => {
    active = 0;
    update();
  });
  chips.addEventListener('click', (e) => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    filter = b.dataset.filter;
    active = 0;
    update();
    input.focus();
  });
  results.addEventListener('mousemove', (e) => {
    const el = e.target.closest('.gs-item');
    if (el && Number(el.dataset.i) !== active) {
      active = Number(el.dataset.i);
      markActive(false);
    }
  });
  results.addEventListener('click', (e) => {
    if (e.target.closest('.gs-item')) close();
  });
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) close();
  });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!shown.length) return;
      active = (active + (e.key === 'ArrowDown' ? 1 : shown.length - 1)) % shown.length;
      markActive();
    } else if (e.key === 'Enter' && shown[active]) {
      e.preventDefault();
      location.hash = shown[active].href.slice(1);
      close();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      input.focus();
    }
  });
  document.addEventListener('keydown', (e) => {
    const typing =
      /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (overlay.hidden) open();
      else close();
    } else if (e.key === '/' && overlay.hidden && !typing) {
      e.preventDefault();
      open();
    }
  });
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-search-open]');
    if (trigger) {
      e.preventDefault();
      open(trigger.dataset.searchOpen || '');
    }
  });
  // a busca grande da tela inicial abre a janela com o que já foi digitado
  document.addEventListener('gs-open', (e) => open(e.detail ?? ''));
  return { open, close };
}
