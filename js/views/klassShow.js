import { html, raw, setTitle, titleCase, escapeHtml, capitalize, titleStrongs, enhanceStatblocks } from '../util.js';
import { t, ordinal, getLang } from '../i18n.js';
import { href } from '../router.js';
import { loadClass } from '../data.js';
import { sourcesHtml } from '../components/spellCard.js';
import { filterSpells } from '../spellFilter.js';
import { icon } from '../icons.js';
import { classIcon } from '../classIcons.js';
import {
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
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

// marcas que acompanham o nome no livro ("*", "(ritual)", "(somente água; ...)") ficam depois do nome da lista de magias
const spellSuffix = (text) => (text.trim().match(/(?:\s*(?:\*+|\([^)]*\)))+$/) || [''])[0];

function findSpell(R, enName, name) {
  if (!spellIndex.has(R)) {
    spellIndex.set(R, {
      en: new Map(R.spells.map((s) => [cleanName(s.original_name ?? s.name), s])),
      own: new Map([
        ...R.spells.flatMap((s) => (s.aliases ?? []).map((n) => [cleanName(n), s])),
        ...R.spells.map((s) => [cleanName(s.name), s]),
      ]),
    });
  }
  const idx = spellIndex.get(R);
  const get = (map, n) => (cleanName(n) ? map.get(cleanName(n)) : undefined);
  return get(idx.en, enName) ?? get(idx.own, name) ?? get(idx.en, name);
}

// nomes de magia em itálico no texto corrido viram link, com o nome da lista de magias
export function linkProseSpells(R, root) {
  root.querySelectorAll('em').forEach((em) => {
    if (em.closest('a, table, .statblock') || em.children.length) return;
    const spell = findSpell(R, null, em.textContent);
    if (!spell) return;
    const a = document.createElement('a');
    a.href = href.spell(spell.slug);
    em.textContent = spell.name;
    em.replaceWith(a);
    a.append(em);
  });
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
    const items = p.textContent.split(SPLIT);
    const looksLikeList = items.length >= 3 && items.every((x) => x.trim().length <= 50);
    if (
      heading &&
      looksLikeList &&
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
      return html`<a href="${href.spell(spells[i].slug)}">${titleCase(spells[i].name)}</a>${spellSuffix(p)}`;
    });
    if (found) cell.el.innerHTML = items.join(', ');
  }
  return tpl.innerHTML;
}

// características que são listas de opções: cada opção vai numa caixa própria
const BOXED_OPTIONS = new Set(['eldritch-invocations', 'eldritch-invocations-extra', 'artificer-infusions']);

// uma opção começa num parágrafo só com o nome em negrito (pt) ou num nome solto entre parágrafos (en)
function boxOptions(body) {
  const tpl = document.createElement('template');
  tpl.innerHTML = body;
  const root = tpl.content;
  root.querySelectorAll(':scope > p').forEach((p) => !p.textContent.trim() && !p.children.length && p.remove());
  const nextEl = (n) => {
    let x = n.nextSibling;
    while (x && x.nodeType === Node.TEXT_NODE && !x.textContent.trim()) x = x.nextSibling;
    return x;
  };
  // títulos seguidos de tabela (ex.: "Itens Replicáveis") continuam dentro da opção anterior
  const isHead = (n) =>
    nextEl(n)?.nodeName === 'P' &&
    ((n.nodeType === Node.TEXT_NODE && n.textContent.trim()) ||
      (n.nodeName === 'P' &&
        n.childNodes.length === 1 &&
        n.firstChild.nodeName === 'STRONG' &&
        !/[.:]$/.test(n.textContent.trim())));
  let box = null;
  for (const node of [...root.childNodes]) {
    if (isHead(node)) {
      box = document.createElement('div');
      box.className = 'option-box';
      const head = document.createElement('p');
      head.className = 'option-name';
      head.innerHTML = `<strong>${escapeHtml(node.textContent.trim())}</strong>`;
      box.append(head);
      node.replaceWith(box);
    } else if (box && !(node.nodeType === Node.TEXT_NODE && !node.textContent.trim())) {
      box.append(node);
    }
  }
  return tpl.innerHTML;
}

