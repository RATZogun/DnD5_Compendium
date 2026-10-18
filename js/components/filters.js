// Campo: { key | keys:[min,max], label, type: text|select|boolean|range, options?(state), visible?(state),
//          fieldset?, extra? (só com "mostrar mais"), onChange?(state) para ajustar campos dependentes }
import { html, raw, debounce, escapeHtml, compareText, titleCase } from '../util.js';
import { t } from '../i18n.js';

let uid = 0;

export function createFilterPanel(
  container,
  { fields, defaults, state, open = false, showMoreToggle = false, onChange, debounceMs = 150 },
) {
  const id = `f${++uid}`;
  const st = { ...defaults, ...state };
  let showMore = false;
  const emit = debounce(() => onChange({ ...st }), debounceMs);

  const fieldId = (key) => `${id}_${key}`;
  const toInput = (v) => (v === null || v === undefined ? '' : String(v));
  const fieldKey = (f) => f.key ?? f.keys[0];

  function control(f) {
    if (f.type === 'text') {
      return html`<input
        class="form-control"
        type="text"
        id="${fieldId(f.key)}"
        data-key="${f.key}"
        value="${toInput(st[f.key])}"
        autocomplete="off"
      />`;
    }
    if (f.type === 'range') {
      const [a, b] = f.keys;
      return html`<div class="range">
        <input
          class="form-control"
          type="number"
          id="${fieldId(a)}"
          data-key="${a}"
          min="${f.min}"
          max="${f.max}"
          value="${toInput(st[a])}"
          aria-label="${f.label} (${t('common.min')})"
        /><span>–</span
        ><input
          class="form-control"
          type="number"
          id="${fieldId(b)}"
          data-key="${b}"
          min="${f.min}"
          max="${f.max}"
          value="${toInput(st[b])}"
          aria-label="${f.label} (${t('common.max')})"
        />
      </div>`;
    }
    return html`<select class="form-control" id="${fieldId(f.key)}" data-key="${f.key}" data-type="${f.type}">
      ${raw(f.type === 'boolean' ? optionsHtml(f) : '')}
    </select>`;
  }

  function optionsHtml(f) {
    const opts =
      f.type === 'boolean'
        ? [
            { value: true, label: t('common.yes') },
            { value: false, label: t('common.no') },
          ]
        : f.options(st);
    return [
      `<option value="">${escapeHtml(t('common.any'))}</option>`,
      ...opts.map((o) => `<option value="${escapeHtml(String(o.value))}">${escapeHtml(o.label)}</option>`),
    ].join('');
  }

  function fieldHtml(f) {
    return html`<div class="form-group" data-field="${fieldKey(f)}">
      <label for="${fieldId(fieldKey(f))}">${titleCase(f.label)}</label>${raw(control(f))}
    </div>`;
  }

  function bodyHtml() {
    let out = '';
    let currentFs = null;
    for (const f of fields) {
      if (f.fieldset !== currentFs) {
        if (currentFs) out += '</fieldset>';
        if (f.fieldset) out += html`<fieldset><legend>${titleCase(f.fieldset)}</legend></fieldset>`;
        currentFs = f.fieldset ?? null;
      }
      out += fieldHtml(f);
    }
    if (currentFs) out += '</fieldset>';
    return out;
  }

  container.innerHTML = html` <section class="panel filters-panel${open ? ' open' : ''}">
    <button
      type="button"
      class="panel-heading filters-toggle"
      aria-expanded="${String(open)}"
      aria-controls="${id}_body"
    >
      <span class="icon-filter" aria-hidden="true"></span>${titleCase(t('filters.title'))}<span
        class="chevron"
        aria-hidden="true"
      ></span>
    </button>
    <form class="panel-body filters-body" id="${id}_body" autocomplete="off">
      ${showMoreToggle ? raw(html`<button type="button" class="btn btn-link show-more">${t('filters.showMore')}</button>`) : ''}
      <div class="filters-grid">${raw(bodyHtml())}</div>
      <div class="filters-actions"><button type="reset" class="btn btn-default">${t('filters.clean')}</button></div>
    </form>
  </section>`;

  const panel = container.querySelector('.filters-panel');
  const form = panel.querySelector('form');

  function refresh() {
    for (const f of fields) {
      const wrap = form.querySelector(`[data-field="${CSS.escape(fieldKey(f))}"]`);
      wrap.hidden = !((!f.visible || f.visible(st)) && (!f.extra || showMore));
      if (f.type === 'select') {
        const sel = wrap.querySelector('select');
        const next = optionsHtml(f);
        if (sel.dataset.opts !== next) {
          sel.innerHTML = next;
          sel.dataset.opts = next;
          const cur = toInput(st[f.key]);
          if (cur && ![...sel.options].some((o) => o.value === cur)) st[f.key] = null;
          sel.value = toInput(st[f.key]);
        }
      }
    }
    form.querySelectorAll('fieldset').forEach((fs) => {
      fs.hidden = [...fs.querySelectorAll('.form-group')].every((g) => g.hidden);
    });
    const more = form.querySelector('.show-more');
    if (more) more.textContent = t(showMore ? 'filters.showLess' : 'filters.showMore');
  }

  function syncInputs() {
    refresh();
    form.querySelectorAll('[data-key]').forEach((el) => {
      const v = toInput(st[el.dataset.key]);
      if (el.value !== v && document.activeElement !== el) el.value = v;
    });
  }

  function readInput(el) {
    const v = el.value;
    if (el.type === 'number') return v === '' ? null : Number(v);
    if (el.dataset.type === 'boolean') return v === '' ? null : v === 'true';
    if (el.tagName === 'SELECT') return v === '' ? null : v;
    return v;
  }

  form.addEventListener('input', (e) => {
    const key = e.target.dataset.key;
    if (!key) return;
    st[key] = readInput(e.target);
    fields.find((f) => f.key === key || f.keys?.includes(key))?.onChange?.(st);
    syncInputs();
    emit();
  });
  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('reset', (e) => {
    e.preventDefault();
    for (const k of Object.keys(st)) delete st[k];
    Object.assign(st, structuredClone(defaults));
    syncInputs();
    onChange({ ...st });
  });
  panel.querySelector('.filters-toggle').addEventListener('click', (e) => {
    const isOpen = panel.classList.toggle('open');
    e.currentTarget.setAttribute('aria-expanded', String(isOpen));
  });
  form.querySelector('.show-more')?.addEventListener('click', () => {
    showMore = !showMore;
    if (!showMore) {
      let changed = false;
      for (const f of fields.filter((x) => x.extra)) {
        for (const k of f.keys ?? [f.key])
          if (st[k] !== defaults[k]) {
            st[k] = defaults[k];
            changed = true;
          }
      }
      if (changed) emit();
    }
    syncInputs();
  });

  syncInputs();
  return { getState: () => ({ ...st }) };
}

// `first` (ex.: "nenhum") vai na frente das demais opções, que ficam em ordem alfabética.
export function uniqueOptions(items, field, { first = [] } = {}) {
  const firsts = [].concat(first);
  const vals = [...new Set(items.map((x) => x[field]).filter((v) => v !== null && v !== undefined && v !== ''))];
  const head = firsts.filter((v) => vals.includes(v));
  const tail = vals.filter((v) => !firsts.includes(v)).sort(compareText);
  return [...head, ...tail].map((v) => ({ value: v, label: v }));
}
