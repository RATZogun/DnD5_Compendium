import { html, raw, titleCase } from '../util.js';
import { t, ordinal } from '../i18n.js';
import { spellCasters } from '../data.js';
import { href } from '../router.js';

export function spellLevelLine(spell) {
  const school = spell.spell_school_name;
  const base =
    spell.level === 0 ? t('spell.cantripOf', { school }) : t('spell.levelOf', { level: ordinal(spell.level), school });
  return base + (spell.is_ritual ? t('spell.ritual') : '');
}

const qty = (n, unit) => (n > 0 ? `${n} ${unit}` : unit);

// Os campos *_text guardam o texto como está no livro; os demais servem aos filtros.
const castingTimeText = (s) =>
  s.casting_time_text ??
  qty(s.casting_time, s.casting_time_unit) + (s.casting_conditions ? `, ${s.casting_conditions}` : '');
const rangeText = (s) => s.range_text ?? qty(s.range, s.range_unit);
const durationText = (s) =>
  s.duration_text ?? (s.does_need_concentration ? t('spell.concentrationUpTo') : '') + qty(s.duration, s.duration_unit);

function componentsText(s) {
  if (s.components_text) return s.components_text;
  const parts = [];
  if (s.does_have_verbal_component) parts.push('V');
  if (s.does_have_somatic_component) parts.push('S');
  if (s.material_component) {
    let m = s.material_component;
    if (s.material_component_cost) m += t('spell.materialCost', { cost: s.material_component_cost });
    if (s.is_material_component_consumed) m += t('spell.materialConsumed');
    parts.push(`M (${m})`);
  }
  return parts.join(' ');
}

export function sourcesHtml(R, rels) {
  const items = (rels ?? []).map((r) => {
    const src = R.sourceByAbbr.get(r.source_abbreviation);
    return html`<em>${titleCase(src ? src.name : r.source_abbreviation)}</em
      >${r.page ? ` ${t('common.page')} ${r.page}` : ''}`;
  });
  return html`<strong>${titleCase(t('common.sources'))}</strong>: ${raw(items.join(', '))}`;
}

function castersHtml(R, spell, link) {
  const casters = spellCasters(R, spell);
  if (!casters.length) return '—';
  return casters
    .map((c) =>
      link && c.slug ? html`<a href="${href.klass(c.slug)}">${titleCase(c.name)}</a>` : html`${titleCase(c.name)}`,
    )
    .join(', ');
}

export function spellCardHtml(R, spell, { linkName = true, showName = true, linkKlasses = true } = {}) {
  const title = titleCase(spell.name);
  const original =
    spell.original_name && spell.original_name !== spell.name
      ? html` <small>(${titleCase(spell.original_name, 'en')})</small>`
      : '';
  const nameHtml = linkName ? html`<a href="${href.spell(spell.slug)}">${title}</a>` : html`${title}`;
  return html` <article class="panel spell-card">
    <header class="panel-heading">
      ${showName ? raw(html`<h3 class="spell-name">${raw(nameHtml)}${raw(original)}</h3>`) : ''}
      <p class="spell-level"><em>${spellLevelLine(spell)}</em></p>
      <p class="spell-casters">
        <strong>${titleCase(t('spell.casters'))}</strong>: ${raw(castersHtml(R, spell, linkKlasses))}
      </p>
    </header>
    <div class="panel-body">
      <p><strong>${titleCase(t('spell.castingTime'))}</strong>: ${castingTimeText(spell)}</p>
      <p><strong>${titleCase(t('spell.range'))}</strong>: ${rangeText(spell)}</p>
      <p><strong>${titleCase(t('spell.components'))}</strong>: ${componentsText(spell)}</p>
      <p><strong>${titleCase(t('spell.duration'))}</strong>: ${durationText(spell)}</p>
      <div class="spell-description">${raw(spell.description)}</div>
    </div>
    <footer class="panel-footer">${raw(sourcesHtml(R, spell.sources_rels))}</footer>
  </article>`;
}
