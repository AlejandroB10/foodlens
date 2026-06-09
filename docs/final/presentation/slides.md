---
title: "FoodLens — Transparent dual-axis food recommendations"
author: "FoodLens · HCI 11755 · UIB MUSI-IA"
date: "June 2026"
theme: "Singapore"
colortheme: "dolphin"
fontsize: 10pt
aspectratio: 169
header-includes:
  - \setbeamertemplate{headline}{}
  - \setbeamertemplate{navigation symbols}{}
---

## FoodLens

**Transparent multi-objective food recommendations via contrastive XAI**

Health (Nutri-Score) and Eco (Environmental Score) — shown together, never averaged, always explained with one verifiable number.

Team: Alejandro Bordón · Soufyane Youbi · Alejandro Rodríguez · Pau Girón

Course 11755 — Human-Computer Interaction · MUSI-IA, UIB · June 2026

::: notes
**Tuti:** Morning. We're team FoodLens, and this is our final project for the course. Here's the problem in one line: most food apps hand you a single score and expect you to trust it. We don't do that. We show two things at once, how healthy a product is and how heavy its footprint is, and when those two disagree we point straight at it instead of hiding it. Every recommendation comes with one plain sentence built on a real number from Open Food Facts. The four of us will take you through the next twenty-five minutes: how we got here, the AI under the hood, how we plan to test it, the problems that fought back, a live demo, and what we'd change. I'll start with the design.
:::

## Outline

1. **Design process & rationale**
2. **XAI methods selection**
3. **Key insights from user testing**
4. **Technical & design challenges**
5. **Live demonstration of the dashboard**
6. **Lessons learned & future improvements**

All four of us present; roughly eight minutes of the talk is a live demo of the working web platform, right before the conclusions.

::: notes
**Tuti:** Quick map of where we're going. Six points, all required by the rubric. I take the design process. Sufi does the explainable-AI side and why we picked those methods. Alex covers how we test it with real users. Pau takes the technical and design problems. Then we run the live demo together, each of us driving the bit we just talked about. And we close with the lessons, split between Alex and Pau, plus what's next. We left the demo for the end on purpose, right before the conclusions, so by the time you see it running you already know what every piece means. Let's start with the design.
:::

# 1. Design process & rationale

## WA3 discovery: research before code

We ran **six semi-structured interviews** with people who make real grocery decisions — from a 20-year-old student to a 41-year-old designer on a quasi-vegetarian diet.

- Protocol kept **context exploration separate from XAI concepts** to avoid leading questions
- Thematic analysis (Braun & Clarke): **47 codes -> 5 Key Insights**
- The asymmetry we found: **health is a label you read in passing; ecology is buried in a database** — and the conflicts between them are surfaced nowhere

Every feature we shipped traces back to one of those insights. Nothing was designed by intuition alone.

::: notes
**Tuti:** We didn't start by writing code. We started by listening. Six interviews with people who actually do the weekly shop, from someone who barely cooks to someone running a near-vegetarian household. We kept the questions well away from anything about AI so we wouldn't lead them. Then we coded the transcripts, forty-seven codes that collapsed into five Key Insights. The thing that jumped out was an imbalance. Nutri-Score is right there on the front of the pack. The Eco-Score almost never is. And nobody tells you when the two disagree. That gap is the whole reason FoodLens exists.
:::

## The five Key Insights

- **KI-1 — Visible reasoning is a prerequisite for trust.** An opaque score reads as marketing. Never hide the "why".
- **KI-2 — The value-action gap is contextual.** Time, budget, fatigue override good intentions. Never moralise.
- **KI-3 — Single-axis labels create axis blindness.** A soda outscoring juice; water-hungry almonds looking "healthy".
- **KI-4 — Contrastive framing turns explanations into decisions.** "30% less sugar than yours" beats "70/100".
- **KI-5 — Tolerance for configuration varies widely.** Sensible default, presets, advanced slider behind progressive disclosure.

