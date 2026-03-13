# Auto Run App

Brief guide for the local Nova Act app runners in this folder.

## Files

- `run-our-app.py`
  Runs one local Nova Act recruiter flow against the AI Hire app.
  Main flow:
  - starts at `http://localhost:3002/hiring-center`
  - waits for manual sign-in
  - works through Hiring Center
  - goes into Candidate Queue
  - opens a candidate
  - clicks `Review`
  - clicks `Confirm Schedule`
  - goes to `Conversation`
  - drafts a demo message for Lam

- `run-multiple-our-app.py`
  Runs multiple Nova Act jobs in parallel.
  It uses separate worker processes so each Nova Act session has its own
  isolated browser startup and avoids the Playwright sync-in-async conflict.
  Current jobs:
  - `http://localhost:3002/hiring-center`
  - `http://localhost:3002/roles`
  - `http://localhost:3002/risk-flags`

## Prerequisites

- local app is running on `http://localhost:3002`
- Python environment has `nova_act` installed
- Nova API key is available through:
  - `NOVA_ACT_API`, or
  - `NOVA_API_KEY`
- app auth is completed manually when the script pauses

## Run

Single job:

```bash
python3 apps/agents/scripts/run-our-app.py --debug-logs --prefer-chrome
```

Multiple jobs:

```bash
python3 apps/agents/scripts/run-multiple-our-app.py --debug-logs --prefer-chrome
```

## Prompt Preview

Single job prompt:

```bash
python3 apps/agents/scripts/run-our-app.py --print-prompt
```

All parallel job prompts:

```bash
python3 apps/agents/scripts/run-multiple-our-app.py --print-prompts
```

## Notes

- local `http://localhost` URLs are handled with HTTPS error ignore logic
- `--prefer-chrome` is best-effort and depends on your local Chrome install
- the multiple runner is best-effort for “multiple tabs”; depending on Nova Act behavior, it may open multiple browser contexts or windows instead
- the multiple runner waits for all sessions to open first, then asks for one shared manual sign-in confirmation before continuing
- the demo message is typed but not sent unless you explicitly change the prompt or code to do that
