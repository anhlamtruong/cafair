# OpenClaw Review

## What OpenClaw Means In This Repo

This uses OpenClaw as an external ChatOps and control layer through:

- real OpenClaw workspace skills under `skills/`
- AI Hire AI adapter endpoints under `apps/web-client/src/app/api/aihire/openclaw/`
- local helper scripts for setup, smoke tests, live tests, webhook capture, and Discord bridging

Main pieces:

- `skills/aihire-social-screen`
- `skills/aihire-recruiter-workflows`
- `apps/web-client/scripts/openclaw-setup.mjs`
- `apps/web-client/scripts/openclaw-smoke-test.mjs`
- `apps/web-client/scripts/openclaw-live-test.mjs`
- `apps/web-client/scripts/openclaw-webhook-catcher.mjs`
- `apps/web-client/scripts/openclaw-discord-bot.mjs`

## OpenClaw Features Included

### Adapter endpoints

The web app exposes these OpenClaw-facing endpoints:

- `POST /api/aihire/openclaw/social-screen-batch`
- `GET /api/aihire/openclaw/social-screen-batch/:batchJobId`
- `GET /api/aihire/openclaw/social-screen-batch/:batchJobId/summary`
- `GET /api/aihire/openclaw/notifications`
- `GET /api/aihire/openclaw/skills`
- `POST /api/aihire/openclaw/skills`
- `GET /api/aihire/openclaw/workflows`
- `POST /api/aihire/openclaw/workflows`
- `POST /api/aihire/openclaw/discord-context`
- `POST /api/aihire/openclaw/resume-review`

### Registered OpenClaw skill names

The server advertises these skill names:

- `social_screen_batch.start`
- `social_screen_batch.status`
- `social_screen_batch.summary`
- `triage_candidate`
- `social_screen_candidate`
- `candidate_packet.build`
- `recruiter_actions.draft`

### Notification formats

Supported webhook payload formats:

- `openclaw`
- `slack`
- `whatsapp`
- `discord`

## Ports And Runtime Assumptions

- web app: `http://localhost:3002`
- llm service: `http://localhost:3001`
- webhook catcher default: `http://localhost:4011`

Most OpenClaw helpers default `AIHIRE_BASE_URL` to `http://localhost:3002`.

## Step 1: Prerequisites

Install or verify:

```bash
node -v
npm -v
docker -v
```

Repo requirements from branch docs:

- Node.js `20+`
- npm
- Docker
- Supabase CLI available through project scripts

## Step 2: Install Repo Dependencies

From the repo root:

```bash
cd /Users/macbook/Hack/cafair
npm install
```

## Step 3: Configure Local Environment

This branch does not include `apps/web-client/.env.example` or `apps/llm/.env.example` in the checked-in files I inspected, so derive your env from the code and docs below.

### Minimum app credentials mentioned by the repo

Add the normal app credentials required by AI Hire AI:

```bash
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
```

### OpenClaw-related env used by this branch

Put these in the repo root `.env` if you want the helper scripts to pick them up automatically:

```bash
AIHIRE_BASE_URL=http://localhost:3002
OPENCLAW_PUBLIC_BASE_URL=http://localhost:3002

OPENCLAW_WEBHOOK_URL=
OPENCLAW_DEFAULT_WEBHOOK_URL=
OPENCLAW_WEBHOOK_FORMAT=
OPENCLAW_DEFAULT_WEBHOOK_FORMAT=

OPENCLAW_DISCORD_WEBHOOK_URL=
OPENCLAW_DEFAULT_CHANNEL_ID=recruiter-social
OPENCLAW_DEFAULT_CONVERSATION_ID=thread-openclaw-default
OPENCLAW_DISCORD_CHANNEL_ID=
OPENCLAW_DISCORD_CONVERSATION_ID=
OPENCLAW_DEFAULT_ACTOR_ID=

OPENCLAW_AGENT=main
```

### Optional Discord companion bot env

Only needed if you want the Discord bridge:

```bash
DISCORD_BOT_TOKEN=
DISCORD_ALLOWED_CHANNEL_IDS=
DISCORD_ALLOWED_GUILD_IDS=
DISCORD_ALLOW_DMS=true
DISCORD_REPLY_ONLY_ON_MENTION=false
OPENCLAW_DISCORD_SHARED_SECRET=
OPENCLAW_DISCORD_THINKING=low
OPENCLAW_DISCORD_CONTEXT_TIMEOUT_MS=8000
OPENCLAW_DISCORD_RESUME_REVIEW_TIMEOUT_MS=25000
OPENCLAW_DISCORD_MAX_RESUME_CONTEXT_CHARS=12000
OPENCLAW_DISCORD_PROACTIVE_ENABLED=false
OPENCLAW_DISCORD_PROACTIVE_CHANNEL_IDS=
OPENCLAW_DISCORD_PROACTIVE_IDLE_MINUTES=180
OPENCLAW_DISCORD_PROACTIVE_MIN_INTERVAL_MINUTES=360
OPENCLAW_DISCORD_PROACTIVE_MAX_PER_DAY=3
```

