# LLM Prompt Service

A focused, stateless AI prompt service powered by **Google Gemini 2.0 Flash**. It provides optimized prompt templates and a raw prompt API for structured AI interactions, with optional **Redis** caching.

## Architecture

```
Client → Express API → Prompt Formatter → Gemini AI → Response
                              ↕
                        Redis Cache (optional)
```

- **Stateless** — no conversation history, no user data stored
- **Template-driven** — pre-built, optimized prompt templates
- **Cache layer** — optional Redis for response deduplication
- **Graceful degradation** — works without Redis if unavailable

## API Endpoints

### `GET /api/health`

Health check with service status and Redis connectivity.

### `GET /api/prompt/templates`

Returns all available prompt templates with descriptions and required variables.

### `POST /api/prompt/run`

Execute a registered prompt template by name.

```json
{
  "template": "generate-theme-palette",
  "variables": {
    "mood": "warm and cozy",
    "style": "modern minimalist"
  },
  "options": { "json": true }
}
```

### `POST /api/prompt/raw`

Execute a custom formatted prompt directly.

```json
{
  "role": "You are an expert code reviewer",
  "task": "Review the following code for bugs and improvements",
  "rules": ["Be concise", "Focus on critical issues"],
  "input": "function add(a, b) { return a - b; }",
  "output": "Return a JSON array of issues found",
  "options": { "json": true }
}
```

## Available Templates

| Template                  | Description                                    |
| ------------------------- | ---------------------------------------------- |
| `generate-theme-palette`  | Generate a UI color palette for a theme        |
| `summarize-text`          | Summarize long text into key points            |
| `review-code`             | Review code for bugs, style, and improvements  |
| `rewrite-content`         | Rewrite content with a specified tone/style    |
| `extract-structured-data` | Extract structured JSON from unstructured text |
| `translate-text`          | Translate text between languages               |

## Adding a Template

Edit `src/lib/prompt-templates.ts`:

```ts
export const myTemplate: PromptTemplate = {
  name: "my-template",
  description: "What it does",
  variables: ["input"],
  template: {
    role: "You are an expert at X",
    task: "Do Y with the following input",
    rules: ["Be concise", "Return JSON"],
    input: "{{input}}",
    output: "Return a JSON object with ...",
  },
};

// Register in the templateRegistry Map at the bottom of the file
templateRegistry.set(myTemplate.name, myTemplate);
```

## Quick Start

### Local development

```bash
# Install dependencies (from monorepo root)
npm install -w apps/llm

# Copy env and add your Gemini API key
cp .env.example .env

# Start dev server
npm run dev -w apps/llm
```

### Docker

```bash
# Start with Docker Compose (includes Redis)
docker compose up

# Or build and run standalone
docker build -t llm-prompt-service .
docker run -p 3001:3001 -e GEMINI_API_KEY=your-key llm-prompt-service
```

## Environment Variables

| Variable          | Required | Default                  | Description                   |
| ----------------- | -------- | ------------------------ | ----------------------------- |
| `PORT`            | No       | `3001`                   | Server port                   |
| `GEMINI_API_KEY`  | **Yes**  | —                        | Google Gemini API key         |
| `REDIS_URL`       | No       | `redis://localhost:6379` | Redis connection URL          |
| `REDIS_CACHE_TTL` | No       | `3600`                   | Cache TTL in seconds (1 hour) |
| `CORS_ORIGINS`    | No       | `http://localhost:3000`  | Allowed CORS origins          |
| `NODE_ENV`        | No       | `development`            | Environment mode              |

## Project Structure

```
src/
├── index.ts                # Entry point, Redis init, graceful shutdown
├── app.ts                  # Express app setup
├── lib/
│   ├── gemini.ts           # Gemini AI client (text + JSON)
│   ├── prompt-formatter.ts # Deterministic prompt builder
│   ├── prompt-templates.ts # Template registry (6 built-in)
│   └── redis.ts            # Optional Redis cache layer
└── routes/
    ├── health.ts           # Health check endpoint
    └── prompt.ts           # /run, /raw, /templates endpoints
```

## Tech Stack

- **Runtime**: Node.js 22 (Alpine)
- **Framework**: Express
- **AI Model**: Google Gemini 2.0 Flash
- **Cache**: Redis 7 (optional, via Docker Compose)
- **Validation**: Zod
- **Language**: TypeScript (NodeNext modules)
