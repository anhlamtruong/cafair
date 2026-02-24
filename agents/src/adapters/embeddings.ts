export type EmbeddingsMode = "stub" | "real";

export interface EmbeddingsConfig {
  mode: EmbeddingsMode;
  region?: string;       
  modelId?: string;      // Nova embeddings model id 
}

export interface EmbedRequest {
  id: string;
  text: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface EmbedVector {
  id: string;
  vector: number[];
  metadata?: Record<string, string | number | boolean>;
}

function stubVector(text: string, dims = 16): number[] {
  const v = new Array(dims).fill(0);
  for (let i = 0; i < text.length; i++) {
    v[i % dims] += (text.charCodeAt(i) % 31) / 31;
  }
  // normalize
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

function dot(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let s = 0;
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

/**
 * Create embedding vectors 
 */
export async function embedTextBatch(
  cfg: EmbeddingsConfig,
  items: EmbedRequest[]
): Promise<EmbedVector[]> {
  if (cfg.mode === "stub") {
    return items.map((it) => ({
      id: it.id,
      vector: stubVector(it.text),
      metadata: it.metadata,
    }));
  }

  
  throw new Error("embedTextBatch real mode not implemented yet.");
}

/**
 * Simple in-memory semantic search over embedded items
 */
export function semanticSearchTopK(args: {
  queryVector: number[];
  corpus: EmbedVector[];
  k: number;
}): { id: string; score: number; metadata?: EmbedVector["metadata"] }[] {
  const scored = args.corpus.map((c) => ({
    id: c.id,
    score: dot(args.queryVector, c.vector),
    metadata: c.metadata,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, args.k);
}