::: notes
**Tuti:** These five insights are what we kept checking ourselves against. KI-1: people don't reject algorithms for being algorithms, they reject the ones whose reasoning is hidden. So always show the why. KI-2: the gap between what people want and what they actually buy is about time and money, not willpower, so we never lecture. KI-3: a single label gives false confidence. Our participants handed us real cases, a soda beating a juice on Nutri-Score, almonds that look healthy but cost a lot ecologically. KI-4: people reached for comparisons on their own. A difference lands faster than an absolute grade. And KI-5: everyone wanted to tune health against eco, but some wanted one button and others wanted the full slider.
:::

## From insights to seven Design Hooks

| Hook | Rule it enforces |
|---|---|
| **H1** | Dual-axis default — eco badge never hidden, even "no data" renders with a caption |
| **H2** | Reasoning IS the recommendation — contrastive sentence open by default |
| **H3** | One sentence, one number — charts are drill-downs, not the entry point |
| **H4** | Configurable first axis — health/eco slider; price behind "Advanced" |
| **H5** | Compare-this-shelf — N products in, ranked list out, one-line justification each |
| **H6** | Minimal onboarding — goals + age + gender only |
| **H7** | Close into action — every card ends in a real next step |

::: notes
**Tuti:** We turned those insights into seven Design Hooks, hard rules for the interface. H1: both axes always on screen. Even when Open Food Facts has no eco grade, the badge still shows up with a "no data" caption instead of vanishing. H2: the explanation isn't on a separate page, it's open on the card by default. H3: one sentence, one number. Charts are a drill-down, not the front door. H4: the slider is health against eco, with price tucked behind an Advanced toggle. H5: comparison takes several products and gives back a ranked list. H6: onboarding asks the bare minimum. H7: every card ends in something you can do. These are what we test the build against.
:::

## Personas: who we are designing for

::: columns
:::: {.column width="50%"}
- **Marc Vidal** — time-strapped pragmatist. Shops on autopilot, will not configure. Wants instantly visible reasoning.
- **Pau Estarellas** — sceptical analyst. Distrusts opaque scores. Needs verifiable numbers and the drill-down.
::::
:::: {.column width="50%"}
- **Lluís Tomàs** — autonomous planner. Hates greenwashing and moralising. Wants quick visual graphs, opt-in only.
- **Aina Servera** — convenience seeker. Time- and budget-bound. Hard boundary against guilt-inducing UX.
::::
:::

Four personas, four constraints. If a decision helps one and hurts another, we name the trade-off.

::: notes
**Tuti:** We pulled four personas out of the interviews, each one carrying a constraint. Marc shops on autopilot, so the system has to work with zero setup. Pau Estarellas won't trust a score he can't check, so he's why the drill-down exists. Lluís hates greenwashing and being preached at, so the tool has to be opt-in and on demand. And Aina is so short on time and money that any app that lectures her loses instantly, she's our hard line against judgy copy. When two of them pull in opposite directions, we show the trade-off instead of quietly picking a side. That's the foundation. Sufi, over to you for the AI.
:::

# 2. XAI methods selection

## Why these methods: Miller's criteria

Tim Miller (2019): good explanations are **contrastive, selective, and grounded in the user's mental model** — not raw scores.

We chose each XAI component to satisfy a specific criterion:

- **Contrastive** -> "why this and not your usual?" — the contrastive sentence generator
- **Selective** -> one number, not twenty — H3 discipline over rich model output
- **Grounded / auditable** -> an interpretable model plus a verifiable drill-down for the sceptic

The literature gave us the test; our job was to make a vanilla-JS app pass it.

::: notes
**Sufi:** Thanks Tuti. Our XAI choices aren't random, they come straight out of the research on what an explanation actually is. Tim Miller's finding is that good explanations are contrastive, they're selective, and they connect to what the person already knows. A raw model score fails all three. So we matched each technique to one of those. Contrastive: we answer "why this product instead of the one you usually buy". Selective: we show one number, not the whole feature vector, that's our H3 rule. Grounded: we use a model you can actually interpret, and we give the sceptic a way to check the maths. The literature gave us the test; we built the app to pass it.
:::

## An interpretable model: Random Forest for Nutri-Score

