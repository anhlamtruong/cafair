# AI HIRE AI Agents

This folder contains the **agent-side logic** for the AI Hire AI app. It powers both **recruiter-side screening** and **candidate-side application automation**, with outputs that are ready for UI rendering, backend actions, and future ATS sync.

---

## What’s implemented

### Recruiter-side agents
- **Triage Agent** (`triage.ts`)  
  Routes candidates into `RECRUITER_NOW`, `QUICK_ASYNC_SCREEN`, or `POLITE_REDIRECT`.

- **Verify Agent** (`verify.ts`)  
  Detects artifact mismatches, suspicious patterns, and risk signals across resume, transcript, and essay.

- **Micro-Screen Agent** (`microscreen.ts`)  
  Scores short transcript-based screens on communication, role fit, and depth.

- **Candidate Packet** (`candidatePacket.ts`)  
  Combines triage, verification, and micro-screen into one recruiter-ready payload.

- **ATS Payload Adapter** (`atsPayload.ts`)  
  Converts recruiter-side results into ATS-ready notes, tags, tasks, and follow-up actions.

- **Bedrock Recruiter Screen** (`bedrockScreen.ts`)  
  Runs a real Bedrock-based recruiter screen using Amazon Nova Lite and returns validated structured scoring output.

- **Social Screen** (`socialScreen.ts`)  
  Produces social intelligence / verification-style output for LinkedIn, GitHub, and Google signal checks.

---

### Candidate-side agents
- **Candidate Plan Agent** (`candidatePlan.ts`)  
  Generates a step-by-step action plan for job search, resume tailoring, referrals, applications, and follow-ups.

---

## Adapters and services

- **Nova Act Adapter** (`adapters/novaAct.ts`)  
  Starts and checks Nova Act workflow runs for action automation.

- **Bedrock Adapter** (`adapters/bedrock.ts`)  
  Handles Bedrock model listing, text generation, and invoke calls in stub or real mode.

- **Embeddings Adapter** (`adapters/embeddings.ts`)  
  Placeholder / helper layer for future semantic matching and retrieval.

- **Bedrock Service Wrapper** (`services/bedrockClient.ts`)  
  Adds retries, metrics, guardrails, model/profile selection, and fallback handling around Bedrock calls.

---

## Prompts, parsers, and schema

- **Prompts**
  - `prompts/candidateScreen.ts`
  - `prompts/socialScreen.ts`
  - `prompts/resumeTailor.ts`

- **Parsers**
  - `parsers/candidateScreenParser.ts`
  - `parsers/socialScreenParser.ts`

- **Schema**
  - `schema/candidateScreenSchema.ts`

These keep prompt logic, response parsing, and validation modular and easier to maintain.

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



Key paths
	•	agents/src/types.ts — shared base types
	•	agents/src/index.ts — public exports
	•	agents/src/agents/* — agent logic
	•	agents/src/adapters/* — AWS / model adapters
	•	agents/src/services/* — orchestration wrappers
	•	agents/src/prompts/* — reusable prompt builders
	•	agents/src/parsers/* — model output parsers
	•	agents/src/schema/* — validation schema
	•	agents/scripts/* — local runners

Current Bedrock status

The Bedrock recruiter screening flow is working in real mode with:
	•	Amazon Bedrock Converse
	•	Amazon Nova Lite
	•	structured JSON output
	•	parser + schema validation
	•	metrics logging

Recommended backend action name for app integration:
	•	getBedrockScreen

This should wrap:
	•	runBedrockCandidateScreen(...)

How this connects to the product

These agents are designed to plug into:
	•	Recruiter UI: lane routing, AI scorecards, social checks, risk popups, ATS actions
	•	Candidate UI: application plans, resume tailoring, referral and follow-up guidance
	•	Nova Act: workflow automation for ATS sync, scheduling, and task execution
	•	Bedrock: reasoning, screening, and structured output generation

AI Hire AI is an automation layer, not a replacement for an existing ATS.

Next
	•	Add backend wrapper files in apps/web-client for app integration
	•	Expose stable procedures like getBedrockScreen
	•	Connect recruiter candidate drawer to real Bedrock output
	•	Connect candidate-side plan UI to candidatePlan.ts
	•	Add frontend wiring for Nova Act actions


Current structure

```bash
agents/
  README.md
  AWS-DOC.md
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
```