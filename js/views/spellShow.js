import {
  html,
  raw,
  setTitle,
  titleCase,
  capitalize,
  compareText,
  parseQuery,
  titleStrongs,
  enhanceStatblocks,
} from '../util.js';
import { t, ordinal } from '../i18n.js';
import { href } from '../router.js';
import { spellCasters } from '../data.js';
import { spellMetaGridHtml, spellNotesHtml } from '../components/spellPopup.js';
import { casterHref } from '../components/spellCard.js';
import { pickFilters, spellFilterChips } from '../spellFilter.js';
import { icon } from '../icons.js';
import { crumbsHtml, pagerHtml } from '../components/docPage.js';

// última busca da lista de magias (gravada pela lista), para o "Voltar aos resultados"
export const SPELLS_BACK_KEY = 'spellsBack';
function savedList() {
  try {
    return sessionStorage.getItem(SPELLS_BACK_KEY);
  } catch {
    return null;
  }
}

const NONE = new Set(['nenhum', 'none', '', null, undefined]);
const levelText = (spell) =>
  spell.level === 0 ? capitalize(t('spells.cantrip')) : t('spells.levelN', { level: ordinal(spell.level) });

// filtros ativos da busca salva, em rótulos curtos
const activeFilters = (R, search) => spellFilterChips(R, pickFilters(parseQuery(search))).map((c) => c.label);

// o parágrafo "Em Níveis Superiores." sai do texto e vai para uma caixa própria
const HIGHER = /^(em (níveis|círculos) superiores|at higher levels)\.?$/i;
function splitHigher(description) {
  const tpl = document.createElement('template');
  tpl.innerHTML = description;
  const p = [...tpl.content.children].find((x) => {
    if (x.tagName !== 'P') return false;
    const st = x.querySelector('strong');
    return st && x.firstElementChild === st && HIGHER.test(st.textContent.trim());
  });
  if (!p) return { body: description, higher: null };
  const title = p.querySelector('strong').textContent.trim().replace(/\.$/, '');
  p.querySelector('strong').remove();
  const higher = { title, html: p.innerHTML.trim() };
  p.remove();
  return { body: tpl.innerHTML, higher };
}

// dano tirado do texto ("8d6 de dano de fogo", "8d6 fire damage")
function damageText(spell) {
  if (NONE.has(spell.damage_type)) return null;
  const text = spell.description.replace(/<[^>]+>/g, ' ');
  const m =
    text.match(/(\d+d\d+(?:\s*\+\s*\d+)?)\s+(?:pontos\s+)?de\s+dano/i) ||
    text.match(/(\d+d\d+(?:\s*\+\s*\d+)?)\s+\w+\s+damage/i);
  return t('spells.damage', { value: [m?.[1], spell.damage_type].filter(Boolean).join(' ') });
}

function tagsHtml(spell) {
  const dmg = damageText(spell);
  const tags = [
    dmg ? [dmg, 'mg-tag-damage'] : null,
    spell.heal && !NONE.has(spell.heal) ? [t('spells.heals')] : null,
    spell.can_evolve ? [capitalize(t('spellFilter.canEvolve'))] : null,
    [spell.does_need_concentration ? capitalize(t('spellFilter.concentration')) : t('spells.noConcentration')],
    spell.is_ritual ? [t('spells.ritualTag')] : null,
  ].filter(Boolean);
  return html`<p class="mg-tags">${tags.map(([text, cls]) => raw(html`<span class="chip ${cls ?? ''}">${text}</span>`))}</p>`;
}

// magias parecidas: mesma escola, nível próximo e classes em comum
function related(R, spell) {
  const casters = new Set(spell.classes ?? []);
  const score = (s) =>
    (s.spell_school_name === spell.spell_school_name ? 3 : 0) +
    (s.damage_type && s.damage_type === spell.damage_type && !NONE.has(s.damage_type) ? 3 : 0) +
    Math.max(0, 2 - Math.abs(s.level - spell.level)) +
    ((s.classes ?? []).some((c) => casters.has(c)) ? 1 : 0);
  return R.spells
    .filter((s) => s !== spell)
    .map((s) => [s, score(s)])
    .sort((a, b) => b[1] - a[1] || compareText(a[0].name, b[0].name))
    .slice(0, 5)
    .map(([s]) => s);
}

