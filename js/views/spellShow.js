import { html, raw, setTitle, titleCase, wrapDoc } from '../util.js';
import { t } from '../i18n.js';
import { href } from '../router.js';
import {
  spellLevelLine,
  sourcesHtml,
  castersHtml,
  castingTimeText,
  rangeText,
  componentsText,
  durationText,
} from '../components/spellCard.js';

export function render(container, { R, params }) {
  const spell = R.spellBySlug.get(params.slug);
  const back = html`<a class="back-link" href="${href.spells()}">${t('spells.back')}</a>`;
  if (!spell) {
    setTitle(t('spells.notFound'), t('spells.title'));
    container.innerHTML = html`${raw(back)}
      <div class="alert" role="alert">${t('spells.notFound')}</div>`;
    return;
  }
  setTitle(titleCase(spell.name), t('spells.title'));
  const original =
    spell.original_name && spell.original_name !== spell.name
      ? html` <small>(${titleCase(spell.original_name, 'en')})</small>`
      : '';
  container.innerHTML = html` <h1>${titleCase(spell.name)}${raw(original)}</h1>
    <p class="text-muted">${raw(sourcesHtml(R, spell.sources_rels))}</p>
    <p class="spell-level"><em>${spellLevelLine(spell)}</em></p>
    <div class="spell-props">
      <p><strong>${titleCase(t('spell.castingTime'))}</strong>: ${castingTimeText(spell)}</p>
      <p><strong>${titleCase(t('spell.range'))}</strong>: ${rangeText(spell)}</p>
      <p><strong>${titleCase(t('spell.components'))}</strong>: ${componentsText(spell)}</p>
      <p><strong>${titleCase(t('spell.duration'))}</strong>: ${durationText(spell)}</p>
    </div>
    <div class="spell-description">${raw(spell.description)}</div>
    <p class="doc-facts">
      <strong>${titleCase(t('spell.casters'))}</strong>: ${raw(castersHtml(R, spell, true))}
    </p>
    ${raw(back)}`;
  wrapDoc(container);
}
