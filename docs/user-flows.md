# User Flows — FoodLens

> Three core flows, each walked through the eyes of the three personas from the WA3 research. Use these as the acceptance scripts for the prototype: every flow must work end to end with at least one of these personas before the prototype is "done".

## The personas (recap)

Full personas live in `../Assignments/03-assignment/openspec/artifacts/personas-template.md`. Short version for this doc:

- **Marc Vidal** (P01) — 27, software engineer in Palma. Time-poor. Cooks weeknights. Tech-trusting *only when* the reasoning is visible. Configures once if it saves him repeated decision effort. Quote: *"I can live with a score I disagree with if I can see why it was given and decide for myself."*
- **Pau Estarellas** (P02) — 22, maths undergrad. Tight budget, minimal cooking routine. Sceptical of marketing, demands a number he can check. Will dismiss explanations that lack data. Quote: *"Tell me: compared to what you usually buy, this one has thirty percent less sugar and almost the same saturated fat."*
- **Lluís Tomàs** (P03) — 26, marketing professional. Knows greenwashing from the inside. Wants a sharp contrastive sentence with a datum. Resists moralising. Quote: *"What convinces me is a sharp sentence with a data point in it."*

## Flow 1 — Search by name → scores → weighting → explanation

**Trigger.** User opens the app and wants to evaluate a product they have in mind.

### Steps

1. App loads. If first visit, **onboarding modal (F-11)** asks for goals + age + gender. Skippable.
2. User types `"oat milk"` in the **search bar (F-02)** and submits.
3. `api.js` calls `/api/v2/search?categories_tags=en:plant-based-milks&search_terms=oat`.
4. Search returns 20 products. UI renders **product cards (F-05+)**, each showing:
   - Name, brand, image
   - Nutri-Score badge (left) and Eco-Score badge (right) **side by side (F-07)** — both always visible
   - `nutrient_levels` chips
   - Contrastive sentence **open by default (F-10)**: *"Among oat milks, this one has 30% less sugar per 100g than the category average."*
   - Three action buttons at the bottom (F-17)
5. User sees the **weighting slider (F-12)** above the results. Default 70% health / 30% eco.
6. User drags the slider to 30% health / 70% eco. Cards re-rank live (debounced).
7. User taps a card to open its detail view, which expands the sentence into a small nutrient drill-down (numbers per 100g).

### Per-persona walkthrough

#### Marc Vidal (Time-Strapped Pragmatist)

Marc filled in the onboarding once. He searches `"oat milk"`, glances at the top three cards. He needs the **first card** to be the right answer because he is not going to scroll. He reads the contrastive sentence ("30% less sugar than the category average") and trusts the algorithm because the sentence is concrete. He picks the top card and taps *Add to shopping list*. **Total time: under 15 seconds.** If the slider is hidden or the explanation is collapsed, Marc disengages.

**Acceptance for Marc**: the right product is in the top three for the default 70/30 weighting; the contrastive sentence is visible without expanding anything.

#### Pau Estarellas (Sceptical Analyst)

Pau searched `"oat milk"`. The contrastive sentence claims "30% less sugar". Pau **does not trust the sentence by default** — he wants to verify. He taps *See numbers* and gets the nutrient table per 100g for this product and for the reference. He compares sugars_100g: 3.2g vs 4.6g. That checks out. **He now trusts the sentence**. He moves the slider towards eco (60/40) — eco was not his primary axis initially, but now that he sees the trade-off he wants to factor it in. The top card changes; the new contrastive sentence reads *"This option has 1.2g more sugar per 100g than your previous top, but a better Environmental Score (B vs C)."* Pau picks it because the trade-off is explicit.

**Acceptance for Pau**: every claim in the contrastive sentence is verifiable in a drill-down; moving the slider produces an updated sentence that explains the new ranking.

#### Lluís Tomàs (Marketing-Aware Indulger)

Lluís searched `"oat milk"`. He is suspicious of the algorithm's defaults because he knows marketing. He **reads the contrastive sentence and asks "is this a placement?"**. Because the sentence references a concrete number (30% less sugar) and the reference is "the category average" (not "our recommendation"), Lluís accepts the framing. He does not move the slider — he uses the **Balanced** preset (F-13). He taps *Compare with my usual* (F-18) — he has previously marked Alpro as his usual. The card updates: *"This one has the same protein content as Alpro and 18% less added sugar."* He picks it.

**Acceptance for Lluís**: the system never claims authority ("we recommend"); always grounded in data and contrasts; the *Compare with my usual* path is one tap away.

### Failure modes covered

- OFF returns 503 → `api.js` falls back to `sample_products.json`. UI shows a small "showing offline samples" indicator. Flow continues.
- Search returns 0 results → UI shows an empty state with three suggested categories to browse instead.
- Nutri-Score is `unknown` for a product → badge renders grey with `?`, contrastive sentence falls back to *"Insufficient data to compare on the health axis."*

## Flow 2 — Barcode → product → alternatives → choose

**Trigger.** User is in front of a shelf (real or imagined) and wants to know if there is a better option than what they were about to buy.

### Steps

