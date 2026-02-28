Recommended endpoint name

getBedrockScreen

Backend source

This endpoint should call:
	•	runBedrockCandidateScreen(...)
from:
	•	agents/src/agents/bedrockScreen.ts


Input

```json
{
  "candidateId": "string",
  "name": "string",
  "roleTitle": "string",
  "companyName": "string?",
  "resumeText": "string",
  "roleRequirements": ["string"],
  "transcriptText": "string?",
  "notes": "string?"
}
```

Output

```json
{
  "candidateId": "string",
  "score": 90,
  "strengths": [
    "string"
  ],
  "concerns": [
    "string"
  ],
  "summary": "string",
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
    "latencyMs": 1103,
    "attempts": 1,
    "usedFallback": false,
    "degraded": false,
    "inputTokensEstimated": 332,
    "outputTokensEstimated": 147,
    "timestampISO": "string",
    "requestId": "string"
  }
}
```


Frontend usage

Use this endpoint when recruiter clicks:
	•	Run AI Screen
	•	or when candidate detail page loads

Render:
	•	score
	•	strengths
	•	concerns
	•	summary
	•	recommendation
	•	optional latency / provider badge

Current status

This endpoint contract is tested and working in real mode with:
	•	provider: "bedrock-converse"
	•	degraded: false
	•	usedFallback: false
