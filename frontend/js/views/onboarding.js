// FoodLens F-11 — Onboarding Modal
// Vanilla JS, no build step. ES modules.

const PROFILE_KEY = 'foodlens.profile';
const SCHEMA_VERSION = 1;

// ─── profile storage ───────────────────────────────────────────────────────

/**
 * Load profile from localStorage. Returns null if absent or malformed.
 */
function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const profile = JSON.parse(raw);
    if (typeof profile !== 'object' || profile === null) return null;
    return profile;
  } catch {
    return null;
  }
}

/**
 * Persist profile to localStorage. Silently fails if storage is unavailable.
 */
function saveProfile(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* localStorage full or disabled — continue without blocking */
  }
}

// ─── module state ───────────────────────────────────────────────────────────

let currentStep = 1;
let focusTrapPreviousFocus = null;
let modalEl = null;

// ─── DOM factory helpers (mirror app.js style) ───────────────────────────────

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

// ─── markup builders ────────────────────────────────────────────────────────

function buildBackdrop() {
  return el('div', {
    id: 'onboarding-backdrop',
    class: 'onboarding-backdrop',
    'aria-hidden': 'true',
  });
}

function buildModal() {
  return el('div', {
    id: 'onboarding-modal',
    class: 'onboarding',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Onboarding — tell us about yourself',
    tabindex: '-1',
  });
}