export function featureHtml(R, f, spells, { badge: withBadge = true } = {}) {
  const badge =
    withBadge && f.level && !CORE.has(f.key)
      ? html`<span class="level-badge">${t('classes.levelBadge', { level: ordinal(f.level) })}</span>`
      : '';
  const opt = f.optional ? html`<span class="optional-badge">${t('classes.optional')}</span>` : '';
  return html` <section class="feature" id="${f.key}">
    <h3>${titleCase(pick(f.name))} ${raw(badge)} ${raw(opt)}</h3>
    <div class="feature-body">
      ${raw(
        BOXED_OPTIONS.has(f.key)
          ? boxOptions(linkSpellTables(R, f, pick(f.html), spells))
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
      raw(html`<a href="#" data-anchor="${f.key}">${titleCase(pick(f.name))}</a>`),
    );
    const values = groups.flatMap((g) =>
      (pick(g.rows)[i] ?? []).map((v) => raw(html`<td class="num">${v === 0 ? '–' : v}</td>`)),
    );
    return raw(
      html`<tr data-level="${level}">
        <th scope="row">${ordinal(level)}</th>
        <td class="num">+${Math.ceil(level / 4) + 1}</td>
        <td class="feat-list">${feats.length ? raw(feats.map((x) => x.value).join(', ')) : '–'}</td>
        ${values}
      </tr>`,
    );
  });
  return html` <div class="table-wrap kx-table">
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

export function bookName(R, source) {
  const s = source?.[getLang() === 'en' ? 'en' : 'pt'] ?? source?.pt ?? source?.en;
  const book = s && R.sourceByAbbr.get(s.book);
  return html`${book ? titleCase(book.name) : (s?.book ?? '')}`;
}

// pares "Rótulo: valor" do texto de proficiências (armaduras, armas, testes de resistência...)
function proficiencyRows(data) {
  const f = data.features.find((x) => x.key === 'proficiencies');
  if (!f) return [];
  const tpl = document.createElement('template');
  tpl.innerHTML = pick(f.html);
  return [...tpl.content.querySelectorAll('strong')].map((st) => {
    let text = '';
    for (let n = st.nextSibling; n && n.nodeName !== 'STRONG' && n.nodeName !== 'BR'; n = n.nextSibling)
      text += n.textContent;
    return [st.textContent.replace(/:\s*$/, ''), html`${capitalize(text.trim())}`];
  });
}

function headHtml(R, data, name, spellCount) {
  const subs = data.subclasses?.length ?? 0;
  return html`${raw(crumbsHtml(href.klasses(), titleCase(t('classes.title')), name))}
    <p class="sx-kicker">
      <span class="chip chip-class">${t('home.kind.class')}</span>
      <span class="sx-source">${raw(icon.book(14))} ${raw(sourceText(R, data.source))}</span>
    </p>
    <h1 class="sx-title">${name}</h1>
    <div class="ornament" aria-hidden="true"><span></span><i></i><span></span></div>
    ${raw(
      chipsHtml(
        [
          data.hit_die ? [titleCase(t('classes.hitDie')), `d${data.hit_die}`] : null,
          spellCount ? ['', t('classes.caster')] : null,
          subs ? ['', t('classes.subclassesN', { n: subs })] : null,
        ].filter(Boolean),
      ),
    )}`;
}

// tabela de progressão: mostra os 5 primeiros níveis e destaca o nível escolhido
function progressionHtml(data, mine) {
  return html`${raw(sectionTitle('progression', titleCase(t('classes.progression'))))}
    <div class="kx-table-bar">
      <span class="kx-showing">${t('classes.showing', { to: ordinal(5) })}</span>
      <label class="kx-mine">
        <span>${t('classes.myLevel')}</span>
        <select class="form-control">
          <option value="">–</option>
          ${Array.from({ length: 20 }, (_, i) => raw(html`<option value="${i + 1}" ${mine === i + 1 ? 'selected' : ''}>${ordinal(i + 1)}</option>`))}
        </select>
      </label>
    </div>
    ${raw(tableHtml(data))}
    <button type="button" class="link-btn kx-more" aria-expanded="false" data-more="${t('classes.showAll')}" data-less="${t('classes.showLess')}"></button>`;
}

// características: as de base (vida, proficiências, equipamento) e depois uma linha do tempo por nível
function featuresHtml(R, data) {
  const core = data.features.filter((f) => CORE.has(f.key));
  const byLevel = new Map();
  for (const f of data.features.filter((x) => !CORE.has(x.key))) {
    if (!byLevel.has(f.level)) byLevel.set(f.level, []);
    byLevel.get(f.level).push(f);
  }
  return html`${raw(sectionTitle('features', titleCase(t('classes.featuresCol'))))}
    <div class="features kx-core">${core.map((f) => raw(featureHtml(R, f, null, { badge: false })))}</div>
    <ol class="kx-timeline">
      ${[...byLevel].map(([level, feats]) =>
        raw(
          html`<li class="kx-level" id="level-${level}" data-level="${level}" data-toc="2" data-toc-label="${t('classes.levelBadge', { level: ordinal(level) })}">
            <span class="kx-dot" aria-hidden="true">${ordinal(level)}</span>
            <p class="kx-level-name">${t('classes.levelBadge', { level: ordinal(level) })}</p>
            <div class="features">${feats.map((f) => raw(featureHtml(R, f, null, { badge: false })))}</div>
          </li>`,
        ),
      )}
    </ol>`;
}

function subclassesHtml(R, data) {
  if (!data.subclasses?.length) return '';
  const subs = [...data.subclasses].sort((a, b) => pick(a.name).localeCompare(pick(b.name), getLang()));
  return html`${raw(sectionTitle('subclasses', titleCase(pick(data.subclass_title))))}
    <div class="kx-subs">
      ${subs.map((s) =>
        raw(
          html`<a class="kx-sub" href="${href.subclass(data.slug, s.slug)}">
            <strong>${titleCase(pick(s.name))}</strong>
            <span>${raw(bookName(R, s.source))}</span>
            ${raw(icon.arrowRight(16))}
          </a>`,
        ),
      )}
    </div>`;
}

function spellsCallout(klass, name, count) {
  if (!count) return '';
  return html`${raw(sectionTitle('spells', t('classes.spellsOf', { klass: name })))}
    <div class="kx-spells">
      <span class="kx-spells-icon">${raw(icon.flame(24))}</span>
      <span class="kx-spells-text">
        <strong>${t('classes.spellsCount', { n: count })}</strong>
        <small>${t('classes.spellsHint', { klass: name })}</small>
      </span>
      <a class="btn btn-primary" href="${href.spells({ klassName: klass.name })}">${t('classes.seeSpells')} →</a>
    </div>`;
}

function asideHtml(R, data, klass, name) {
  const ability = klass?.spellcasting_ability_abbreviation
    ? R.abilities.find((a) => a.abbreviation === klass.spellcasting_ability_abbreviation)
    : null;
  const rows = [
    data.hit_die ? [t('classes.hitDie'), html`d${data.hit_die}`] : null,
    ability ? [t('classes.spellcastingAbility'), html`${titleCase(ability.name)}`] : null,
    ...proficiencyRows(data),
  ].filter(Boolean);
  return cardHtml({
    label: t('classes.sheet'),
    cls: 'kx-card',
    art: html`<div class="sx-art kx-art" role="img" aria-label="${name}">${raw(classIcon(data.slug, 72))}</div>`,
    name,
    sub: sourceText(R, data.source),
    rows,
  });
}

// nível destacado na tabela e na linha do tempo (guardado por classe)
const MINE_KEY = (slug) => `classLevel:${slug}`;
function readMine(slug) {
  try {
    return Number(localStorage.getItem(MINE_KEY(slug))) || null;
  } catch {
    return null;
  }
}
function saveMine(slug, level) {
  try {
    if (level) localStorage.setItem(MINE_KEY(slug), String(level));
    else localStorage.removeItem(MINE_KEY(slug));
  } catch {
    // sem armazenamento: o destaque vale só nesta visita
  }
}

function applyMine(container, level) {
  container
    .querySelectorAll('[data-level]')
    .forEach((el) => el.classList.toggle('is-mine', Number(el.dataset.level) === level));
}

function setExpanded(container, open) {
  container.querySelector('.kx-table').classList.toggle('is-open', open);
  const more = container.querySelector('.kx-more');
  more.setAttribute('aria-expanded', String(open));
  more.textContent = open ? more.dataset.less : more.dataset.more;
  container.querySelector('.kx-showing').hidden = open;
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
  const name = titleCase(pick(data.name));
  setTitle(name, t('classes.title'));
  const klass = R.klassBySlug.get(data.slug);
  const spellCount = klass?.spell_list_name ? filterSpells(R, { klassName: klass.name }).length : 0;
  const mine = readMine(data.slug);

  container.innerHTML = layoutHtml({ bottom: pagerHtml(R.klasses, data.slug, href.klass, t('classes.title')) });
  const body = container.querySelector('.version-body');
  container.querySelector('.sx-head').innerHTML = headHtml(R, data, name, spellCount);
  body.innerHTML = html`${raw(introHtml(pick(data.intro_html)))} ${raw(progressionHtml(data, mine))}
  ${raw(featuresHtml(R, data))} ${raw(subclassesHtml(R, data))} ${raw(spellsCallout(klass, name, spellCount))}`;
  container.querySelector('.sx-aside').innerHTML = asideHtml(R, data, klass, name);
  titleStrongs(body);
  enhanceStatblocks(body);
  linkProseSpells(R, body);
  applyMine(container, mine);
  setExpanded(container, mine > 5);
  refreshToc(container);
  initDocPage(container, { onTarget: (el) => el.closest('.kx-table') && setExpanded(container, true) });

  container
    .querySelector('.kx-more')
    .addEventListener('click', () =>
      setExpanded(container, !container.querySelector('.kx-table').classList.contains('is-open')),
    );
  container.querySelector('.kx-mine select').addEventListener('change', (e) => {
    const level = Number(e.target.value) || null;
    saveMine(data.slug, level);
    applyMine(container, level);
    if (level > 5) setExpanded(container, true);
  });
}
