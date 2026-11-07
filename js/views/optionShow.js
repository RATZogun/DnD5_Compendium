import { html, raw, setTitle, titleCase, compareText, parseQuery, titleStrongs } from '../util.js';
import { t, ordinal } from '../i18n.js';
import { href } from '../router.js';
import { loadOptions } from '../data.js';
import { pick, linkProseSpells } from './klassShow.js';
import { typeLabel, klassText, bookOf, OPTIONS_BACK_KEY } from './options.js';
import { icon } from '../icons.js';
import { classIcon } from '../classIcons.js';
import { crumbsHtml, pagerHtml } from '../components/docPage.js';
import { linkRules } from '../ruleLinks.js';
import { trackVisit } from '../recent.js';

// página de uma opção de classe (invocação, manobra, infusão...) no mesmo modelo da página de magia: voltar aos
// resultados e filtros à esquerda, ficha no centro e opções parecidas à direita

function savedList() {
  try {
    return sessionStorage.getItem(OPTIONS_BACK_KEY);
  } catch {
    return null;
  }
}

// filtros da busca salva, em rótulos curtos
function activeFilters(R, search) {
  const q = parseQuery(search);
  const list = (v) => (v ? String(v).split(',').filter(Boolean) : []);
  return [
    ...(q.name ? [`“${q.name}”`] : []),
    ...list(q.type).map(typeLabel),
    ...list(q.klass).map((c) => titleCase(R.klassBySlug.get(c)?.name ?? c)),
    ...list(q.book).map((b) => titleCase(b)),
  ];
}

// opções parecidas: mesmo tipo, mesma classe ou subclasse, mesmo pré-requisito e nível próximo
function related(o, options) {
  const score = (x) =>
    (x.type === o.type ? 3 : 0) +
    (x.classes.some((c) => o.classes.includes(c)) ? 2 : 0) +
    (o.subclass && x.subclass === o.subclass ? 2 : 0) +
    (o.prereq?.en && x.prereq?.en === o.prereq.en ? 2 : 0) +
    (o.level && x.level ? Math.max(0, 2 - Math.abs(x.level - o.level) / 3) : 0);
  return options
    .filter((x) => x !== o)
    .map((x) => [x, score(x)])
    .sort((a, b) => b[1] - a[1] || compareText(pick(a[0].name), pick(b[0].name)))
    .slice(0, 5)
    .map(([x]) => x);
}

export async function render(container, { R, params }) {
  const listHash = savedList() ?? href.options();
  let options;
  try {
    options = await loadOptions();
  } catch {
    if (!container.isConnected) return;
    container.innerHTML = html`<div class="alert" role="alert">${t('common.loadError')}</div>`;
    return;
  }
  if (!container.isConnected) return;
  const o = options.find((x) => x.slug === params.slug);
  if (!o) {
    setTitle(t('options.notFound'), t('rules.options.title'));
    container.innerHTML = html`<a class="back-link" href="${listHash}">← ${t('spells.backResults')}</a>
      <div class="alert" role="alert">${t('options.notFound')}</div>`;
    return;
  }

  const name = titleCase(pick(o.name));
  setTitle(name, t('rules.options.title'));
  const original = o.name.en && o.name.en !== pick(o.name) ? o.name.en : null;
  const filters = activeFilters(R, listHash.split('?')[1] ?? '');
  const sameType = options
    .filter((x) => x.type === o.type)
    .map((x) => ({ slug: x.slug, name: pick(x.name) }))
    .sort((a, b) => compareText(a.name, b.name));
  const src = pick(o.source);
  const cell = (label, value) =>
    html`<div class="sp-cell"><div class="sp-label">${label}</div><div class="sp-value">${value}</div></div>`;
  const type = typeLabel(o.type);

  container.innerHTML = html`<div class="mg-layout mg-option">
    <nav class="mg-side">
      <a class="mg-back" href="${listHash}">← ${t('spells.backResults')}</a>
      ${
        filters.length
          ? raw(
              html`<p class="mg-side-title">${t('spells.activeFilters')}</p>
                <p class="mg-filters">${filters.map((f) => raw(html`<span class="chip">${f}</span>`))}</p>`,
            )
          : ''
      }
    </nav>
    <article class="doc mg-doc">
      ${raw(
        crumbsHtml(
          [
            [href.rules(), titleCase(t('rules.title'))],
            [href.options(), t('rules.options.title')],
            [href.options({ type: o.type }), type],
          ],
          name,
        ),
      )}
      <p class="sx-kicker">
        <span class="chip chip-rules">${type}</span>
        <span class="mg-level">${raw(classIcon(o.classes[0], 18))} ${klassText(R, o)}</span>
      </p>
      <h1 class="sx-title mg-title">${name}${original ? raw(html` <small lang="en">${original}</small>`) : ''}</h1>
      <div class="ornament" aria-hidden="true"><span></span><i></i><span></span></div>
      <div class="sp-grid opt-grid">
        ${raw(cell(t('spellFilter.class'), klassText(R, o)))} ${raw(cell(t('options.col.prereq'), pick(o.prereq) || '—'))}
        ${raw(cell(t('options.col.level'), o.level ? ordinal(o.level) : '—'))} ${raw(cell(t('options.col.type'), type))}
      </div>
      <div class="mg-text feature-body">${raw(pick(o.html))}</div>
      <p class="mg-casters">
        <span>${t('spellFilter.class')}:</span>
        ${o.classes.map((c) => raw(html`<a class="chip chip-class" href="${href.klass(c)}">${titleCase(R.klassBySlug.get(c)?.name ?? c)}</a>`))}
      </p>
      ${
        src
          ? raw(
              html`<p class="sx-source mg-source">
                ${raw(icon.book(14))} ${titleCase(bookOf(R, o))}${src.page ? ` · ${t('common.page')} ${src.page}` : ''}
              </p>`,
            )
          : ''
      }
      ${raw(pagerHtml(sameType, o.slug, href.option, type, type))}
    </article>
    <aside class="mg-aside">
      <div class="mg-related">
        <p class="mg-side-title">${t('options.related')}</p>
        <ul>
          ${related(o, options).map((x) =>
            raw(
              html`<li>
                <a href="${href.option(x.slug)}">${titleCase(pick(x.name))}</a>
                <span>${typeLabel(x.type)}${x.level ? ` · ${ordinal(x.level)}` : ''}</span>
              </li>`,
            ),
          )}
        </ul>
      </div>
    </aside>
  </div>`;
  const doc = container.querySelector('.mg-doc');
  titleStrongs(doc);
  linkProseSpells(R, doc);
  linkRules(doc);
  trackVisit('option', o.slug);
}