export function render(container, { R, params }) {
  const spell = R.spellBySlug.get(params.slug);
  const listHash = savedList() ?? href.spells();
  const back = html`<a class="back-link" href="${listHash}">${t('spells.back')}</a>`;
  if (!spell) {
    setTitle(t('spells.notFound'), t('spells.title'));
    container.innerHTML = html`${raw(back)}
      <div class="alert" role="alert">${t('spells.notFound')}</div>`;
    return;
  }
  const name = titleCase(spell.name);
  setTitle(name, t('spells.title'));
  const original =
    spell.original_name && spell.original_name !== spell.name ? titleCase(spell.original_name, 'en') : null;
  const { body, higher } = splitHigher(spell.description);
  const filters = activeFilters(R, listHash.split('?')[1] ?? '');
  const sameLevel = R.spells
    .filter((s) => s.level === spell.level)
    .sort((a, b) => compareText(a.name, b.name))
    .map((s) => ({ slug: s.slug, name: s.name }));
  const src = spell.sources_rels?.[0];
  const book = src && R.sourceByAbbr.get(src.source_abbreviation);
  const casters = spellCasters(R, spell);

  container.innerHTML = html`<div class="mg-layout">
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
            [href.spells(), titleCase(t('spells.title'))],
            [href.spells({ levels: spell.level }), levelText(spell)],
          ],
          name,
        ),
      )}
      <p class="sx-kicker">
        <span class="chip chip-spell">${t('home.kind.spellTag')}</span>
        <span class="mg-level">${levelText(spell)} · ${titleCase(spell.spell_school_name)}</span>
      </p>
      <h1 class="sx-title mg-title">${name}${original ? raw(html` <small lang="en">${original}</small>`) : ''}</h1>
      <div class="ornament" aria-hidden="true"><span></span><i></i><span></span></div>
      ${raw(spellMetaGridHtml(R, spell, { full: true }))} ${raw(tagsHtml(spell))}
      <div class="spell-description mg-text" data-spell-level="${spell.level}">${raw(body)}${raw(spellNotesHtml(spell))}</div>
      ${
        higher
          ? raw(
              html`<aside class="mg-higher">
                <p class="mg-higher-title">${raw(icon.flame(18))} ${higher.title}</p>
                <p>${raw(higher.html)}</p>
              </aside>`,
            )
          : ''
      }
      ${
        casters.length
          ? raw(
              html`<p class="mg-casters">
                <span>${t('spell.casters')}:</span>
                ${casters.map((c) => raw(c.slug ? html`<a class="chip chip-class" href="${casterHref(c)}">${titleCase(c.name)}</a>` : html`<span class="chip chip-class">${titleCase(c.name)}</span>`))}
              </p>`,
            )
          : ''
      }
      ${
        src
          ? raw(
              html`<p class="sx-source mg-source">
                ${raw(icon.book(14))} ${book ? titleCase(book.name) : src.source_abbreviation}${src.page ? ` · ${t('common.page')} ${src.page}` : ''}
              </p>`,
            )
          : ''
      }
      ${raw(pagerHtml(sameLevel, spell.slug, href.spell, levelText(spell), levelText(spell)))}
    </article>
    <aside class="mg-aside">
      <div class="mg-related">
        <p class="mg-side-title">${t('spells.related')}</p>
        <ul>
          ${related(R, spell).map((s) =>
            raw(
              html`<li>
                <a href="${href.spell(s.slug)}">${titleCase(s.name)}</a>
                <span>${s.level === 0 ? capitalize(t('spells.cantrip')) : ordinal(s.level)} · ${titleCase(s.spell_school_name)}</span>
              </li>`,
            ),
          )}
        </ul>
      </div>
    </aside>
  </div>`;
  const doc = container.querySelector('.mg-doc');
  titleStrongs(doc);
  enhanceStatblocks(doc);
}
