import { html, raw, setTitle } from '../util.js';
import { t } from '../i18n.js';

// créditos completos (o rodapé mostra só a tradução, a inspiração e um link para cá); a lista obra a obra, com a
// licença de cada ícone e retrato, fica no README
const link = (url, text) => html`<a href="${url}" target="_blank" rel="noopener">${text}</a>`;
const links = (pairs) => pairs.map(([url, text]) => link(url, text)).join(', ');

const CREDITS = [
  ['footer.translationCredit', () => link('https://bibliotecaelfica.org/', 'bibliotecaelfica.org')],
  [
    'footer.inspired',
    () => link('https://web.archive.org/web/2022/https://dnd5spells.rpgist.net/', 'dnd5spells.rpgist.net'),
  ],
  ['footer.iconsCredit', () => link('https://dribbble.com/jimemosqueda', 'Jime Mosqueda')],
  [
    'footer.gameIconsCredit',
    () =>
      html`Lorc, Delapouite, Skoll, Cathelineau, Kier Heyl, Sparker, Sbed, DarkZaitzev, Willdabeast
      (${raw(link('https://game-icons.net/', 'game-icons.net'))},
      ${raw(link('https://creativecommons.org/licenses/by/3.0/', 'CC BY 3.0'))})`,
  ],
  [
    'footer.portraitsCredit',
    () =>
      links([
        ['https://www.patreon.com/morvoldpress', 'HIIDRA Studios (Morvold Press)'],
        ['https://wangdaye.artstation.com', 'wangdaye'],
        ['https://www.artstation.com/alew', 'alew'],
        ['https://yanavaseva.tumblr.com', 'yanavaseva'],
        ['https://avocadraw9.artstation.com', 'avocadraw9'],
        ['https://ryuutsu.artstation.com', 'ryuutsu'],
        ['https://deoxy_diamond.artstation.com', 'Deoxy Diamond'],
        ['https://www.artstation.com/boissb', 'boissb'],
      ]),
  ],
  [
    'footer.quickrefCredit',
    () =>
      html`${raw(link('https://github.com/crobi/dnd5e-quickref', 'dnd5e-quickref'))} (crobi,
      ${raw(link('https://github.com/diogoan/dnd5e-quickref', 'diogoan'))}, crdornelles; MIT)`,
  ],
  [
    'credits.fonts',
    () =>
      html`Cinzel, Fraunces, Inter, Literata
      (${raw(link('https://openfontlicense.org/', 'SIL OFL 1.1'))})`,
  ],
];

export function render(container) {
  const title = t('credits.title');
  setTitle(title);
  container.innerHTML = html`<nav class="crumbs" aria-label="breadcrumb">
      <a href="#/">${t('nav.home')}</a> › <span>${title}</span>
    </nav>
    <header class="list-head">
      <span class="chip chip-rules">${t('credits.chip')}</span>
      <h1>${title}</h1>
    </header>
    <div class="ornament" aria-hidden="true"><span></span><i></i><span></span></div>
    <dl class="credits-list">
      ${CREDITS.map(([key, value]) => raw(html`<div><dt>${t(key).replace(/:$/, '')}</dt><dd>${raw(value())}</dd></div>`))}
    </dl>
    <p class="credits-more">
      ${t('credits.readme')}
      ${raw(link('https://github.com/RATZogun/DnD5_Compendium#créditos', t('credits.readmeLink')))}.
    </p>`;
}