1. User taps the camera icon next to the search bar (F-21) **OR** types a barcode manually.
2. `api.js` calls `/api/v2/product/{barcode}`.
3. Product card renders for the scanned product (same layout as Flow 1).
4. Below the card, **Alternative Engine (F-15)** displays up to 3 alternatives ranked by the current slider weighting.
5. Each alternative shows: name + image + Nutri/Eco badges + **one-line delta (F-16)**, e.g. *"4.1g less sugar, 3.7g more protein per 100g."*
6. User taps an alternative. That alternative becomes the focused card. The original product moves into a small "Was looking at" link at the top.
7. User taps an action button (Add to shopping list / See recipe / Compare with usual).

### Per-persona walkthrough

#### Marc Vidal

Marc is at the supermarket. He scans a barcode (a sugary breakfast cereal). The card returns Nutri-Score D and Eco-Score C. The three alternatives show two with Nutri-Score B and one with A. He picks the A (highest health weight on his slider). Total interaction: **under 10 seconds**, no panel expanded.

**Acceptance for Marc**: a Nutri-Score D product yields actionable alternatives within 10 seconds of the scan.

#### Pau Estarellas

Pau scanned a yogurt. The deltas on the alternative cards include numbers (sugar grams, protein grams). He needs that — *"4.1g less sugar"* lets him verify mentally without expanding anything. He picks an alternative not because the system recommends it, but because the delta on protein matches his goal.

**Acceptance for Pau**: every alternative card shows at least one numeric delta with units.

#### Lluís Tomàs

Lluís scanned a packaged snack. He notices the alternatives section includes a couple of brands he distrusts. He taps *Compare with my usual* on the original card instead of picking an alternative — he wants to know how this snack stacks against the one he buys habitually. The contrastive sentence updates against his usual. He decides: not worth switching.

**Acceptance for Lluís**: the alternative ranking does not silently push sponsored brands; *Compare with my usual* is reachable from the original card.

### Failure modes covered

- Barcode not found (`status: 0`) → UI shows *"This barcode is not in Open Food Facts. Want to add it?"* with a link to OFF's contribution flow. No fake product is invented.
- No alternatives meet the "strictly better" criterion → empty state *"This is already among the best in its category."* No fabricated alternatives.
- Camera permission denied → falls back to manual barcode entry.

## Flow 3 — Browse by category → compare-this-shelf

**Trigger.** User has no specific product in mind; they want to explore a category or compare a handful of candidates side by side.

### Steps

1. From the home screen, user opens the **category browser (F-22)** or types a category name in the search bar.
2. App lists products in that category (paginated, 20 per page).
3. User taps a "select" toggle on up to 5 products to add to a comparison tray (this is the **Compare-this-shelf** mode, F-19).
4. User taps "Compare these" → a single screen shows a ranked list of the selected products, each with:
   - Both badges
   - One-line contrastive justification ("vs the worst of the selection" or "vs the best Eco-Score in the selection")
5. User can re-rank by moving the slider, which immediately reorders the list.
6. User picks one and triggers an action (add to list, etc.).

### Per-persona walkthrough

#### Marc Vidal

Marc is planning his shopping. He opens the *yogurts* category, selects four candidates (two he already knows, two new), taps Compare. He sees a ranking and the one-line justifications. He picks the top of the ranking. **Saves him a 2-minute supermarket comparison.**

**Acceptance for Marc**: 4-product comparison completes in under 30 seconds; ranking is consistent with the current slider weighting.

#### Pau Estarellas

Pau wants to compare ingredients across yogurts. He selects five candidates. The ranking is fine but he taps each to drill into the nutrient table. Three of them have identical sugar content (rounding); the differentiator is protein. The contrastive justifications make this explicit: *"This one has 8g more protein per 100g than the bottom of the selection."* Pau is happy.

**Acceptance for Pau**: drill-down is reachable from the comparison view; justifications surface the most differentiating axis automatically.

#### Lluís Tomàs

Lluís opens the *snacks* category for weekend planning. He selects five products from brands he is curious about. The comparison shows two with surprisingly bad Eco-Scores despite the brand's marketing. He takes a screenshot. The interface did not moralise his selection ("you should pick the healthy one") — it just showed the data.

**Acceptance for Lluís**: no judgmental copy on the comparison screen; the data does the talking.

### Failure modes covered

- More than 5 products selected → toast *"Comparing up to 5 at a time."*, oldest selection is dropped.
- Selected products span multiple categories → the comparison still works, but a small note clarifies the comparison is across categories ("cereals vs yogurts vs beverages") which makes the Eco-Score axis more meaningful than the Nutri-Score axis.

## Cross-flow expectations (the WA3 hooks as acceptance)

For every flow above, the following must be true (regardless of persona):

- **H1**: Both badges are on every card, every screen. No exception.
- **H2**: At least one contrastive sentence is visible on each card without user interaction.
- **H3**: That sentence contains exactly one verifiable number with units.
- **H4**: The slider is reachable in two taps from anywhere in the app.
- **H5**: A path to compare 2–5 products exists.
- **H6**: First-visit onboarding asks goals + age + gender; nothing else is mandatory.
- **H7**: Every card terminates in at least one action button.

If a flow violates a hook, the flow is broken — not the hook.

## Out of scope for the flows

- Login / account creation (the brief does not require it).
- Mobile-native barcode scanning (we use the desktop webcam path).
- Multi-language UI (English-only base).
- Saving comparison sessions across devices (localStorage only, single device).
