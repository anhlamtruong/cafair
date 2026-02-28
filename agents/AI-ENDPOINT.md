## Bedrock Recruiter Screen Handoff

Local test commands

### Core Bedrock test
```bash
USE_REAL_BEDROCK=true AWS_PROFILE=local-iam AWS_REGION=us-east-1 BEDROCK_MODEL_ID=amazon.nova-lite-v1:0 npx tsx agents/scripts/run-bedrock-local.ts
```

### App wrapper test
```bash
USE_REAL_BEDROCK=true AWS_PROFILE=local-iam AWS_REGION=us-east-1 BEDROCK_MODEL_ID=amazon.nova-lite-v1:0 npx tsx agents/scripts/run-app-bedrock-wrapper-local.ts
```

### Ready endpoint
Use the recruiter-side tRPC mutation:

`recruiter.getBedrockScreen`

### Backend wrapper
### File
`apps/web-client/src/server/aihire/bedrock.ts`

### Function
`getBedrockScreen(input)`

This is the stable wrapper used by the app layer.

- validates required input fields
- normalizes strings
- calls the Bedrock screening agent
- returns either:
  - `{ ok: true, result }`
  - or `{ ok: false, error, details }`


### Underlying agent

### File
`agents/src/agents/bedrockScreen.ts`

### Function
`runBedrockCandidateScreen(input)`

- builds the recruiter screening prompt
- calls the Bedrock service wrapper
- parses JSON from model output
- validates final structure
- returns normalized recruiter-screen result

### HMmmmm
Runs a real Amazon Bedrock recruiter screen using Nova Lite and returns:
- score
- strengths
- concerns
- summary
- recommendation
- provider
- metrics

### Input
- candidateId
- name
- roleTitle
- companyName
- resumeText
- roleRequirements
- transcriptText (optional)
- notes (optional)

### Current validation status
Tested locally in real mode with:
- `provider: bedrock-converse`
- `degraded: false`
- `usedFallback: false`

### Frontend usage
Trigger this when recruiter clicks:
- Run AI Screen
or when candidate detail panel opens.


---

## Supporting files

### Prompt
`agents/src/prompts/candidateScreen.ts`

Builds the structured recruiter prompt and output schema hint.

### Parser
`agents/src/parsers/candidateScreenParser.ts`

Extracts and parses JSON from Bedrock output, including fenced JSON blocks.

### Schema
`agents/src/schema/candidateScreenSchema.ts`

Validates and normalizes the final candidate-screen object.

### Bedrock service wrapper
`agents/src/services/bedrockClient.ts`

Handles:
- Bedrock Converse calls
- retries
- timeout wrapper
- metrics logging
- fallback handling

### Bedrock adapter
`agents/src/adapters/bedrock.ts`

Handles:
- model listing
- generic invoke
- text generation
- stub vs real mode

---

## Input contract

The endpoint expects this shape:

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

## Output from bedrock

```json
{
  "ok": true,
  "result": {
    "candidateId": "cand_np_001",
    "score": 90,
    "strengths": [
      "Developed real-time AI music transcription engine processing audio with <100ms latency.",
      "Built React-based music visualization dashboard used by 10K+ users.",
      "3 years ML + web dev. Strong PyTorch and full-stack experience."
    ],
    "concerns": [
      "No additional information from transcript or recruiter notes."
    ],
    "summary": "Nguyen Phan Nguyen has a strong background in real-time AI systems and full-stack development, with specific experience in PyTorch and React, aligning well with the role requirements.",
    "recommendation": "INTERVIEW",
    "modelId": "amazon.nova-lite-v1:0",
    "provider": "bedrock-converse",
    "degraded": false,
    "usedFallback": false,
    "parseOk": true,
    "validationOk": true,
    "metrics": {
      "feature": "candidate_screen",
      "provider": "bedrock-converse",
      "modelId": "amazon.nova-lite-v1:0",
      "latencyMs": 1314,
      "attempts": 1,
      "usedFallback": false,
      "degraded": false,
      "inputTokensEstimated": 332,
      "outputTokensEstimated": 151,
      "timestampISO": "2026-02-28T16:42:35.845Z",
      "requestId": "f6b7b0a9-5fca-49fe-a19c-d3c4de08604d"
    }
  }
}
```

### Failure result 
```json
{
  "ok": false,
  "error": "Failed to run Bedrock recruiter screen",
  "details": "Error message here"
}
```


## Stephen saw working
	•	AWS auth using AWS_PROFILE=local-iam
	•	real Bedrock model listing
	•	real Bedrock Converse call
	•	amazon.nova-lite-v1:0
	•	prompt builder
	•	parser
	•	schema validation
	•	app wrapper function

## Last confirmed run
	•	provider: bedrock-converse
	•	degraded: false
	•	usedFallback: false
	•	parseOk: true
	•	validationOk: true


## Frontend integration note

Frontend should call:

recruiter.getBedrockScreen

Use it when:
	•	recruiter clicks Run AI Screen
	•	recruiter opens candidate detail drawer/page and wants on-demand AI evaluation

Frontend should render:
	•	fit score
	•	strengths
	•	concerns
	•	summary
	•	recommendation badge
	•	optional model/provider/latency info

Frontend does not need to know anything about:
	•	prompt logic
	•	parsing
	•	validation
	•	Bedrock retries/fallback logic


## AI models team next steps:

### next most useful endpoints are:
	1.	recruiter.getSocialScreen
	2.	candidate.getResumeTailor
	3.	candidate.getApplicationPlan

### These would reuse the same pattern:
	•	prompt
	•	service wrapper
	•	parser
	•	schema
	•	app wrapper
	•	tRPC procedure