function buildHeader(title) {
  return el('header', { class: 'onboarding__header' },
    el('h2', { class: 'onboarding__title' }, title),
    el('button', {
      type: 'button',
      class: 'onboarding__close-btn',
      'aria-label': 'Close onboarding',
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

function buildProgress(steps, activeStep) {
  return el('div', { class: 'onboarding__progress' },
    ...Array.from({ length: steps }, (_, i) => {
      const idx = i + 1;
      const cls = idx < activeStep ? 'progress-step is-done' : idx === activeStep ? 'progress-step is-active' : 'progress-step';
      return el('div', { class: cls });
    })
  );
}

function buildFooter(stepNum, totalSteps, nextLabel = 'Continue') {
  return el('footer', { class: 'onboarding__footer' },
    el('span', { class: 'step-counter' }, `${stepNum} / ${totalSteps}`),
    el('div', { class: 'btn-group' },
      el('button', { type: 'button', class: 'btn btn--skip', onClick: handleSkip }, 'Skip for now'),
      el('button', { type: 'button', class: 'btn btn--primary', onClick: handleNext }, nextLabel)
    )
  );
}

// ─── step 1 — goals ─────────────────────────────────────────────────────────

function buildStep1(profile) {
  const selectedGoals = profile?.goals || [];

  const goalCards = [
    {
      value: 'weight_management',
      label: 'Weight management',
      desc: 'Track and balance what you eat',
      iconHtml: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M3 7h18"/><path d="M5 7l1 10h4l1-10"/><path d="M14 7l1 10h4l1-10"/><circle cx="5" cy="7" r="2"/><circle cx="19" cy="7" r="2"/></svg>',
    },
    {
      value: 'dietary_preferences',
      label: 'Dietary preferences',
      desc: 'Follow a specific diet pattern',
      iconHtml: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>',
    },
    {
      value: 'eco_priorities',
      label: 'Eco priorities',
      desc: 'Understand environmental impact',
      iconHtml: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10z"/><path d="M12 6v6l4 2"/></svg>',
    },
  ];

  return el('section', { class: 'onboarding', 'aria-label': 'Step 1 — Your goals', dataset: { step: '1' } },
    buildHeader('Let\'s get started'),
    buildProgress(3, 1),
    el('div', { class: 'onboarding__body' },
      el('div', {},
        el('h3', { class: 'step-title' }, 'What brings you here?'),
        el('p', { class: 'step-subtitle' }, 'Select all that apply. You can skip this entirely.')
      ),
      el('fieldset', { class: 'goals-grid', 'aria-label': 'Select your goals' },
        ...goalCards.map((goal) => {
          const checked = selectedGoals.includes(goal.value);
          return el('label', {
            class: 'goal-card' + (checked ? ' is-selected' : ''),
            onKeydown: (e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                const cb = e.currentTarget.querySelector('input[type="checkbox"]');
                if (cb) {
                  cb.checked = !cb.checked;
                  e.currentTarget.classList.toggle('is-selected', cb.checked);
                }
              }
            },
          },
            el('input', {
              type: 'checkbox',
              name: 'goals',
              value: goal.value,
              checked: checked,
              onChange: (e) => {
                e.target.closest('.goal-card').classList.toggle('is-selected', e.target.checked);
              },
            }),
            el('span', { class: 'goal-card__check', 'aria-hidden': 'true' },
              el('svg', { viewBox: '0 0 12 12', html: '<polyline points="1.5,6 4.5,9 10.5,3"/>' })
            ),
            el('span', { class: 'goal-card__icon', 'aria-hidden': 'true', html: goal.iconHtml }),
            el('span', { class: 'goal-card__label' }, goal.label),
            el('span', { class: 'goal-card__desc' }, goal.desc)
          );
        })
      )
    ),
    buildFooter(1, 3)
  );
}

// ─── step 2 — age + gender ───────────────────────────────────────────────────

function buildStep2(profile) {
  const savedAge = profile?.age ?? '';
  const savedGender = profile?.gender ?? null;

  const genderOptions = [
    { value: 'female', label: 'Female' },
    { value: 'male', label: 'Male' },
    { value: 'non_binary', label: 'Non-binary' },
    { value: 'prefer_not_to_say', label: 'Prefer not to say' },
  ];

  return el('section', { class: 'onboarding', 'aria-label': 'Step 2 — About you', dataset: { step: '2' } },
    buildHeader('About you'),
    buildProgress(3, 2),
    el('div', { class: 'onboarding__body' },
      el('div', {},
        el('h3', { class: 'step-title' }, 'Help us personalise your view'),
        el('p', { class: 'step-subtitle' }, 'All fields are optional — skip anytime.')
      ),
      el('div', { class: 'field-group' },
        // Age
        el('div', { class: 'field' },
          el('label', { class: 'field__label', for: 'fl-age' }, 'Your age'),
          el('input', {
            type: 'number',
            id: 'fl-age',
            class: 'field__input',
            placeholder: 'e.g. 28',
            min: '13',
            max: '120',
            inputmode: 'numeric',
            autocomplete: 'off',
            value: savedAge,
            onInput: (e) => {
              e.target.classList.remove('has-error');
            },
          }),
          el('span', { class: 'field__error', role: 'alert' }, 'Enter a whole number between 13 and 120')
        ),
        // Gender
        el('fieldset', { class: 'field' },
          el('legend', { class: 'field__label' }, 'Gender'),
          el('div', { class: 'radio-group' },
            ...genderOptions.map((opt) =>
              el('label', { class: 'radio-item' },
                el('input', {
                  type: 'radio',
                  name: 'gender',
                  value: opt.value,
                  checked: savedGender === opt.value,
                }),
                el('span', { class: 'radio-item__label' }, opt.label)
              )
            )
          )
        )
      )
    ),
    buildFooter(2, 3)
  );
}

// ─── step 3 — body metrics (optional) ───────────────────────────────────────

function buildStep3(profile) {
  const savedHeight = profile?.bodyMetrics?.heightCm ?? '';
  const savedWeight = profile?.bodyMetrics?.weightKg ?? '';

  return el('section', { class: 'onboarding', 'aria-label': 'Step 3 — Body metrics (optional)', dataset: { step: '3' } },
    buildHeader('One more thing'),
    buildProgress(3, 3),
    el('div', { class: 'onboarding__body' },
      el('div', {},
        el('h3', { class: 'step-title' }, 'Body metrics'),
        el('p', { class: 'step-subtitle' }, 'Optional — helps us scale calorie context.')
      ),
      el('div', {
        class: 'rationale',
        role: 'note',
        html: 'We use this to scale calorie ranges. You can skip it.',
      }),
      el('div', { class: 'metrics-row' },
        el('div', { class: 'field' },
          el('label', { class: 'field__label', for: 'fl-height' }, 'Height'),
          el('input', {
            type: 'number',
            id: 'fl-height',
            class: 'field__input',
            placeholder: 'e.g. 172',
            min: '100',
            max: '250',
            inputmode: 'numeric',
            autocomplete: 'off',
            value: savedHeight,
            onInput: (e) => e.target.classList.remove('has-error'),
          }),
          el('span', { class: 'field__unit' }, 'cm'),
          el('span', { class: 'field__error', role: 'alert' }, 'Enter a whole number between 100 and 250')
        ),
        el('div', { class: 'field' },
          el('label', { class: 'field__label', for: 'fl-weight' }, 'Weight'),
          el('input', {
            type: 'number',
            id: 'fl-weight',
            class: 'field__input',
            placeholder: 'e.g. 68',
            min: '30',
            max: '250',
            inputmode: 'numeric',
            autocomplete: 'off',
            value: savedWeight,
            onInput: (e) => e.target.classList.remove('has-error'),
          }),
          el('span', { class: 'field__unit' }, 'kg'),
          el('span', { class: 'field__error', role: 'alert' }, 'Enter a whole number between 30 and 250')
        )
      )
    ),
    buildFooter(3, 3, 'Finish')
  );
}

// ─── validation helpers ──────────────────────────────────────────────────────

function validateAge() {
  const input = document.getElementById('fl-age');
  if (!input) return true;
  const val = parseInt(input.value, 10);
  if (input.value !== '' && (isNaN(val) || val < 13 || val > 120)) {
    input.classList.add('has-error');
    input.focus();
    return false;
  }
  return true;
}

function validateHeight() {
  const input = document.getElementById('fl-height');
  if (!input || input.value === '') return true;
  const val = parseInt(input.value, 10);
  if (isNaN(val) || val < 100 || val > 250) {
    input.classList.add('has-error');
    input.focus();
    return false;
  }
  return true;
}

function validateWeight() {
  const input = document.getElementById('fl-weight');
  if (!input || input.value === '') return true;
  const val = parseInt(input.value, 10);
  if (isNaN(val) || val < 30 || val > 250) {
    input.classList.add('has-error');
    input.focus();
    return false;
  }
  return true;
}

// ─── data collection ────────────────────────────────────────────────────────

function collectGoals() {
  const checked = document.querySelectorAll('#onboarding-modal input[name="goals"]:checked');
  return Array.from(checked).map((cb) => cb.value);
}

function collectAge() {
  const input = document.getElementById('fl-age');
  if (!input || input.value === '') return null;
  const val = parseInt(input.value, 10);
  if (isNaN(val) || val < 13 || val > 120) return null;
  return val;
}

function collectGender() {
  const checked = document.querySelector('#onboarding-modal input[name="gender"]:checked');
  return checked ? checked.value : null;
}

function collectBodyMetrics() {
  const heightInput = document.getElementById('fl-height');
  const weightInput = document.getElementById('fl-weight');
  const height = heightInput && heightInput.value !== '' ? parseInt(heightInput.value, 10) : null;
  const weight = weightInput && weightInput.value !== '' ? parseInt(weightInput.value, 10) : null;

  if (height === null && weight === null) return null;

  // Validate if provided
  if (height !== null && (isNaN(height) || height < 100 || height > 250)) return null;
  if (weight !== null && (isNaN(weight) || weight < 30 || weight > 250)) return null;

  return { heightCm: height, weightKg: weight };
}

// ─── profile creation ──────────────────────────────────────────────────────

function makeProfile(overrides = {}) {
  const now = new Date().toISOString();
  return {
    version: SCHEMA_VERSION,
    status: 'completed',
    goals: [],
    age: null,
    gender: null,
    bodyMetrics: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ─── navigation handlers ────────────────────────────────────────────────────

function handleNext() {
  const profile = loadProfile() || makeProfile();

  if (currentStep === 1) {
    profile.goals = collectGoals();
    saveProfile(profile);
    goToStep(2);
  } else if (currentStep === 2) {
    if (!validateAge()) return;
    profile.age = collectAge();
    profile.gender = collectGender();
    saveProfile(profile);
    goToStep(3);
  } else if (currentStep === 3) {
    if (!validateHeight() || !validateWeight()) return;
    const metrics = collectBodyMetrics();
    profile.bodyMetrics = metrics;
    profile.updatedAt = new Date().toISOString();
    saveProfile(profile);
    hide();
  }
}

function handleSkip() {
  const profile = loadProfile() || makeProfile();

  if (currentStep === 1) {
    // Skipping step 1 — save skipped status but keep goals empty
    profile.status = 'skipped';
    profile.goals = [];
    profile.updatedAt = new Date().toISOString();
    saveProfile(profile);
    hide();
  } else if (currentStep === 2) {
    profile.status = 'skipped';
    profile.age = null;
    profile.gender = null;
    profile.updatedAt = new Date().toISOString();
    saveProfile(profile);
    hide();
  } else if (currentStep === 3) {
    // Skipping step 3 — keep required fields completed, bodyMetrics = null
    profile.bodyMetrics = null;
    profile.updatedAt = new Date().toISOString();
    saveProfile(profile);
    hide();
  }
}

function handleClose() {
  // Closing via X button counts as skip for required fields
  handleSkip();
}

// ─── step management ────────────────────────────────────────────────────────

function goToStep(step) {
  currentStep = step;
  const profile = loadProfile();

  const backdrop = document.getElementById('onboarding-backdrop');
  const modal = document.getElementById('onboarding-modal');

  let newModal;
  if (step === 1) newModal = buildStep1(profile);
  else if (step === 2) newModal = buildStep2(profile);
  else if (step === 3) newModal = buildStep3(profile);

  if (modal && newModal) {
    modal.replaceWith(newModal);
    modalEl = newModal;

    // Focus first focusable element
    const focusable = newModal.querySelector('input, button, [tabindex="0"]');
    if (focusable) {
      requestAnimationFrame(() => focusable.focus());
    }
  }
}

// ─── show / hide ─────────────────────────────────────────────────────────────

function show() {
  // Save current focus for restoration
  focusTrapPreviousFocus = document.activeElement;

  const existingBackdrop = document.getElementById('onboarding-backdrop');
  const existingModal = document.getElementById('onboarding-modal');
  if (existingBackdrop) existingBackdrop.remove();
  if (existingModal) existingModal.remove();

  currentStep = 1;
  const profile = loadProfile();

  const backdrop = buildBackdrop();
  const modal = buildStep1(profile);
  modalEl = modal;

  document.body.appendChild(backdrop);
  backdrop.appendChild(modal);

  // Focus the first focusable element
  const focusable = modal.querySelector('input, button, [tabindex="0"]');
  if (focusable) {
    requestAnimationFrame(() => focusable.focus());
  }

  // Prevent body scroll
  document.body.style.overflow = 'hidden';

  // Wire keyboard handlers
  document.addEventListener('keydown', handleKeydown);
}

function hide() {
  const backdrop = document.getElementById('onboarding-backdrop');
  const modal = document.getElementById('onboarding-modal');

  if (backdrop) backdrop.remove();
  if (modal) modal.remove();

  // Restore body scroll
  document.body.style.overflow = '';

  // Remove keyboard handlers
  document.removeEventListener('keydown', handleKeydown);

  // Restore focus
  if (focusTrapPreviousFocus && typeof focusTrapPreviousFocus.focus === 'function') {
    focusTrapPreviousFocus.focus();
  }
  focusTrapPreviousFocus = null;
}

// ─── keyboard handling ───────────────────────────────────────────────────────

function handleKeydown(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    handleClose();
    return;
  }

  // Basic focus trap — only within modal
  const modal = document.getElementById('onboarding-modal');
  if (!modal) return;

  if (e.key === 'Tab') {
    const focusable = Array.from(
      modal.querySelectorAll('button, input, [tabindex="0"]')
    ).filter((el) => !el.disabled && el.offsetParent !== null);

    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
}

// ─── public API ─────────────────────────────────────────────────────────────

/**
 * Initialise the onboarding module. Checks if onboarding should be shown
 * on this visit and opens the modal if needed.
 * Safe to call multiple times.
 */
function init() {
  const profile = loadProfile();

  // Show only when no profile or status is neither completed nor skipped
  if (!profile || !profile.status) {
    requestAnimationFrame(show);
  }
}

/**
 * Show the onboarding modal immediately.
 * Useful for explicit "Edit profile" calls (future feature, no-op for now).
 */
function showOnboarding() {
  show();
}

/**
 * Hide the onboarding modal without saving.
 */
function hideOnboarding() {
  hide();
}

/**
 * Returns true if onboarding has been completed or skipped.
 */
function isCompleted() {
  const profile = loadProfile();
  return profile && (profile.status === 'completed' || profile.status === 'skipped');
}

/**
 * Returns the stored profile object, or null if none.
 * Never throws — malformed JSON is treated as null.
 */
function getProfile() {
  return loadProfile();
}

/**
 * Clears the stored profile and removes the localStorage entry.
 * Returns focus to the body for re-onboarding on next visit.
 */
function clearProfile() {
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch {
    /* ignore */
  }
}

export {
  init,
  showOnboarding as show,
  hideOnboarding as hide,
  isCompleted,
  getProfile,
  clearProfile,
};