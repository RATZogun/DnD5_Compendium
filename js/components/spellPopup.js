import { html, raw, titleCase } from '../util.js';
import { t, ordinal } from '../i18n.js';
import { sourcesHtml, castingTimeText, rangeText, durationText } from './spellCard.js';

// Ficha resumida da magia ao passar o mouse nos links de magia das páginas de classes e espécies.
const PAGES = /^#\/(classes|especies|racas)\b/;
const GAP = 8;
const MARGIN = 16;

const short = (s) => (s ?? '').split(/,|\(/)[0].trim();

function componentsShort(s) {
  const parts = [];
  if (s.does_have_verbal_component) parts.push('V');
  if (s.does_have_somatic_component) parts.push('S');
  if (s.material_component) parts.push('M *');
  return parts.join(', ') || '—';
}

function attackSave(R, s) {
  if (s.attack && !/^(nenhum|none)$/i.test(s.attack)) {
    return /dist[âa]ncia|ranged/i.test(s.attack) ? t('popup.ranged') : t('popup.melee');
  }
  if (s.saving_throw && !/^(nenhum|none)$/i.test(s.saving_throw)) {
    const ab = R.abilities.find((a) => a.name === s.saving_throw || a.original_name === s.saving_throw);
    return t('popup.save', { ability: (ab?.abbreviation ?? s.saving_throw.slice(0, 3)).toUpperCase() });
  }
  return t('popup.none');
}

function effect(s) {
  if (s.damage_type) return titleCase(s.damage_type);
  if (s.heal) return t('popup.heal');
  return '';
}

// grade de propriedades da magia, usada no popup e na página da magia (full: textos completos)
export function spellMetaGridHtml(R, s, { full = false } = {}) {
  const cell = (label, value) =>
    html`<div class="sp-cell">
      <div class="sp-label">${label}</div>
      <div class="sp-value">${value}</div>
    </div>`;
  const fit = (v) => (full ? v : short(v));
  const level = s.level === 0 ? t('popup.cantrip') : ordinal(s.level);
  return html`<div class="sp-grid">
    ${raw(cell(t('popup.level'), level))} ${raw(cell(t('popup.castingTime'), fit(castingTimeText(s))))}
    ${raw(cell(t('popup.range'), fit(rangeText(s))))} ${raw(cell(t('popup.components'), componentsShort(s)))}
    ${raw(cell(t('popup.duration'), durationText(s)))} ${raw(cell(t('popup.school'), titleCase(s.spell_school_name)))}
    ${raw(cell(t('popup.attackSave'), attackSave(R, s)))} ${raw(cell(t('popup.effect'), effect(s)))}
  </div>`;
}

export const materialNoteHtml = (s) =>
  s.material_component ? html`<p class="sp-material">* – (${s.material_component})</p>` : '';

function popupHtml(R, s) {
  return html`<header class="sp-head">
      <div>
        <div class="sp-name">${titleCase(s.name)}</div>
        <div class="sp-source">${raw(sourcesHtml(R, s.sources_rels.slice(0, 1)).replace(/^<strong>.*?<\/strong>: /, ''))}</div>
      </div>
      <span class="sp-badge">${t('popup.badge')}</span>
    </header>
    ${raw(spellMetaGridHtml(R, s))}
    <div class="sp-body">${raw(s.description)}${raw(materialNoteHtml(s))}</div>`;
}

export function initSpellPopup(getR) {
  if (!window.matchMedia('(hover: hover)').matches) return;
  const box = document.createElement('div');
  box.className = 'spell-popup';
  box.setAttribute('role', 'tooltip');
  box.hidden = true;
  document.body.append(box);
  let hideTimer = null;
  let current = null;

  const hide = () => {
    box.hidden = true;
    current = null;
  };
  const scheduleHide = () => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, 150);
  };

  function place(link) {
    const r = link.getBoundingClientRect();
    const w = box.offsetWidth;
    const h = box.offsetHeight;
    const left = Math.min(Math.max(MARGIN, r.left), window.innerWidth - w - MARGIN);
    const below = r.bottom + GAP + h <= window.innerHeight - MARGIN || r.top < h + GAP + MARGIN;
    const top = below ? r.bottom + GAP : r.top - GAP - h;
    box.style.left = `${Math.max(MARGIN, left)}px`;
    box.style.top = `${Math.max(MARGIN, top)}px`;
  }

  function show(link) {
    const R = getR();
    const slug = decodeURIComponent(link.getAttribute('href').split('/').pop());
    const spell = R?.spellBySlug.get(slug);
    if (!spell) return;
    clearTimeout(hideTimer);
    if (current !== link) {
      box.innerHTML = popupHtml(R, spell);
      box.scrollTop = 0;
      current = link;
    }
    box.hidden = false;
    place(link);
  }

  const spellLink = (el) =>
    PAGES.test(location.hash) ? el.closest?.('main a[href^="#/magias/"]:not(.back-link)') : null;

  document.addEventListener('mouseover', (e) => {
    if (box.contains(e.target)) return clearTimeout(hideTimer);
    const link = spellLink(e.target);
    if (link) show(link);
  });
  document.addEventListener('mouseout', (e) => {
    if (spellLink(e.target) || box.contains(e.target)) scheduleHide();
  });
  document.addEventListener('focusin', (e) => {
    const link = spellLink(e.target);
    if (link) show(link);
    else if (!box.contains(e.target)) hide();
  });
  window.addEventListener('hashchange', hide);
  window.addEventListener('scroll', () => current && !box.matches(':hover') && hide(), { passive: true });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && hide());
}
