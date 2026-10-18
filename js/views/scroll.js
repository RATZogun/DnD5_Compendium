import { html, setTitle, enhanceStatblocks } from '../util.js';
import { t } from '../i18n.js';
import { createFilterPanel } from '../components/filters.js';
import { spellCardHtml } from '../components/spellCard.js';
import { SPELL_DEFAULTS, spellFilterFields, filterSpells } from '../spellFilter.js';

const COLLAPSED = new Set(['levelMin', 'spellSchoolName', 'klassName', 'specializationName', 'sourceAbbreviation']);
const INITIAL = { levelMin: 1, levelMax: 9 };

export function render(container, { R }) {
  setTitle(t('scroll.pageTitle'));
  let filtered = [];
  let spell = null;

  container.innerHTML = html` <h1>${t('scroll.title')}</h1>
    <div id="scroll-filters"></div>
    <div id="scroll-result" aria-live="polite">
      <div class="alert" role="status" hidden>${t('spells.empty')}</div>
      <button type="button" class="btn btn-primary randomize-btn" hidden>${t('scroll.generate')}</button>
      <div class="scroll-spell"></div>
    </div>`;
  const result = container.querySelector('#scroll-result');
  const alert = result.querySelector('.alert');
  const btn = result.querySelector('.randomize-btn');
  const card = result.querySelector('.scroll-spell');

  const fields = spellFilterFields(R)
    .filter((f) => f.key !== 'name')
    .map((f) => (COLLAPSED.has(f.key ?? f.keys[0]) ? f : { ...f, extra: true }));

  createFilterPanel(container.querySelector('#scroll-filters'), {
    fields,
    defaults: SPELL_DEFAULTS,
    state: INITIAL,
    open: true,
    showMoreToggle: true,
    onChange: (st) => {
      filtered = filterSpells(R, st);
      generate();
    },
  });

  btn.addEventListener('click', generate);

  // Evita sortear a mesma magia duas vezes seguidas quando há mais de uma opção.
  function generate() {
    const pool = filtered.length > 1 && spell ? filtered.filter((s) => s !== spell) : filtered;
    spell = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    alert.hidden = Boolean(spell);
    btn.hidden = !spell;
    card.innerHTML = spell ? spellCardHtml(R, spell) : '';
    enhanceStatblocks(card);
  }

  filtered = filterSpells(R, { ...SPELL_DEFAULTS, ...INITIAL });
  generate();
}
