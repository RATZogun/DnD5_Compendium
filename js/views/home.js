import { html, raw, setTitle, titleCase } from '../util.js';
import { t, ordinal } from '../i18n.js';
import { href } from '../router.js';
import { icon } from '../icons.js';
import { recentItems } from '../recent.js';

export function categoryCard({ kind, iconHtml, count, title, text, link, cta }) {
  return html`<a class="home-card home-card-${kind}" href="${link}">
    <span class="home-card-art">${raw(iconHtml)}</span>
    <span class="home-card-body">
      <span class="home-card-count">${count}</span>
      <span class="home-card-title">${title}</span>
      <span class="home-card-text">${text}</span>
      <span class="home-card-cta">${cta} ${raw(icon.arrowRight())}</span>
    </span>
  </a>`;
}

const KIND_LABEL = { species: 'home.kind.species', class: 'home.kind.class', subclass: 'home.kind.subclass' };

// linha "Vistos recentemente" abaixo da busca: só aparece depois que o usuário abre algum item
function recentRow(R) {
  const recent = recentItems(R);
  if (!recent.length) return '';
  const label = (r) =>
    r.kind === 'spell'
      ? t('home.kind.spell', { level: r.level === 0 ? t('search.cantrip') : ordinal(r.level) })
      : t(KIND_LABEL[r.kind]);
  return html`<p class="home-recent">
    <span>${t('home.recent')}</span>
    ${recent.map((r) =>
      raw(
        html`<a class="chip chip-${r.kind === 'subclass' ? 'class' : r.kind}" href="${r.href}" title="${label(r)}">${r.name}</a>`,
      ),
    )}
  </p>`;
}

export function render(container, { R }) {
  setTitle();
  const speciesBooks = new Set(R.races.flatMap((r) => (r.sources_rels ?? []).map((s) => s.source_abbreviation))).size;
  container.innerHTML = html` <section class="home-hero">
      <span class="home-hero-icon">${raw(icon.d20(64))}</span>
      <h1>${t('home.title')}</h1>
      <p class="home-lead">${t('home.lead')}</p>
      <label class="home-search">
        ${raw(icon.search(22))}
        <input type="search" autocomplete="off" placeholder="${t('home.searchPlaceholder')}" aria-label="${t('search.title')}" />
        <kbd>Ctrl K</kbd>
      </label>
      ${raw(recentRow(R))}
    </section>

    <section class="home-section">
      <h2>${t('home.explore')}</h2>
      <div class="home-cards">
        ${raw(
          categoryCard({
            kind: 'species',
            iconHtml: icon.people(48),
            count: t('home.speciesCount', { n: R.races.length, books: speciesBooks }),
            title: titleCase(t('nav.races')),
            text: t('home.speciesText'),
            link: href.races(),
            cta: t('home.speciesCta'),
          }),
        )}
        ${raw(
          categoryCard({
            kind: 'class',
            iconHtml: icon.book(48),
            count: t('home.classesCount', { n: R.klasses.length, subs: R.specializations.length }),
            title: titleCase(t('nav.classes')),
            text: t('home.classesText'),
            link: href.klasses(),
            cta: t('home.classesCta'),
          }),
        )}
        ${raw(
          categoryCard({
            kind: 'spell',
            iconHtml: icon.flame(48),
            count: t('home.spellsCount', { n: R.spells.length }),
            title: titleCase(t('nav.spells')),
            text: t('home.spellsText'),
            link: href.spells(),
            cta: t('home.spellsCta'),
          }),
        )}
      </div>
    </section>`;

  const input = container.querySelector('.home-search input');
  const openSearch = () => document.dispatchEvent(new CustomEvent('gs-open', { detail: input.value }));
  input.addEventListener('input', () => {
    openSearch();
    input.value = '';
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') openSearch();
  });
}
