import { detectApplyBatchProvider } from "./applyBatchProviderDetector.js";

type FetchLike = typeof fetch;

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36";

function stripHtml(text: string): string {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function pickMatch(text: string, pattern: RegExp): string | undefined {
  const match = text.match(pattern);
  return match?.[1] ? stripHtml(match[1]) : undefined;
}

function compactSnippet(parts: Array<string | undefined>): string | undefined {
  const joined = parts
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" | ")
    .trim();

  if (!joined) {
    return undefined;
  }

  return joined.slice(0, 800);
}

export async function loadApplyBatchJobSnippet(
  applyUrl: string,
  fetchImpl: FetchLike = fetch,
): Promise<string | undefined> {
  if (!/^https?:\/\//i.test(applyUrl)) {
    return undefined;
  }

  const provider = detectApplyBatchProvider(applyUrl);
  if (provider === "other") {
    return undefined;
  }

  try {
    const response = await fetchImpl(applyUrl, {
      redirect: "follow",
      headers: {
        "user-agent": DEFAULT_USER_AGENT,
        accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      return undefined;
    }

    const html = await response.text();
    if (!html.trim()) {
      return undefined;
    }

    const title = pickMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const metaDescription = pickMatch(
      html,
      /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i,
    );
    const ogDescription = pickMatch(
      html,
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i,
    );
    const bodyText = stripHtml(html).slice(0, 1200);

    return compactSnippet([
      title,
      metaDescription,
      ogDescription,
      bodyText,
    ]);
  } catch {
    return undefined;
  }
}
