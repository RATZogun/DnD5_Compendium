import { html, raw, titleCase, setTitle } from '../util.js';
import { t, ordinal, getLang } from '../i18n.js';
import { href } from '../router.js';
import { loadSpecies } from '../data.js';
import { pick, sourceLine, bookName } from './klassShow.js';
import { speedText, sizeText } from './races.js';

function traitsHtml(traits) {
  return (traits ?? [])
    .map(
      (tr) =>
        html` <section class="feature" id="${tr.key}">
          <h3>${titleCase(pick(tr.name))}</h3>
          <div class="feature-body">${raw(pick(tr.html))}</div>
        </section>`,
    )
    .join('');
}

function spellsHtml(R, spells) {
  if (!spells?.length) return '';
  const lang = getLang();
  const link = (namePt, nameEn) => {
    const spell = R.spells.find(
      (s) =>
        s.original_name?.toLowerCase() === nameEn?.toLowerCase() ||
        s.name.toLowerCase() === (lang === 'pt' ? namePt : nameEn)?.toLowerCase(),
    );
    const label = titleCase(spell ? spell.name : lang === 'pt' ? (namePt ?? nameEn) : (nameEn ?? namePt));
    return spell ? html`<a href="${href.spell(spell.slug)}">${label}</a>` : html`${label}`;
  };
  return html` <h3>${titleCase(t('races.innateSpells'))}</h3>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th class="num">${titleCase(t('common.level'))}</th>
            <th>${titleCase(t('races.spell'))}</th>
            <th>${titleCase(t('races.regularity'))}</th>
          </tr>
        </thead>
        <tbody>
          ${spells.map((s) =>
            raw(
              html`<tr>
                <td class="num">${s.level ? ordinal(s.level) : '–'}</td>
                <td>
                  ${raw((s.names_en ?? s.names_pt ?? []).map((n, i) => link(s.names_pt?.[i], s.names_en?.[i])).join(', '))}
                </td>
                <td>${pick(s.regularity) || '–'}</td>
              </tr>`,
            ),
          )}
        </tbody>
      </table>
    </div>`;
}

function versionHtml(R, data, v) {
  const intro = pick(v.intro_html);
  return html` <p class="text-muted">
      ${raw(sourceLine(R, v.source, v.additional_sources ?? data.additional_sources))}
    </p>
    <div class="panel">
      <div class="panel-body">
        <p>
          <strong>${titleCase(t('races.size'))}</strong>: ${sizeText(data.size)} ·
          <strong>${titleCase(t('races.speed'))}</strong>: ${speedText(data.speed)}
        </p>
      </div>
    </div>
    ${
      intro
        ? raw(
            html`<details class="panel intro">
              <summary class="panel-heading">${titleCase(t('classes.description'))}</summary>
              <div class="panel-body">${raw(intro)}</div>
            </details>`,
          )
        : ''
    }
    <h2>${titleCase(t('races.traits'))}</h2>
    <div class="features">${raw(traitsHtml(v.traits))}</div>
    ${raw(spellsHtml(R, v.spells))}
    ${
      v.subraces?.length
        ? raw(
            html`<h2>${titleCase(t('races.subraces'))}</h2>
              ${v.subraces.map((s) =>
                raw(
                  html` <section class="panel subrace" id="${s.slug}">
                    <header class="panel-heading">
                      <h3>${titleCase(pick(s.name))}</h3>
                      <span class="text-muted">${raw(sourceLine(R, s.source))}</span>
                    </header>
                    <div class="panel-body">
                      ${raw(pick(s.intro_html))}${raw(traitsHtml(s.traits))}${raw(spellsHtml(R, s.spells))}
                    </div>
                  </section>`,
                ),
              )}`,
          )
        : ''
    }`;
}

export async function render(container, { R, params }) {
  const back = html`<a class="back-link" href="${href.races()}">${t('races.back')}</a>`;
  let data;
  try {
    data = await loadSpecies(params.slug);
  } catch {
    setTitle(t('races.notFound'), t('races.title'));
    container.innerHTML = html`${raw(back)}
      <div class="alert" role="alert">${t('races.notFound')}</div>`;
    return;
  }
  const name = titleCase(pick(data.name));
  setTitle(name, t('races.title'));
  const versions = data.versions?.length ? data.versions : [data];
  container.innerHTML = html` <h1>${name}</h1>
    ${
      versions.length > 1
        ? raw(
            html`<div class="alert" role="note">
              ${t('races.versionNote')}
              <div class="version-tabs">
                ${versions.map((v, i) => raw(html`<button type="button" class="btn" data-version="${i}" aria-pressed="${String(i === 0)}">${raw(bookName(R, v.source))}</button>`))}
              </div>
            </div>`,
          )
        : ''
    }
    <div class="version-body">${raw(versionHtml(R, data, versions[0]))}</div>
    ${raw(back)}`;
  container.querySelectorAll('[data-version]').forEach((b) =>
    b.addEventListener('click', () => {
      const i = Number(b.dataset.version);
      container
        .querySelectorAll('[data-version]')
        .forEach((x) => x.setAttribute('aria-pressed', String(Number(x.dataset.version) === i)));
      container.querySelector('.version-body').innerHTML = versionHtml(R, data, versions[i]);
    }),
  );
}
