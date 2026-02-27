// Path: agents/src/adapters/bedrock.ts
//
// Minimal Bedrock adapter for AI Hire AI / FairSignal
// - Stub-first for hackathon reliability
// - Real-mode skeleton ready for AWS Bedrock Runtime
//
// Usage:
//   const res = await bedrockGenerateText(
//     { mode: "stub", modelId: "amazon.nova-lite-v1:0" },
//     { prompt: "Summarize this candidate..." }
//   )
//
// Notes:
// - Keep API keys / tokens in env vars, never hardcode.
// - If you later switch to real mode, install:
//     npm i @aws-sdk/client-bedrock-runtime
// - This file is written so your app can use the same interface in both stub + real mode.

export type BedrockMode = "stub" | "real";

export interface BedrockConfig {
  mode: BedrockMode;
  region?: string;          // e.g. "us-east-1"
  modelId?: string;         // e.g. Nova Lite model id
  maxTokens?: number;       // default 256
  temperature?: number;     // default 0.2
}

export interface BedrockTextRequest {
  system?: string;
  prompt: string;
}

export interface BedrockTextResponse {
  text: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  modelId?: string;
  raw?: unknown;
}

// ---------------------------
// Small helpers
// ---------------------------
function stableHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function estimateTokens(text: string): number {
  // very rough estimate for demo
  return Math.max(1, Math.ceil(text.trim().length / 4));
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function pickStubReply(req: BedrockTextRequest): string {
  const prompt = req.prompt.toLowerCase();
  const key = stableHash((req.system ?? "") + "||" + req.prompt);

  // Light intent routing for more believable demo behavior
  if (prompt.includes("follow-up") || prompt.includes("email")) {
    const replies = [
      "Thanks for speaking with us today. We’d like to move you to the next step and will share scheduling details shortly.",
      "Thank you for your time at the career fair. We’d love to continue the conversation and coordinate next steps.",
      "We appreciate your interest. Please share a few times that work for a short follow-up conversation this week.",
    ];
    return replies[key % replies.length];
  }

  if (prompt.includes("risk") || prompt.includes("verify") || prompt.includes("mismatch")) {
    const replies = [
      "Moderate risk signal detected. Recommend confirming timeline claims and requesting one supporting artifact.",
      "High-confidence mismatch signal. Ask a short clarification question before advancing to the next stage.",
      "Low risk overall, but one claim should be verified with a quick follow-up.",
    ];
    return replies[key % replies.length];
  }

  if (prompt.includes("summary") || prompt.includes("summarize")) {
    const replies = [
      "Strong overall fit with clear project evidence. Recommend moving to recruiter review.",
      "Potential fit with partial must-have coverage. A quick screen is recommended before recruiter time.",
      "Candidate shows relevant signals but needs stronger proof on core requirements.",
    ];
    return replies[key % replies.length];
  }

  if (prompt.includes("score") || prompt.includes("rubric")) {
    const replies = [
      "Fit is strong on must-haves and communication. Main gap is depth evidence on one required skill.",
      "Candidate meets several criteria but should complete a short micro-screen to validate role alignment.",
      "Evidence suggests medium alignment with one notable risk factor requiring clarification.",
    ];
    return replies[key % replies.length];
  }

  const generic = [
    "Here is a concise, evidence-based output for the current step.",
    "This result is generated in stub mode for demo reliability.",
    "Recommended next action: proceed with the highest-signal, lowest-risk path.",
  ];

  return generic[key % generic.length];
}

// ---------------------------
// Main text generation
// ---------------------------
export async function bedrockGenerateText(
  cfg: BedrockConfig,
  req: BedrockTextRequest
): Promise<BedrockTextResponse> {
  const region = cfg.region ?? process.env.AWS_REGION ?? "us-east-1";
  const modelId = cfg.modelId ?? process.env.BEDROCK_MODEL_ID ?? "stub-nova-lite";
  const maxTokens = cfg.maxTokens ?? 256;
  const temperature = cfg.temperature ?? 0.2;

  // -----------------------
  // Stub mode
  // -----------------------
  if (cfg.mode === "stub") {
    const text = cleanText(pickStubReply(req));

    return {
      text,
      usage: {
        inputTokens: estimateTokens((req.system ?? "") + "\n" + req.prompt),
        outputTokens: estimateTokens(text),
      },
      modelId,
      raw: {
        mode: "stub",
        region,
        maxTokens,
        temperature,
      },
    };
  }

  // -----------------------
  // Real mode
  // -----------------------
  // This section intentionally avoids importing AWS SDK at top-level
  // so stub mode works even if @aws-sdk/client-bedrock-runtime is not installed.
  try {
    const aws = await import("@aws-sdk/client-bedrock-runtime");

    const client = new aws.BedrockRuntimeClient({
      region,
    });

    // This payload shape is a generic JSON body for text generation.
    // You may need to adjust this to the exact Nova model schema you use.
    const body = JSON.stringify({
      system: req.system ?? "",
      inputText: req.prompt,
      maxTokens,
      temperature,
    });

    const command = new aws.InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body,
    });

    const response = await client.send(command);

    let parsed: any = null;
    let text = "";

    if (response.body) {
      const decoder = new TextDecoder("utf-8");
      const rawText = decoder.decode(response.body);

      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = rawText;
      }

      // Try common response shapes
      if (typeof parsed === "string") {
        text = parsed;
      } else if (parsed?.outputText) {
        text = parsed.outputText;
      } else if (parsed?.text) {
        text = parsed.text;
      } else if (Array.isArray(parsed?.results) && parsed.results[0]?.outputText) {
        text = parsed.results[0].outputText;
      } else if (Array.isArray(parsed?.content) && parsed.content[0]?.text) {
        text = parsed.content[0].text;
      } else {
        text = JSON.stringify(parsed);
      }
    }

    text = cleanText(text);

    return {
      text,
      usage: {
        inputTokens: estimateTokens((req.system ?? "") + "\n" + req.prompt),
        outputTokens: estimateTokens(text),
      },
      modelId,
      raw: parsed ?? response,
    };
  } catch (error) {
    // Helpful error for hackathon debugging
    const message =
      error instanceof Error ? error.message : "Unknown Bedrock error";

    throw new Error(
      `bedrockGenerateText real mode failed. Check AWS credentials, region, modelId, and SDK install. Details: ${message}`
    );
  }
}

// ---------------------------
// Optional convenience helper
// ---------------------------
export async function bedrockSummarize(
  cfg: BedrockConfig,
  input: string
): Promise<string> {
  const res = await bedrockGenerateText(cfg, {
    system: "You are a concise assistant that produces short, factual summaries.",
    prompt: `Summarize this in 2 sentences:\n\n${input}`,
  });
  return res.text;
}