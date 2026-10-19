import { html, raw, setTitle, titleCase } from '../util.js';
import { t } from '../i18n.js';
import { href } from '../router.js';
import { icon } from '../icons.js';
import { categoryCard } from './home.js';
import { renderOptions } from './options.js';

// regras: um cartão por seção (resumo de regras, talentos, opções e recursos, antecedentes), cada uma com a sua
// página; o conteúdo entra depois
const SECTIONS = {
  resumo: { key: 'summary', icon: () => icon.scroll(48), kind: 'rules' },
  talentos: { key: 'feats', icon: () => icon.medal(48), kind: 'feats' },
  opcoes: { key: 'options', icon: () => icon.sliders(48), kind: 'options', render: renderOptions },
  antecedentes: { key: 'backgrounds', icon: () => icon.backpack(48), kind: 'backgrounds' },
};

function header(trail, title, chip) {
  return html`<nav class="crumbs" aria-label="breadcrumb">
      <a href="#/">${t('nav.home')}</a> ›
      ${trail.map(([h, label]) => raw(html`<a href="${h}">${label}</a> › `))}<span>${title}</span>
    </nav>
    <header class="list-head">
      <span class="chip chip-rules">${chip}</span>
      <h1>${title}</h1>
    </header>
    <div class="ornament" aria-hidden="true"><span></span><i></i><span></span></div>`;
}

function soonHtml(iconHtml) {
  return html`<section class="rules-empty">
    <span class="rules-empty-icon">${raw(iconHtml)}</span>
    <h2>${t('rules.soonTitle')}</h2>
    <p>${t('rules.soonText')}</p>
  </section>`;
}

export function render(container, { R, params, query }) {
  const title = titleCase(t('rules.title'));
  const section = SECTIONS[params.section];
  if (section) {
    const name = t(`rules.${section.key}.title`);
    setTitle(name, t('rules.title'));
    const top = header([[href.rules(), title]], name, title);
    if (section.render) return section.render(container, { R, query, header: top });
    container.innerHTML = html`${raw(top)} ${raw(soonHtml(section.icon()))}`;
    return;
  }
  setTitle(t('rules.title'));
  container.innerHTML = html`${raw(header([], title, t('list.category')))}
    <div class="home-cards rules-cards">
      ${Object.entries(SECTIONS).map(([slug, s]) =>
        raw(
          categoryCard({
            kind: s.kind,
            iconHtml: s.icon(),
            count: t('rules.soonTitle'),
            title: t(`rules.${s.key}.title`),
            text: t(`rules.${s.key}.text`),
            link: href.rules(slug),
            cta: t(`rules.${s.key}.cta`),
          }),
        ),
      )}
    </div>`;
}