## Step 4: Start Local Infra

Start Supabase:

```bash
npm run supa:start
```

Run database migrations:

```bash
npm run db:migrate
```

Start the web app:

```bash
npm run dev:web
```

Start the llm service in another terminal:

```bash
npm run dev:llm
```

Useful startup scripts exposed by the root workspace:

```bash
npm run dev:web
npm run dev:llm
npm run dev:openclaw-discord
npm run test:openclaw-smoke
npm run test:openclaw-live
```

## Step 5: Install OpenClaw

Preferred path from this branch:

```bash
npm install -g openclaw@latest
openclaw onboard --install-daemon
```

If global npm install fails with `EACCES`, use either of these.

### Fastest path without global install

```bash
npx openclaw@latest onboard --install-daemon
```

### Persistent user-level install

```bash
mkdir -p ~/.npm-global
npm config set prefix ~/.npm-global
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
npm install -g openclaw@latest
openclaw onboard --install-daemon
```

Branch note:

- Homebrew is explicitly not the preferred CLI install path here.

## Step 6: Register This Repo’s OpenClaw Skills

This repo ships two real workspace skills:

- `skills/aihire-social-screen`
- `skills/aihire-recruiter-workflows`

### Recommended auto-setup

Preview the merged config first:

```bash
node apps/web-client/scripts/openclaw-setup.mjs
```

Write the config into `~/.openclaw/openclaw.json`:

```bash
node apps/web-client/scripts/openclaw-setup.mjs --write
```

### Manual config if you prefer

Edit `~/.openclaw/openclaw.json` to include:

```json5
{
  skills: {
    load: {
      extraDirs: ["/Users/macbook/Hack/cafair/skills"],
    },
    entries: {
      "aihire-social-screen": {
        enabled: true,
        env: {
          AIHIRE_BASE_URL: "http://localhost:3002",
        },
      },
      "aihire-recruiter-workflows": {
        enabled: true,
        env: {
          AIHIRE_BASE_URL: "http://localhost:3002",
        },
      },
    },
  },
}
```

Then restart or refresh OpenClaw skills.

## Step 7: Verify OpenClaw Sees The Skills

Check OpenClaw itself:

```bash
npx openclaw@latest skills list
npx openclaw@latest skills info aihire-social-screen
npx openclaw@latest skills info aihire-recruiter-workflows
```

Check the app adapter endpoints:

```bash
curl -s http://localhost:3002/api/aihire/openclaw/skills | jq .
curl -s http://localhost:3002/api/aihire/openclaw/workflows | jq .
curl -s http://localhost:3002/api/aihire/openclaw/notifications | jq .
```

## Step 8: Use The Local Helper Scripts Directly

These scripts let you use the OpenClaw adapter without going through a live OpenClaw agent turn.

### Social-screen skill helper

Show help:

```bash
node skills/aihire-social-screen/scripts/social-screen-batch.mjs help
```

Start a batch:

```bash
cat <<'JSON' | node skills/aihire-social-screen/scripts/social-screen-batch.mjs start
{
  "candidates": [
    {
      "candidateId": "cand_demo_001",
      "name": "Nguyen Phan Nguyen",
      "roleTitle": "Software Engineer",
      "school": "Virginia Tech",
      "resumeText": "Built AI and real-time systems."
    }
  ],
  "notify": {
    "channelId": "recruiter-social",
    "conversationId": "thread-demo-001"
  }
}
JSON
```

Check status:

```bash
node skills/aihire-social-screen/scripts/social-screen-batch.mjs status <batchJobId>
```

Fetch recruiter summary:

```bash
node skills/aihire-social-screen/scripts/social-screen-batch.mjs summary <batchJobId>
```

Fetch per-candidate results:

```bash
node skills/aihire-social-screen/scripts/social-screen-batch.mjs results <batchJobId>
```

Retry a failed batch:

```bash
node skills/aihire-social-screen/scripts/social-screen-batch.mjs retry <batchJobId>
```

### Recruiter workflow helper

Show help:

```bash
node skills/aihire-recruiter-workflows/scripts/recruiter-workflows.mjs help
```

List available skills:

```bash
node skills/aihire-recruiter-workflows/scripts/recruiter-workflows.mjs skills
```

Run one skill:

```bash
cat <<'JSON' | node skills/aihire-recruiter-workflows/scripts/recruiter-workflows.mjs run-skill triage_candidate
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
JSON
```

