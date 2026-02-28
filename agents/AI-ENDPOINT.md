## Bedrock Recruiter Screen Handoff

### Ready endpoint
Use the recruiter-side tRPC mutation:

`recruiter.getBedrockScreen`

### Backend wrapper
- File: `apps/web-client/src/server/aihire/bedrock.ts`
- Function: `getBedrockScreen(input)`

### Underlying agent
- File: `agents/src/agents/bedrockScreen.ts`
- Function: `runBedrockCandidateScreen(input)`

### What it does
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