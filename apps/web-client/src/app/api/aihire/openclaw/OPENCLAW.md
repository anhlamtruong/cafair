# OpenClaw Integration

This repo now includes a real OpenClaw-compatible skill pack under [skills](/Users/tranminhtue/Downloads/cafair/skills).

## Included skills

- [skills/aihire-social-screen/SKILL.md](/Users/tranminhtue/Downloads/cafair/skills/aihire-social-screen/SKILL.md)
- [skills/aihire-recruiter-workflows/SKILL.md](/Users/tranminhtue/Downloads/cafair/skills/aihire-recruiter-workflows/SKILL.md)

These skills call the AI Hire AI OpenClaw adapter endpoints:

- `POST /api/aihire/openclaw/social-screen-batch`
- `GET /api/aihire/openclaw/social-screen-batch/:batchJobId`
- `GET /api/aihire/openclaw/social-screen-batch/:batchJobId/summary`
- `GET /api/aihire/openclaw/skills`
- `POST /api/aihire/openclaw/skills`
- `POST /api/aihire/openclaw/workflows`
- `GET /api/aihire/openclaw/notifications`

## Install into a real OpenClaw setup

Add this repo’s `skills` directory to `~/.openclaw/openclaw.json`:

```json5
{
  skills: {
    load: {
      extraDirs: ["/Users/tranminhtue/Downloads/cafair/skills"]
    },
    entries: {
      "aihire-social-screen": {
        enabled: true,
        env: {
          AIHIRE_BASE_URL: "http://localhost:3002"
        }
      },
      "aihire-recruiter-workflows": {
        enabled: true,
        env: {
          AIHIRE_BASE_URL: "http://localhost:3002"
        }
      }
    }
  }
}
```

Then refresh OpenClaw skills or restart the gateway.

If OpenClaw is not installed yet, the upstream recommended install flow is:

```bash
npm install -g openclaw@latest
openclaw onboard --install-daemon
```

If global npm install fails with `EACCES`, use one of these:

```bash
# Fastest path, no global install required
npx openclaw@latest onboard --install-daemon
```

```bash
# Persistent CLI without sudo
mkdir -p ~/.npm-global
npm config set prefix ~/.npm-global
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
npm install -g openclaw@latest
openclaw onboard --install-daemon
```

Homebrew currently exposes `openclaw` as a macOS app cask, not the CLI binary,
so it is not the preferred path for the command-line setup in this repo.

You can preview or write the AI Hire AI skill-pack config with:

```bash
node apps/web-client/scripts/openclaw-setup.mjs
node apps/web-client/scripts/openclaw-setup.mjs --write
```

Useful checks:

```bash
npx openclaw@latest skills list
npx openclaw@latest skills info aihire-social-screen
npx openclaw@latest skills info aihire-recruiter-workflows
```

## Smoke test

With the AI Hire AI app running on `http://localhost:3002`, you can validate the
integration in three layers:

```bash
# 1. Local helper scripts parse and show usage without the server
node skills/aihire-social-screen/scripts/social-screen-batch.mjs help
node skills/aihire-recruiter-workflows/scripts/recruiter-workflows.mjs help
node apps/web-client/scripts/openclaw-smoke-test.mjs --help || true

# 2. API adapter discovery
curl -s http://localhost:3002/api/aihire/openclaw/skills | jq .
curl -s http://localhost:3002/api/aihire/openclaw/workflows | jq .

# 3. OpenClaw sees the installed skills
npx openclaw@latest skills list
npx openclaw@latest skills info aihire-social-screen
npx openclaw@latest skills info aihire-recruiter-workflows
```

Example batch start:

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

The returned `batchJobId` can be reused with:

```bash
node skills/aihire-social-screen/scripts/social-screen-batch.mjs status <batchJobId>
node skills/aihire-social-screen/scripts/social-screen-batch.mjs summary <batchJobId>
node skills/aihire-recruiter-workflows/scripts/recruiter-workflows.mjs notifications --batch <batchJobId>
```

## Webhook test

For local dev, the cleanest path is to put your notifier config in the repo-root
`.env` once and let the scripts pick it up automatically:

```bash
OPENCLAW_PUBLIC_BASE_URL=http://localhost:3002
OPENCLAW_DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
OPENCLAW_DEFAULT_CHANNEL_ID=recruiter-social
OPENCLAW_DEFAULT_CONVERSATION_ID=discord-recruiter
```

The smoke-test and live-test scripts now load the repo-root `.env` on startup,
so you do not need to manually `export` the Discord webhook every time.

