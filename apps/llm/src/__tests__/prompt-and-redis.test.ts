import { describe, it, expect, vi, beforeEach } from "vitest";

import { formatPrompt } from "../lib/prompt-formatter.js";
import { PROMPT_TEMPLATES } from "../lib/prompt-templates.js";

// Mock ioredis to avoid network usage in tests
vi.mock("ioredis", () => {
  type ListenerMap = Record<string, Array<(...args: unknown[]) => void>>;

  class MockRedis {
    private listeners: ListenerMap = {};
    private store = new Map<string, string>();

    constructor(_url?: string, _options?: Record<string, unknown>) {}

    on(event: string, cb: (...args: unknown[]) => void) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(cb);
      return this;
    }

    async connect() {
      (this.listeners["connect"] || []).forEach((cb) => cb());
      return this;
    }

    async get(key: string) {
      return this.store.get(key) ?? null;
    }

    async setex(key: string, _ttl: number, value: string) {
      this.store.set(key, value);
      return "OK";
    }

    async quit() {
      return "OK";
    }
  }

  return { default: MockRedis };
});

describe("prompt formatter", () => {
  it("builds a deterministic prompt with required sections", () => {
    const prompt = formatPrompt({
      role: "Expert tester",
      task: "Generate a summary",
      rules: ["Return JSON only"],
      input: { text: "Hello" },
      output: { summary: "string" },
    });

    expect(prompt).toContain("Role: Expert tester");
    expect(prompt).toContain("Task: Generate a summary");
    expect(prompt).toContain("Input (JSON):");
    expect(prompt).toContain("Rules:");
    expect(prompt).toContain("- Return JSON only");
    expect(prompt).toContain("Output (JSON):");
  });

  it("creates a prompt using a registered template", () => {
    const template = PROMPT_TEMPLATES["summarize-text"];
    const prompt = template({ text: "Hello world" });

    expect(prompt).toContain("Task: Produce a concise, accurate summary");
    expect(prompt).toContain('"text"');
  });
});

describe("redis cache layer", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.REDIS_URL = "redis://localhost:6379";
  });

  it("caches and retrieves responses when redis is connected", async () => {
    const redisModule = await import("../lib/redis.js");

    redisModule.initRedis();

    const prompt = "test prompt";
    await redisModule.setCachedResponse(prompt, "cached-response", 60);

    const cached = await redisModule.getCachedResponse(prompt);

    expect(cached).toBe("cached-response");
    expect(redisModule.isRedisConnected()).toBe(true);

    await redisModule.closeRedis();
    expect(redisModule.isRedisConnected()).toBe(false);
  });
});
