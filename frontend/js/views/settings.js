// FoodLens F-27 — Settings Panel
// Vanilla JS, no build step. ES modules.
// Editorial right-side drawer: numbered sections (01/02/03/04),
// segmented tabs for units, weighting slider, danger button + confirm dialog.

const SETTINGS_KEY = 'foodlens.settings';

const DEFAULT_SETTINGS = {
  unitSystem: 'metric',    // 'metric' | 'imperial'
  language: 'en',
  defaultSliderWeight: 50, // 0..100
  theme: 'light',          // 'light' | 'dark'
};

let currentSettings = null;

// ─── DOM factory ────────────────────────────────────────────────────────────

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
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

// ─── persistence ────────────────────────────────────────────────────────────

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      currentSettings = { ...DEFAULT_SETTINGS };
      persist();
      applyTheme(currentSettings.theme);
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
  applyTheme(currentSettings.theme);
  return currentSettings;
}

function saveSettings(key, value) {
  if (!currentSettings) loadSettings();
  currentSettings[key] = value;
  persist();
  if (key === 'theme') applyTheme(value);
}

function getSettings() {
  if (!currentSettings) loadSettings();
  return currentSettings;
}

function persist() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(currentSettings));
  } catch {
    /* localStorage full or disabled */
  }
}

function applyTheme(theme) {
  const nextTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = nextTheme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', nextTheme === 'dark' ? '#141714' : '#FAF6EF');
  }
}

function clearProfile() {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('foodlens.')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.push('hasSeenOnboarding');
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
  window.location.reload();
}

// ─── markup ────────────────────────────────────────────────────────────────

function buildBackdrop() {
  return el('div', {
    id: 'settings-backdrop',
    class: 'settings-backdrop',
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
    el('div', { class: 'settings__masthead' },
      el('span', { class: 'settings__masthead-tag' }, 'FoodLens · 2026'),
      el('h2', { class: 'settings__title' }, 'Settings'),
    ),
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
      }),
    ),
  );
}

function buildFooter() {
  return el('footer', { class: 'settings__footer' },
    el('span', null, 'Stored locally on this device'),
    el('span', null, 'v0.1'),
  );
}

// ─── sections ──────────────────────────────────────────────────────────────

function buildSection(num, title, control, hint) {
  const children = [
    el('span', { class: 'settings__section-num', 'aria-hidden': 'true' }, num),
    el('h3', { class: 'settings__section-title' }, title),
    el('hr', { class: 'settings__section-rule' }),
  ];
  if (control) children.push(control);
  if (hint) children.push(el('p', { class: 'settings__section-hint' }, hint));
  return el('section', { class: 'settings__section' }, ...children);
}

function buildUnitSection(settings) {
  const tabs = el('div', {
    class: 'settings__tabs settings__section-control',
    role: 'radiogroup',
    'aria-label': 'Unit system',
  },
    buildTab('metric', 'Metric', 'kg · cm', settings.unitSystem === 'metric'),
    buildTab('imperial', 'Imperial', 'lb · in', settings.unitSystem === 'imperial'),
  );
  return buildSection('01', 'Units of measure', tabs);
}

function buildTab(value, name, hint, checked) {
  return el('label', { class: 'settings__tab' },
    el('input', {
      type: 'radio',
      name: 'unitSystem',
      value: value,
      checked: checked,
      onChange: () => saveSettings('unitSystem', value),
    }),
    el('span', { class: 'settings__tab-label' },
      el('span', { class: 'settings__tab-name' }, name),
      el('span', { class: 'settings__tab-hint' }, hint),
    ),
  );
}

function buildLanguageSection(settings) {
  const select = el('select', {
    class: 'settings__select settings__section-control',
    'aria-label': 'Language',
    disabled: true,
    onChange: (e) => saveSettings('language', e.target.value),
  },
    el('option', { value: 'en', selected: settings.language === 'en' }, 'English'),
  );
  const section = buildSection('02', 'Language', select, 'More languages coming soon.');
  // Legacy alias on the hint paragraph for tests.
  const hint = section.querySelector('.settings__section-hint');
  if (hint) hint.classList.add('settings__select-note');
  return section;
}

function buildSliderSection(settings) {
  const weight = settings.defaultSliderWeight ?? 50;

  const range = el('input', {
    type: 'range',
    class: 'settings__range',
    min: '0',
    max: '100',
    step: '5',
    value: String(weight),
    'aria-label': 'Default health weight (0% = full eco, 100% = full health)',
    style: { '--track-pct': weight + '%' },
    onInput: (e) => {
      const v = parseInt(e.target.value, 10);
      saveSettings('defaultSliderWeight', v);
      e.target.style.setProperty('--track-pct', v + '%');
      updateSliderReadout(e.target.closest('.settings__slider-wrap'), v);
    },
  });

  const wrap = el('div', { class: 'settings__slider-wrap settings__section-control' },
    range,
    el('div', { class: 'settings__slider-readout' },
      el('span', null,
        el('span', { class: 'label' }, 'Eco '),
        el('span', { class: 'value', 'data-eco': true }, (100 - weight) + '%'),
      ),
      el('span', null,
        el('span', { class: 'label' }, 'Health '),
        el('span', { class: 'value', 'data-health': true }, weight + '%'),
      ),
    ),
  );
  return buildSection(
    '03',
    'Default Eco / Health weighting',
    wrap,
    'Sets the home slider on first load. You can still override per session.',
  );
}

