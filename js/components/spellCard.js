import { html, raw, titleCase } from '../util.js';
import { t } from '../i18n.js';
import { spellCasters } from '../data.js';
import { href } from '../router.js';
import { spellSheetHtml } from './spellPopup.js';

const qty = (n, unit) => (n > 0 ? `${n} ${unit}` : unit);

// Os campos *_text guardam o texto como está no livro; os demais servem aos filtros.
export const castingTimeText = (s) =>
  s.casting_time_text ??
  qty(s.casting_time, s.casting_time_unit) + (s.casting_conditions ? `, ${s.casting_conditions}` : '');
export const rangeText = (s) => s.range_text ?? qty(s.range, s.range_unit);
export const durationText = (s) =>
  s.duration_text ?? (s.does_need_concentration ? t('spell.concentrationUpTo') : '') + qty(s.duration, s.duration_unit);

export function componentsText(s) {
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

export function castersHtml(R, spell, link) {
  const casters = spellCasters(R, spell);
  if (!casters.length) return '—';
  return casters
    .map((c) =>
      link && c.slug ? html`<a href="${href.klass(c.slug)}">${titleCase(c.name)}</a>` : html`${titleCase(c.name)}`,
    )
    .join(', ');
}

// card da lista de magias: a mesma ficha do popup, com os conjuradores no rodapé
export function spellCardHtml(R, spell) {
  return html`<article class="spell-sheet">
    ${raw(
      spellSheetHtml(R, spell, {
        link: true,
        footer: html`<footer class="sp-foot">
          <strong>${titleCase(t('spell.casters'))}</strong>: ${raw(castersHtml(R, spell, true))}
        </footer>`,
      }),
    )}
  </article>`;
}