- The system reads the **official `nutriscore_grade`** — we never recompute the certified label locally.
- For the XAI pipeline we trained a **Random Forest** on a real OFF dump (~80% five-fold CV accuracy).
- Why a forest, not a deep net: **feature importances are first-class** — fat, sugars, saturated fat, salt, protein, fibre, energy each carry a readable weight.
- This is a **pipeline-verification model**: it proves the explanation path end-to-end, it does not replace the official grade.

::: notes
**Sufi:** First the model. We don't recompute the Nutri-Score ourselves. The official formula has category quirks, so we read the certified `nutriscore_grade` straight from the API. For the explanation pipeline, though, we trained a Random Forest on a real Open Food Facts dump, around eighty percent accuracy on five-fold cross-validation. Why a forest and not a neural net? Because the feature importances come for free and you can read them, each of the seven per-hundred-gram nutrients gets a weight that makes sense. I want to be honest about scope here. This is a model that verifies the pipeline. It proves the explanation path works end to end. It isn't trying to replace the official grade.
:::

## SHAP -> one contrastive sentence, one number

![](figs/shap_explanation.png){width=78%}

- **SHAP local attribution** computes each nutrient's contribution for *this* product
- We compress that vector into **one contrastive sentence with exactly one verifiable number** (H3)
- The full SHAP detail is parked behind an **"Advanced explanation"** — selective by default, complete on demand

::: notes
**Sufi:** This is where Miller meets the screen. SHAP gives us local attribution: for this exact product, how much did sugar push the grade down, how much did fibre push it up. That's a vector. A vector breaks the selective rule and buries the shopper. So we squeeze it into one sentence with one number, which is H3 in practice. We don't throw the rest away. It sits behind an "Advanced explanation" toggle, the waterfall you're looking at. One sentence for Marc, the full thing on demand for anyone who wants it.
:::

## The scatter drill-down: for the sceptic who verifies

![](figs/scatter_plot.png){width=64%}

- The contrastive sentence answers Marc in half a second; **Pau Estarellas wants to see the space.**
- `GET /api/scatter` returns a **visual XAI scatter plot**: where this product sits on the health/eco plane relative to its category.
- The drill-down is **opt-in** — Miller's selectivity, and Lluís's "no moralising, just show me the graph".

**How each method helps the user:** sentence = instant trust; SHAP advanced view = traceability; scatter = independent verification.

::: notes
**Sufi:** One sentence is plenty for someone in a hurry. It isn't enough for the sceptic. Pau Estarellas told us flat out he won't trust a grade he can't check. So the drill-down is this scatter plot, served from our scatter endpoint, that drops the product onto the health-versus-eco plane next to the rest of its category. He can see for himself whether the recommendation holds up. And it's opt-in, it only shows when he asks for it, which keeps Lluís happy too, he wanted graphs, not guilt. Three layers for three people: the sentence gives Marc instant trust, the advanced SHAP view gives traceability, and the scatter lets Pau check it himself. One more slide before I hand over, on the AI we used.
:::

## The AI we used — in the product and in development

::: columns
:::: {.column width="52%"}
**In the product (ML / XAI)**

- **Random Forest** (scikit-learn) — predicts Nutri-Score for the explanation pipeline
- **SHAP** — local feature attribution -> the one contrastive sentence
- **Weighted KNN** — the Alternative Engine (healthier / greener substitutes)
- **DuckDB** — queries the full OFF dump at scale
::::
:::: {.column width="44%"}
**In development (generative AI)**

- **LLM coding assistants** to speed up boilerplate, tests, and docs
- **Human-verified**: every change reviewed, adversarially audited (this caught the dead allergen filter), and gated by tests
- We **direct** the AI — the design and the verification are ours
::::
:::

We disclose both: the AI *inside* FoodLens, and the AI we used to *build* it.

::: notes
**Sufi:** One honest slide before I pass it on, because we think you should declare both kinds of AI. Inside the product: a scikit-learn Random Forest drives the Nutri-Score explanation, SHAP gives the local attribution we compress into a sentence, a weighted KNN powers the alternatives, and DuckDB lets us query the full Open Food Facts dump. In development: we used AI coding assistants for boilerplate, tests, and docs. But every change was reviewed by a human, picked apart in adversarial review, which is literally how we caught a dead allergen filter, and gated by tests. We steer the AI. The design calls and the checking are ours. With that out in the open, Alex will tell you how we evaluate all of this with users.
:::

