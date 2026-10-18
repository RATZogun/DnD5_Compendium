import { html, raw, setTitle, titleCase } from '../util.js';
import { t, ordinal, getLang } from '../i18n.js';
import { href } from '../router.js';
import { loadClass } from '../data.js';
import { sourcesHtml } from '../components/spellCard.js';

export const pick = (obj) => (obj ? (obj[getLang()] ?? obj.pt ?? obj.en ?? '') : '');

export function sourceLine(R, source, extra = []) {
  const lang = getLang() === 'en' ? 'en' : 'pt';
  const rels = [source, ...(extra ?? [])]
    .map((x) => x?.[lang] ?? x?.pt ?? x?.en)
    .filter(Boolean)
    .map((s) => ({ source_abbreviation: s.book, page: s.page }));
  return rels.length ? sourcesHtml(R, rels) : '';
}

const CORE = new Set(['hit-points', 'proficiencies', 'equipment']);

export function featureHtml(R, f) {
  const badge =
    f.level && !CORE.has(f.key)
      ? html`<span class="level-badge">${t('classes.levelBadge', { level: ordinal(f.level) })}</span>`
      : '';
  const opt = f.optional ? html`<span class="optional-badge">${t('classes.optional')}</span>` : '';
  return html` <section class="feature" id="${f.key}">
    <h3>${titleCase(pick(f.name))} ${raw(badge)} ${raw(opt)}</h3>
    <div class="feature-body">${raw(pick(f.html))}</div>
    ${f.source ? raw(html`<p class="feature-source">${raw(sourceLine(R, f.source))}</p>`) : ''}
  </section>`;
}

function tableHtml(data) {
  const groups = data.table?.groups ?? [];
  const byLevel = data.table?.features_by_level ?? {};
  const head1 = groups.map((g) =>
    g.title
      ? raw(html`<th colspan="${g.columns.length}" class="num">${titleCase(pick(g.title))}</th>`)
      : raw(g.columns.map(() => '<th></th>').join('')),
  );
  const anyTitle = groups.some((g) => g.title);
  const head2 = groups.flatMap((g) => g.columns.map((c) => raw(html`<th class="num">${titleCase(pick(c))}</th>`)));
  const rows = Array.from({ length: 20 }, (_, i) => {
    const level = i + 1;
    const feats = (byLevel[level] ?? []).map((f) =>
      raw(html`<a href="#${f.key}" data-anchor>${titleCase(pick(f.name))}</a>`),
    );
    const values = groups.flatMap((g) =>
      (pick(g.rows)[i] ?? []).map((v) => raw(html`<td class="num">${v === 0 ? '–' : v}</td>`)),
    );
    return raw(
      html`<tr>
        <td>${ordinal(level)}</td>
        <td class="num">+${Math.ceil(level / 4) + 1}</td>
        <td class="feat-list">${feats.length ? raw(feats.map((x) => x.value).join(', ')) : '–'}</td>
        ${values}
      </tr>`,
    );
  });
  return html` <div class="table-wrap">
    <table class="data-table class-table">
      <thead>
        ${
          anyTitle
            ? raw(
                html`<tr>
                  <th colspan="3"></th>
                  ${head1}
                </tr>`,
              )
            : ''
        }
        <tr>
          <th>${titleCase(t('common.level'))}</th>
          <th class="num">${titleCase(t('classes.profBonus'))}</th>
          <th>${titleCase(t('classes.featuresCol'))}</th>
          ${head2}
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </div>`;
}

function subclassListHtml(R, data) {
  return html` <h2 id="subclasses">${titleCase(pick(data.subclass_title))}</h2>
    <ul class="subclass-list">
      ${data.subclasses.map((s) =>
        raw(
          html`<li>
            <a href="${href.subclass(data.slug, s.slug)}">${titleCase(pick(s.name))}</a>
            <span class="text-muted">(${raw(bookName(R, s.source))})</span>
          </li>`,
        ),
      )}
    </ul>`;
}

export function bookName(R, source) {
  const s = source?.[getLang() === 'en' ? 'en' : 'pt'] ?? source?.pt ?? source?.en;
  const book = s && R.sourceByAbbr.get(s.book);
  return html`${book ? titleCase(book.name) : (s?.book ?? '')}`;
}

export async function render(container, { R, params }) {
  const back = html`<a class="back-link" href="${href.klasses()}">${t('classes.back')}</a>`;
  let data;
  try {
    data = await loadClass(params.slug);
  } catch {
    setTitle(t('classes.notFound'), t('classes.title'));
    container.innerHTML = html`${raw(back)}
      <div class="alert" role="alert">${t('classes.notFound')}</div>`;
    return;
  }
  setTitle(titleCase(pick(data.name)), t('classes.title'));
  const intro = pick(data.intro_html);
  container.innerHTML = html` <h1>${titleCase(pick(data.name))}</h1>
    <p class="text-muted">
      ${raw(sourceLine(R, data.source))}${data.hit_die ? ` · ${titleCase(t('classes.hitDie'))}: d${data.hit_die}` : ''}
    </p>
    ${
      intro
        ? raw(
            html`<details class="panel intro">
              <summary class="panel-heading">${titleCase(t('classes.description'))}</summary>
              <div class="panel-body">${raw(intro)}</div>
            </details>`,
          )
        : ''
    }
    ${raw(tableHtml(data))}
    <h2>${titleCase(t('classes.classFeatures'))}</h2>
    <div class="features">${data.features.map((f) => raw(featureHtml(R, f)))}</div>
    ${data.subclasses?.length ? raw(subclassListHtml(R, data)) : ''} ${raw(back)}`;
  container.querySelectorAll('[data-anchor]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      container.querySelector(a.getAttribute('href'))?.scrollIntoView({ block: 'start' });
    }),
  );
}
