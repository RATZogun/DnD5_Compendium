import { html, raw, setTitle, titleCase } from '../util.js';
import { t } from '../i18n.js';
import { href } from '../router.js';
import { spellCardHtml } from '../components/spellCard.js';

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
    ${raw(spellCardHtml(R, spell, { showName: false, linkName: false }))} ${raw(back)}`;
}