# 3. Key insights from user testing

## Two instruments, built in-app (F-46)

![](figs/eval_form.png){width=46%}

- **SUS** (Brooke 1996) — 10 items, usability of the dashboard (KI-2)
- **Explanation Satisfaction** — anchored to **XEQ** (Wijekoon 2024): clarity, consistency, on-demand detail, reliability/fairness, improved understanding (KI-1, KI-4)
- Both **wired into the prototype** — completed in the same browser session, no external survey tool

::: notes
**Alex:** Evaluation. We measure two separate things and we keep them apart on purpose, so a nice usability number can't paper over a weak explanation layer. First is the System Usability Scale, Brooke, 1996, ten items, basically: can people get around the dashboard. Second is explanation satisfaction, anchored to the XEQ construct from Wijekoon and colleagues, 2024, so: is it clear, is it consistent, does it give detail when you ask, does it feel reliable and fair, does it actually help you understand. And neither of these is a Google Form. They're a feature in the app, so a participant finishes the tasks and fills them in right there, same browser, same session, no jumping out to another tool.
:::

## Procedure & cohort

- **Six task scenarios** mapped to documented user flows: onboarding+search · read explanation · find alternative · compare shelf · set "my usual" · drag slider
- **SEQ** after each task for per-flow diagnostics; SUS once at the end
- **Cohort:** the six WA3 interviewees re-used (Nielsen formative, n=6). P01 & P03 are team members — declared bias, weighted as optimistic
- Scoring **pre-registered**: odd items raw minus 1, even items 5 minus raw, then x2.5 to 0-100; benchmark **68**, Sauro–Lewis grade bands

::: notes
**Alex:** The procedure is six tasks that follow our documented flows in order. Onboarding and search first, because everything else depends on them, then reading an explanation, finding an alternative, comparing a shelf, setting a usual product, and dragging the slider. After each task there's a Single Ease Question so we can pin friction to a specific flow. SUS comes once, right at the end. The cohort is the same six people we interviewed back in WA3, so this is a small formative study, six users, not a powered experiment. Two of the six are on the team. We say that openly and treat their data as the optimistic case. And the scoring is locked in advance: the standard SUS formula, the sixty-eight benchmark, the Sauro-Lewis grade bands, all committed before any data exists.
:::

## Honest status: instrument built, data pending

- The instrument is **built, wired, and ready**. The task suite and cohort are defined.
- **No participant data has been collected yet.** We will **not** quote a SUS score we did not measure.
- Pre-committing the scoring rules and thresholds **before** collection is sound method — it removes the temptation to fit interpretation to whatever numbers arrive.
- **Pre-registered hypotheses:** (H-a) contrastive + drill-down raises satisfaction for the sceptic; (H-b) zero-config default -> high SEQ for the pragmatist; (H-c) any moralising copy erodes trust for the convenience seeker.

::: notes
**Alex:** Now the honest part, and I want to be really clear about it. The instrument is built and wired, the tasks and the cohort are set, but we haven't collected participant data yet. So we're not going to stand here and quote a usability score we never measured. Making up numbers would be about the worst thing an HCI team could do. What we did instead is pre-register everything: the scoring, the thresholds, the bands, and three hypotheses we could genuinely turn out to be wrong about. That the contrastive drill-down lifts satisfaction for the sceptic. That the zero-config path scores well for the pragmatist. And that any moralising phrase costs us trust with the convenience seeker. Committing to all that before the data lands is good method, not a hole in the work. Pau, the technical side is yours.
:::

# 4. Technical & design challenges

## Open Food Facts: the API fought back

- **Intermittent 503s** on `/search` -> silent fallback to `sample_products.json`, non-blocking banner keeps the UI alive
- **Missing `User-Agent` -> 403.** Mandatory header `FoodLens-MVP/0.1` on every call
- **Field rename:** read `environmental_score_grade` **first**, fall back to legacy `ecoscore_grade`
- **Rate limits** (search 10/min) -> **Redis** cache budgeting on the backend
- **Graceful degradation:** backend times out at **1500 ms** (KNN) / **2000 ms** (explanation), then falls back to the in-browser path

