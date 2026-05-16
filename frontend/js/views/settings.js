// FoodLens F-27 — Settings Panel
// Vanilla JS, no build step. ES modules.

const SETTINGS_KEY = 'foodlens.settings';

const DEFAULT_SETTINGS = {
  unitSystem: 'metric',    // 'metric' | 'imperial'
  language: 'en',
  defaultSliderWeight: 50, // 0–100
};

// ─── module state ───────────────────────────────────────────────────────────

let currentSettings = null;

// ─── DOM factory (mirror onboarding.js style) ───────────────────────────────

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') {
      node.className = value;
    } else if (key === 'dataset') {
      for (const [k, v] of Object.entries(value)) node.dataset[k] = v;
    } else if (key === 'style') {
      for (const [k, v] of Object.entries(value)) node.style.setProperty(k, v);
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'html') {
      node.innerHTML = value;
    } else {
      node.setAttribute(key, value);
    }
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (typeof child === 'string' || typeof child === 'number') {
      node.appendChild(document.createTextNode(String(child)));
    } else {
      node.appendChild(child);
    }
  }
  return node;
}

// ─── unit conversion helpers (internal, not exported) ───────────────────────

function kgToLb(kg) {
  return kg * 2.20462;
}

function lbToKg(lb) {
  return lb / 2.20462;
}

function cmToIn(cm) {
  return cm / 2.54;
}

function inToCm(inches) {
  return inches * 2.54;
}

// ─── public API ─────────────────────────────────────────────────────────────

/**
 * Load settings from localStorage. Creates defaults if absent or malformed.
 * Returns the settings object.
 */
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      currentSettings = { ...DEFAULT_SETTINGS };
      persist();
      return currentSettings;
    }
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      currentSettings = { ...DEFAULT_SETTINGS };
    } else {
      currentSettings = { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {
    currentSettings = { ...DEFAULT_SETTINGS };
  }
  return currentSettings;
}

/**
 * Update a single setting key and persist to localStorage.
 */
function saveSettings(key, value) {
  if (!currentSettings) loadSettings();
  currentSettings[key] = value;
  persist();
}

/**
 * Return the current settings object.
 */
function getSettings() {
  if (!currentSettings) loadSettings();
  return currentSettings;
}

/**
 * Clear ALL foodlens localStorage keys AND hasSeenOnboarding.
 * Does NOT reload the page — caller is responsible for navigation if needed.
 */
function clearProfile() {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('foodlens.')) {
      keysToRemove.push(key);
    }
  }
  // Also clear onboarding flag
  keysToRemove.push('hasSeenOnboarding');
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
  // Trigger a full re-init: clear the profile so init() re-evaluates
  window.location.reload();
}

// ─── persistence ────────────────────────────────────────────────────────────

function persist() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(currentSettings));
  } catch {
    /* localStorage full or disabled */
  }
}

// ─── markup builders ────────────────────────────────────────────────────────

function buildBackdrop() {
  return el('div', {
    id: 'settings-backdrop',
    class: 'settings-backdrop',
    'aria-hidden': 'true',
    onClick: handleClose,
  });
}

function buildPanel() {
  return el('aside', {
    id: 'settings-panel',
    class: 'settings-panel',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Settings',
    tabindex: '-1',
  });
}

function buildHeader() {
  return el('header', { class: 'settings__header' },
    el('h2', { class: 'settings__title' }, 'Settings'),
    el('button', {
      type: 'button',
      class: 'settings__close-btn',
      'aria-label': 'Close settings',
      onClick: handleClose,
    },
      el('svg', {
        viewBox: '0 0 16 16',
        'aria-hidden': 'true',
        html: '<line x1="2" y1="2" x2="14" y2="14"/><line x1="14" y1="2" x2="2" y2="14"/>',
      })
    )
  );
}

function buildUnitSection(settings) {
  return el('section', { class: 'settings__section' },
    el('h3', { class: 'settings__section-title' }, 'Unit System'),
    el('div', { class: 'radio-group' },
      el('label', { class: 'radio-item' },
        el('input', {
          type: 'radio',
          name: 'unitSystem',
          value: 'metric',
          checked: settings.unitSystem === 'metric',
          onChange: () => saveSettings('unitSystem', 'metric'),
        }),
        el('span', { class: 'radio-item__label' }, 'Metric'),
        el('span', { class: 'radio-item__hint' }, 'kg / cm')
      ),
      el('label', { class: 'radio-item' },
        el('input', {
          type: 'radio',
          name: 'unitSystem',
          value: 'imperial',
          checked: settings.unitSystem === 'imperial',
          onChange: () => saveSettings('unitSystem', 'imperial'),
        }),
        el('span', { class: 'radio-item__label' }, 'Imperial'),
        el('span', { class: 'radio-item__hint' }, 'lb / in')
      )
    )
  );
}

