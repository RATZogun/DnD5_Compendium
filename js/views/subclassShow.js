import { html, raw, setTitle, titleCase, wrapDoc, titleStrongs, enhanceStatblocks } from '../util.js';
import { t } from '../i18n.js';
import { href } from '../router.js';
import { loadClass } from '../data.js';
import { pick, sourceLine, featureHtml, bookName, linkSpellTables, linkProseSpells } from './klassShow.js';

function versionHtml(R, v) {
  const intro = linkSpellTables(R, { html: v.intro_html }, pick(v.intro_html), v.spells);
  return html` <p class="text-muted">${raw(sourceLine(R, v.source, v.additional_sources))}</p>
    ${intro ? raw(html`<div class="subclass-intro">${raw(intro)}</div>`) : ''}
    <div class="features">${v.features.map((f) => raw(featureHtml(R, f, null, v.spells)))}</div>`;
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
  setTitle(titleCase(pick(sub.name)), klassName);
  const versions = sub.versions?.length ? sub.versions : [sub];
  let current = 0;
  container.innerHTML = html` <p class="breadcrumb">
      <a href="${href.klass(data.slug)}">${klassName}</a> › ${titleCase(pick(data.subclass_title))}
    </p>
    <h1>${titleCase(pick(sub.name))}</h1>
    ${
      versions.length > 1
        ? raw(
            html`<div class="alert" role="note">
              ${t('classes.duplicateNote')}
              <div class="version-tabs">
                ${versions.map((v, i) => raw(html`<button type="button" class="btn" data-version="${i}" aria-pressed="${String(i === 0)}">${raw(bookName(R, v.source))}</button>`))}
              </div>
            </div>`,
          )
        : ''
    }
    <div class="version-body">${raw(versionHtml(R, versions[0]))}</div>
    ${raw(back)}`;
  wrapDoc(container);
  linkProseSpells(R, container);
  container.querySelectorAll('[data-version]').forEach((b) =>
    b.addEventListener('click', () => {
      current = Number(b.dataset.version);
      container
        .querySelectorAll('[data-version]')
        .forEach((x) => x.setAttribute('aria-pressed', String(Number(x.dataset.version) === current)));
      container.querySelector('.version-body').innerHTML = versionHtml(R, versions[current]);
      titleStrongs(container.querySelector('.version-body'));
      enhanceStatblocks(container.querySelector('.version-body'));
      linkProseSpells(R, container.querySelector('.version-body'));
    }),
  );
}