You can capture webhook deliveries locally without a real chat channel:

```bash
node apps/web-client/scripts/openclaw-webhook-catcher.mjs
```

If port `4011` is already in use, run it on another port:

```bash
PORT=4012 node apps/web-client/scripts/openclaw-webhook-catcher.mjs
```

Then start a batch or workflow with:

```json
{
  "notify": {
    "webhookUrl": "http://localhost:4011",
    "webhookFormat": "slack",
    "channelId": "recruiter-social",
    "conversationId": "thread-demo-001"
  }
}
```

For workflows, `notify` lives at the top level next to `steps`.

Webhook payloads now include a top-level `text` field for chat-ready status
updates, plus the richer `summary` or `result` object for deeper inspection.

Set `notify.webhookFormat` to:

- `openclaw` for the raw adapter payload
- `slack` for Slack incoming-webhook style `text` + `blocks`
- `whatsapp` for a compact plain-text WhatsApp-style message payload
- `discord` for Discord webhook style `content` + `embeds`

If you use `slack`, set `OPENCLAW_PUBLIC_BASE_URL` or `NEXT_PUBLIC_APP_URL`
when you want clickable absolute links in chat instead of localhost defaults.

If you use `whatsapp`, the delivery payload is a single `text` body designed to
be easy for a WhatsApp bridge or OpenClaw-side sender to forward.

If you use `discord`, the delivery payload is shaped like a Discord webhook:
top-level `content` plus a single rich `embed`.

## One-command local check

With the AI Hire AI app running:

```bash
node apps/web-client/scripts/openclaw-smoke-test.mjs
```

To also verify webhook delivery:

```bash
node apps/web-client/scripts/openclaw-webhook-catcher.mjs
OPENCLAW_WEBHOOK_URL=http://localhost:4011 node apps/web-client/scripts/openclaw-smoke-test.mjs
```

or on a custom port:

```bash
PORT=4012 node apps/web-client/scripts/openclaw-webhook-catcher.mjs
OPENCLAW_WEBHOOK_URL=http://localhost:4012 node apps/web-client/scripts/openclaw-smoke-test.mjs
```

To preview Slack-style recruiter notifications locally:

```bash
PORT=4012 node apps/web-client/scripts/openclaw-webhook-catcher.mjs
OPENCLAW_WEBHOOK_URL=http://localhost:4012 OPENCLAW_WEBHOOK_FORMAT=slack npm run test:openclaw-smoke
```

To preview WhatsApp-style recruiter notifications locally:

```bash
PORT=4012 node apps/web-client/scripts/openclaw-webhook-catcher.mjs
OPENCLAW_WEBHOOK_URL=http://localhost:4012 OPENCLAW_WEBHOOK_FORMAT=whatsapp npm run test:openclaw-smoke
```

To preview Discord-style recruiter notifications locally:

```bash
PORT=4012 node apps/web-client/scripts/openclaw-webhook-catcher.mjs
OPENCLAW_WEBHOOK_URL=http://localhost:4012 OPENCLAW_WEBHOOK_FORMAT=discord npm run test:openclaw-smoke
```

## Channel choice

On this machine, the working Discord path is a Discord webhook URL, not
`openclaw channels add`. The current OpenClaw runtime advertises `discord` in
CLI help, but the actual command handler rejects it as `Unknown channel:
discord`.

iMessage/SMS is not ready because the OpenClaw `imsg` skill and local `imsg`
CLI are not installed. WhatsApp-style formatting works in this repo, but your
current OpenClaw runtime rejected real WhatsApp channel login as unsupported.

If you want recruiter notifications in Discord today, create a Discord
incoming webhook for a target channel and use it directly:

```bash
OPENCLAW_DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
npm run test:openclaw-smoke
```

That gives you real Discord delivery for batch and workflow completions.

If you need two-way recruiter chat, use the Discord companion bot script in
this repo instead of `openclaw channels add`. It logs into Discord directly,
forwards messages to the real `openclaw agent`, and can send low-frequency
opt-in proactive check-ins.

Add these to your local `.env`:

