---
name: aihire-recruiter-workflows
description: Run AI Hire AI recruiter skills and sequential workflows through the OpenClaw adapter. Use when the user wants triage, social screening, candidate packets, recruiter action drafts, or a chained recruiter workflow from AI Hire AI.
homepage: https://github.com/tranminhtue/cafair
metadata: { "openclaw": { "emoji": "🧠", "requires": { "bins": ["node"] } } }
---

# AI Hire Recruiter Workflows

This skill connects OpenClaw to the AI Hire AI recruiter agent adapter endpoints:

- `GET /api/aihire/openclaw/skills`
- `POST /api/aihire/openclaw/skills`
- `POST /api/aihire/openclaw/workflows`
- `GET /api/aihire/openclaw/notifications`

If `AIHIRE_BASE_URL` is not set, the helper script defaults to `http://localhost:3002`.

## Available AI Hire AI skills

- `triage_candidate`
- `social_screen_candidate`
- `candidate_packet.build`
- `recruiter_actions.draft`
- `social_screen_batch.start`
- `social_screen_batch.status`
- `social_screen_batch.summary`

For `social_screen_candidate`, either `name` or `candidateName` is accepted.
Prefer `candidateName` when sharing one candidate object across multiple recruiter
workflow steps.

## Commands

### List skills

```bash
node {baseDir}/scripts/recruiter-workflows.mjs skills
```

### Run one skill

Pipe the input JSON to:

```bash
node {baseDir}/scripts/recruiter-workflows.mjs run-skill <skillName>
```

Example:

```json
{
  "candidateId": "cand_np_001",
  "candidateName": "Nguyen Phan Nguyen",
  "role": {
    "roleId": "role_001",
    "roleName": "AI Music Engineer",
    "mustHaveKeywords": ["PyTorch", "real-time", "full-stack"]
  },
  "artifacts": {
    "resumeText": "Built real-time AI music systems with PyTorch and React."
  }
}
```

### Run a workflow

Pipe a workflow definition to:

```bash
node {baseDir}/scripts/recruiter-workflows.mjs run-workflow
```

Expected shape:

```json
{
  "workflowId": "recruiter-review-001",
  "stopOnError": true,
  "notify": {
    "webhookUrl": "http://localhost:4011",
    "channelId": "recruiter-social",
    "conversationId": "thread-review-001"
  },
  "steps": [
    {
      "skill": "triage_candidate",
      "input": {
        "candidateId": "cand_np_001",
        "candidateName": "Nguyen Phan Nguyen",
        "role": {
          "roleId": "role_001",
          "roleName": "AI Music Engineer",
          "mustHaveKeywords": ["PyTorch", "real-time"]
        },
        "artifacts": {
          "resumeText": "Built real-time AI music systems."
        }
      }
    },
    {
      "skill": "candidate_packet.build",
      "input": {
        "candidateId": "cand_np_001",
        "candidateName": "Nguyen Phan Nguyen",
        "role": {
          "roleId": "role_001",
          "roleName": "AI Music Engineer",
          "mustHaveKeywords": ["PyTorch", "real-time"]
        },
        "artifacts": {
          "resumeText": "Built real-time AI music systems."
        }
      }
    }
  ]
}
```

When `notify.webhookUrl` is present, the workflow runner will POST a single
completion or failure event with a top-level `text` summary plus the full
workflow result.

### Read notifications

```bash
node {baseDir}/scripts/recruiter-workflows.mjs notifications
node {baseDir}/scripts/recruiter-workflows.mjs notifications --workflow <workflowId>
node {baseDir}/scripts/recruiter-workflows.mjs notifications --batch <batchJobId>
```

## Workflow guidance

- Prefer `run-skill` when the user wants one targeted output.
- Prefer `run-workflow` when the user wants a fixed sequence like triage → packet → recruiter actions.
- Keep workflows sequential and explicit.
- If a workflow fails, report the failed `stepId`, `skill`, and `error` clearly.
- Use notifications only as an audit trail, not as the primary data source.
