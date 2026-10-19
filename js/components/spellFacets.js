// Filtros laterais de magias (lista de magias e gerador de pergaminho): busca por nome, grupos recolhíveis com
// contagens, "possui" e a barra com o total e os filtros ativos. Em cada grupo vale qualquer opção marcada.
import { html, raw, titleCase } from '../util.js';
import { t } from '../i18n.js';
import {
  filterSpells,
  filterValues,
  spellFacetGroups,
  spellFlags,
  spellFilterChips,
  casterKlasses,
  casterSubclasses,
  casterTest,
} from '../spellFilter.js';
import { icon } from '../icons.js';

const LIST_KEYS = (R) => [...spellFacetGroups(R).map((g) => g.key), 'klassName', 'specializationName'];

// grupos de opções viram listas de texto (o estado vem da URL como "a,b")
export function normalizeSpellState(R, st) {
  for (const key of LIST_KEYS(R)) st[key] = filterValues(st[key]).map(String);
  st.name = st.name ?? '';
  return st;
}

// esqueleto: barra lateral e coluna principal (a barra de resultados e o conteúdo vêm depois)
export function facetsLayoutHtml(main) {
  return html`<div class="list-layout">
    <aside class="facets">
      <button type="button" class="facets-toggle" aria-expanded="false">${titleCase(t('filters.title'))}</button>
      <div class="facets-body"></div>
    </aside>
    <section class="list-main">
      <div class="list-bar"></div>
      ${raw(main)}
    </section>
  </div>`;
}

function optionHtml(group, value, label, count, checked) {
  return html`<label class="facet-option">
    <input type="checkbox" data-group="${group}" value="${value}" ${checked ? 'checked' : ''} />
    <span class="facet-label">${label}</span>
    <span class="facet-count">${count}</span>
  </label>`;
}

