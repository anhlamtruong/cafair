---
name: aihire-social-screen
description: Trigger AI Hire AI recruiter social-screen batch jobs, check their progress, fetch recruiter-ready summaries, and retry failed runs. Use when the user wants to batch-screen candidates or get notification-ready social-screen results from an AI Hire AI server.
homepage: https://github.com/tranminhtue/cafair
metadata: { "openclaw": { "emoji": "🔎", "requires": { "bins": ["node"] } } }
---

# AI Hire Social Screen

Use this skill when a recruiter wants to run the AI Hire AI social-screen batch flow from OpenClaw.

The helper script talks to the real AI Hire AI OpenClaw adapter endpoints:

- `POST /api/aihire/openclaw/social-screen-batch`
- `GET /api/aihire/openclaw/social-screen-batch/:batchJobId`
- `GET /api/aihire/openclaw/social-screen-batch/:batchJobId/summary`
- `GET /api/aihire/social-screen/batch/:batchJobId/results`
- `POST /api/aihire/social-screen/batch/:batchJobId/retry`

If `AIHIRE_BASE_URL` is not set, the script defaults to `http://localhost:3002`.

## Commands

### Start a batch

Create a JSON payload and pipe it to:

```bash
node {baseDir}/scripts/social-screen-batch.mjs start
```

Expected input shape:

```json
{
  "candidates": [
    {
      "candidateId": "cand_001",
      "name": "Nguyen Phan Nguyen",
      "roleTitle": "Software Engineer",
      "school": "Virginia Tech",
      "resumeText": "Built AI and real-time systems."
    }
  ],
  "notify": {
    "webhookUrl": "http://localhost:4011",
    "channelId": "recruiter-social",
    "conversationId": "thread-001"
  }
}
```

The response contains `batchJobId`, `statusUrl`, `resultsUrl`, and `summaryUrl`.

### Check status

```bash
node {baseDir}/scripts/social-screen-batch.mjs status <batchJobId>
```

### Fetch the recruiter summary

```bash
node {baseDir}/scripts/social-screen-batch.mjs summary <batchJobId>
```

Prefer the `summary.text` field when the user wants a concise update. Use the richer summary object when they want counts, top candidates, or flagged candidates.

### Fetch candidate-by-candidate results

```bash
node {baseDir}/scripts/social-screen-batch.mjs results <batchJobId>
```

### Retry a batch

```bash
node {baseDir}/scripts/social-screen-batch.mjs retry <batchJobId>
```

## Recommended workflow

1. Start the batch.
2. Save the returned `batchJobId`.
3. Poll `status` until the batch is terminal.
4. Use `summary` for the recruiter-facing update.
5. Use `results` only when the user wants candidate-level detail.
6. If the batch failed or needs a rerun, use `retry`.

## Notes

- This skill is for AI Hire AI recruiter-side social-screen batches, not browser scraping.
- The current batch runner may still use mock/heuristic scoring depending on server wiring, so do not overclaim “real AI scoring” unless the backend has been upgraded.
- Keep recruiter summaries concise and explicit about whether the batch is `queued`, `running`, `completed`, or `failed`.