Design discipline under pressure: keep the **eco badge visible** for "not-applicable" (H1); hold **one-sentence-one-number** even when SHAP hands us a rich vector (H3).

::: notes
**Pau:** Thanks. The biggest single headache was the Open Food Facts API. Search throws random 503s, so we built a quiet fallback to a ten-product local sample with a banner that doesn't block anything, the UI never dies on you. Forget the User-Agent header and it returns a 403, so that header is on every call now. The eco field got renamed, so we read the new `environmental_score_grade` first and fall back to the old `ecoscore_grade`. Search is capped at ten requests a minute, so the backend budgets its calls through a Redis cache. And the backend is optional, it times out, fifteen hundred milliseconds for recommendations, two thousand for explanations, then quietly hands off to the in-browser path. On the design side, the hard part was holding the line: keeping the eco badge visible even when the grade is not-applicable, and not letting a fat SHAP vector break our one-sentence rule.
:::

## Honest QA: defects we found and fixed before release

An adversarial review + engineering pass caught **three real defects** — none of which a usability test would have caught:

- **Allergen filters were dead.** `api.js` never requested `allergens_tags`, so cards carried no allergen data — a **safety issue**. Fix: request the field, normalise to tokens, exact OFF-token matching.
- **Category browser search was commented out.** `runSearch` wiring was dead. Fix: connected dropdown filters to live in-memory rendering.
- **Falsy-zero bug.** A genuine **0 g** rendered as "no data" under a truthiness test. Fix: explicit `typeof`/null guards — real 0 shows "0"; missing shows "no data".

We disclose these candidly. Finding them strengthens the build; hiding them would not.

::: notes
**Pau:** And here's the part we're genuinely proud of, even though it's about bugs. An adversarial review and then an engineering pass turned up three real defects before release, and not one of them is something a usability test would have caught. First, and worst: the allergen filters were dead. The frontend wasn't even asking for the allergens field, so there was nothing to filter on. That's a safety problem, not a cosmetic one. We fixed it by pulling the field, normalising it to tokens, and matching exactly. Second, the category search was commented out, dead code, so we wired the filters back to live rendering. Third, a zero that read as missing: a real zero grams of sugar showed up as "no data" because of a truthiness check, so we added proper null guards. We're putting all three on the table. In our field, catching and fixing your own bugs honestly beats a slide that just looks clean. Right, time to show it working. We run the demo together, the four of us.
:::

# 5. Live demonstration

## What we will show live (about 8 min)

1. **Onboarding** — goals + age + gender only (H6), then a product search
2. **Dual-axis card** — Nutri-Score and Eco-Score side by side, contrastive sentence **open by default** (H1, H2, H3)
3. **Advanced explanation** — expand SHAP attribution; open the scatter drill-down
4. **Priority slider** — drag health/eco; show the ranking actually changes (H4, KI-5)
5. **Filters** — allergen + eco multi-criteria filtering; category browser (Batch-I)
6. **Compare this shelf** — N products -> ranked list + winner-highlight table -> **CSV export** (H5)
7. **i18n** EN/ES/CA · barcode scan · dark mode · PWA

**AI live, not mock-ups:** the SHAP explanation + scatter (step 3) and the KNN Alternative Engine (steps 5–6) run on the live scikit-learn + SHAP backend.

**Fallback:** if the live app fails, the next two slides are screenshot backups.

::: notes
**Todos:** Right, you've got the full picture, so let's actually show it. We run this part as a team, each of us driving the bit we just presented. It opens on the home page, one clear thing to do, none of the wall of controls you usually get hit with. From there, Discover: a search and the dual-axis grid, both badges on every card, the sentence already open. Click any product and it gets its own page, the reasoning, the main ingredients, and the advanced SHAP view and the scatter Sufi showed you, all on one screen. Drag the priority slider and the ranking really does re-order, a sceptic can confirm it's doing something. Then the diet-and-ethics and allergen filters, and the category browser. And compare-this-shelf: a few products in, a ranked list out with a winner-highlight table and a CSV export. Onboarding still asks only goals, age, and gender, that's H6. If anything falls over, the next two slides are screenshot backups. Switching to the app now.
:::