// liga os filtros ao estado st; barStart/barEnd montam o começo (total) e o fim (ordenação, botão) da barra.
// onChange roda depois de cada mudança, com a lista já filtrada. only limita os grupos mostrados (chaves dos
// grupos, 'klassName' para classe e subclasse, 'flags' para "possui" e 'name' para a busca).
export function initSpellFacets(container, { R, st, barStart, barEnd = () => '', onChange, only = null }) {
  const show = (key) => !only || only.includes(key);
  const groups = spellFacetGroups(R);
  const flags = spellFlags();
  // a página abre com todos os grupos fechados (o número ao lado do título mostra o que está marcado)
  const open = new Set();
  const facets = container.querySelector('.facets-body');
  const bar = container.querySelector('.list-bar');
  const toggle = container.querySelector('.facets-toggle');
  toggle.addEventListener('click', () => {
    const opened = container.querySelector('.facets').classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(opened));
  });

  // subclasses só valem com a classe delas marcada
  const dropOrphanSubclasses = () => {
    st.specializationName = st.specializationName.filter((sp) =>
      R.specializations.some((x) => x.name === sp && st.klassName.includes(x.klass_name)),
    );
  };
  // contagem de uma opção: todos os filtros menos o do próprio grupo
  const without = (key) => filterSpells(R, { ...st, [key]: Array.isArray(st[key]) ? [] : null });

  function drawFacets() {
    // classe e subclasse: a contagem é o total de magias de cada uma com os demais filtros
    const noCaster = filterSpells(R, { ...st, klassName: [], specializationName: [] });
    const klassGroup = {
      key: 'klassName',
      label: t('spellFilter.class'),
      base: noCaster,
      options: casterKlasses(R).map((k) => ({ value: k.name, label: titleCase(k.name) })),
      test: (s, v) => casterTest(R, v, null, st.raceName)(s),
    };
    const subs = st.klassName.flatMap((k) => casterSubclasses(R, k).map((sp) => ({ ...sp, klass: k })));
    const subGroup = subs.length
      ? {
          key: 'specializationName',
          label: t('spellFilter.specialization'),
          base: noCaster,
          options: subs.map((sp) => ({ value: sp.name, label: titleCase(sp.name) })),
          test: (s, v) => casterTest(R, subs.find((x) => x.name === v).klass, v, st.raceName)(s),
        }
      : null;
    const groupHtml = (g) => {
      const base = g.base ?? without(g.key);
      const options = g.options
        .map((o) => ({ ...o, count: base.filter((s) => g.test(s, o.value)).length }))
        .filter((o) => o.count || st[g.key].includes(String(o.value)));
      if (!options.length) return '';
      return html`<details class="facet" data-key="${g.key}" ${open.has(g.key) ? 'open' : ''}>
        <summary>${g.label}${st[g.key].length ? raw(html` <span class="facet-on">${st[g.key].length}</span>`) : ''}</summary>
        ${options.map((o) => raw(optionHtml(g.key, o.value, o.label, o.count, st[g.key].includes(String(o.value)))))}
      </details>`;
    };
    const flagBase = filterSpells(R, st);
    const flagsOn = flags.filter((f) => st[f.key] != null).length;
    const shown = (g) => (show(g.key) ? groupHtml(g) : '');
    facets.innerHTML = html`${
      show('name')
        ? raw(
            html`<label class="facet-search">
                ${raw(icon.search(16))}
                <input type="search" value="${st.name}" placeholder="${t('list.filterName')}" aria-label="${t('common.name')}" />
              </label>`,
          )
        : ''
    }
      ${raw(shown(groups[0]))} ${raw(shown(groups[1]))}
      ${show('klassName') ? raw(groupHtml(klassGroup) + (subGroup ? groupHtml(subGroup) : '')) : ''}
      ${
        show('flags')
          ? raw(
              html`<details class="facet" data-key="flags" ${open.has('flags') ? 'open' : ''}>
                <summary>${t('list.has')}${flagsOn ? raw(html` <span class="facet-on">${flagsOn}</span>`) : ''}</summary>
                ${flags.map((f) => {
                  const count = (st[f.key] === true ? flagBase : filterSpells(R, { ...st, [f.key]: null })).filter(
                    f.test,
                  ).length;
                  return raw(optionHtml('flag', f.key, f.label, count, st[f.key] === true));
                })}
              </details>`,
            )
          : ''
      }
      ${groups.slice(2).map((g) => raw(shown(g)))}
      <button type="button" class="link-btn facet-clear">${t('list.clear')}</button>`;
  }

  function drawBar(list) {
    bar.innerHTML = html`<strong class="list-count">${barStart(list)}</strong>
      ${spellFilterChips(R, st).map((c) =>
        raw(
          html`<button type="button" class="active-chip" data-key="${c.key}" value="${c.value ?? ''}" aria-label="${t('list.removeFilter', { name: c.label })}">${c.label} <span aria-hidden="true">✕</span></button>`,
        ),
      )}
      ${raw(barEnd(list))}`;
  }

  // redesenha a barra lateral e a de resultados e avisa a página
  function update({ facetsToo = true } = {}) {
    const list = filterSpells(R, st);
    if (facetsToo) drawFacets();
    drawBar(list);
    onChange(list);
  }

  facets.addEventListener(
    'toggle',
    (e) => {
      const d = e.target.closest?.('details[data-key]');
      if (d) (d.open ? open.add : open.delete).call(open, d.dataset.key);
    },
    true,
  );
  facets.addEventListener('change', (e) => {
    const box = e.target.closest('input[type="checkbox"]');
    if (!box) return;
    if (box.dataset.group === 'flag') {
      st[box.value] = box.checked ? true : null;
      if (box.value === 'hasMaterialComponent' && !box.checked) st.isMaterialConsumed = null;
    } else {
      const list = st[box.dataset.group];
      if (box.checked) list.push(box.value);
      else list.splice(list.indexOf(box.value), 1);
      if (box.dataset.group === 'klassName') dropOrphanSubclasses();
    }
    update();
  });
  let typing;
  facets.addEventListener('input', (e) => {
    if (e.target.type !== 'search') return;
    clearTimeout(typing);
    typing = setTimeout(() => {
      st.name = e.target.value;
      // atualiza as contagens sem perder o campo que está sendo digitado
      const pos = e.target.selectionStart;
      update();
      const again = facets.querySelector('.facet-search input');
      again.focus();
      again.setSelectionRange(pos, pos);
    }, 150);
  });
  facets.addEventListener('click', (e) => {
    if (!e.target.closest('.facet-clear')) return;
    for (const k of Object.keys(st)) st[k] = Array.isArray(st[k]) ? [] : k === 'name' ? '' : null;
    update();
  });
  bar.addEventListener('click', (e) => {
    const chip = e.target.closest('.active-chip');
    if (!chip) return;
    const { key } = chip.dataset;
    if (Array.isArray(st[key])) st[key].splice(st[key].indexOf(chip.value), 1);
    else if (key === 'levelRange') st.levelMin = st.levelMax = null;
    else st[key] = key === 'name' ? '' : null;
    if (key === 'klassName') dropOrphanSubclasses();
    update();
  });

  return { update };
}
