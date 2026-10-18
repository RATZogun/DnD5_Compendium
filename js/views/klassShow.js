import { html, raw, setTitle, titleCase, escapeHtml } from '../util.js';
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

const spellIndex = new WeakMap();
const cleanName = (s) =>
  (s ?? '')
    .replace(/\*|\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

function findSpell(R, enName, name) {
  if (!spellIndex.has(R)) {
    spellIndex.set(R, {
      en: new Map(R.spells.map((s) => [cleanName(s.original_name), s])),
      own: new Map([
        ...R.spells.flatMap((s) => (s.aliases ?? []).map((n) => [cleanName(n), s])),
        ...R.spells.map((s) => [cleanName(s.name), s]),
      ]),
    });
  }
  const idx = spellIndex.get(R);
  return idx.en.get(cleanName(enName)) ?? idx.own.get(cleanName(name)) ?? idx.en.get(cleanName(name));
}

const SPLIT = /,\s*(?![^(]*\))/;
const LIST_HEADING = /c[íi]rculo|truques|level|cantrips/i;

// células de tabela (menos a 1ª coluna) e parágrafos logo abaixo de um título de círculo, com o nível da linha
function spellCells(root) {
  const cells = [];
  root.querySelectorAll('table tbody tr').forEach((tr) => {
    const level = parseInt(tr.querySelector('td')?.textContent, 10);
    tr.querySelectorAll('td').forEach((td, ci) => ci > 0 && cells.push({ el: td, level, kind: 'td' }));
  });
  root.querySelectorAll('p').forEach((p) => {
    const prev = p.previousElementSibling;
    const heading = prev?.tagName === 'P' && prev.children.length === 1 && prev.firstElementChild.tagName === 'STRONG';
    if (
      heading &&
      prev.textContent.trim() === prev.firstElementChild.textContent.trim() &&
      LIST_HEADING.test(prev.textContent)
    )
      cells.push({ el: p, level: NaN, kind: 'p' });
  });
  return cells;
}

// nomes de magias em tabelas e listas viram links; os que não casam pelo nome são pareados com os da mesma
// célula em inglês ou, sem ela, com a lista de magias da subclasse no nível da linha
export function linkSpellTables(R, f, body, extra = []) {
  if (!body.includes('<table') && !body.includes('<strong>')) return body;
  const tpl = document.createElement('template');
  tpl.innerHTML = body;
  const en = document.createElement('template');
  en.innerHTML = f.html?.en ?? '';
  const enCells = spellCells(en.content);
  const seen = { td: 0, p: 0 };
  for (const cell of spellCells(tpl.content)) {
    const enCell = enCells.filter((c) => c.kind === cell.kind)[seen[cell.kind]++];
    if (cell.el.querySelector('a')) continue;
    const parts = cell.el.textContent.split(SPLIT);
    const enParts = enCell?.el.textContent.split(SPLIT) ?? [];
    const spells = parts.map((p) => findSpell(R, null, p));
    const used = new Set(spells.filter(Boolean));
    const pool = enParts.length
      ? enParts
      : extra.filter((x) => x.level === cell.level).flatMap((x) => x.names_en ?? []);
    const rest = pool.map((e) => findSpell(R, e)).filter((s) => s && !used.has(s));
    const missing = spells.map((s, i) => (s ? -1 : i)).filter((i) => i >= 0);
    if (missing.length && missing.length === rest.length) missing.forEach((i, k) => (spells[i] = rest[k]));
    let found = 0;
    const items = parts.map((p, i) => {
      if (!spells[i]) return escapeHtml(p.trim());
      found++;
      return html`<a href="${href.spell(spells[i].slug)}">${p.trim()}</a>`;
    });
    if (found) cell.el.innerHTML = items.join(', ');
  }
  return tpl.innerHTML;
}

export function featureHtml(R, f, data, spells) {
  const badge =
    f.level && !CORE.has(f.key)
      ? html`<span class="level-badge">${t('classes.levelBadge', { level: ordinal(f.level) })}</span>`
      : '';
  const opt = f.optional ? html`<span class="optional-badge">${t('classes.optional')}</span>` : '';
  return html` <section class="feature" id="${f.key}">
    <h3>${titleCase(pick(f.name))} ${raw(badge)} ${raw(opt)}</h3>
    <div class="feature-body">
      ${raw(
        f.subclass_list && data?.subclasses?.length
          ? withSubclassList(R, data, linkSpellTables(R, f, pick(f.html), spells))
          : linkSpellTables(R, f, pick(f.html), spells),
      )}
    </div>
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

// a lista entra antes do primeiro subtítulo do texto (ex.: Magias de Domínio) ou no fim
function withSubclassList(R, data, body) {
  const at = body.indexOf('<p><strong>');
  const list = subclassItemsHtml(R, data);
  return at < 0 ? body + list : body.slice(0, at) + list + body.slice(at);
}

function subclassItemsHtml(R, data) {
  const subs = [...data.subclasses].sort((a, b) => pick(a.name).localeCompare(pick(b.name), getLang()));
  return html`<ul class="subclass-list">
    ${subs.map((s) =>
      raw(
        html`<li>
          <a href="${href.subclass(data.slug, s.slug)}">${titleCase(pick(s.name))}</a>
          <span class="text-muted">(${raw(bookName(R, s.source))})</span>
        </li>`,
      ),
    )}
  </ul>`;
}

function subclassListHtml(R, data) {
  return html` <h2 id="subclasses">${titleCase(pick(data.subclass_title))}</h2>
    ${raw(subclassItemsHtml(R, data))}`;
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
    <div class="features">${data.features.map((f) => raw(featureHtml(R, f, data)))}</div>
    ${data.subclasses?.length && !data.features.some((f) => f.subclass_list) ? raw(subclassListHtml(R, data)) : ''} ${raw(back)}`;
  container.querySelectorAll('[data-anchor]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      container.querySelector(a.getAttribute('href'))?.scrollIntoView({ block: 'start' });
    }),
  );
}