## Demo backup A — dashboard & dual-axis grid

![](figs/dashboard_home.png){width=72%}

Results grid: every card shows both badges. Missing data renders as **?** or **—** with a caption — never suppressed (H1).

::: notes
**Todos:** This is the backup if the live app plays up, the Discover view. The results grid: every card carries both badges, the contrastive sentence open by default, and a little toggle to drop the product into a comparison. Look at the cards where data is missing, the eco badge still shows, with a question mark or a dash and a caption, instead of disappearing. That's H1 in the actual markup: missing gets shown, never hidden.
:::

## Demo backup B — comparison view

![](figs/comparison_view.png){width=70%}

Ranked summary + one-line contrastive justification per product + attribute table highlighting the winner per axis. Genuine **0 g** renders as "0", not "no data".

::: notes
**Todos:** And the second backup, the Compare view. A few products go in, and out comes a ranked summary with a one-line reason for each, sitting on top of a table that highlights whichever product leads on each axis, Nutri-Score, Eco-Score, energy, sugars, fat. Notice one small thing that cost us a real bug fix: a genuine zero grams of sugar shows as "0", not "no data". Missing and zero aren't the same, and the table respects that now. That's the platform. Alex will pull the lessons together, and then Pau closes on where this goes next.
:::

# 6. Lessons learned & future improvements

## Lessons learned

- **Research pays for itself.** Five Key Insights gave us a non-negotiable spec — we never argued about features from taste.
- **Honesty is a feature.** Disclosing dead filters and pending data is more credible than a polished fiction. Missing is not zero is a discipline, not a detail.
- **Constraints enabled the work.** No build step, no framework — a vanilla app runs with a double-click, and graceful degradation kept it alive when the API didn't cooperate.
- **XAI is an interaction problem, not a model problem.** The hard part was compressing SHAP into one trustworthy sentence, not training the forest.

::: notes
**Alex:** Lessons, first half. One: the research up front paid for itself many times over. Those five Key Insights became something we could point at, so we argued from evidence instead of personal taste. Two: honesty turned out to be a feature. Owning the bugs we found, and saying out loud that our data collection isn't done yet, reads as far more credible than a polished story, and "missing is not zero" became a real engineering habit. Three, and this one's newer: information architecture is a design decision, not an afterthought. We started with everything crammed onto one endless page and it overwhelmed people, so we split it into a clear home plus separate views for discover, product, compare, and evaluation, each at the right level. Pau will take the rest of the lessons and where we're headed.
:::

## Future work & close

**Future improvements**

- **Run the study** and populate the SUS / XEQ tables with real figures
- **SHAP over DuckDB** in the backend; scale the index from ~862 toward the full OFF catalogue
- **Price as a first-class axis** behind Advanced (H4) — for Aina
- **Playwright** regression suite; longitudinal in-the-wild study vs. a Yuka baseline

**FoodLens** — dual-axis, contrastive, honest. Repo: `github.com/AlejandroB10/foodlens`

### Thank you — questions?

::: notes
**Pau:** Lessons, second half, then we close. Four, and this is the big one: explainable AI is an interaction problem before it's a modelling problem. Training the forest was the easy bit. Compressing SHAP into a sentence a sceptic would actually trust was the real work. Five: the limits we set ourselves helped. No build step, no framework, the app opens with a double-click, and the graceful degradation we were forced into kept it alive every time the API misbehaved. Where it goes next: run the study and fill those placeholder tables with real SUS and explanation numbers; finish the price axis behind the Advanced toggle, which is the thing Aina needs; grow the index, it already holds around eight hundred and sixty real products and we want the whole catalogue; and eventually a longer, in-the-wild study against something like Yuka, to see whether dual-axis contrastive design actually changes what people buy. That's FoodLens. Two scores, a real comparison, honest about what it does and doesn't prove yet. Repo's on the slide. Thanks, we're happy to take your questions.
:::