```bash
DISCORD_BOT_TOKEN=
DISCORD_ALLOWED_CHANNEL_IDS=
DISCORD_ALLOWED_GUILD_IDS=
DISCORD_ALLOW_DMS=true
DISCORD_REPLY_ONLY_ON_MENTION=false
OPENCLAW_DISCORD_SHARED_SECRET=
OPENCLAW_AGENT=main
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

Then run:

```bash
npm run dev:openclaw-discord
```

Notes for the Discord companion bot:

- Enable `Message Content Intent` in the Discord Developer Portal.
- Invite the bot to your server and give it access only to the channels you
  actually want.
- When `npm run dev:web` is running, the bot now pulls real local AI Hire AI
  workspace context from `/api/aihire/openclaw/discord-context`, including
  matched candidates, job roles, recruiter actions, social-screen batches,
  OpenClaw notifications, and apply-agent history.
- If a user uploads a PDF resume in Discord, the bot now parses the PDF text,
  builds an internal + internet role-fit bundle, replies with recruiter /
  candidate feedback, and attaches an annotated HTML review plus markdown
  report. That uploaded resume stays active in the channel for follow-up
  questions until you replace it or run `!clearresume`.
- If you set `OPENCLAW_DISCORD_SHARED_SECRET`, the bot sends it to the local
  context route via `x-openclaw-discord-secret` so the context bridge is not
  open accidentally.
- The bot is friendly, supportive, and willing to handle general chat, but it
  uses the AI Hire AI OpenClaw skills when messages are actually about hiring,
  applications, candidates, or recruiter workflows.
- Proactive check-ins are opt-in and rate-limited by env so it does not spam.

If you still want to inspect what the installed OpenClaw runtime supports
directly, check live status with:

```bash
npx openclaw@latest channels status --probe
```

## Real OpenClaw live test

Once the skills are visible in `npx openclaw@latest skills list`, you still
need two things for a real agent turn:

1. a running OpenClaw gateway
2. model auth for the default `main` agent

Check the current gateway first:

```bash
npx openclaw@latest health
```

If the gateway is not already running, start it in one terminal:

```bash
npx openclaw@latest gateway run --allow-unconfigured --verbose
```

The most reliable auth flow we found for this repo is direct OpenAI Codex OAuth:

```bash
npx openclaw@latest models auth login --provider openai-codex --set-default
npx openclaw@latest models status
```

With the gateway up, the app running on `http://localhost:3002`, and model auth
working, run the real end-to-end agent test:

```bash
node apps/web-client/scripts/openclaw-live-test.mjs
```

or from the repo root:

```bash
npm run test:openclaw-live
```

This executes two real OpenClaw agent turns:

1. `aihire-social-screen` for a one-candidate batch summary
2. `aihire-recruiter-workflows` for triage -> social screen -> packet -> recruiter actions

Expected outcome:

- social-screen turn returns a concise recruiter summary with fit/risk/flags
- workflow turn returns a recruiter-ready disposition and next steps

You can also run the raw commands directly:

```bash
npx openclaw@latest agent --agent main --message "Use the aihire-social-screen skill to start a social-screen batch for one candidate named OpenClaw Live Test with role Software Engineer, school Virginia Tech, and resume text 'Built AI and full-stack systems with strong execution in 2025.' Then wait for completion and give me a concise recruiter summary." --thinking low --json
```

```bash
npx openclaw@latest agent --agent main --message "Use the aihire-recruiter-workflows skill to run a recruiter workflow for candidate Workflow Alias Test. Use candidateName consistently for the candidate field. The workflow should include triage_candidate, social_screen_candidate, candidate_packet.build, and recruiter_actions.draft. Use role AI Music Engineer with must-have keywords PyTorch, real-time, and full-stack, plus nice-to-have keyword React. Use resume text 'Built real-time AI systems with PyTorch and React in 2025.' and transcript text 'Shipped full-stack product features.' Include one simple public web result showing strong AI and full-stack work. Then summarize the workflow outcome for a recruiter." --thinking low --json
```

Current known behavior:

- If `gateway run` says the gateway is already running, that is fine. Use `npx openclaw@latest health`.
- The skill pack loads correctly from this repo's `skills/` directory.
- `models auth login --provider openai-codex --set-default` successfully authenticated and set the default model to `openai-codex/gpt-5.4`.
- Both requested flows now work through real OpenClaw agent turns, not only the local API smoke test.

## Design choice

This integration uses OpenClaw’s real workspace-skill model instead of embedding
OpenClaw code into the AI Hire AI app.

Why:

- lowest-risk path to a real OpenClaw integration
- no need to fork or vendor the OpenClaw runtime yet
- keeps AI Hire AI as the system of record
- lets OpenClaw act as the ChatOps/control layer

## Current scope

- Social-screen batch start/status/summary/retry
- Recruiter agent skill execution
- Sequential recruiter workflows
- Notification outbox inspection

## Next possible step

If needed later, we can move from workspace skills to a deeper OpenClaw plugin
or channel-native experience. Right now, the skill-pack approach is the most
realistic and maintainable integration.
