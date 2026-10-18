import { html, raw, titleCase, setTitle, titleStrongs, enhanceStatblocks } from '../util.js';
import { t, ordinal, getLang } from '../i18n.js';
import { href, replaceQuery } from '../router.js';
import { loadSpecies } from '../data.js';
import { pick, bookName, linkProseSpells } from './klassShow.js';
import { speedText, sizeText } from './races.js';
import { icon } from '../icons.js';
import { speciesIcon } from '../speciesIcons.js';

// observador do sumário e barra de progresso da página aberta (trocados a cada página)
let spy;
let onScroll;
const mobile = window.matchMedia('(max-width: 820px)');

const srcOf = (source) => source?.[getLang() === 'en' ? 'en' : 'pt'] ?? source?.pt ?? source?.en;

function sourceText(R, source) {
  const s = srcOf(source);
  if (!s) return '';
  return html`${raw(bookName(R, source))}${s.page ? ` · ${t('common.page')} ${s.page}` : ''}`;
}

const subCount = (n) => (n === 1 ? t('races.subraceOne') : t('search.subraces', { n }));

// alcance da visão no escuro tirado do texto do traço ("18 m", "60 feet")
function darkvisionRange(v) {
  const tr = [v, ...(v.subraces ?? [])].flatMap((x) => x.traits ?? []).find((x) => x.key === 'darkvision');
  if (!tr) return null;
  const text = pick(tr.html).replace(/<[^>]+>/g, ' ');
  const m = text.match(/(\d+(?:,\d+)?)\s*(m\b|metros|feet|ft)/i);
  if (!m) return '';
  return getLang() === 'pt' ? `${m[1]} m` : `${m[1]} ft.`;
}

function sectionTitle(id, text) {
  return html`<h2 id="${id}" class="sx-h2" data-toc="1">
    ${text}<a class="sx-anchor" href="#" data-anchor="${id}" aria-label="${t('races.sectionLink')}">#</a>
  </h2>`;
}

function traitsHtml(traits, prefix = '', toc = true) {
  return (traits ?? [])
    .map(
      (tr) =>
        html` <section class="feature" id="${prefix + tr.key}" ${toc ? raw('data-toc="2"') : ''}>
          <h3>${titleCase(pick(tr.name))}</h3>
          <div class="feature-body">${raw(pick(tr.html))}</div>
        </section>`,
    )
    .join('');
}

function spellsHtml(R, spells) {
  if (!spells?.length) return '';
  const lang = getLang();
  const link = (namePt, nameEn) => {
    const spell = R.spells.find(
      (s) =>
        s.original_name?.toLowerCase() === nameEn?.toLowerCase() ||
        s.name.toLowerCase() === (lang === 'pt' ? namePt : nameEn)?.toLowerCase(),
    );
    const label = titleCase(spell ? spell.name : lang === 'pt' ? (namePt ?? nameEn) : (nameEn ?? namePt));
    return spell ? html`<a href="${href.spell(spell.slug)}">${label}</a>` : html`${label}`;
  };
  return html`<div class="table-wrap sx-table">
    <table class="data-table">
      <thead>
        <tr>
          <th>${titleCase(t('common.level'))}</th>
          <th>${titleCase(t('races.spell'))}</th>
          <th>${titleCase(t('races.regularity'))}</th>
        </tr>
      </thead>
      <tbody>
        ${spells.map((s) =>
          raw(
            html`<tr>
              <th scope="row">${s.level ? ordinal(s.level) : '–'}</th>
              <td>
                ${raw((s.names_en ?? s.names_pt ?? []).map((n, i) => link(s.names_pt?.[i], s.names_en?.[i])).join(', ') || '–')}
              </td>
              <td>${pick(s.regularity) || '–'}</td>
            </tr>`,
          ),
        )}
      </tbody>
    </table>
  </div>`;
}

// todas as magias inatas da versão (da espécie e das sub-espécies), numa tabela só
function allSpells(v) {
  return [...(v.spells ?? []), ...(v.subraces ?? []).flatMap((s) => s.spells ?? [])];
}

