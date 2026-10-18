import { html, raw, titleCase, setTitle, titleStrongs, enhanceStatblocks } from '../util.js';
import { t, ordinal, getLang } from '../i18n.js';
import { href } from '../router.js';
import { loadSpecies } from '../data.js';
import { pick, bookName, linkProseSpells } from './klassShow.js';
import { speedText, sizeText } from './races.js';
import { icon } from '../icons.js';
import { speciesIcon } from '../speciesIcons.js';
import {
  srcOf,
  sourceText,
  sectionTitle,
  introHtml,
  crumbsHtml,
  chipsHtml,
  cardHtml,
  pagerHtml,
  layoutHtml,
  refreshToc,
  initDocPage,
} from '../components/docPage.js';

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

function headHtml(R, data, v, name) {
  const subs = v.subraces ?? [];
  const range = darkvisionRange(v);
  const chips = [
    [titleCase(t('races.size')), titleCase(sizeText(data.size))],
    [titleCase(t('races.speed')), speedText(data.speed)],
    range !== null ? ['', t('races.darkvision')] : null,
    subs.length ? ['', subCount(subs.length)] : null,
  ].filter(Boolean);
  return html`${raw(crumbsHtml(href.races(), titleCase(t('races.title')), name))}
    <p class="sx-kicker">
      <span class="chip chip-species">${t('home.kind.species')}</span>
      <span class="sx-source">${raw(icon.book(14))} ${raw(sourceText(R, v.source))}</span>
    </p>
    <h1 class="sx-title">${name}</h1>
    <div class="ornament" aria-hidden="true"><span></span><i></i><span></span></div>
    ${raw(chipsHtml(chips))}`;
}

function bodyHtml(R, data, v, name) {
  const intro = pick(v.intro_html);
  const subs = v.subraces ?? [];
  const spells = allSpells(v);
  // o traço "Sub-raça" vira a introdução da seção de sub-espécies
  const subIntro = subs.length ? (v.traits ?? []).find((tr) => tr.key === 'subrace') : null;
  const traits = (v.traits ?? []).filter((tr) => tr !== subIntro);
  return html`${raw(introHtml(intro))}
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
                      ${titleCase(pick(s.name))}<a class="sx-anchor" href="#" data-anchor="${s.slug}" aria-label="${t('page.sectionLink')}">#</a>
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
  return cardHtml({
    label: t('races.sheet'),
    art: html`<div class="sx-art" role="img" aria-label="${t('page.illustration', { name })}">${raw(speciesIcon(data.slug, 72))}</div>`,
    name,
    sub: sourceText(R, v.source),
    rows: rows.map(([k, val]) => [k, html`${val}`]),
  });
}

// no mobile só a sub-espécie da aba ativa aparece
function showSub(container, slug) {
  container.querySelectorAll('.sx-subrace').forEach((s) => s.toggleAttribute('data-active', s.id === slug));
  container
    .querySelectorAll('[data-sub]')
    .forEach((b) => b.setAttribute('aria-selected', String(b.dataset.sub === slug)));
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

  container.innerHTML = layoutHtml({
    top:
      versions.length > 1
        ? html`<div class="alert" role="note">
            ${t('races.versionNote')}
            <div class="version-tabs">
              ${versions.map((v, i) => raw(html`<button type="button" class="btn" data-version="${i}" aria-pressed="${String(i === 0)}">${raw(bookName(R, v.source))}</button>`))}
            </div>
          </div>`
        : '',
    bottom: pagerHtml(R.races, data.slug, href.race, t('races.title')),
  });

  const body = container.querySelector('.version-body');
  function show(i) {
    const v = versions[i];
    container.querySelector('.sx-head').innerHTML = headHtml(R, data, v, name);
    body.innerHTML = bodyHtml(R, data, v, name);
    container.querySelector('.sx-aside').innerHTML = asideHtml(R, data, v, name);
    titleStrongs(body);
    enhanceStatblocks(body);
    linkProseSpells(R, body);
    if (query?.s && container.querySelector(`.sx-subrace[id="${CSS.escape(query.s)}"]`)) showSub(container, query.s);
    refreshToc(container);
  }
  show(0);
  initDocPage(container, { onTarget: (el) => el.matches('.sx-subrace') && showSub(container, el.id) });

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
    const sub = e.target.closest('[data-sub]');
    if (sub) showSub(container, sub.dataset.sub);
  });
}
