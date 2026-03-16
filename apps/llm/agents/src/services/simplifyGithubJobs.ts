import crypto from "node:crypto";
import { detectApplyBatchProvider, type ApplyBatchProvider } from "./applyBatchProviderDetector.js";

export type SimplifyGithubJobRow = {
  rowKey: string;
  company: string;
  roleTitle: string;
  location: string;
  applyUrl: string;
  age?: string;
  sourceUrl: string;
  sourceType: "markdown" | "html";
  raw: Record<string, string>;
  provider: ApplyBatchProvider;
};

type FetchLike = typeof fetch;

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function stripMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFirstUrl(text: string): string | undefined {
  const markdownMatch = text.match(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/i);
  if (markdownMatch?.[1]) return markdownMatch[1];

  const htmlMatch = text.match(/href=["'](https?:\/\/[^"']+)["']/i);
  if (htmlMatch?.[1]) return htmlMatch[1];

  const rawMatch = text.match(/https?:\/\/[^\s)>"']+/i);
  return rawMatch?.[0];
}

function parseMarkdownPipeRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function isMarkdownSeparator(line: string): boolean {
  const trimmed = line.trim();
  return /^[\|\s:-]+$/.test(trimmed) && trimmed.includes("-");
}

function hashRow(parts: string[]): string {
  return crypto.createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 16);
}

function makeRow(
  input: {
    company: string;
    roleTitle: string;
    location: string;
    applyUrl: string;
    age?: string;
    sourceUrl: string;
    sourceType: "markdown" | "html";
    raw: Record<string, string>;
  },
): SimplifyGithubJobRow | null {
  if (!input.company || !input.roleTitle || !input.applyUrl) {
    return null;
  }

  const normalizedApplyUrl = input.applyUrl.trim();
  if (!/^https?:\/\//i.test(normalizedApplyUrl)) {
    return null;
  }

  return {
    rowKey: hashRow([
      input.company.toLowerCase(),
      input.roleTitle.toLowerCase(),
      input.location.toLowerCase(),
      normalizedApplyUrl.toLowerCase(),
    ]),
    company: input.company.trim(),
    roleTitle: input.roleTitle.trim(),
    location: input.location.trim() || "Unknown",
    applyUrl: normalizedApplyUrl,
    age: input.age?.trim() || undefined,
    sourceUrl: input.sourceUrl,
    sourceType: input.sourceType,
    raw: input.raw,
    provider: detectApplyBatchProvider(normalizedApplyUrl),
  };
}