function buildLanguageSection(settings) {
  return el('section', { class: 'settings__section' },
    el('h3', { class: 'settings__section-title' }, 'Language'),
    el('div', { class: 'field' },
      el('select', {
        class: 'settings__select',
        'aria-label': 'Language',
        disabled: true,
        onChange: (e) => saveSettings('language', e.target.value),
      },
        el('option', { value: 'en', selected: settings.language === 'en' }, 'English')
      ),
      el('span', { class: 'settings__select-note' }, 'More languages coming soon')
    )
  );
}

function buildSliderSection(settings) {
  const weight = settings.defaultSliderWeight ?? 50;
  const ecoWeight = 100 - weight;

  return el('section', { class: 'settings__section' },
    el('h3', { class: 'settings__section-title' }, 'Default Eco / Health Weight'),
    el('div', { class: 'settings__slider-wrap' },
      el('span', { class: 'settings__slider-label' }, 'Health ', weight, '%'),
      el('input', {
        type: 'range',
        class: 'settings__range',
        min: '0',
        max: '100',
        step: '5',
        value: String(weight),
        'aria-label': 'Default health weight',
        onInput: (e) => {
          const v = parseInt(e.target.value, 10);
          saveSettings('defaultSliderWeight', v);
          updateSliderDisplay(e.target, v);
        },
      }),
      el('span', { class: 'settings__slider-label' }, 'Eco ', ecoWeight, '%')
    )
  );
}

function updateSliderDisplay(input, weight) {
  const wrap = input.closest('.settings__slider-wrap');
  if (!wrap) return;
  const labels = wrap.querySelectorAll('.settings__slider-label');
  if (labels.length === 2) {
    labels[0].textContent = `Health ${weight}%`;
    labels[1].textContent = `Eco ${100 - weight}%`;
  }
}

function buildClearSection() {
  return el('section', { class: 'settings__section settings__section--destructive' },
    el('button', {
      type: 'button',
      class: 'settings__clear-btn',
      onClick: showConfirmation,
    }, 'Clear my profile')
  );
}

function buildConfirmationDialog() {
  return el('div', {
    id: 'settings-confirm-dialog',
    class: 'settings-confirm',
    role: 'alertdialog',
    'aria-modal': 'true',
    'aria-label': 'Confirm profile reset',
  },
    el('p', { class: 'settings-confirm__message' },
      'This will reset your profile, history, and saved products. Are you sure?'
    ),
    el('div', { class: 'settings-confirm__actions' },
      el('button', {
        type: 'button',
        class: 'btn btn--ghost',
        onClick: hideConfirmation,
      }, 'Cancel'),
      el('button', {
        type: 'button',
        class: 'btn btn--danger',
        onClick: clearProfile,
      }, 'Confirm')
    )
  );
}

// ─── show / hide ─────────────────────────────────────────────────────────────

function showConfirmation() {
  const panel = document.getElementById('settings-panel');
  if (!panel) return;
  // Remove existing dialog if any
  const existing = document.getElementById('settings-confirm-dialog');
  if (existing) existing.remove();

  const dialog = buildConfirmationDialog();
  panel.appendChild(dialog);

  // Focus Cancel button
  requestAnimationFrame(() => {
    const confirmBtn = dialog.querySelector('.btn--danger');
    if (confirmBtn) confirmBtn.focus();
  });
}

function hideConfirmation() {
  const dialog = document.getElementById('settings-confirm-dialog');
  if (dialog) {
    dialog.remove();
  }
}

function handleClose() {
  hide();
  hideConfirmation();
}

function hide() {
  const backdrop = document.getElementById('settings-backdrop');
  const panel = document.getElementById('settings-panel');
  if (backdrop) backdrop.remove();
  if (panel) panel.remove();
}

function show() {
  // Clean up any existing instances
  hide();

  const settings = loadSettings();

  const backdrop = buildBackdrop();
  const panel = buildPanel();

  panel.appendChild(buildHeader());
  panel.appendChild(buildUnitSection(settings));
  panel.appendChild(buildLanguageSection(settings));
  panel.appendChild(buildSliderSection(settings));
  panel.appendChild(buildClearSection());

  document.body.appendChild(backdrop);
  document.body.appendChild(panel);

  // Animate in
  requestAnimationFrame(() => {
    backdrop.classList.add('is-visible');
    panel.classList.add('is-open');
    const firstFocusable = panel.querySelector('input, button, select, [tabindex="0"]');
    if (firstFocusable) firstFocusable.focus();
  });

  // Keyboard: Escape closes panel
  document.addEventListener('keydown', handleKeydown);
}

function handleKeydown(e) {
  if (e.key === 'Escape') {
    const dialog = document.getElementById('settings-confirm-dialog');
    if (dialog) {
      hideConfirmation();
    } else {
      hide();
    }
    document.removeEventListener('keydown', handleKeydown);
  }
}

// ─── exports ─────────────────────────────────────────────────────────────────

export {
  loadSettings,
  saveSettings,
  getSettings,
  clearProfile,
  show,
  hide,
};