# Choices — Avaliação Multicritério de Alternativas

Local-first web app ("Choices") for evaluating and ranking alternatives using the MACBETH method (Bana e Costa & Vansnick 1994). The UI is domain-agnostic — it does not assume any particular context (e.g. architecture or conformity).

## Quick start

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npx vitest run     # unit tests (38 tests)
npx tsc --noEmit   # type-check
npm run build      # production build
```

## Two flows: create vs apply

The app separates **building** a reusable evaluation model from **applying** it
to concrete proposals. The entry page (Home) offers both paths.

- **`EvaluationModel`** (template): valueTree (criteria + descriptors),
  judgmentMatrices, derivedScales, weights, **decisionScale**. Built in the
  *criação* flow: **Critérios → Escalas → Ponderação → Perfis de decisão**
  (perfis last, since deriving its cut-offs needs scales + weights).
- **`Evaluation`** (application): embeds a snapshot of an `EvaluationModel` plus
  `options`, `performances`, `aggregationResult`. Built in the *aplicação* flow:
  **Análise e avaliação → Resultados → Sensibilidade → Relatório**.

Both are persisted (two IndexedDB stores) and exported/imported as JSON,
discriminated by a `kind: 'model' | 'evaluation'` field.

## Architecture

```
src/
  domain/types.ts          # EvaluationModel, Evaluation, DecisionBand, JudgmentMatrix, …
  domain/decision.ts       # Decision-scale helpers (classify, sortBands, defaults)
  engine/                  # Pure math — no React, no side effects
    lp.ts                  # glpk.js (WASM) wrapper
    consistency.ts         # LP consistency check + correction suggestions
    scaling.ts             # Cardinal scale derivation + continuous scoreAtPosition
    interpolation.ts       # Monotone-cubic (PCHIP) smooth value curve
    weighting.ts           # Swing weighting LP
    aggregation.ts         # Two-tier aggregation over an Evaluation
    sensitivity.ts         # Weight-sensitivity analysis
  repository/
    indexeddb.ts           # idb persistence: models + evaluations stores
  ui/
    store.ts               # React context + useReducer; create/apply modes
    components/            # ModelHeader (per-mode nav), JudgmentMatrixEditor, …
    screens/               # Home, Criteria, DecisionScale, Scales, Weighting,
                           #   Analysis, Results, Sensitivity, Report
  i18n/pt-PT.ts            # UI strings in Portuguese (PT-PT) — not yet wired via t()
```

## MACBETH method

**Two-tier decision flow:**
- **Tier 1 — Gate (habilitação):** binary pass/fail eliminatory checks; any fail = hard-rejected before aggregation.
- **Tier 2 — Qualification (qualificação):** MACBETH scoring with additive model V(p) = Σᵢ kᵢ·vᵢ(p), anchored Neutral=0 / Good=100.

**Decision scale (Perfis de decisão):** `DecisionBand[]` — N named bands over
V(p); each result gets the highest band whose `minScore` it reaches
(`domain/decision.ts:classify`). A band's cut-off is normally *derived by MACBETH*
rather than typed: a `DecisionBand.referenceProfile` (`criterionId -> levelId`)
describes a reference alternative, and `engine/aggregation.ts:scoreProfile`
computes its global V(p) under the model's scales + weights — that score becomes
the band's `minScore` (global impact, not per-criterion comparison). The Perfis
screen keeps `minScore` in sync with the profile; manual numeric entry remains a
fallback. Replaces the old fixed approved/conditional thresholds.

**Value curves:** the derived cardinal values at discrete levels are connected by
a monotone-cubic (PCHIP) interpolant (`engine/interpolation.ts`) — smooth, passes
exactly through every node, no overshoot. Criteria flagged `continuous` let
proposals score at any position along the descriptor, read from this curve
(`scaling.ts:scoreAtPosition`).

**Categories:** C0 (nula) → C6 (extrema). Judgments can be exact `{kind:'exact', category}` or interval `{kind:'interval', lo, hi}`.

**Consistency LP (consistency.ts):**  
Maximise z subject to:
- v[i] ∈ [0,1] for all alternatives; z ∈ [0,1] (explicit cap so all-C0 matrices stay bounded and solve as consistent)
- v[last] = 0 (least-attractive fixed as anchor)
- Ordinal: exact C0 ⟹ v[A] = v[B]; catLo ≥ 1 ⟹ v[A] − v[B] ≥ z; interval {lo:0, hi>0} ⟹ v[A] − v[B] ≥ 0 (indifference admissible, no margin)
- Cardinal: d(p1) − d(p2) ≥ z only when catLo(p1) > catHi(p2) — interval-aware; overlapping category ranges impose no ordering

z* > 0 ⟹ consistent. Cardinal constraints deduplicate variable coefficients when pairs share an alternative (e.g. A-B and A-C both contain A — the shared variable is collapsed by summing coefficients before passing to GLPK, which rejects duplicate names in a row).

**Scale LP (scaling.ts):** threshold variables s[1]…s[6]; neutral and good levels fixed as EQ constraints (normalization); z capped (≤100) so partial matrices that never chain to the anchors stay bounded. Intervals starting at C0 lower-bound the difference at 0 (no s_0). Admissible ranges computed via parallel min/max LPs per level **with z fixed at z*** — the range is the variation among maximally-discriminating scales (z free would collapse all category separations into degenerate judgment-violating spans). Same pattern in weighting.ts (z ≤ 1; all-equal judgments now yield 1/n).

**Decision-profile integrity (aggregation.ts):** `resolveBands` treats a profile whose levelId no longer resolves in the derived scale as incomplete (falls back to the cached `minScore` — never renormalizes over a subset); `bandOrderConflicts` flags bands whose live-resolved cut-offs invert the stored order; `OptionResult.pendingGates` marks classifications provisional while gates are unanswered.

## Extension points

- **Multi-assessor:** `JudgmentMatrix.assessorId` + `DEFAULT_ASSESSOR_ID` constant. Future: aggregate multiple assessors' matrices before deriving scales.
- **Conformity module:** hook in `aggregation.ts` after band classification.

## Key dependencies

| Package | Purpose |
|---|---|
| `glpk.js` | WASM GLPK — LP solver (excluded from Vite pre-bundling) |
| `idb` | IndexedDB wrapper |
| `recharts` | Sensitivity chart |
| `jspdf` + `jspdf-autotable` | PDF report export |
| `i18next` | PT-PT translations |
| `vitest` | Unit tests |
