import { html, raw } from '../util.js';
import { t } from '../i18n.js';

const MAX_SIZE = 4;

function pageWindow(page, totalPages) {
  let start = Math.max(1, page - Math.floor(MAX_SIZE / 2));
  const end = Math.min(totalPages, start + MAX_SIZE - 1);
  start = Math.max(1, end - MAX_SIZE + 1);
  const pages = [];
  for (let p = start; p <= end; p++) pages.push(p);
  return pages;
}

export function paginationHtml({ page, perPage, total }) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const from = total ? (page - 1) * perPage + 1 : 0;
  const to = Math.min(page * perPage, total);
  const item = (p, label, aria, { disabled = false, active = false } = {}) =>
    raw(
      html` <li class="${disabled ? 'disabled' : ''}${active ? ' active' : ''}">
        <button
          type="button"
          data-page="${p}"
          ${disabled ? 'disabled' : ''}
          ${active ? raw('aria-current="page"') : ''}
          aria-label="${aria}"
        >
          ${label}
        </button>
      </li>`,
    );
  return html` <nav class="pagination-bar" aria-label="${t('pagination.label')}">
    <ul class="pagination">
      ${item(1, '«', t('pagination.first'), { disabled: page === 1 })}
      ${item(page - 1, '‹', t('pagination.prev'), { disabled: page === 1 })}
      ${pageWindow(page, totalPages).map((p) => item(p, String(p), t('pagination.page', { n: p }), { active: p === page }))}
      ${item(page + 1, '›', t('pagination.next'), { disabled: page === totalPages })}
      ${item(totalPages, '»', t('pagination.last'), { disabled: page === totalPages })}
    </ul>
    <label class="per-page"
      >${t('pagination.perPage')}
      <input type="number" class="form-control" min="1" max="${total}" value="${perPage}" data-per-page
    /></label>
    <span class="page-info">${t('pagination.range', { from, to, total })}</span>
  </nav>`;
}

export function bindPagination(root, { onPage, onPerPage }) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-page]');
    if (b && !b.disabled) onPage(Number(b.dataset.page));
  });
  let timer;
  root.addEventListener('input', (e) => {
    if (!e.target.matches('[data-per-page]')) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const n = parseInt(e.target.value, 10);
      if (n >= 1) onPerPage(n);
    }, 250);
  });
}
