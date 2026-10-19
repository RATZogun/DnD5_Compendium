// Esqueleto das páginas de leitura (espécie e classe): sumário "Nesta página" à esquerda, texto no meio, ficha
// à direita e, no mobile, barra fixa com a seção atual, painel com o sumário e botão de voltar ao topo.
import { html, raw, titleCase } from '../util.js';
import { t, getLang } from '../i18n.js';
import { replaceQuery } from '../router.js';
import { bookName } from '../views/klassShow.js';

// observador do sumário e barra de progresso da página aberta (trocados a cada página)
let spy;
let onScroll;
export const mobile = window.matchMedia('(max-width: 820px)');

export const srcOf = (source) => source?.[getLang() === 'en' ? 'en' : 'pt'] ?? source?.pt ?? source?.en;

export function sourceText(R, source) {
  const s = srcOf(source);
  if (!s) return '';
  return html`${raw(bookName(R, source))}${s.page ? ` · ${t('common.page')} ${s.page}` : ''}`;
}

function readMinutes(htmlText) {
  const words = htmlText
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function sectionTitle(id, text) {
  return html`<h2 id="${id}" class="sx-h2" data-toc="1">
    ${text}<a class="sx-anchor" href="#" data-anchor="${id}" aria-label="${t('page.sectionLink')}">#</a>
  </h2>`;
}

// descrição recolhível, com o tempo de leitura
export function introHtml(intro) {
  if (!intro) return '';
  return html`<details class="sx-intro" id="description" data-toc="1">
    <summary>
      <span>
        <strong>${titleCase(t('classes.description'))}</strong>
        <small>${t('page.readTime', { n: readMinutes(intro) })}</small>
      </span>
      <span class="sx-intro-toggle" data-open="${t('page.collapse')}" data-closed="${t('page.expand')}"></span>
    </summary>
    <div class="sx-intro-body">${raw(intro)}</div>
  </details>`;
}

// trilha: Início › [href, rótulo]... › página atual (no mobile o "Início" some)
export function crumbsHtml(trail, name) {
  return html`<nav class="crumbs" aria-label="breadcrumb">
    <span class="sx-crumb-home"><a href="#/">${t('nav.home')}</a> › </span>${trail.map(([h, label]) => raw(html`<a href="${h}">${label}</a> › `))}
    <span>${name}</span>
  </nav>`;
}

// chips do cabeçalho; no mobile o rótulo some ("Médio", "9 m")
export function chipsHtml(chips) {
  return html`<p class="sx-chips">
    ${chips.map(([k, v]) => raw(html`<span class="chip">${k ? raw(html`<span class="sx-chip-k">${k}: </span>`) : ''}${v}</span>`))}
  </p>`;
}

// ficha lateral: no desktop fica aberta, no mobile vira um item recolhível
export function cardHtml({ label, art, name, sub, rows, cls = '' }) {
  return html`<details class="sx-card ${cls}">
    <summary class="sx-card-sum">
      <strong>${label}</strong><span>${t('page.items', { n: rows.length })}</span>
    </summary>
    ${raw(art)}
    <div class="sx-card-head">
      <strong>${name}</strong>
      <span>${raw(sub)}</span>
    </div>
    <dl class="sx-facts">
      ${rows.map(([k, val]) => raw(html`<div><dt>${titleCase(k)}</dt><dd>${raw(val)}</dd></div>`))}
    </dl>
  </details>`;
}

// suffix entra no rótulo ("Anterior · 3º nível")
export function pagerHtml(list, slug, hrefOf, label, suffix = '') {
  const i = list.findIndex((r) => r.slug === slug);
  if (i < 0) return '';
  const more = suffix ? ` · ${suffix}` : '';
  const link = (r, cls, text) =>
    r
      ? html`<a class="sx-pager-link ${cls}" href="${hrefOf(r.slug)}">
          <small>${text}</small><strong>${titleCase(r.name)}</strong>
        </a>`
      : '<span></span>';
  return html`<nav class="sx-pager" aria-label="${label}">
    ${raw(link(list[i - 1], 'prev', `← ${t('page.prev')}${more}`))}${raw(link(list[i + 1], 'next', `${t('page.next')}${more} →`))}
  </nav>`;
}

const svg = (paths, size) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

// esqueleto da página; o conteúdo entra depois em .sx-head, .version-body e .sx-aside
export function layoutHtml({ top = '', bottom = '', cat = '' }) {
  return html`<div class="sx-layout ${cat ? `cat-${cat}` : ''}">
      <nav class="sx-toc" aria-label="${t('page.onThisPage')}">
        <p class="sx-toc-title">${t('page.onThisPage')}</p>
        <div class="sx-toc-list"></div>
        <a class="sx-toc-top" href="#" data-top>↑ ${t('page.backToTop')}</a>
      </nav>
      <article class="doc sx-doc">
        <div class="sx-head"></div>
        ${raw(top)}
        <div class="sx-mbar">
          <button type="button" class="sx-mbar-btn" data-sheet-open aria-haspopup="dialog">
            <span>
              <small>${t('page.onThisPage')}</small>
              <strong class="sx-mbar-cur"></strong>
            </span>
            ${raw(svg('<path d="m6 9 6 6 6-6"/>', 20))}
          </button>
          <span class="sx-progress"><i></i></span>
        </div>
        <div class="version-body"></div>
        ${raw(bottom)}
      </article>
      <aside class="sx-aside"></aside>
    </div>
    <div class="sx-sheet" hidden>
      <div class="sx-sheet-panel" role="dialog" aria-modal="true" aria-label="${t('page.onThisPage')}">
        <span class="sx-sheet-handle" aria-hidden="true"></span>
        <div class="sx-sheet-head">
          <strong>${t('page.onThisPage')}</strong>
          <button type="button" class="sx-sheet-close" data-sheet-close aria-label="${t('page.close')}">
            ${raw(svg('<path d="M18 6 6 18M6 6l12 12"/>', 22))}
          </button>
        </div>
        <nav class="sx-sheet-list"></nav>
      </div>
    </div>
    <button type="button" class="sx-fab" data-top aria-label="${t('page.backToTop')}" hidden>
      ${raw(svg('<path d="m5 12 7-7 7 7M12 19V5"/>', 20))}
    </button>`;
}

// sumário montado a partir das seções marcadas com data-toc (1 = seção, 2 = subseção)
function tocHtml(doc) {
  const items = [...doc.querySelectorAll('[data-toc]')].map((el) => {
    const label = el.dataset.tocLabel
      ? null
      : el.matches('details')
        ? el.querySelector('summary strong')
        : el.querySelector('h2, h3') || el;
    const text =
      el.dataset.tocLabel ??
      [...label.childNodes]
        .filter((n) => !(n.nodeType === 1 && n.matches('.sx-anchor, .level-badge, .optional-badge')))
        .map((n) => n.textContent)
        .join('')
        .trim();
    return html`<li class="toc-l${el.dataset.toc}"><a href="#" data-anchor="${el.id}">${text}</a></li>`;
  });
  return html`<ul>
    ${raw(items.join(''))}
  </ul>`;
}

function setSheet(container, open) {
  const sheet = container.querySelector('.sx-sheet');
  sheet.hidden = !open;
  document.body.classList.toggle('sx-sheet-open', open);
  if (open) {
    sheet.querySelector('a.active')?.scrollIntoView({ block: 'center' });
    sheet.querySelector('.sx-sheet-close').focus();
  }
}

function watchToc(container) {
  spy?.disconnect();
  const ids = [...container.querySelectorAll('.sx-toc [data-anchor]')].map((a) => a.dataset.anchor);
  const links = container.querySelectorAll('.sx-toc [data-anchor], .sx-sheet-list [data-anchor]');
  const cur = container.querySelector('.sx-mbar-cur');
  const setCurrent = (id) => {
    links.forEach((a) => a.classList.toggle('active', a.dataset.anchor === id));
    const li = container.querySelector(`.sx-toc [data-anchor="${CSS.escape(id)}"]`).parentElement;
    let parent = li;
    while (parent && !parent.classList.contains('toc-l1')) parent = parent.previousElementSibling;
    cur.textContent =
      parent && parent !== li ? `${parent.textContent.trim()} › ${li.textContent.trim()}` : li.textContent.trim();
  };
  if (ids.length) setCurrent(ids[0]);
  const visible = new Set();
  spy = new IntersectionObserver(
    (entries) => {
      for (const e of entries) (e.isIntersecting ? visible.add : visible.delete).call(visible, e.target.id);
      const first = ids.find((id) => visible.has(id));
      if (first) setCurrent(first);
    },
    { rootMargin: '0px 0px -70% 0px' },
  );
  container.querySelectorAll('.sx-doc [data-toc]').forEach((el) => spy.observe(el));
}

// remonta o sumário depois que o conteúdo muda (troca de versão)
export function refreshToc(container) {
  const toc = tocHtml(container.querySelector('.sx-doc'));
  container.querySelector('.sx-toc-list').innerHTML = toc;
  container.querySelector('.sx-sheet-list').innerHTML = toc;
  const card = container.querySelector('.sx-card');
  if (card) card.open = !mobile.matches;
  watchToc(container);
}

function flash(el, text) {
  const tip = document.createElement('span');
  tip.className = 'sx-copied';
  tip.textContent = text;
  el.after(tip);
  setTimeout(() => tip.remove(), 1600);
}

// liga o sumário, o painel, as âncoras, o progresso de leitura e o botão de topo; onTarget(el) roda antes de
// rolar até uma seção (ex.: abrir a aba da sub-espécie)
export function initDocPage(container, { onTarget } = {}) {
  mobile.onchange = () => {
    const card = container.querySelector('.sx-card');
    if (card) card.open = !mobile.matches;
  };
  const body = container.querySelector('.version-body');
  const bar = container.querySelector('.sx-progress i');
  const fab = container.querySelector('.sx-fab');
  if (onScroll) window.removeEventListener('scroll', onScroll);
  onScroll = () => {
    if (!bar.isConnected) {
      window.removeEventListener('scroll', onScroll);
      document.body.classList.remove('sx-sheet-open');
      return;
    }
    const top = body.getBoundingClientRect().top + scrollY;
    const span = body.offsetHeight - innerHeight;
    const p = span > 0 ? Math.min(1, Math.max(0, (scrollY - top + innerHeight / 3) / span)) : 1;
    bar.style.width = `${(p * 100).toFixed(1)}%`;
    fab.hidden = scrollY < 600;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const goTo = (id) => {
    const el = container.querySelector(`[id="${CSS.escape(id)}"]`);
    if (!el) return;
    if (el.matches('details')) el.open = true;
    onTarget?.(el);
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    replaceQuery({ s: id });
  };
  container.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !container.querySelector('.sx-sheet').hidden) setSheet(container, false);
  });
  container.addEventListener('click', (e) => {
    if (e.target.closest('[data-sheet-open]')) return setSheet(container, true);
    if (e.target.closest('[data-sheet-close]') || e.target.classList.contains('sx-sheet'))
      return setSheet(container, false);
    const anchor = e.target.closest('[data-anchor]');
    if (anchor) {
      e.preventDefault();
      if (anchor.closest('.sx-sheet')) setSheet(container, false);
      goTo(anchor.dataset.anchor);
      if (anchor.classList.contains('sx-anchor')) {
        navigator.clipboard?.writeText(location.href).catch(() => {});
        flash(anchor, t('page.linkCopied'));
      }
      return;
    }
    if (e.target.closest('[data-top]')) {
      e.preventDefault();
      replaceQuery({});
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
}
