#!/usr/bin/env node

import { existsSync, readFileSync } from "fs";
import { basename, dirname, join } from "path";
import { fileURLToPath } from "url";

// ── .env loader (zero deps) ───────────────────────────────────────────

function loadEnvFile(): void {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const packageRoot = basename(moduleDir) === "dist" ? join(moduleDir, "..") : moduleDir;
  const envPath = join(packageRoot, ".env");
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile();

// ── Types ──────────────────────────────────────────────────────────────

interface ExaInput {
  /** Natural language search query (required) */
  query: string;

  /** Search type: auto (default), fast, instant, deep, deep-reasoning */
  type?: "auto" | "fast" | "instant" | "deep" | "deep-reasoning";

  /** Number of results (1-100, default 5) */
  results?: number;

  /** Max characters for highlights/text content (default 4000) */
  chars?: number;

  /** Content mode: highlights (default), text, summary */
  content?: "highlights" | "text" | "summary";

  /** Content category filter */
  category?: "company" | "people" | "research paper" | "news" | "tweet" | "personal site" | "financial report";

  /** Only return results from these domains */
  domains?: string[];

  /** Exclude results from these domains */
  excludeDomains?: string[];

  /** Only results published after this ISO date */
  startDate?: string;

  /** Only results published before this ISO date */
  endDate?: string;

  /** Force livecrawl for fresh content (slower) */
  fresh?: boolean;

  /** JSON schema for structured deep search output */
  schema?: Record<string, unknown>;

  /** System prompt for deep search behavior */
  systemPrompt?: string;

  /** Custom query for highlight/summary selection */
  contentQuery?: string;
}

interface ExaResult {
  title: string;
  url: string;
  publishedDate?: string | null;
  author?: string | null;
  text?: string;
  highlights?: string[];
  highlightScores?: number[];
  summary?: string;
}

interface ExaResponse {
  requestId: string;
  searchType?: string;
  results: ExaResult[];
  output?: {
    content: string | Record<string, unknown>;
    grounding?: Array<{
      field: string;
      citations: Array<{ url: string; title: string }>;
      confidence: string;
    }>;
  };
  costDollars?: { total: number };
  error?: string;
}

// ── API ────────────────────────────────────────────────────────────────

const EXA_API_URL = "https://api.exa.ai/search";

function getApiKey(): string {
  const key = process.env.EXA_API_KEY;
  if (!key) {
    console.error("error: EXA_API_KEY environment variable not set");
    console.error("Get your API key at https://dashboard.exa.ai/api-keys");
    process.exit(1);
  }
  return key;
}

function buildRequestBody(input: ExaInput): Record<string, unknown> {
  const contentMode = input.content ?? "highlights";
  const maxChars = input.chars ?? 4000;

  const body: Record<string, unknown> = {
    query: input.query,
    type: input.type ?? "auto",
    numResults: input.results ?? 5,
  };

  // Contents
  const contents: Record<string, unknown> = {};

  if (contentMode === "highlights") {
    const highlights: Record<string, unknown> = { maxCharacters: maxChars };
    if (input.contentQuery) highlights.query = input.contentQuery;
    contents.highlights = highlights;
  } else if (contentMode === "text") {
    contents.text = { maxCharacters: maxChars };
  } else if (contentMode === "summary") {
    const summary: Record<string, unknown> = {};
    if (input.contentQuery) summary.query = input.contentQuery;
    contents.summary = summary;
  }

  if (input.fresh) {
    contents.maxAgeHours = 0;
  }

  body.contents = contents;

  // Filters
  if (input.category) body.category = input.category;
  if (input.domains) body.includeDomains = input.domains;
  if (input.excludeDomains) body.excludeDomains = input.excludeDomains;
  if (input.startDate) body.startPublishedDate = input.startDate;
  if (input.endDate) body.endPublishedDate = input.endDate;

  // Deep search
  if (input.schema) body.outputSchema = input.schema;
  if (input.systemPrompt) body.systemPrompt = input.systemPrompt;

  return body;
}

async function search(input: ExaInput): Promise<ExaResponse> {
  const apiKey = getApiKey();
  const body = buildRequestBody(input);

  const isDeep = input.type === "deep" || input.type === "deep-reasoning";
  const timeoutMs = isDeep ? 120_000 : 30_000;

  const response = await fetch(EXA_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMsg: string;
    try {
      const errorJson = JSON.parse(errorText) as { error?: string };
      errorMsg = errorJson.error ?? errorText;
    } catch {
      errorMsg = errorText;
    }
    throw new Error(`Exa API error (${response.status}): ${errorMsg}`);
  }

  return (await response.json()) as ExaResponse;
}

// ── Formatting ─────────────────────────────────────────────────────────

function formatResults(response: ExaResponse, input: ExaInput): string {
  const lines: string[] = [];
  const resultCount = response.results.length;
  const searchType = response.searchType ? ` [${response.searchType}]` : "";
  const cost = response.costDollars ? ` ($${response.costDollars.total.toFixed(4)})` : "";

  lines.push(`${resultCount} results${searchType}${cost}`);
  lines.push("━".repeat(50));

  // Deep search output
  if (response.output?.content) {
    lines.push("");
    lines.push("## Answer");
    lines.push("");
    if (typeof response.output.content === "string") {
      lines.push(response.output.content);
    } else {
      lines.push(JSON.stringify(response.output.content, null, 2));
    }

    if (response.output.grounding?.length) {
      lines.push("");
      lines.push("### Sources");
      for (const g of response.output.grounding) {
        const confidence = g.confidence ? ` [${g.confidence}]` : "";
        for (const c of g.citations) {
          lines.push(`  ${c.title}${confidence}`);
          lines.push(`  ${c.url}`);
        }
      }
    }
    lines.push("");
    lines.push("━".repeat(50));
  }

  for (let i = 0; i < response.results.length; i++) {
    const r = response.results[i];
    lines.push("");
    lines.push(`[${i + 1}] ${r.title}`);
    lines.push(`    ${r.url}`);

    if (r.publishedDate) {
      lines.push(`    published: ${r.publishedDate.split("T")[0]}`);
    }
    if (r.author) {
      lines.push(`    author: ${r.author}`);
    }

    // Highlights
    if (r.highlights?.length) {
      lines.push("");
      for (let j = 0; j < r.highlights.length; j++) {
        const score = r.highlightScores?.[j];
        const scoreTag = score !== undefined ? ` [relevance: ${score.toFixed(2)}]` : "";
        lines.push(`    ${r.highlights[j].trim()}${scoreTag}`);
        if (j < r.highlights.length - 1) lines.push("");
      }
    }

    // Summary
    if (r.summary) {
      lines.push("");
      lines.push(`    ${r.summary}`);
    }

    // Full text
    if (r.text) {
      lines.push("");
      const text = r.text.length > (input.chars ?? 4000)
        ? r.text.slice(0, input.chars ?? 4000) + "..."
        : r.text;
      lines.push(`    ${text.split("\n").join("\n    ")}`);
    }

    lines.push("");
    lines.push("━".repeat(50));
  }

  return lines.join("\n");
}

// ── Input Parsing ──────────────────────────────────────────────────────

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf-8").trim();
}