Run a workflow:

```bash
cat <<'JSON' | node skills/aihire-recruiter-workflows/scripts/recruiter-workflows.mjs run-workflow
{
  "workflowId": "recruiter-review-001",
  "stopOnError": true,
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
JSON
```

Read notifications:

```bash
node skills/aihire-recruiter-workflows/scripts/recruiter-workflows.mjs notifications
node skills/aihire-recruiter-workflows/scripts/recruiter-workflows.mjs notifications --workflow <workflowId>
node skills/aihire-recruiter-workflows/scripts/recruiter-workflows.mjs notifications --batch <batchJobId>
```

## Step 9: Run The Repo’s OpenClaw Smoke Test

This validates the integration without requiring a real OpenClaw agent conversation.

Show usage:

```bash
node apps/web-client/scripts/openclaw-smoke-test.mjs --help
```

Run it:

```bash
node apps/web-client/scripts/openclaw-smoke-test.mjs
```

Or from the root npm script:

```bash
npm run test:openclaw-smoke
```

What it does:

- fetches `/api/aihire/openclaw/skills`
- fetches `/api/aihire/openclaw/workflows`
- starts a social-screen batch
- waits for batch completion
- runs a recruiter workflow
- fetches workflow notifications

## Step 10: Capture Webhook Deliveries Locally

Start the webhook catcher:

```bash
node apps/web-client/scripts/openclaw-webhook-catcher.mjs
```

If port `4011` is busy:

```bash
PORT=4012 node apps/web-client/scripts/openclaw-webhook-catcher.mjs
```

Then point the smoke test at it:

```bash
OPENCLAW_WEBHOOK_URL=http://localhost:4011 node apps/web-client/scripts/openclaw-smoke-test.mjs
```

Or:

```bash
PORT=4012 node apps/web-client/scripts/openclaw-webhook-catcher.mjs
OPENCLAW_WEBHOOK_URL=http://localhost:4012 node apps/web-client/scripts/openclaw-smoke-test.mjs
```

Preview format-specific payloads:

```bash
PORT=4012 node apps/web-client/scripts/openclaw-webhook-catcher.mjs
OPENCLAW_WEBHOOK_URL=http://localhost:4012 OPENCLAW_WEBHOOK_FORMAT=slack npm run test:openclaw-smoke
```

```bash
PORT=4012 node apps/web-client/scripts/openclaw-webhook-catcher.mjs
OPENCLAW_WEBHOOK_URL=http://localhost:4012 OPENCLAW_WEBHOOK_FORMAT=whatsapp npm run test:openclaw-smoke
```

```bash
PORT=4012 node apps/web-client/scripts/openclaw-webhook-catcher.mjs
OPENCLAW_WEBHOOK_URL=http://localhost:4012 OPENCLAW_WEBHOOK_FORMAT=discord npm run test:openclaw-smoke
```

## Step 11: Run A Real OpenClaw Agent Turn

Once the skills are installed, you still need:

1. a running OpenClaw gateway
2. model auth for the default `main` agent

Check health:

```bash
npx openclaw@latest health
```

If needed, start the gateway:

```bash
npx openclaw@latest gateway run --allow-unconfigured --verbose
```

Authenticate model access using the branch-documented flow:

```bash
npx openclaw@latest models auth login --provider openai-codex --set-default
npx openclaw@latest models status
```

Run the end-to-end live test:

```bash
node apps/web-client/scripts/openclaw-live-test.mjs
```

Or:

```bash
npm run test:openclaw-live
```

The live test performs two real OpenClaw agent turns:

1. `aihire-social-screen`
2. `aihire-recruiter-workflows`

Raw direct agent commands:

```bash
npx openclaw@latest agent --agent main --message "Use the aihire-social-screen skill to start a social-screen batch for one candidate named OpenClaw Live Test with role Software Engineer, school Virginia Tech, and resume text 'Built AI and full-stack systems with strong execution in 2025.' Then wait for completion and give me a concise recruiter summary." --thinking low --json
```

```bash
npx openclaw@latest agent --agent main --message "Use the aihire-recruiter-workflows skill to run a recruiter workflow for candidate Workflow Alias Test. Use candidateName consistently for the candidate field. The workflow should include triage_candidate, social_screen_candidate, candidate_packet.build, and recruiter_actions.draft. Use role AI Music Engineer with must-have keywords PyTorch, real-time, and full-stack, plus nice-to-have keyword React. Use resume text 'Built real-time AI systems with PyTorch and React in 2025.' and transcript text 'Shipped full-stack product features.' Include one simple public web result showing strong AI and full-stack work. Then summarize the workflow outcome for a recruiter." --thinking low --json
```

## Step 12: Optional Discord Integration

