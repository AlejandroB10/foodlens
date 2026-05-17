# F-31 — Personas showcase block: Requirements

## 1. User story

Como visitante nuevo de FoodLens, quiero ver claramente quién es el proyecto y qué personas resuelve antes de empezar a buscar productos.

## 2. Owner & hook

- **Owner:** Alejandro Bordón
- **Hook:** storytelling
- **Persona:** All

## 3. Goal

A static decorative block above the footer that introduces FoodLens's three core personas (Marc, Pau, Lluís) so a first-time visitor immediately understands who the app is built for.

## 4. Acceptance criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC1 | Block is visible above the footer, before `</body>`, and contains 3 cards: Marc, Pau, Lluís | HTML present in index.html; CSS renders it |
| AC2 | Each card shows: name, avatar (initials-based), tagline (1 line), user type (P01/P02/P03 badge) | Visual check |
| AC3 | Responsive: 1 column on mobile (≤640px), 3-column grid on desktop (>640px) | Resize test |
| AC4 | Block is NOT inside the scrollable `<main>` area — it is a direct child of `<body>`'s shell div, outside `<main>` | DOM structure check |
| AC5 | Content matches `docs/user-flows.md` personas section exactly | Text comparison |

## 5. Content (from docs/user-flows.md)

### Marc Vidal (P01)
- **Name:** Marc Vidal
- **Role/tagline:** "Time-poor. Cooks weeknights. Trusts algorithms only when the reasoning is visible."
- **Quote:** *"I can live with a score I disagree with if I can see why it was given and decide for myself."*
- **Type badge:** P01

### Pau Estarellas (P02)
- **Name:** Pau Estarellas
- **Role/tagline:** "Sceptical of marketing. Demands a number he can verify."
- **Quote:** *"Tell me: compared to what you usually buy, this one has thirty percent less sugar and almost the same saturated fat."*
- **Type badge:** P02

### Lluís Tomàs (P03)
- **Name:** Lluís Tomàs
- **Role/tagline:** "Knows greenwashing from the inside. Wants a sharp contrastive sentence with a datum."
- **Quote:** *"What convinces me is a sharp sentence with a data point in it."*
- **Type badge:** P03

## 6. Out of scope

- No JavaScript interaction (purely static decorative block)
- No localStorage or API calls
- No animation beyond CSS transitions