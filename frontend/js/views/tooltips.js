// FoodLens — F-28 Educational Tooltips
// Vanilla JS, no build step. Mobile-first.

const TOOLTIP_CONTENT = {
  nutri: {
    title: 'About Nutri-Score',
    body: 'Nutri-Score is a front-of-pack nutrition label devised by Sant\u00e9 Publique France, based on a modified Atwater index. It grades products A\u2013E using energy, saturated fat, sodium, sugar, fibre, and protein per 100\u00a0g or 100\u00a0kcal. The algorithm includes category-specific adjustments (e.g. cheese vs. beverages).',
    link: 'https://www.santepubliquefrance.fr/nos-avis/reponse-a-la-commission-d-enquete-sur-les-conditions-de-mise-sur-le-marche-et-les-conditionnements-des-pesticides-et-leur-utilisation/#articles',
    linkText: 'Official Nutri-Score documentation \u2199',
  },
  eco: {
    title: 'About Eco-Score',
    body: 'Eco-Score is an environmental label designed by ADEME and adapted from the Agribalyse LCA database. It grades products A\u2013E across five impact categories: climate change, biodiversity, water stress, ozone depletion, and acidification. The score is computed from per-category base scores and production-transport adjustments.',
    link: 'https://www.ecoscore.fr',
    linkText: 'Official Eco-Score page \u2199',
  },
};

const SHOW_DELAY_MS = 150;
const HIDE_DELAY_MS = 100;

// ─── active state ─────────────────────────────────────────────────────────

let active = null;          // { badge, popover, showTimer, hideTimer, closeBtn }
let lastFocusedBeforeTrap = null;

// ─── popover factory ───────────────────────────────────────────────────────

function createPopover(badge) {
  const type = badge.dataset.tooltip;
  const info = TOOLTIP_CONTENT[type];
  if (!info) return null;

  const popover = document.createElement('div');
  popover.setAttribute('role', 'tooltip');
  popover.setAttribute('aria-hidden', 'false');
  popover.id = `tooltip-${type}-${Date.now()}`;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'tooltip-close';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close tooltip');
  closeBtn.textContent = '\u00d7'; // ×

  const title = document.createElement('h3');
  title.className = 'tooltip-title';
  title.id = `${popover.id}-title`;
  title.textContent = info.title;

  const body = document.createElement('p');
  body.className = 'tooltip-body';
  body.textContent = info.body;

  const link = document.createElement('a');
  link.className = 'tooltip-link';
  link.href = info.link;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = info.linkText;

  badge.setAttribute('aria-describedby', popover.id);

  popover.appendChild(closeBtn);
  popover.appendChild(title);
  popover.appendChild(body);
  popover.appendChild(link);

  return popover;
}

// ─── positioning ──────────────────────────────────────────────────────────

function autoFlip(popover, badge) {
  const rect = badge.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const ph = popover.offsetHeight || 160;
  popover.classList.toggle('flip', spaceBelow < ph + 12 && spaceAbove > spaceBelow);
}

function applyPosition(popover, badge) {
  autoFlip(popover, badge);

  const rect = badge.getBoundingClientRect();
  const pw = popover.offsetWidth || 260;
  const hostCenterX = rect.left + rect.width / 2;

  let left = hostCenterX;
  const halfPw = pw / 2;
  if (left - halfPw < 8) left = halfPw + 8;
  else if (left + halfPw > window.innerWidth - 8) left = window.innerWidth - halfPw - 8;

  popover.style.left = `${left}px`;
  popover.style.top = rect.bottom + 8 + 'px';

  if (popover.classList.contains('flip')) {
    popover.style.top = `${rect.top - (popover.offsetHeight || 160) - 8}px`;
  }
}

// ─── show / hide ──────────────────────────────────────────────────────────

function showTooltip(badge) {
  if (active && active.badge === badge) return;

  hideTooltip(true);

  const popover = createPopover(badge);
  if (!popover) return;
  document.body.appendChild(popover);

  requestAnimationFrame(() => {
    applyPosition(popover, badge);
    popover.classList.add('is-visible');
  });

  const closeBtn = popover.querySelector('.tooltip-close');
  const onClose = () => hideTooltip();
  closeBtn.addEventListener('click', onClose);

  lastFocusedBeforeTrap = document.activeElement;
  trapFocus(popover);

  active = { badge, popover, closeBtn, onClose };
}

function hideTooltip(immediate = false) {
  if (!active) return;

  const { badge, popover, closeBtn, onClose } = active;
  clearTimeout(active.showTimer);
  clearTimeout(active.hideTimer);

  if (immediate || !popover || !popover.classList.contains('is-visible')) {
    finishHide(badge, popover, closeBtn, onClose);
    active = null;
    return;
  }

  popover.classList.remove('is-visible');
  popover.addEventListener('transitionend', () => {
    finishHide(badge, popover, closeBtn, onClose);
    active = null;
  }, { once: true });
}

