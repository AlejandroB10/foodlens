// FoodLens — F-28 Educational Tooltips
// Vanilla JS, no build step. Mobile-first.

const TOOLTIP_CONTENT = {
  nutri: {
    eyebrow: 'Health axis',
    title: 'About Nutri-Score',
    body: 'A\u2013E front-of-pack label by Sant\u00e9 Publique France. Combines nutrients per 100\u202fg into one letter, with rules per category.',
    link: 'https://www.santepubliquefrance.fr/determinants-de-sante/nutrition-et-activite-physique/articles/nutri-score',
    linkText: 'Read the methodology',
  },
  eco: {
    eyebrow: 'Eco axis',
    title: 'About Eco-Score',
    body: 'A\u2013E environmental label by ADEME. Aggregates climate, biodiversity, water and packaging impact across the product\u2019s life-cycle.',
    link: 'https://www.ecoscore.fr',
    linkText: 'Read the methodology',
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
  popover.className = `tooltip-popover tooltip-popover--${type}`;
  popover.setAttribute('role', 'tooltip');
  popover.setAttribute('aria-hidden', 'false');
  popover.id = `tooltip-${type}-${Date.now()}`;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'tooltip-close';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close tooltip');
  closeBtn.textContent = '\u00d7'; // ×

  const eyebrow = document.createElement('span');
  eyebrow.className = 'tooltip-eyebrow';
  eyebrow.textContent = info.eyebrow;

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
  link.innerHTML = `${info.linkText} <span aria-hidden="true">→</span>`;

  badge.setAttribute('aria-describedby', popover.id);

  popover.appendChild(closeBtn);
  popover.appendChild(eyebrow);
  popover.appendChild(title);
  popover.appendChild(body);
  popover.appendChild(link);

  return popover;
}

// ─── positioning ──────────────────────────────────────────────────────────

// Position the popover next to the badge using viewport coordinates.
// `position: fixed` in CSS lets us use getBoundingClientRect values directly
// without worrying about the nearest positioned ancestor.
function applyPosition(popover, badge) {
  const rect = badge.getBoundingClientRect();
  const margin = 12;     // gap between badge and popover
  const edge = 8;        // viewport edge padding
  const pw = popover.offsetWidth || 280;
  const ph = popover.offsetHeight || 180;

  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const flip = spaceBelow < ph + margin && spaceAbove > spaceBelow;
  popover.classList.toggle('flip', flip);

  const badgeCenterX = rect.left + rect.width / 2;
  // Clamp the popover so it stays within the viewport laterally.
  let left = badgeCenterX - pw / 2;
  if (left < edge) left = edge;
  else if (left + pw > window.innerWidth - edge) left = window.innerWidth - pw - edge;

  // The CSS arrow uses --arrow-offset (in px) to follow the badge centre even
  // when the popover itself has been clamped against the viewport edge.
  const arrowOffset = Math.max(16, Math.min(pw - 16, badgeCenterX - left));
  popover.style.setProperty('--arrow-offset', `${arrowOffset}px`);

  popover.style.left = `${left}px`;
  if (flip) {
    popover.style.top = `${rect.top - ph - margin}px`;
  } else {
    popover.style.top = `${rect.bottom + margin}px`;
  }
}

// ─── show / hide ──────────────────────────────────────────────────────────

function showTooltip(badge, focusInto = false) {
  // Skip only if the popover is ALREADY rendered for the same badge.
  // (active may exist with popover:null from the pre-show timer in handleMouseOver.)
  if (active && active.badge === badge && active.popover) return;

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

  // Only move focus into the popover for keyboard / explicit-click activations
  // (handleClick / handleFocusIn). Hover should NOT steal focus — it would
  // also break AC4 because the mouseout guard refuses to hide when focus is
  // trapped inside the popover.
  if (focusInto) {
    requestAnimationFrame(() => closeBtn.focus());
  }

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
  let finalised = false;
  const finalise = () => {
    if (finalised) return;
    finalised = true;
    finishHide(badge, popover, closeBtn, onClose);
    active = null;
  };
  // Wait for the CSS fade, but fall back to a timer so the popover always
  // leaves the DOM even when transitions are disabled (some test envs / users
  // with prefers-reduced-motion).
  popover.addEventListener('transitionend', finalise, { once: true });
  setTimeout(finalise, 120);
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
    hideTooltip(true); // immediate dismiss on outside click
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && active) {
      e.stopPropagation();
      hideTooltip(true); // immediate dismiss on Escape
      return;
    }
    if (e.key !== 'Enter' && e.key !== ' ') {
      return;
    }
    const badge = e.target.closest('.badge[data-tooltip]');
    if (!badge) {
      return;
    }
    e.preventDefault();
    handleClick(e);
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

  // Toggle ONLY if a rendered popover already exists for this badge.
  // The pre-show timer from hover sets `active` with `popover: null`; in that
  // case treat the click as "show now" instead of "hide".
  if (active && active.badge === badge && active.popover) {
    hideTooltip();
  } else {
    hideTooltip(true);
    showTooltip(badge, true); // click → focus into popover
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
      hideTooltip(true); // immediate so the popover leaves the DOM before the test polls
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
  const showTimer = setTimeout(() => showTooltip(badge, true), SHOW_DELAY_MS);
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
      hideTooltip(true); // immediate so the popover leaves the DOM before the test polls
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
