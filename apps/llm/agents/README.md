# AI HIRE AI Agents

This folder contains the agent-side logic for the AI Hire AI app. It supports both recruiter-side screening and candidate-side application automation, with outputs designed for UI rendering, backend integration, and future ATS sync.

---

## What’s implemented

### Recruiter-side agents

- **Triage Agent** (`triage.ts`)  
  Routes candidates into `RECRUITER_NOW`, `QUICK_ASYNC_SCREEN`, or `POLITE_REDIRECT`.

- **Verify Agent** (`verify.ts`)  
  Detects artifact mismatches, suspicious patterns, and verification risk across resume, transcript, and essay.

- **Micro-Screen Agent** (`microscreen.ts`)  
  Scores short transcript-based screens on communication, role fit, and depth.

- **Candidate Packet Orchestrator** (`candidatePacket.ts`)  
  Combines triage, verification, and micro-screen into one recruiter-ready packet.

- **ATS Payload Adapter** (`atsPayload.ts`)  
  Converts recruiter-side outputs into ATS-ready notes, tags, tasks, email drafts, and action previews.

- **Bedrock Recruiter Screen** (`bedrockScreen.ts`)  
  Runs a structured recruiter screen using Bedrock and returns validated scoring output.

- **Social Screen** (`socialScreen.ts`)  
  Produces social verification output for LinkedIn, GitHub, and Google-style signals.

---

### Candidate-side agents

- **Candidate Plan Agent** (`candidatePlan.ts`)  
  Generates a step-by-step plan for job search, resume tailoring, referrals, applications, and follow-ups.

---

## Adapters and services

- **Nova Act Adapter** (`adapters/novaAct.ts`)  
  Starts and checks Nova Act workflow runs for action automation.

- **Bedrock Adapter** (`adapters/bedrock.ts`)  
  Handles Bedrock model listing, text generation, and invoke calls in stub or real mode.

- **Embeddings Adapter** (`adapters/embeddings.ts`)  
  Placeholder/helper layer for future semantic matching and retrieval.

- **Bedrock Service Wrapper** (`services/bedrockClient.ts`)  
  Adds retries, metrics, guardrails, model/profile selection, and fallback handling around Bedrock calls.

---

## Prompts, parsers, and schema

### Prompts
- `prompts/candidateScreen.ts`
- `prompts/socialScreen.ts`
- `prompts/resumeTailor.ts`

### Parsers
- `parsers/candidateScreenParser.ts`
- `parsers/socialScreenParser.ts`

### Schema
- `schema/candidateScreenSchema.ts`

These keep prompt logic, response parsing, and validation modular.

---

## Local demos

Run from the repo root:

```bash
npx tsx agents/scripts/run-local.ts
npx tsx agents/scripts/run-verify-local.ts
npx tsx agents/scripts/run-microscreen-local.ts
npx tsx agents/scripts/run-packet-local.ts
npx tsx agents/scripts/run-social-screen-local.ts
USE_REAL_BEDROCK=true AWS_PROFILE=local-iam AWS_REGION=us-east-1 BEDROCK_MODEL_ID=amazon.nova-lite-v1:0 npx tsx agents/scripts/run-bedrock-local.ts
USE_REAL_BEDROCK=true AWS_PROFILE=local-iam AWS_REGION=us-east-1 BEDROCK_MODEL_ID=amazon.nova-lite-v1:0 npx tsx agents/scripts/run-app-bedrock-wrapper-local.ts
```

## Key paths
	•	agents/src/types.ts — shared base types
	•	agents/src/index.ts — public exports
	•	agents/src/agents/* — agent logic
	•	agents/src/adapters/* — AWS/model adapters
	•	agents/src/services/* — orchestration wrappers
	•	agents/src/prompts/* — reusable prompt builders
	•	agents/src/parsers/* — model output parsers
	•	agents/src/schema/* — validation schema
	•	agents/scripts/* — local runners


## Current Bedrock status

The Bedrock recruiter screening flow is working in real mode with:
	•	Bedrock Converse
	•	Amazon Nova Lite (amazon.nova-lite-v1:0)
	•	structured JSON output
	•	parser + schema validation
	•	metrics logging

Current stable app wrapper:
	•	getBedrockScreen(...)

This wraps:
	•	runBedrockCandidateScreen(...)

⸻

## App integration [more in AI-ENDPOINT.md]

Current HTTP route:
	•	POST /api/aihire/bedrock-screen

Health/info check:
	•	GET /api/aihire/bedrock-screen

Expected request body:
```json
{
  "candidateId": "cand_np_001",
  "name": "Nguyen Phan Nguyen",
  "roleTitle": "AI Music Engineer",
  "companyName": "AI Hire AI",
  "resumeText": "Developed real-time AI music transcription engine...",
  "roleRequirements": ["PyTorch", "full-stack", "real-time systems"],
  "transcriptText": "",
  "notes": ""
}
```

The route returns:
	•	ok: true with recruiter screen result
	•	or ok: false with error details

How this connects to the product

These agents are designed to plug into:
	•	Recruiter UI — lane routing, AI scorecards, social checks, risk popups, ATS actions
	•	Candidate UI — application plans, resume tailoring, referral and follow-up guidance
	•	Nova Act — workflow automation for ATS sync, scheduling, and task execution
	•	Bedrock — reasoning, screening, and structured output generation

AI Hire AI is an automation layer, not a replacement for an existing ATS.

⸻

Next
	•	Add more app wrappers for social screen and candidate plan
	•	Expose stable backend procedures for frontend use
	•	Connect recruiter candidate drawer to real Bedrock output
	•	Connect candidate-side plan UI to candidatePlan.ts
	•	Add frontend wiring for Nova Act actions

## Current structure

```bash
agents/
  README.md
  AWS-DOC.md
  AI-ENDPOINT.md
  src/
    types.ts
    index.ts
    agents/
      triage.ts
      verify.ts
      microscreen.ts
      candidatePacket.ts
      atsPayload.ts
      candidatePlan.ts
      socialScreen.ts
      bedrockScreen.ts
    adapters/
      novaAct.ts
      bedrock.ts
      embeddings.ts
    services/
      bedrockClient.ts
    prompts/
      candidateScreen.ts
      socialScreen.ts
      resumeTailor.ts
    parsers/
      candidateScreenParser.ts
      socialScreenParser.ts
    schema/
      candidateScreenSchema.ts
  scripts/
    run-local.ts
    run-verify-local.ts
    run-microscreen-local.ts
    run-packet-local.ts
    run-social-screen-local.ts
    run-bedrock-local.ts
    run-app-bedrock-wrapper-local.ts
```