function buildThemeSection(settings) {
  const currentTheme = settings.theme === 'dark' ? 'dark' : 'light';
  const tabs = el('div', {
    class: 'settings__tabs settings__section-control',
    role: 'radiogroup',
    'aria-label': 'Theme',
  },
    buildThemeTab('light', 'Paper', 'Day', currentTheme === 'light'),
    buildThemeTab('dark', 'Paper-night', 'Night', currentTheme === 'dark'),
  );
  return buildSection('04', 'Theme', tabs, 'Switches the interface colours only; product data and scores stay unchanged.');
}

function buildThemeTab(value, name, hint, checked) {
  return el('label', { class: 'settings__tab' },
    el('input', {
      type: 'radio',
      name: 'theme',
      value: value,
      checked: checked,
      onChange: () => saveSettings('theme', value),
    }),
    el('span', { class: 'settings__tab-label' },
      el('span', { class: 'settings__tab-name' }, name),
      el('span', { class: 'settings__tab-hint' }, hint),
    ),
  );
}

function updateSliderReadout(wrap, weight) {
  if (!wrap) return;
  const eco = wrap.querySelector('[data-eco]');
  const health = wrap.querySelector('[data-health]');
  if (eco) eco.textContent = (100 - weight) + '%';
  if (health) health.textContent = weight + '%';
}

function buildClearSection() {
  const button = el('button', {
    type: 'button',
    // settings__clear-btn kept as legacy alias for tests.
    class: 'settings__danger-btn settings__clear-btn settings__section-control',
    onClick: showConfirmation,
  }, 'Clear my profile');
  const section = buildSection(
    '05',
    'Reset profile',
    button,
    'Wipes onboarding answers, saved products, history and weighting preferences.',
  );
  section.classList.add('settings__section--destructive');
  return section;
}

// ─── confirmation dialog ───────────────────────────────────────────────────

function buildConfirmationDialog() {
  return el('div', {
    id: 'settings-confirm-dialog',
    class: 'settings-confirm',
    role: 'alertdialog',
    'aria-modal': 'true',
    'aria-labelledby': 'settings-confirm-heading',
  },
    el('h3', { id: 'settings-confirm-heading', class: 'settings-confirm__heading' },
      'Reset ', el('em', null, 'everything?'),
    ),
    el('p', { class: 'settings-confirm__message' },
      'This will reset your profile and every locally stored FoodLens selection.',
    ),
    el('p', { class: 'settings-confirm__detail' },
      'Profile · favourites · history · settings · onboarding flag.',
    ),
    el('div', { class: 'settings-confirm__actions' },
      el('button', {
        type: 'button',
        // btn btn--ghost preserved as legacy alias for tests.
        class: 'settings-confirm__btn settings-confirm__btn--cancel btn btn--ghost',
        onClick: hideConfirmation,
      }, 'Cancel'),
      el('button', {
        type: 'button',
        // btn btn--danger preserved as legacy alias for tests.
        class: 'settings-confirm__btn settings-confirm__btn--danger btn btn--danger',
        onClick: clearProfile,
      }, 'Confirm reset'),
    ),
  );
}

function showConfirmation() {
  const panel = document.getElementById('settings-panel');
  if (!panel) return;
  const existing = document.getElementById('settings-confirm-dialog');
  if (existing) existing.remove();

  const dialog = buildConfirmationDialog();
  panel.appendChild(dialog);

  requestAnimationFrame(() => {
    const cancelBtn = dialog.querySelector('.settings-confirm__btn--cancel');
    if (cancelBtn) cancelBtn.focus();
  });
}

function hideConfirmation() {
  const dialog = document.getElementById('settings-confirm-dialog');
  if (dialog) dialog.remove();
}

// ─── show / hide ───────────────────────────────────────────────────────────

function handleClose() {
  hide();
  hideConfirmation();
}

function hide() {
  const backdrop = document.getElementById('settings-backdrop');
  const panel = document.getElementById('settings-panel');
  if (backdrop) backdrop.remove();
  if (panel) panel.remove();
  document.removeEventListener('keydown', handleKeydown);
}

function show() {
  hide(); // dedupe any previous instance

  const settings = loadSettings();

  const backdrop = buildBackdrop();
  const panel = buildPanel();

  panel.appendChild(buildHeader());

  const body = el('div', { class: 'settings__body' },
    buildUnitSection(settings),
    buildLanguageSection(settings),
    buildSliderSection(settings),
    buildThemeSection(settings),
    buildClearSection(),
  );
  panel.appendChild(body);
  panel.appendChild(buildFooter());

  document.body.appendChild(backdrop);
  document.body.appendChild(panel);

  requestAnimationFrame(() => {
    backdrop.classList.add('is-visible');
    panel.classList.add('is-open');
    const firstFocusable = panel.querySelector('input, button, select, [tabindex="0"]');
    if (firstFocusable) firstFocusable.focus();
  });

  document.addEventListener('keydown', handleKeydown);
}

function handleKeydown(e) {
  if (e.key !== 'Escape') return;
  const dialog = document.getElementById('settings-confirm-dialog');
  if (dialog) {
    hideConfirmation();
  } else {
    hide();
  }
}

// ─── exports ────────────────────────────────────────────────────────────────

export {
  loadSettings,
  saveSettings,
  getSettings,
  applyTheme,
  clearProfile,
  show,
  hide,
};