function dedupeRows(rows: SimplifyGithubJobRow[]): SimplifyGithubJobRow[] {
  const seen = new Set<string>();
  const output: SimplifyGithubJobRow[] = [];
  for (const row of rows) {
    const key = `${row.company.toLowerCase()}|${row.roleTitle.toLowerCase()}|${row.location.toLowerCase()}|${row.applyUrl.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(row);
  }
  return output;
}

function pickCell(
  row: Record<string, string>,
  keys: string[],
): string {
  for (const key of keys) {
    const value = row[key];
    if (value && value.trim()) return value.trim();
  }
  return "";
}

export function parseSimplifyJobsMarkdown(
  markdown: string,
  sourceUrl: string,
): SimplifyGithubJobRow[] {
  const lines = markdown.split(/\r?\n/);
  const rows: SimplifyGithubJobRow[] = [];
  let lastCompany = "";

  for (let index = 0; index < lines.length - 1; index += 1) {
    const headerLine = lines[index]?.trim();
    const separatorLine = lines[index + 1]?.trim();
    if (!headerLine?.startsWith("|") || !separatorLine || !isMarkdownSeparator(separatorLine)) {
      continue;
    }

    const headerCells = parseMarkdownPipeRow(headerLine).map(normalizeHeader);
    let rowIndex = index + 2;

    while (rowIndex < lines.length) {
      const rowLine = lines[rowIndex]?.trim();
      if (!rowLine?.startsWith("|") || isMarkdownSeparator(rowLine)) {
        break;
      }

      const rawCells = parseMarkdownPipeRow(rowLine);
      const mapped: Record<string, string> = {};
      headerCells.forEach((header, headerIndex) => {
        mapped[header] = rawCells[headerIndex] ?? "";
      });

      const rawCompany = stripMarkdown(
        pickCell(mapped, ["company", "companyname", "organization", "employer"]),
      );
      const company =
        rawCompany === "↳" || !rawCompany ? lastCompany : rawCompany;
      const roleTitle = stripMarkdown(
        pickCell(mapped, ["role", "roletitle", "title", "position", "jobtitle"]),
      );
      const location = stripMarkdown(
        pickCell(mapped, ["location", "locations", "place"]),
      );
      const applyCell = pickCell(
        mapped,
        ["applicationlink", "applylink", "apply", "url", "joblink", "link", "application"],
      );
      const applyUrl = extractFirstUrl(applyCell) ?? extractFirstUrl(rowLine);
      const age = stripMarkdown(pickCell(mapped, ["age", "posted", "postage"]));

      const nextRow = makeRow({
        company,
        roleTitle,
        location,
        applyUrl: applyUrl ?? "",
        age,
        sourceUrl,
        sourceType: "markdown",
        raw: Object.fromEntries(
          Object.entries(mapped).map(([key, value]) => [key, stripMarkdown(value)]),
        ),
      });

      if (nextRow) rows.push(nextRow);
      if (company) lastCompany = company;
      rowIndex += 1;
    }

    index = rowIndex - 1;
  }

  return dedupeRows(rows);
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function stripHtml(text: string): string {
  return decodeHtmlEntities(text).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function parseSimplifyJobsHtml(
  html: string,
  sourceUrl: string,
): SimplifyGithubJobRow[] {
  const rows: SimplifyGithubJobRow[] = [];
  const tableMatches = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];

  for (const table of tableMatches) {
    let lastCompany = "";
    const rowMatches = table.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
    if (rowMatches.length < 2) continue;
    const headerRow = rowMatches[0];
    if (!headerRow) continue;

    const headerCells = (headerRow.match(/<t[hd][\s\S]*?<\/t[hd]>/gi) ?? []).map((cell) =>
      normalizeHeader(stripHtml(cell)),
    );
    if (!headerCells.length) continue;

    for (const rowMatch of rowMatches.slice(1)) {
      const cellMatches = rowMatch.match(/<td[\s\S]*?<\/td>/gi) ?? [];
      if (!cellMatches.length) continue;

      const mapped: Record<string, string> = {};
      headerCells.forEach((header, index) => {
        mapped[header] = cellMatches[index] ?? "";
      });

      const rawCompany = stripMarkdown(
        pickCell(mapped, ["company", "companyname", "organization", "employer"]).replace(/<[^>]+>/g, " "),
      );
      const company =
        rawCompany === "↳" || !rawCompany ? lastCompany : rawCompany;
      const roleTitle = stripMarkdown(
        pickCell(mapped, ["role", "roletitle", "title", "position", "jobtitle"]).replace(/<[^>]+>/g, " "),
      );
      const location = stripMarkdown(
        pickCell(mapped, ["location", "locations", "place"]).replace(/<[^>]+>/g, " "),
      );
      const applyCell = pickCell(
        mapped,
        ["applicationlink", "applylink", "apply", "url", "joblink", "link", "application"],
      );
      const applyUrl = extractFirstUrl(applyCell) ?? extractFirstUrl(rowMatch);
      const age = stripMarkdown(
        pickCell(mapped, ["age", "posted", "postage"]).replace(/<[^>]+>/g, " "),
      );

      const nextRow = makeRow({
        company: stripHtml(company),
        roleTitle: stripHtml(roleTitle),
        location: stripHtml(location),
        applyUrl: applyUrl ?? "",
        age: stripHtml(age),
        sourceUrl,
        sourceType: "html",
        raw: Object.fromEntries(
          Object.entries(mapped).map(([key, value]) => [key, stripHtml(value)]),
        ),
      });

      if (nextRow) rows.push(nextRow);
      if (company) lastCompany = company;
    }
  }

  return dedupeRows(rows);
}

function buildGithubRawCandidates(sourceUrl: string): string[] {
  try {
    const url = new URL(sourceUrl);
    if (url.hostname === "raw.githubusercontent.com") {
      return [sourceUrl];
    }
    if (url.hostname !== "github.com") {
      return [];
    }

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return [];

    const [owner, repo] = parts;
    const candidates = ["main", "master", "dev"].map(
      (branch) => `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`,
    );

    if (parts[2] === "blob" && parts.length >= 5) {
      const branch = parts[3];
      const filePath = parts.slice(4).join("/");
      candidates.unshift(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`);
    }

    return [...new Set(candidates)];
  } catch {
    return [];
  }
}

export async function fetchAndParseSimplifyJobs(
  sourceUrl: string,
  fetchImpl: FetchLike = fetch,
): Promise<{
  sourceUrl: string;
  resolvedUrl: string;
  sourceType: "markdown" | "html";
  jobs: SimplifyGithubJobRow[];
}> {
  const rawCandidates = buildGithubRawCandidates(sourceUrl);

  for (const rawUrl of rawCandidates) {
    const response = await fetchImpl(rawUrl, {
      headers: { "User-Agent": "aihire-apply-batch" },
      redirect: "follow",
    });
    if (!response.ok) continue;
    const markdown = await response.text();
    const jobs = parseSimplifyJobsMarkdown(markdown, rawUrl);
    if (jobs.length) {
      return {
        sourceUrl,
        resolvedUrl: rawUrl,
        sourceType: "markdown",
        jobs,
      };
    }
  }

  const htmlResponse = await fetchImpl(sourceUrl, {
    headers: { "User-Agent": "aihire-apply-batch" },
    redirect: "follow",
  });
  if (!htmlResponse.ok) {
    throw new Error(`Failed to fetch source URL: ${sourceUrl} (${htmlResponse.status})`);
  }

  const html = await htmlResponse.text();
  const jobs = parseSimplifyJobsHtml(html, sourceUrl);
  if (!jobs.length) {
    throw new Error(`Could not parse SimplifyJobs table from source: ${sourceUrl}`);
  }

  return {
    sourceUrl,
    resolvedUrl: sourceUrl,
    sourceType: "html",
    jobs,
  };
}
