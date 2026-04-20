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

const SEARCH_TYPES = ["auto", "fast", "instant", "deep-lite", "deep", "deep-reasoning"] as const;
const CONTENT_MODES = ["highlights", "text", "summary"] as const;
const CATEGORIES = ["company", "people", "research paper", "news", "personal site", "financial report"] as const;

type SearchType = typeof SEARCH_TYPES[number];
type ContentMode = typeof CONTENT_MODES[number];
type Category = typeof CATEGORIES[number];

interface ExaInput {
  /** Natural language search query (required) */
  query: string;

  /** Search type: auto (default), fast, instant, deep-lite, deep, deep-reasoning */
  type?: SearchType;

  /** Number of results (1-100, default 10) */
  results?: number;

  /** Max characters for highlights/text content (default 4000) */
  chars?: number;

  /** Content mode(s): highlights (default), text, summary */
  content?: ContentMode | ContentMode[];

  /** Content category filter */
  category?: Category;

  /** Only return results from these domains */
  domains?: string[];

  /** Exclude results from these domains */
  excludeDomains?: string[];

  /** Only results published after this ISO date */
  startDate?: string;

  /** Only results published before this ISO date */
  endDate?: string;

  /** Force livecrawl for fresh content (alias for maxAgeHours: 0) */
  fresh?: boolean;

  /** Allow cached results newer than this many hours */
  maxAgeHours?: number;

  /** Extra query variations to improve search coverage */
  additionalQueries?: string[];

  /** JSON schema for structured output */
  schema?: Record<string, unknown>;

  /** System prompt for search behavior */
  systemPrompt?: string;

  /** Custom query for highlight/summary selection */
  contentQuery?: string;

  /** CLI-only: suppress raw results when synthesis is present */
  synthOnly?: boolean;
}

interface ExaResult {
  title: string;
  url: string;
  publishedDate?: string | null;
  author?: string | null;
  text?: string;
  highlights?: string[];
  summary?: string;
}

interface ExaGrounding {
  field?: string;
  citations: Array<{ url: string; title: string }>;
  confidence?: string;
}

interface ExaResponse {
  requestId: string;
  searchType?: string;
  results: ExaResult[];
  output?: {
    content: string | Record<string, unknown>;
    grounding?: ExaGrounding[];
  };
  costDollars?: { total: number };
  error?: string;
}

// ── Validation helpers ─────────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatAllowedValues(values: readonly string[]): string {
  return values.map((value) => `"${value}"`).join(", ");
}

function parseEnumValue<T extends readonly string[]>(
  value: unknown,
  fieldName: string,
  allowedValues: T,
): T[number] {
  if (typeof value !== "string" || !allowedValues.includes(value as T[number])) {
    throw new Error(`Invalid "${fieldName}". Expected one of: ${formatAllowedValues(allowedValues)}`);
  }
  return value as T[number];
}

function parseInteger(value: unknown, fieldName: string, min: number, max?: number): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`Invalid "${fieldName}". Expected an integer.`);
  }
  if (value < min || (max !== undefined && value > max)) {
    const range = max === undefined ? `>= ${min}` : `${min}-${max}`;
    throw new Error(`Invalid "${fieldName}". Expected an integer in range ${range}.`);
  }
  return value;
}

function parseNonNegativeNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid "${fieldName}". Expected a non-negative number.`);
  }
  return value;
}

function parseBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid "${fieldName}". Expected true or false.`);
  }
  return value;
}

function parseStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Invalid "${fieldName}". Expected an array of strings.`);
  }
  return value;
}

function parseContent(value: unknown): ContentMode | ContentMode[] {
  if (typeof value === "string") {
    return parseEnumValue(value, "content", CONTENT_MODES);
  }

  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Invalid \"content\". Expected a content mode or a non-empty array of content modes.");
  }

  return Array.from(new Set(value.map((item) => parseEnumValue(item, "content", CONTENT_MODES))));
}

function normalizeContentModes(content: ExaInput["content"]): ContentMode[] {
  if (!content) return ["highlights"];
  return Array.isArray(content) ? content : [content];
}

function hasSynthesis(response: ExaResponse): boolean {
  return response.output?.content !== undefined && response.output.content !== null;
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
  const maxChars = input.chars ?? 4000;
  const contentModes = normalizeContentModes(input.content);

  const body: Record<string, unknown> = {
    query: input.query,
    type: input.type ?? "auto",
    numResults: input.results ?? 10,
  };

  const contents: Record<string, unknown> = {};

  for (const mode of contentModes) {
    if (mode === "highlights") {
      const highlights: Record<string, unknown> = { maxCharacters: maxChars };
      if (input.contentQuery) highlights.query = input.contentQuery;
      contents.highlights = highlights;
      continue;
    }

    if (mode === "text") {
      contents.text = { maxCharacters: maxChars };
      continue;
    }

    const summary: Record<string, unknown> = {};
    if (input.contentQuery) summary.query = input.contentQuery;
    contents.summary = summary;
  }

  if (typeof input.maxAgeHours === "number") {
    contents.maxAgeHours = input.maxAgeHours;
  } else if (input.fresh) {
    contents.maxAgeHours = 0;
  }

  body.contents = contents;

  if (input.additionalQueries?.length) body.additionalQueries = input.additionalQueries;

  if (input.category) body.category = input.category;
  if (input.domains) body.includeDomains = input.domains;
  if (input.excludeDomains) body.excludeDomains = input.excludeDomains;
  if (input.startDate) body.startPublishedDate = input.startDate;
  if (input.endDate) body.endPublishedDate = input.endDate;

  if (input.schema) body.outputSchema = input.schema;
  if (input.systemPrompt) body.systemPrompt = input.systemPrompt;

  return body;
}

async function search(input: ExaInput): Promise<ExaResponse> {
  const apiKey = getApiKey();
  const body = buildRequestBody(input);

  const isDeep = input.type === "deep-lite" || input.type === "deep" || input.type === "deep-reasoning";
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

function formatSynthesis(response: ExaResponse): string[] {
  if (!response.output) return [];

  const lines: string[] = ["## Answer", ""];

  if (typeof response.output.content === "string") {
    lines.push(response.output.content);
  } else {
    lines.push(JSON.stringify(response.output.content, null, 2));
  }

  if (response.output.grounding?.length) {
    lines.push("");
    lines.push("### Sources");

    for (const grounding of response.output.grounding) {
      const label = grounding.field ?? "result";
      const confidence = grounding.confidence ? ` [${grounding.confidence}]` : "";
      lines.push(`- ${label}${confidence}`);

      for (const citation of grounding.citations) {
        lines.push(`  - ${citation.title}`);
        lines.push(`    ${citation.url}`);
      }
    }
  }

  return lines;
}

function formatResults(response: ExaResponse, input: ExaInput): string {
  if (input.synthOnly && hasSynthesis(response)) {
    return formatSynthesis(response).join("\n");
  }

  const lines: string[] = [];
  const resultCount = response.results.length;
  const searchType = response.searchType ? ` [${response.searchType}]` : "";
  const cost = response.costDollars ? ` ($${response.costDollars.total.toFixed(4)})` : "";

  lines.push(`${resultCount} results${searchType}${cost}`);
  lines.push("━".repeat(50));

  if (hasSynthesis(response)) {
    lines.push("");
    lines.push(...formatSynthesis(response));
    lines.push("");
    lines.push("━".repeat(50));
  }

  for (let i = 0; i < response.results.length; i++) {
    const result = response.results[i];
    lines.push("");
    lines.push(`[${i + 1}] ${result.title}`);
    lines.push(`    ${result.url}`);

    if (result.publishedDate) {
      lines.push(`    published: ${result.publishedDate.split("T")[0]}`);
    }
    if (result.author) {
      lines.push(`    author: ${result.author}`);
    }

    if (result.highlights?.length) {
      lines.push("");
      for (let j = 0; j < result.highlights.length; j++) {
        lines.push(`    ${result.highlights[j].trim()}`);
        if (j < result.highlights.length - 1) lines.push("");
      }
    }

    if (result.summary) {
      lines.push("");
      lines.push(`    ${result.summary}`);
    }

    if (result.text) {
      lines.push("");
      const maxChars = input.chars ?? 4000;
      const text = result.text.length > maxChars ? result.text.slice(0, maxChars) + "..." : result.text;
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

  if (!isPlainObject(parsed)) {
    throw new Error("Input must be a JSON object");
  }

  const input: ExaInput = {
    query: typeof parsed.query === "string" ? parsed.query.trim() : "",
  };

  if (!input.query) {
    throw new Error('Missing required field: "query"');
  }

  if (parsed.type !== undefined) input.type = parseEnumValue(parsed.type, "type", SEARCH_TYPES);
  if (parsed.results !== undefined) input.results = parseInteger(parsed.results, "results", 1, 100);
  if (parsed.chars !== undefined) input.chars = parseInteger(parsed.chars, "chars", 1);
  if (parsed.content !== undefined) input.content = parseContent(parsed.content);
  if (parsed.category !== undefined) input.category = parseEnumValue(parsed.category, "category", CATEGORIES);
  if (parsed.domains !== undefined) input.domains = parseStringArray(parsed.domains, "domains");
  if (parsed.excludeDomains !== undefined) input.excludeDomains = parseStringArray(parsed.excludeDomains, "excludeDomains");
  if (parsed.startDate !== undefined && typeof parsed.startDate !== "string") {
    throw new Error('Invalid "startDate". Expected a string.');
  }
  if (parsed.endDate !== undefined && typeof parsed.endDate !== "string") {
    throw new Error('Invalid "endDate". Expected a string.');
  }
  if (parsed.startDate !== undefined) input.startDate = parsed.startDate;
  if (parsed.endDate !== undefined) input.endDate = parsed.endDate;
  if (parsed.fresh !== undefined) input.fresh = parseBoolean(parsed.fresh, "fresh");
  if (parsed.maxAgeHours !== undefined) input.maxAgeHours = parseNonNegativeNumber(parsed.maxAgeHours, "maxAgeHours");
  if (parsed.additionalQueries !== undefined) {
    input.additionalQueries = parseStringArray(parsed.additionalQueries, "additionalQueries");
  }
  if (parsed.schema !== undefined) {
    if (!isPlainObject(parsed.schema)) {
      throw new Error('Invalid "schema". Expected an object.');
    }
    input.schema = parsed.schema;
  }
  if (parsed.systemPrompt !== undefined && typeof parsed.systemPrompt !== "string") {
    throw new Error('Invalid "systemPrompt". Expected a string.');
  }
  if (parsed.contentQuery !== undefined && typeof parsed.contentQuery !== "string") {
    throw new Error('Invalid "contentQuery". Expected a string.');
  }
  if (parsed.systemPrompt !== undefined) input.systemPrompt = parsed.systemPrompt;
  if (parsed.contentQuery !== undefined) input.contentQuery = parsed.contentQuery;
  if (parsed.synthOnly !== undefined) input.synthOnly = parseBoolean(parsed.synthOnly, "synthOnly");

  return input;
}

// ── CLI ────────────────────────────────────────────────────────────────

function getVersion(): string {
  try {
    const moduleDir = dirname(fileURLToPath(import.meta.url));
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
  query             string             Search query (required)
  type              string             auto | fast | instant | deep-lite | deep | deep-reasoning (default: auto)
  results           number             Number of results 1-100 (default: 10)
  chars             number             Max characters for highlights/text (default: 4000)
  content           string|string[]    highlights | text | summary (default: highlights)
  category          string             company | people | research paper | news | personal site | financial report
  domains           string[]           Only these domains
  excludeDomains    string[]           Exclude these domains
  startDate         string             Published after (ISO date)
  endDate           string             Published before (ISO date)
  fresh             boolean            Alias for maxAgeHours: 0
  maxAgeHours       number             Allow cached results newer than this many hours
  additionalQueries string[]           Extra query variations to improve recall
  schema            object             JSON schema for structured output
  systemPrompt      string             Instructions for search behavior
  contentQuery      string             Custom query for highlights/summary selection
  synthOnly         boolean            Suppress raw results when synthesis is present

Examples:
  exa-cli '{"query":"OpenAI embeddings API dimensions and models"}'
  exa-cli '{"query":"latest Rust async runtime benchmarks","results":3,"content":["highlights","text"]}'
  exa-cli '{"query":"current Node.js LTS version","domains":["nodejs.org"],"maxAgeHours":24}'
  exa-cli '{"query":"AI startups seed funding 2026","type":"auto","schema":{"type":"object","required":["companies"],"properties":{"companies":{"type":"array","items":{"type":"object","required":["name","funding"],"properties":{"name":{"type":"string"},"funding":{"type":"string"}}}}}}}'
  exa-cli '{"query":"compare coding agents for greenfield Next.js apps","type":"deep-reasoning","additionalQueries":["agentic coding tool benchmark 2026","Next.js coding assistant comparison"],"systemPrompt":"Return a concise buyer's guide with strengths, weaknesses, and best fit.","schema":{"type":"text","description":"Buyer guide markdown"},"synthOnly":true}'

Environment:
  EXA_API_KEY       API key from https://dashboard.exa.ai/api-keys`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.log(getVersion());
    process.exit(0);
  }

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