function finishHide(badge, popover, closeBtn, onClose) {
  if (badge) badge.removeAttribute('aria-describedby');
  if (closeBtn && onClose) closeBtn.removeEventListener('click', onClose);
  releaseFocus();
  if (popover && popover.parentNode) popover.remove();
}

// ─── focus trap ────────────────────────────────────────────────────────────

function trapFocus(popover) {
  popover._ft = (e) => {
    if (e.key !== 'Tab') return;
    const foci = [...popover.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')];
    if (!foci.length) return;
    if (e.shiftKey) {
      if (document.activeElement === foci[0]) { e.preventDefault(); foci[foci.length - 1].focus(); }
    } else {
      if (document.activeElement === foci[foci.length - 1]) { e.preventDefault(); foci[0].focus(); }
    }
  };
  popover.addEventListener('keydown', popover._ft);
}

function releaseFocus() {
  if (!active?.popover?._ft) return;
  active.popover.removeEventListener('keydown', active.popover._ft);
  delete active.popover._ft;
  if (lastFocusedBeforeTrap && typeof lastFocusedBeforeTrap.focus === 'function') {
    lastFocusedBeforeTrap.focus();
    lastFocusedBeforeTrap = null;
  }
}

// ─── event wiring ─────────────────────────────────────────────────────────

function wireBadgeEvents() {
  document.addEventListener('click', (e) => {
    if (!active) return;
    if (!active.popover) return;
    if (active.popover.contains(e.target)) return;
    if (e.target.closest('.badge[data-tooltip]')) return;
    hideTooltip();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && active) {
      e.stopPropagation();
      hideTooltip();
    }
  });

  document.addEventListener('click', handleClick, true);
  document.addEventListener('touchend', handleTouchEnd, { passive: false });
  document.addEventListener('mouseover', handleMouseOver, true);
  document.addEventListener('mouseout', handleMouseOut, true);
  document.addEventListener('focusin', handleFocusIn, true);
  document.addEventListener('focusout', handleFocusOut, true);
}

function handleClick(e) {
  const badge = e.target.closest('.badge[data-tooltip]');
  if (!badge) return;
  const type = badge.dataset.tooltip;
  if (!type || !TOOLTIP_CONTENT[type]) return;

  if (active && active.badge === badge) {
    hideTooltip();
  } else {
    hideTooltip(true);
    showTooltip(badge);
  }
}

function handleTouchEnd(e) {
  const badge = e.target.closest('.badge[data-tooltip]');
  if (!badge) return;
  e.preventDefault();
  handleClick(e);
}

function handleMouseOver(e) {
  const badge = e.target.closest('.badge[data-tooltip]');
  if (!badge) return;
  const type = badge.dataset.tooltip;
  if (!type || !TOOLTIP_CONTENT[type]) return;

  clearTimeout(active?.hideTimer);
  if (active && active.badge !== badge) hideTooltip(true);
  const showTimer = setTimeout(() => showTooltip(badge), SHOW_DELAY_MS);
  if (active) active.showTimer = showTimer;
  else active = { badge, showTimer, hideTimer: null, popover: null, closeBtn: null, onClose: null };
}

function handleMouseOut(e) {
  const badge = e.target.closest('.badge[data-tooltip]');
  if (!badge) return;
  const type = badge.dataset.tooltip;
  if (!type || !TOOLTIP_CONTENT[type]) return;

  const hideTimer = setTimeout(() => {
    if (active && active.badge === badge && !active.popover?.contains(document.activeElement)) {
      hideTooltip();
    }
  }, HIDE_DELAY_MS);
  if (active && active.badge === badge) {
    clearTimeout(active.hideTimer);
    active.hideTimer = hideTimer;
  }
}

function handleFocusIn(e) {
  const badge = e.target.closest('.badge[data-tooltip]');
  if (!badge) return;
  const type = badge.dataset.tooltip;
  if (!type || !TOOLTIP_CONTENT[type]) return;

  clearTimeout(active?.hideTimer);
  if (active && active.badge !== badge) hideTooltip(true);
  const showTimer = setTimeout(() => showTooltip(badge), SHOW_DELAY_MS);
  if (active) active.showTimer = showTimer;
  else active = { badge, showTimer, hideTimer: null, popover: null, closeBtn: null, onClose: null };
}

function handleFocusOut(e) {
  const badge = e.target.closest('.badge[data-tooltip]');
  if (!badge) return;
  const type = badge.dataset.tooltip;
  if (!type || !TOOLTIP_CONTENT[type]) return;

  const hideTimer = setTimeout(() => {
    if (active && active.badge === badge && !active.popover?.contains(document.activeElement)) {
      hideTooltip();
    }
  }, HIDE_DELAY_MS);
  if (active && active.badge === badge) {
    clearTimeout(active.hideTimer);
    active.hideTimer = hideTimer;
  }
}

// ─── init ──────────────────────────────────────────────────────────────────

export function init() {
  wireBadgeEvents();
}