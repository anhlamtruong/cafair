# FairSignal Agents

This folder contains the **agent-side logic** for FairSignal’s online career fair copilot: **triage**, **verification**, and **micro-screen scoring**. These agents output **UI-ready objects** (lanes, flags, scorecards) and **ATS-ready recommendations** (notes, tags, next steps).

---

## What’s implemented 

### 1) Triage Agent (`triage.ts`)
Routes candidates into a lane using a role rubric + candidate artifacts:
- **RECRUITER_NOW** (high match)
- **QUICK_ASYNC_SCREEN** (medium / needs more signal)
- **POLITE_REDIRECT** (low fit)

Outputs: `fitScore`, `lane`, evidence items, and a short summary.

### 2) Verify Agent (`verify.ts`)
Detects **mismatches** and **risk flags** across artifacts (resume / transcript / essay):
- Claim mismatches (e.g., years of experience vs graduation timeline)
- Suspicious text patterns (template-like writing)
- Missing substantiation (strong claims but thin artifacts)

Outputs: `riskScore`, `flags[]`, `mismatches[]`, and **2–3 suggested recruiter actions** (clickable CTAs).

### 3) Micro-Screen Agent (`microscreen.ts`)
Scores a 60–90s micro-screen transcript (text/voice transcript):
- `communication`
- `roleFit`
- `depth`

Outputs: `overall`, `confidence`, highlights, follow-up questions, and evidence snippets.

---

## Local demos

Run from the repo root:

```bash
npx tsx agents/scripts/run-local.ts
npx tsx agents/scripts/run-verify-local.ts
npx tsx agents/scripts/run-microscreen-local.ts
```

Expected: JSON printed to console with realistic demo outputs.

---

## Key paths

- `agents/src/types.ts` — shared types (candidate/role/artifacts/results)
- `agents/src/agents/triage.ts` — triage router
- `agents/src/agents/verify.ts` — verification risk/flags
- `agents/src/agents/microscreen.ts` — micro-screen scoring
- `agents/src/index.ts` — public exports
- `agents/scripts/*.ts` — local runners

---

## How this connects to the product

These agents are designed to plug into:
- **UI**: lane routing, candidate cards, risk popups, micro-screen scorecards
- **Nova Act (later)**: use outputs to push **ATS-ready notes/tags/stage changes** into an existing ATS (FairSignal is an overlay, not an ATS replacement)

---

## Next 

- Add a `candidatePacket.ts` orchestrator (triage + verify + microscreen → one UI payload)
- Add an `atsPayload.ts` adapter (packet → structured ATS update object)
- Add a `HANDOFF.md` for fullstack integration (payload contracts + examples)