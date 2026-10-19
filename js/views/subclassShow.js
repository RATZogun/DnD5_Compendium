import { html, raw, setTitle, titleCase, titleStrongs, enhanceStatblocks } from '../util.js';
import { t, ordinal } from '../i18n.js';
import { href } from '../router.js';
import { loadClass } from '../data.js';
import {
  pick,
  bookName,
  linkSpellTables,
  linkProseSpells,
  timelineHtml,
  subclassesHtml,
  sortedSubclasses,
  readMine,
  applyMine,
} from './klassShow.js';
import { icon } from '../icons.js';
import { classIcon } from '../classIcons.js';
import {
  sourceText,
  sectionTitle,
  crumbsHtml,
  chipsHtml,
  cardHtml,
  pagerHtml,
  layoutHtml,
  refreshToc,
  initDocPage,
} from '../components/docPage.js';

const levelsOf = (v) => [...new Set(v.features.map((f) => f.level))].sort((a, b) => a - b);

function headHtml(R, data, v, name, klassName) {
  const levels = levelsOf(v);
  return html`${raw(
    crumbsHtml(
      [
        [href.klasses(), titleCase(t('classes.title'))],
        [href.klass(data.slug), klassName],
      ],
      name,
    ),
  )}
    <p class="sx-kicker">
      <span class="chip chip-class">${t('home.kind.subclass')}</span>
      <span class="sx-source">${raw(icon.book(14))} ${raw(sourceText(R, v.source))}</span>
    </p>
    <h1 class="sx-title">${name}</h1>
    <div class="ornament" aria-hidden="true"><span></span><i></i><span></span></div>
    ${raw(
      chipsHtml(
        [
          ['', klassName],
          levels.length ? ['', t('classes.fromLevel', { level: ordinal(levels[0]) })] : null,
          ['', t('classes.featuresN', { n: v.features.length })],
        ].filter(Boolean),
      ),
    )}`;
}

function bodyHtml(R, data, v, sub) {
  const intro = linkSpellTables(R, { html: v.intro_html }, pick(v.intro_html), v.spells);
  return html`${intro ? raw(html`<div class="subclass-intro">${raw(intro)}</div>`) : ''}
    ${raw(sectionTitle('features', titleCase(t('classes.featuresCol'))))} ${raw(timelineHtml(R, v.features, v.spells, { klass: data.slug, sub: sub.slug }))}
    ${raw(subclassesHtml(R, data, { exclude: sub.slug, title: t('classes.otherSubclasses') }))}`;
}

function asideHtml(R, data, v, name, klassName) {
  const levels = levelsOf(v);
  const rows = [
    [t('home.kind.class'), html`<a href="${href.klass(data.slug)}">${klassName}</a>`],
    levels.length ? [t('classes.chosenAt'), html`${t('classes.levelBadge', { level: ordinal(levels[0]) })}`] : null,
    levels.length ? [t('classes.featureLevels'), html`${levels.map((l) => ordinal(l)).join(', ')}`] : null,
    v.spells?.length ? [t('classes.extraSpells'), html`${t('races.yes')}`] : null,
  ].filter(Boolean);
  return cardHtml({
    label: t('classes.subSheet'),
    art: html`<div class="sx-art kx-art" role="img" aria-label="${klassName}">${raw(classIcon(data.slug, 72))}</div>`,
    name,
    sub: sourceText(R, v.source),
    rows,
  });
}

export async function render(container, { R, params }) {
  const backToList = html`<a class="back-link" href="${href.klasses()}">${t('classes.back')}</a>`;
  let data;
  try {
    data = await loadClass(params.slug);
  } catch {
    container.innerHTML = html`${raw(backToList)}
      <div class="alert" role="alert">${t('classes.notFound')}</div>`;
    return;
  }
  const sub = data.subclasses?.find((s) => s.slug === params.sub);
  const klassName = titleCase(pick(data.name));
  const back = html`<a class="back-link" href="${href.klass(data.slug)}"
    >${t('classes.backTo', { klass: klassName })}</a
  >`;
  if (!sub) {
    setTitle(t('classes.subclassNotFound'), klassName);
    container.innerHTML = html`${raw(back)}
      <div class="alert" role="alert">${t('classes.subclassNotFound')}</div>`;
    return;
  }
  const name = titleCase(pick(sub.name));
  setTitle(name, klassName);
  const versions = sub.versions?.length ? sub.versions : [sub];
  const siblings = sortedSubclasses(data).map((s) => ({ slug: s.slug, name: pick(s.name) }));

  container.innerHTML = layoutHtml({
    cat: 'class',
    top:
      versions.length > 1
        ? html`<div class="alert" role="note">
            ${t('classes.duplicateNote')}
            <div class="version-tabs">
              ${versions.map((v, i) => raw(html`<button type="button" class="btn" data-version="${i}" aria-pressed="${String(i === 0)}">${raw(bookName(R, v.source))}</button>`))}
            </div>
          </div>`
        : '',
    bottom: pagerHtml(
      siblings,
      sub.slug,
      (slug) => href.subclass(data.slug, slug),
      titleCase(pick(data.subclass_title)),
    ),
  });

  const body = container.querySelector('.version-body');
  function show(i) {
    const v = versions[i];
    container.querySelector('.sx-head').innerHTML = headHtml(R, data, v, name, klassName);
    body.innerHTML = bodyHtml(R, data, v, sub);
    container.querySelector('.sx-aside').innerHTML = asideHtml(R, data, v, name, klassName);
    titleStrongs(body);
    enhanceStatblocks(body);
    linkProseSpells(R, body);
    // o nível destacado na página da classe vale aqui também
    applyMine(container, readMine(data.slug));
    refreshToc(container);
  }
  show(0);
  initDocPage(container);

  container.addEventListener('click', (e) => {
    const version = e.target.closest('[data-version]');
    if (!version) return;
    const i = Number(version.dataset.version);
    container
      .querySelectorAll('[data-version]')
      .forEach((x) => x.setAttribute('aria-pressed', String(Number(x.dataset.version) === i)));
    show(i);
  });
}
