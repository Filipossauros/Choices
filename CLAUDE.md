# Escolhas — Avaliação Multicritério de Alternativas

Local-first web app ("Escolhas") for evaluating and ranking alternatives using the MACBETH method (Bana e Costa & Vansnick 1994). The UI is domain-agnostic — it does not assume any particular context (e.g. architecture or conformity).

## Quick start

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npx vitest run     # unit tests (20 tests)
npx tsc --noEmit   # type-check
npm run build      # production build
```

## Architecture

```
src/
  domain/types.ts          # Core domain model (MacbethModel, JudgmentMatrix, …)
  engine/                  # Pure math — no React, no side effects
    lp.ts                  # glpk.js (WASM) wrapper
    consistency.ts         # LP consistency check + correction suggestions
    scaling.ts             # Cardinal scale derivation (Neutral=0, Good=100)
    weighting.ts           # Swing weighting LP
    aggregation.ts         # Two-tier gate/qualification aggregation
    sensitivity.ts         # Weight-sensitivity analysis
  repository/
    indexeddb.ts           # idb-backed persistence (save/load/export/import)
  ui/
    store.ts               # React context + useReducer (AppState, Action)
    components/            # Shared components (ModelHeader, JudgmentMatrixEditor, …)
    screens/               # One file per screen (Home → … → Report)
  i18n/pt-PT.ts            # All UI strings in Portuguese (PT-PT)
```

## MACBETH method

**Two-tier decision flow:**
- **Tier 1 — Gate (habilitação):** binary pass/fail eliminatory checks; any fail = rejected before aggregation.
- **Tier 2 — Qualification (qualificação):** MACBETH scoring with additive model V(p) = Σᵢ kᵢ·vᵢ(p), anchored Neutral=0 / Good=100.

**Categories:** C0 (nula) → C6 (extrema). Judgments can be exact `{kind:'exact', category}` or interval `{kind:'interval', lo, hi}`.

**Consistency LP (consistency.ts):**  
Maximise z subject to:
- v[i] ∈ [0,1] for all alternatives (bounds the LP; z ≤ 1)
- v[last] = 0 (least-attractive fixed as anchor)
- Ordinal: v[A] − v[B] ≥ z for each pair with category ≥ 1
- Cardinal: d(higher-cat pair) − d(lower-cat pair) ≥ z for all pairs with different non-zero categories

z* > 0 ⟹ consistent. Cardinal constraints deduplicate variable coefficients when pairs share an alternative (e.g. A-B and A-C both contain A — the shared variable is collapsed by summing coefficients before passing to GLPK, which rejects duplicate names in a row).

**Scale LP (scaling.ts):** threshold variables s[1]…s[6]; neutral and good levels fixed as EQ constraints (normalization). Admissible ranges computed via parallel min/max LPs per level.

## Extension points

- **Multi-assessor:** `JudgmentMatrix.assessorId` + `DEFAULT_ASSESSOR_ID` constant. Future: aggregate multiple assessors' matrices before deriving scales.
- **Conformity module (Piso 3):** hook in `aggregation.ts` after verdict assignment.

## Key dependencies

| Package | Purpose |
|---|---|
| `glpk.js` | WASM GLPK — LP solver (excluded from Vite pre-bundling) |
| `idb` | IndexedDB wrapper |
| `recharts` | Sensitivity chart |
| `jspdf` + `jspdf-autotable` | PDF report export |
| `i18next` | PT-PT translations |
| `vitest` | Unit tests |
