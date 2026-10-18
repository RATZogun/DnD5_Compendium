// Contrato das views: render(container, { R, params, query }).
import { loadRules } from './data.js';
import { route, resolve } from './router.js';
import { parseQuery, setTitle, escapeHtml } from './util.js';
import { t, getLang, setLang, htmlLang } from './i18n.js';
import * as spells from './views/spells.js';
import * as spellShow from './views/spellShow.js';
import * as klasses from './views/klasses.js';
import * as klassShow from './views/klassShow.js';
import * as subclassShow from './views/subclassShow.js';
import * as races from './views/races.js';
import * as raceShow from './views/raceShow.js';
import * as scroll from './views/scroll.js';
import { initSpellPopup } from './components/spellPopup.js';

route('/magias', 'spells', spells);
route('/magias/:slug', 'spells', spellShow);
route('/classes', 'klasses', klasses);
route('/classes/:slug', 'klasses', klassShow);
route('/classes/:slug/:sub', 'klasses', subclassShow);
route('/especies', 'races', races);
route('/especies/:slug', 'races', raceShow);
route('/racas', 'races', races); // links antigos
route('/racas/:slug', 'races', raceShow);
route('/pergaminho', 'scroll', scroll);

const app = document.getElementById('app');
const navbar = document.querySelector('.navbar');
const themeBtn = navbar.querySelector('.theme-toggle');
const langBtn = navbar.querySelector('.lang-toggle');
const menuBtn = navbar.querySelector('.nav-toggle');

const ICONS = {
  sun: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><g stroke="currentColor" stroke-width="2"><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/></g></svg>',
  moon: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="currentColor"/></svg>',
  br: '<svg viewBox="0 0 28 20" width="28" height="20" aria-hidden="true"><rect width="28" height="20" fill="#009c3b"/><path d="M14 2.5 25.5 10 14 17.5 2.5 10z" fill="#ffdf00"/><circle cx="14" cy="10" r="4.4" fill="#002776"/><path d="M9.8 9.1c2.9-.5 5.9.1 8.3 1.7" stroke="#fff" stroke-width=".8" fill="none"/></svg>',
  us:
    '<svg viewBox="0 0 28 20" width="28" height="20" aria-hidden="true"><rect width="28" height="20" fill="#fff"/><g fill="#b22234">' +
    [0, 2, 4, 6, 8, 10, 12].map((i) => `<rect y="${(i * 20) / 13}" width="28" height="${20 / 13}"/>`).join('') +
    '</g><rect width="12" height="10.77" fill="#3c3b6e"/></svg>',
};

const getTheme = () => document.documentElement.dataset.theme;

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem('theme', theme);
  } catch {
    /* storage bloqueado */
  }
  updateChrome();
}

// O botão mostra o destino: a bandeira do outro idioma e o ícone do outro tema.
function updateChrome() {
  document.documentElement.lang = htmlLang();
  navbar.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('.site-footer [data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelector('meta[name="description"]').content = t('site.description');

  const dark = getTheme() === 'dark';
  themeBtn.innerHTML = dark ? ICONS.sun : ICONS.moon;
  themeBtn.setAttribute('aria-label', t(dark ? 'theme.toLight' : 'theme.toDark'));
  themeBtn.title = themeBtn.getAttribute('aria-label');

  langBtn.innerHTML = getLang() === 'pt' ? ICONS.br : ICONS.us;
  langBtn.setAttribute('aria-label', t('lang.switch'));
  langBtn.title = t('lang.switch');

  menuBtn.setAttribute('aria-label', t('nav.menu'));
}

themeBtn.addEventListener('click', () => applyTheme(getTheme() === 'dark' ? 'light' : 'dark'));
langBtn.addEventListener('click', () => {
  setLang(getLang() === 'pt' ? 'en' : 'pt');
  updateChrome();
  render();
});
menuBtn.addEventListener('click', () => {
  const open = navbar.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', String(open));
});

let lastPath = null;
let currentR = null;

async function render() {
  const match = resolve();
  if (!match) {
    location.replace('#/magias');
    return;
  }

  navbar.classList.remove('open');
  menuBtn.setAttribute('aria-expanded', 'false');
  navbar.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === match.nav));

  app.innerHTML = `<div class="loader" role="status" aria-label="${escapeHtml(t('common.loading'))}"></div>`;
  const lang = getLang();
  let R;
  try {
    R = await loadRules(lang);
  } catch (err) {
    console.error(err);
    setTitle();
    app.innerHTML = `<div class="alert" role="alert">${escapeHtml(t('common.loadError'))}
      <button type="button" class="btn btn-default" id="retry">${escapeHtml(t('common.retry'))}</button></div>`;
    app.querySelector('#retry').addEventListener('click', render);
    return;
  }
  if (lang !== getLang()) return;
  currentR = R;

  const path = match.re.source + JSON.stringify(match.params);
  match.view.render(app, { R, params: match.params, query: parseQuery(match.search) });
  if (path !== lastPath) window.scrollTo(0, 0);
  lastPath = path;
}

updateChrome();
initSpellPopup(() => currentR);
window.addEventListener('hashchange', render);
render();
