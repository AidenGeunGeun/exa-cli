<div align="center">

# exa-cli

**Token-efficient web research for AI agents.**

[![npm version](https://img.shields.io/npm/v/%40opencode%2Fexa-cli?style=flat-square&labelColor=black)](https://www.npmjs.com/package/@opencode/exa-cli)
[![License](https://img.shields.io/badge/license-MIT-white?labelColor=black&style=flat-square)](LICENSE)

Powered by [Exa](https://exa.ai)

</div>

---

`exa-cli` is a single-file CLI around Exa's `/search` API. It replaces page-dump workflows with dense highlights, structured extraction, and synthesis modes that fit in an agent context window.

## Pick the Right Tier

Deep-reasoning is the fast middle tier. Use it for synthesis without meta-analysis. Use a web-search agent when you need claim-level citations, conflicts analysis, or follow-the-thread research.

| Need | Use | Cost | Latency | Best for |
|:-----|:----|:-----|:--------|:---------|
| Quick lookup | `auto` / `fast` / `instant` | $0.007 | 1-2s | Facts, API docs, single-step research |
| Synthesized research | `deep` / `deep-reasoning` | $0.012-$0.015 | 15-30s | Comparisons, landscape scans, structured writeups |
| Iterative research | web-search agent | ~$0.08 | 60-90s | Claim-level citations, source conflicts, open-ended investigation |

Notes:
- `deep-lite` exists, but it is weak for synthesis. Prefer `deep` or `deep-reasoning` when you want a real writeup.
- First 10 results worth of contents are bundled. `exa-cli` now defaults to 10 results.

## Install

```bash
npm install -g @opencode/exa-cli
```

Or run directly:

```bash
npx @opencode/exa-cli '{"query":"..."}'
```

Set your API key:

```bash
export EXA_API_KEY=your-key-here
```

Get one at https://dashboard.exa.ai/api-keys

## Usage

JSON input via CLI argument or stdin:

```bash
# Quick lookup with token-efficient highlights (default)
exa-cli '{"query":"Rust async runtime benchmarks 2026"}'

# Structured extraction on a cheap auto call
exa-cli '{"query":"latest Node.js LTS release line and support dates","domains":["nodejs.org"],"type":"auto","schema":{"type":"object","required":["line","codename","support_end"],"properties":{"line":{"type":"string"},"codename":{"type":"string"},"support_end":{"type":"string"}}}}'

# Combine content modes and set a freshness budget
exa-cli '{"query":"Bun package manager roadmap","content":["highlights","text"],"maxAgeHours":24}'

# Deep-reasoning synthesis with extra query variants and no raw result dump
exa-cli '{"query":"compare coding agents for greenfield Next.js apps","type":"deep-reasoning","additionalQueries":["agentic coding tool benchmark 2026","Next.js coding assistant comparison"],"systemPrompt":"Return a concise buyer guide with strengths, weaknesses, and best fit.","schema":{"type":"text","description":"Buyer guide markdown"},"synthOnly":true}'

# Pipe via stdin
printf '%s' '{"query":"latest Node.js LTS"}' | exa-cli
```

## JSON Input

| Field | Type | Default | Description |
|:------|:-----|:--------|:------------|
| `query` | string | **(required)** | Natural language search query |
| `type` | string | `"auto"` | `auto`, `fast`, `instant`, `deep-lite`, `deep`, `deep-reasoning` |
| `results` | number | `10` | Number of results (1-100) |
| `chars` | number | `4000` | Max characters for `highlights` and `text` |
| `content` | string or string[] | `"highlights"` | `highlights`, `text`, `summary`, or an array such as `["highlights","text"]` |
| `category` | string | - | `company`, `people`, `research paper`, `news`, `personal site`, `financial report` |
| `domains` | string[] | - | Only return results from these domains |
| `excludeDomains` | string[] | - | Exclude results from these domains |
| `startDate` | string | - | Published after (ISO date) |
| `endDate` | string | - | Published before (ISO date) |
| `fresh` | boolean | `false` | Alias for `maxAgeHours: 0` |
| `maxAgeHours` | number | - | Allow cached results newer than this many hours |
| `additionalQueries` | string[] | - | Extra query variations to improve search coverage |
| `schema` | object | - | JSON schema for structured output |
| `systemPrompt` | string | - | Instructions for search behavior |
| `contentQuery` | string | - | Custom query for highlight or summary selection |
| `synthOnly` | boolean | `false` | CLI-only: when synthesis is present, suppress the raw results list |

## Content Modes

| Mode | Tokens | Best for |
|:-----|:-------|:---------|
| `highlights` | Low | Facts, API docs, agent research |
| `summary` | Low | Quick overviews |
| `text` | High | Cases where you really need long page excerpts |

## Notes

- `outputSchema` and `systemPrompt` work on every search type, not just deep modes.
- `synthOnly` is a formatter flag in this CLI. It does not map to an Exa API field.
- `highlightScores` is deprecated in the API and intentionally not rendered.
- `tweet` is not a valid Exa category and is intentionally not accepted.

## Agent Integration

An OCO skill file is included at `skill/SKILL.md`.

```bash
mkdir -p ~/.config/opencode/skill/exa-cli
cp skill/SKILL.md ~/.config/opencode/skill/exa-cli/SKILL.md
```

## Build From Source

```bash
git clone https://github.com/AidenGeunGeun/agent-tools.git
cd agent-tools/packages/exa-cli
npm install
npm run build
```

## License

MIT