function parseInput(raw: string): ExaInput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON input: ${raw.slice(0, 100)}`);
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Input must be a JSON object");
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj.query !== "string" || !obj.query.trim()) {
    throw new Error('Missing required field: "query"');
  }

  return obj as unknown as ExaInput;
}

// ── CLI ────────────────────────────────────────────────────────────────

function getVersion(): string {
  try {
    const moduleDir = dirname(fileURLToPath(import.meta.url));
    // Try dist/../package.json first, then ./package.json
    for (const candidate of [join(moduleDir, "..", "package.json"), join(moduleDir, "package.json")]) {
      try {
        const pkg = JSON.parse(readFileSync(candidate, "utf-8")) as { version?: string };
        if (pkg.version) return pkg.version;
      } catch {
        continue;
      }
    }
  } catch {
    // ignore
  }
  return "unknown";
}

function printHelp(): void {
  console.log(`exa-cli v${getVersion()} — Token-efficient web search for AI agents

Usage:
  exa-cli '{"query": "...", ...}'
  echo '{"query": "..."}' | exa-cli
  exa-cli --help | --version

JSON Input:
  query          string     Search query (required)
  type           string     auto | fast | instant | deep | deep-reasoning (default: auto)
  results        number     Number of results 1-100 (default: 5)
  chars          number     Max characters for content (default: 4000)
  content        string     highlights | text | summary (default: highlights)
  category       string     company | people | research paper | news | tweet | personal site | financial report
  domains        string[]   Only these domains
  excludeDomains string[]   Exclude these domains
  startDate      string     Published after (ISO date)
  endDate        string     Published before (ISO date)
  fresh          boolean    Force livecrawl for latest content
  schema         object     JSON schema for structured deep search output
  systemPrompt   string     Instructions for deep search
  contentQuery   string     Custom query for highlight/summary selection

Examples:
  exa-cli '{"query":"OpenAI embeddings API dimensions and models"}'
  exa-cli '{"query":"latest Rust async runtime benchmarks","results":3,"content":"summary"}'
  exa-cli '{"query":"Ollama embedding API","domains":["ollama.com","github.com"],"fresh":true}'
  exa-cli '{"query":"AI startups seed funding 2026","type":"deep","schema":{"type":"object","required":["companies"],"properties":{"companies":{"type":"array","items":{"type":"object","required":["name","funding"],"properties":{"name":{"type":"string"},"funding":{"type":"string"}}}}}}}'

Environment:
  EXA_API_KEY    API key from https://dashboard.exa.ai/api-keys`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Flags
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.log(getVersion());
    process.exit(0);
  }

  // Get input: CLI arg or stdin
  let rawInput: string;

  if (args.length > 0) {
    rawInput = args[0];
  } else if (!process.stdin.isTTY) {
    rawInput = await readStdin();
  } else {
    printHelp();
    process.exit(1);
  }

  try {
    const input = parseInput(rawInput);
    const response = await search(input);
    console.log(formatResults(response, input));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`error: ${message}`);
    process.exit(1);
  }
}

main();