function readMinutes(htmlText) {
  const words = htmlText
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function headHtml(R, data, v, name) {
  const subs = v.subraces ?? [];
  const range = darkvisionRange(v);
  // no mobile o rótulo do chip some ("Médio", "9 m")
  const chips = [
    [titleCase(t('races.size')), titleCase(sizeText(data.size))],
    [titleCase(t('races.speed')), speedText(data.speed)],
    range !== null ? ['', t('races.darkvision')] : null,
    subs.length ? ['', subCount(subs.length)] : null,
  ].filter(Boolean);
  return html`<nav class="crumbs" aria-label="breadcrumb">
      <span class="sx-crumb-home"><a href="#/">${t('nav.home')}</a> › </span><a href="${href.races()}">${titleCase(t('races.title'))}</a> ›
      <span>${name}</span>
    </nav>
    <p class="sx-kicker">
      <span class="chip chip-species">${t('home.kind.species')}</span>
      <span class="sx-source">${raw(icon.book(14))} ${raw(sourceText(R, v.source))}</span>
    </p>
    <h1 class="sx-title">${name}</h1>
    <div class="ornament" aria-hidden="true"><span></span><i></i><span></span></div>
    <p class="sx-chips">
      ${chips.map(([k, v]) => raw(html`<span class="chip">${k ? raw(html`<span class="sx-chip-k">${k}: </span>`) : ''}${v}</span>`))}
    </p>`;
}

function bodyHtml(R, data, v, name) {
  const intro = pick(v.intro_html);
  const subs = v.subraces ?? [];
  const spells = allSpells(v);
  // o traço "Sub-raça" vira a introdução da seção de sub-espécies
  const subIntro = subs.length ? (v.traits ?? []).find((tr) => tr.key === 'subrace') : null;
  const traits = (v.traits ?? []).filter((tr) => tr !== subIntro);
  return html`${
    intro
      ? raw(
          html`<details class="sx-intro" id="description" data-toc="1">
              <summary>
                <span>
                  <strong>${titleCase(t('classes.description'))}</strong>
                  <small>${t('races.readTime', { n: readMinutes(intro) })}</small>
                </span>
                <span class="sx-intro-toggle" data-open="${t('races.collapse')}" data-closed="${t('races.expand')}"></span>
              </summary>
              <div class="sx-intro-body">${raw(intro)}</div>
            </details>`,
        )
      : ''
  }
    ${raw(sectionTitle('traits', titleCase(t('races.traits'))))}
    ${subs.length ? raw(html`<p class="sx-lead">${t('races.traitsLead')}</p>`) : ''}
    <div class="features">${raw(traitsHtml(traits))}</div>
    ${
      spells.length
        ? raw(
            html`${raw(sectionTitle('innate-spells', titleCase(t('races.innateSpells'))))}
              ${raw(spellsHtml(R, spells))}`,
          )
        : ''
    }
    ${
      subs.length
        ? raw(
            html`${raw(sectionTitle('subraces', titleCase(t('races.subraces'))))}
              ${subIntro ? raw(pick(subIntro.html)) : ''}
              <div class="sx-seg" role="tablist">
                ${subs.map((s, i) => raw(html`<button type="button" role="tab" data-sub="${s.slug}" aria-selected="${String(i === 0)}">${titleCase(pick(s.name))}</button>`))}
              </div>
              <p class="sx-jump">
                <span>${t('races.jumpTo')}</span>
                ${subs.map((s) => raw(html`<a class="chip" href="#" data-anchor="${s.slug}" data-jump>${titleCase(pick(s.name))}</a>`))}
              </p>
              ${subs.map((s) =>
                raw(
                  html` <section class="sx-subrace" id="${s.slug}" data-toc="2" ${raw(s === subs[0] ? 'data-active' : '')}>
                    <h3 class="sx-subrace-name">
                      ${titleCase(pick(s.name))}<a class="sx-anchor" href="#" data-anchor="${s.slug}" aria-label="${t('races.sectionLink')}">#</a>
                    </h3>
                    <p class="sx-badges">
                      ${srcOf(s.source) ? raw(html`<span class="sx-badge">${raw(sourceText(R, s.source))}</span>`) : ''}
                      <span class="sx-badge sx-badge-species">${t('races.inherits', { name })}</span>
                    </p>
                    ${raw(pick(s.intro_html))}${raw(traitsHtml(s.traits, `${s.slug}-`, false))}
                  </section>`,
                ),
              )}`,
          )
        : ''
    }`;
}

function asideHtml(R, data, v, name) {
  const range = darkvisionRange(v);
  const subs = v.subraces ?? [];
  const rows = [
    [t('races.size'), titleCase(sizeText(data.size))],
    [t('races.speed'), speedText(data.speed)],
    range !== null ? [t('races.vision'), range ? t('races.darkvisionRange', { range }) : t('races.darkvision')] : null,
    subs.length ? [t('races.subraces'), subs.map((s) => titleCase(pick(s.name))).join(' · ')] : null,
    allSpells(v).length ? [t('races.innateSpells'), t('races.yes')] : null,
  ].filter(Boolean);
  return html`<details class="sx-card">
    <summary class="sx-card-sum">
      <strong>${t('races.sheet')}</strong><span>${t('races.items', { n: rows.length })}</span>
    </summary>
    <div class="sx-art" role="img" aria-label="${t('races.illustration', { name })}">${raw(speciesIcon(data.slug, 72))}</div>
    <div class="sx-card-head">
      <strong>${name}</strong>
      <span>${raw(sourceText(R, v.source))}</span>
    </div>
    <dl class="sx-facts">
      ${rows.map(([k, val]) => raw(html`<div><dt>${titleCase(k)}</dt><dd>${val}</dd></div>`))}
    </dl>
  </details>`;
}

function pagerHtml(R, slug) {
  const i = R.races.findIndex((r) => r.slug === slug);
  if (i < 0) return '';
  const prev = R.races[i - 1];
  const next = R.races[i + 1];
  const link = (r, cls, label) =>
    r
      ? html`<a class="sx-pager-link ${cls}" href="${href.race(r.slug)}">
          <small>${label}</small><strong>${titleCase(r.name)}</strong>
        </a>`
      : '<span></span>';
  return html`<nav class="sx-pager" aria-label="${t('races.title')}">
    ${raw(link(prev, 'prev', `← ${t('races.prev')}`))}${raw(link(next, 'next', `${t('races.next')} →`))}
  </nav>`;
}

// sumário "Nesta página", montado a partir das seções marcadas com data-toc
function tocHtml(doc) {
  const items = [...doc.querySelectorAll('[data-toc]')].map((el) => {
    const label = el.matches('details') ? el.querySelector('summary strong') : el.querySelector('h2, h3') || el;
    const text = [...label.childNodes]
      .filter((n) => !(n.nodeType === 1 && n.classList.contains('sx-anchor')))
      .map((n) => n.textContent)
      .join('')
      .trim();
    return html`<li class="toc-l${el.dataset.toc}"><a href="#" data-anchor="${el.id}">${text}</a></li>`;
  });
  return html`<ul>
    ${raw(items.join(''))}
  </ul>`;
}

// barra fixa do mobile: seção atual, progresso de leitura e painel com o sumário
function mobileBarHtml() {
  return html`<div class="sx-mbar">
    <button type="button" class="sx-mbar-btn" data-sheet-open aria-haspopup="dialog">
      <span>
        <small>${t('races.onThisPage')}</small>
        <strong class="sx-mbar-cur"></strong>
      </span>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    <span class="sx-progress"><i></i></span>
  </div>`;
}

function sheetHtml() {
  return html`<div class="sx-sheet" hidden>
    <div class="sx-sheet-panel" role="dialog" aria-modal="true" aria-label="${t('races.onThisPage')}">
      <span class="sx-sheet-handle" aria-hidden="true"></span>
      <div class="sx-sheet-head">
        <strong>${t('races.onThisPage')}</strong>
        <button type="button" class="sx-sheet-close" data-sheet-close aria-label="${t('races.close')}">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <nav class="sx-sheet-list"></nav>
    </div>
  </div>`;
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
  const label = (id) => container.querySelector(`.sx-toc [data-anchor="${CSS.escape(id)}"]`);
  const setCurrent = (id) => {
    links.forEach((a) => a.classList.toggle('active', a.dataset.anchor === id));
    const li = label(id).parentElement;
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

function goTo(container, id) {
  const el = container.querySelector(`[id="${CSS.escape(id)}"]`);
  if (!el) return;
  if (el.matches('details')) el.open = true;
  if (el.matches('.sx-subrace')) showSub(container, id);
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  replaceQuery({ s: id });
}

function showSub(container, slug) {
  container.querySelectorAll('.sx-subrace').forEach((s) => s.toggleAttribute('data-active', s.id === slug));
  container
    .querySelectorAll('[data-sub]')
    .forEach((b) => b.setAttribute('aria-selected', String(b.dataset.sub === slug)));
}

function flash(el, text) {
  const tip = document.createElement('span');
  tip.className = 'sx-copied';
  tip.textContent = text;
  el.after(tip);
  setTimeout(() => tip.remove(), 1600);
}

export async function render(container, { R, params, query }) {
  const back = html`<a class="back-link" href="${href.races()}">${t('races.back')}</a>`;
  let data;
  try {
    data = await loadSpecies(params.slug);
  } catch {
    setTitle(t('races.notFound'), t('races.title'));
    container.innerHTML = html`${raw(back)}
      <div class="alert" role="alert">${t('races.notFound')}</div>`;
    return;
  }
  const name = titleCase(pick(data.name));
  setTitle(name, t('races.title'));
  const versions = data.versions?.length ? data.versions : [data];

  container.innerHTML = html`<div class="sx-layout">
    <nav class="sx-toc" aria-label="${t('races.onThisPage')}">
      <p class="sx-toc-title">${t('races.onThisPage')}</p>
      <div class="sx-toc-list"></div>
      <a class="sx-toc-top" href="#" data-top>↑ ${t('races.backToTop')}</a>
    </nav>
    <article class="doc sx-doc">
      <div class="sx-head"></div>
      ${
        versions.length > 1
          ? raw(
              html`<div class="alert" role="note">
                ${t('races.versionNote')}
                <div class="version-tabs">
                  ${versions.map((v, i) => raw(html`<button type="button" class="btn" data-version="${i}" aria-pressed="${String(i === 0)}">${raw(bookName(R, v.source))}</button>`))}
                </div>
              </div>`,
            )
          : ''
      }
      ${raw(mobileBarHtml())}
      <div class="version-body"></div>
      ${raw(pagerHtml(R, data.slug))}
    </article>
    <aside class="sx-aside"></aside>
  </div>
  ${raw(sheetHtml())}
  <button type="button" class="sx-fab" data-top aria-label="${t('races.backToTop')}" hidden>
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 7-7 7 7M12 19V5"/></svg>
  </button>`;

  const doc = container.querySelector('.sx-doc');
  const body = container.querySelector('.version-body');
  function show(i) {
    const v = versions[i];
    container.querySelector('.sx-head').innerHTML = headHtml(R, data, v, name);
    body.innerHTML = bodyHtml(R, data, v, name);
    container.querySelector('.sx-aside').innerHTML = asideHtml(R, data, v, name);
    titleStrongs(body);
    enhanceStatblocks(body);
    linkProseSpells(R, body);
    const toc = tocHtml(doc);
    container.querySelector('.sx-toc-list').innerHTML = toc;
    container.querySelector('.sx-sheet-list').innerHTML = toc;
    container.querySelector('.sx-card').open = !mobile.matches;
    if (query?.s && container.querySelector(`.sx-subrace[id="${CSS.escape(query.s)}"]`)) showSub(container, query.s);
    watchToc(container);
  }
  show(0);
  mobile.onchange = () => {
    const card = container.querySelector('.sx-card');
    if (card) card.open = !mobile.matches;
  };

  // progresso de leitura e botão de voltar ao topo
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
  container.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !container.querySelector('.sx-sheet').hidden) setSheet(container, false);
  });

  container.addEventListener('click', (e) => {
    const version = e.target.closest('[data-version]');
    if (version) {
      const i = Number(version.dataset.version);
      container
        .querySelectorAll('[data-version]')
        .forEach((x) => x.setAttribute('aria-pressed', String(Number(x.dataset.version) === i)));
      show(i);
      return;
    }
    if (e.target.closest('[data-sheet-open]')) return setSheet(container, true);
    if (e.target.closest('[data-sheet-close]') || e.target.classList.contains('sx-sheet'))
      return setSheet(container, false);
    const sub = e.target.closest('[data-sub]');
    if (sub) return showSub(container, sub.dataset.sub);
    const anchor = e.target.closest('[data-anchor]');
    if (anchor) {
      e.preventDefault();
      if (anchor.closest('.sx-sheet')) setSheet(container, false);
      goTo(container, anchor.dataset.anchor);
      if (anchor.classList.contains('sx-anchor')) {
        navigator.clipboard?.writeText(location.href).catch(() => {});
        flash(anchor, t('races.linkCopied'));
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
