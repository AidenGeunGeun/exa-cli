---
name: exa-cli
description: Token-efficient web search via the Exa API. Use when an agent needs to search the web, research documentation, look up current information, find API references, or investigate any topic that requires external knowledge. Prefer this over webfetch for any multi-result research task — it returns dense highlights instead of dumping entire pages into context. Also use when the user mentions "exa", "web search", "look this up", "research this online", or needs current information beyond training data.
---

# exa-cli

`exa-cli` is a Node.js CLI that searches the web via the Exa API and returns token-efficient results optimized for agent consumption. It replaces raw webfetch workflows that bloat context windows with full page dumps.

## When to Use This vs Other Tools

- **Need current web information:** `exa-cli` (NOT webfetch)
- **Need to research API docs or compare options:** `exa-cli` with highlights
- **Need structured data from the web:** `exa-cli` with deep search + schema
- **Need to read a specific known URL:** `webfetch` (exa-cli is for search, not direct URL fetching)
- **Need to find code in the local codebase:** `code-intel` (NOT exa-cli)

## Usage

Pass a JSON object as the first argument or pipe via stdin:

```bash
exa-cli '{"query":"OpenAI embeddings API request schema and models"}'
exa-cli '{"query":"Rust async runtime comparison 2026","results":3,"content":"summary"}'
printf '%s' '{"query":"latest Node.js LTS version"}' | exa-cli
```

## JSON Input

```ts
interface ExaInput {
  query: string;              // required — natural language search query
  type?: string;              // "auto" (default) | "fast" | "instant" | "deep" | "deep-reasoning"
  results?: number;           // number of results, 1-100 (default: 5)
  chars?: number;             // max characters for content (default: 4000)
  content?: string;           // "highlights" (default) | "text" | "summary"
  category?: string;          // "company" | "people" | "research paper" | "news" | "tweet" | "personal site" | "financial report"
  domains?: string[];         // only return results from these domains
  excludeDomains?: string[];  // exclude results from these domains
  startDate?: string;         // only results published after this ISO date
  endDate?: string;           // only results published before this ISO date
  fresh?: boolean;            // force livecrawl for latest content (slower)
  schema?: object;            // JSON schema for structured deep search output
  systemPrompt?: string;      // instructions for deep search behavior
  contentQuery?: string;      // custom query for highlight/summary selection
}
```

## Content Modes

| Mode | Best for | Token cost |
|------|----------|------------|
| `highlights` (default) | Factual lookups, API docs, multi-step research | Low — only relevant excerpts |
| `summary` | Quick overviews, when you need a condensed answer | Low — LLM-generated summary |
| `text` | Deep analysis requiring full page context | High — full page text |

**Always prefer `highlights` for agent workflows.** It returns 10x fewer tokens than full text while preserving the most relevant information.

## Search Types

| Type | Speed | When to use |
|------|-------|-------------|
| `auto` (default) | ~1s | Almost always the right choice |
| `fast` | ~450ms | When speed matters more than completeness |
| `instant` | ~200ms | Real-time / interactive use |
| `deep` | 5-60s | Complex queries needing multi-step reasoning |
| `deep-reasoning` | 5-60s | Maximum reasoning for every step |

## Examples

### Research API documentation
```bash
exa-cli '{"query":"Google Gemini embedding API dimensions and authentication","domains":["cloud.google.com","ai.google.dev"],"chars":6000}'
```

### Find recent news
```bash
exa-cli '{"query":"AI model releases March 2026","category":"news","results":5,"startDate":"2026-03-01"}'
```

### Deep search with structured output
```bash
exa-cli '{"query":"compare embedding API pricing across providers","type":"deep","schema":{"type":"object","required":["providers"],"properties":{"providers":{"type":"array","items":{"type":"object","required":["name","price_per_million_tokens","dimensions"],"properties":{"name":{"type":"string"},"price_per_million_tokens":{"type":"string"},"dimensions":{"type":"string"}}}}}}}'
```

### Scoped domain search
```bash
exa-cli '{"query":"Ollama embedding models API endpoint","domains":["ollama.com","github.com/ollama"]}'
```

### Fresh content (force livecrawl)
```bash
exa-cli '{"query":"current Node.js LTS version","fresh":true,"results":3}'
```

## Best Practices

- Use descriptive, natural language queries — Exa handles semantic search well.
- Set `chars` based on how much detail you need (2000 for quick facts, 6000+ for detailed API specs).
- Use `domains` to scope results when you know the authoritative source.
- Use `category` for specialized searches (companies, people, research papers).
- Deep search is powerful but slow (5-60s) — only use for complex multi-step queries.
- `fresh: true` forces livecrawl on every result, increasing latency. Only use when you need truly current data.

## Environment

Requires `EXA_API_KEY`. Get one at https://dashboard.exa.ai/api-keys

If `EXA_API_KEY` is not set, the CLI exits with an error message and a link to get a key.
