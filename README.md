<div align="center">

# exa-cli

**Web research for AI agents, without the token bloat.**

[![npm version](https://img.shields.io/npm/v/%40skybluejacket%2Fexa-cli?color=369eff&labelColor=black&style=flat-square)](https://www.npmjs.com/package/@skybluejacket/exa-cli)
[![License](https://img.shields.io/badge/license-MIT-white?labelColor=black&style=flat-square)](LICENSE)

Powered by [Exa](https://exa.ai)

</div>

A single JSON-in, JSON-out CLI wrapped around Exa's `/search` API.
Three tiers — quick lookup, fast synthesis, iterative research — so you pick the right amount of work for the question.

---

## Install in 30 seconds

```bash
npm install -g @skybluejacket/exa-cli
export EXA_API_KEY=your-key-here    # get one at https://dashboard.exa.ai/api-keys
exa-cli '{"query":"current Node.js LTS"}'
```

No config file, no server, no login flow.

---

## Pick the Right Tier

Deep-reasoning is the fast middle tier — use it for synthesis without meta-analysis. Reach for a web-search agent only when you need claim-level citations, source conflicts, or follow-the-thread reasoning.

| Need | Use | Cost | Latency | Best for |
|:-----|:----|:-----|:--------|:---------|
| **Quick lookup** | `auto` / `fast` / `instant` | $0.007 | 1-2s | Facts, API docs, single-step research |
| **Synthesized research** | `deep` / `deep-reasoning` | $0.012-$0.015 | 15-30s | Comparisons, landscape scans, structured writeups |
| **Iterative research** | web-search agent | ~$0.08 | 60-90s | Claim-level citations, source conflicts, open-ended investigation |

- `deep-lite` exists but is weak for synthesis. Default to `deep` or `deep-reasoning` for a real writeup.
- First 10 results' contents are bundled. `exa-cli` defaults to 10 results.

---

## Usage

```bash
# Quick lookup — cheap, fast, token-efficient highlights
exa-cli '{"query":"Rust async runtime benchmarks 2026"}'

# Structured extraction on a cheap auto call
exa-cli '{
  "query": "latest Node.js LTS release line and support dates",
  "domains": ["nodejs.org"],
  "schema": {
    "type": "object",
    "required": ["line", "codename", "support_end"],
    "properties": {
      "line": {"type": "string"},
      "codename": {"type": "string"},
      "support_end": {"type": "string"}
    }
  }
}'

# Freshness budget + combined content modes
exa-cli '{"query":"Bun package manager roadmap","content":["highlights","text"],"maxAgeHours":24}'

# Deep-reasoning synthesis with extra query variants and no raw dump
exa-cli '{
  "query": "compare coding agents for greenfield Next.js apps",
  "type": "deep-reasoning",
  "additionalQueries": ["agentic coding tool benchmark 2026"],
  "systemPrompt": "Return a concise buyer guide with strengths, weaknesses, and best fit.",
  "schema": {"type": "text", "description": "Buyer guide markdown"},
  "synthOnly": true
}'

# Pipe via stdin
printf '%s' '{"query":"latest Node.js LTS"}' | exa-cli
```

---

## JSON Input

| Field | Type | Default | What it does |
|:------|:-----|:--------|:-------------|
| `query` | string | **required** | Natural language search query |
| `type` | string | `"auto"` | `auto`, `fast`, `instant`, `deep-lite`, `deep`, `deep-reasoning` |
| `results` | number | `10` | Number of results (1-100) |
| `chars` | number | `4000` | Max characters for `highlights` / `text` |
| `content` | string \| string[] | `"highlights"` | `highlights`, `text`, `summary`, or a combined array |
| `category` | string | - | `company`, `people`, `research paper`, `news`, `personal site`, `financial report` |
| `domains` | string[] | - | Only return results from these domains |
| `excludeDomains` | string[] | - | Exclude these domains |
| `startDate` / `endDate` | string | - | Published date range (ISO) |
| `fresh` | boolean | `false` | Shorthand for `maxAgeHours: 0` |
| `maxAgeHours` | number | - | Allow cached results newer than N hours |
| `additionalQueries` | string[] | - | Extra query variations for coverage |
| `schema` | object | - | JSON schema for structured output — works on every tier |
| `systemPrompt` | string | - | Shapes tone, sections, priorities |
| `contentQuery` | string | - | Custom query to focus highlights/summaries |
| `synthOnly` | boolean | `false` | CLI-only: suppress raw results when synthesis is present |

---

## Content Modes

| Mode | Tokens | Best for |
|:-----|:-------|:---------|
| `highlights` | Low | Facts, API docs, agent research |
| `summary` | Low | Quick overviews |
| `text` | High | Long page excerpts when you really need them |

---

## Notes

- `schema` and `systemPrompt` work on every search type, not just deep modes.
- `synthOnly` is a CLI formatter flag — it doesn't map to an Exa API field.
- `highlightScores` is deprecated in the API and intentionally not rendered.
- `tweet` is not a valid Exa category and is intentionally rejected.

---

## Agent Integration

A skill markdwon file is included at `skill/SKILL.md`.
Use where applicable; Claude Code, Cursor, Codex, OpenCode. 

```bash
mkdir -p ~/.config/oco/skills/exa-cli
cp skill/SKILL.md ~/.config/oco/skills/exa-cli/SKILL.md
```

---

## Build From Source

```bash
git clone https://github.com/AidenGeunGeun/exa-cli.git
cd exa-cli && npm install && npm run build
```

## License

MIT