### One-way recruiter notifications via Discord webhook

Preferred branch path:

```bash
OPENCLAW_DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
npm run test:openclaw-smoke
```

### Two-way recruiter chat via the companion bot

Add the Discord env variables listed earlier, then run:

```bash
npm run dev:openclaw-discord
```

Important notes from this branch:

- enable `Message Content Intent` in the Discord Developer Portal
- restrict the bot to the right guilds and channels
- the bot can use local AI Hire AI workspace context from `/api/aihire/openclaw/discord-context`
- uploaded PDF resumes can trigger resume review and annotated report generation
- `OPENCLAW_DISCORD_SHARED_SECRET` protects the local context bridge if configured

## Important API Examples

### Start a social-screen batch via HTTP

```bash
curl -s -X POST http://localhost:3002/api/aihire/openclaw/social-screen-batch \
  -H "Content-Type: application/json" \
  -d '{
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
      "channelId": "recruiter-social",
      "conversationId": "thread-001"
    }
  }' | jq .
```

### Get batch status

```bash
curl -s http://localhost:3002/api/aihire/openclaw/social-screen-batch/<batchJobId> | jq .
```

### Get batch summary

```bash
curl -s http://localhost:3002/api/aihire/openclaw/social-screen-batch/<batchJobId>/summary | jq .
```

### List OpenClaw-facing skills

```bash
curl -s http://localhost:3002/api/aihire/openclaw/skills | jq .
```

### Run a server-side skill directly

```bash
curl -s -X POST http://localhost:3002/api/aihire/openclaw/skills \
  -H "Content-Type: application/json" \
  -d '{
    "skill": "triage_candidate",
    "input": {
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
  }' | jq .
```

### Run a workflow directly

```bash
curl -s -X POST http://localhost:3002/api/aihire/openclaw/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "wf_demo_001",
    "stopOnError": true,
    "steps": [
      {
        "stepId": "triage",
        "skill": "triage_candidate",
        "input": {
          "candidateId": "cand_demo_002",
          "candidateName": "Workflow Demo",
          "role": {
            "roleId": "role_001",
            "roleName": "AI Music Engineer",
            "mustHaveKeywords": ["PyTorch", "real-time", "full-stack"]
          },
          "artifacts": {
            "resumeText": "Built real-time AI systems with PyTorch and React in 2025."
          }
        }
      }
    ]
  }' | jq .
```

## Known Behavior And Caveats

- This integration is workspace-skill based, not a deep OpenClaw plugin.
- The repo treats AI Hire AI as the system of record; OpenClaw is the external control layer.
- Discord notifications work reliably through Discord incoming webhooks.
- The branch docs explicitly say `openclaw channels add --channel discord` is currently unreliable on this machine even if the CLI help advertises it.
- iMessage and true WhatsApp channel login are not considered ready here.
- Some recruiter flows may still use mock or heuristic scoring depending on backend wiring.
- `notify` can be omitted if you rely on repo-root `.env` defaults for webhook or channel metadata.
- Slack link formatting depends on `OPENCLAW_PUBLIC_BASE_URL` or `NEXT_PUBLIC_APP_URL` so the generated links are absolute.

## Short Recommended End-To-End Flow

If you only want the fastest successful local integration path, do this:

```bash
cd /Users/macbook/Hack/cafair
npm install
npm run supa:start
npm run db:migrate
npm run dev:web
```

In another terminal:

```bash
cd /Users/macbook/Hack/cafair
npm run dev:llm
```

In another terminal:

```bash
cd /Users/macbook/Hack/cafair
node apps/web-client/scripts/openclaw-setup.mjs --write
npx openclaw@latest onboard --install-daemon
npx openclaw@latest skills list
npx openclaw@latest health
node apps/web-client/scripts/openclaw-smoke-test.mjs
```

If you want real OpenClaw agent execution too:

```bash
cd /Users/macbook/Hack/cafair
npx openclaw@latest gateway run --allow-unconfigured --verbose
```

Then in another terminal:

```bash
cd /Users/macbook/Hack/cafair
npx openclaw@latest models auth login --provider openai-codex --set-default
node apps/web-client/scripts/openclaw-live-test.mjs
```

## Key Files Worth Reading

- `README.md`
- `package.json`
- `apps/web-client/src/app/api/aihire/social-screen/SOCIAL-SCREEN.md`
- `apps/web-client/src/app/api/aihire/openclaw/OPENCLAW.md`
- `apps/web-client/scripts/openclaw-setup.mjs`
- `apps/web-client/scripts/openclaw-smoke-test.mjs`
- `apps/web-client/scripts/openclaw-live-test.mjs`
- `skills/aihire-social-screen/SKILL.md`
- `skills/aihire-recruiter-workflows/SKILL.md`
