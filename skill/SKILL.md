---
name: exa-cli
description: Provides three-tier web research via the Exa Search API. Triggers for current web information, API docs, vendor comparisons, landscape scans, and structured extraction from search results. Should be preferred over webfetch for multi-result research, and its deep-reasoning synthesis tier often replaces a web-search subagent when the task needs synthesis but not claim-level conflict analysis.
---

# exa-cli

`exa-cli` is the default web research gateway for this stack. It is usually the right first step when a task needs current web information, and it now covers two distinct jobs: cheap lookup and fast synthesis.

## Start Here

Deep-reasoning is the fast, structured middle tier. Use it for synthesis without meta-analysis. Use a web-search subagent when you need claim-level citations, conflicts analysis, or iterative reasoning.

| Tier | Use this | Cost | Latency | Reach for it when | Do not use it when |
|:-----|:---------|:-----|:--------|:------------------|:-------------------|
| Quick lookup | `exa-cli` with `auto` (or `fast` / `instant`) | $0.007 | 1-2s | You need facts, API docs, recent references, or a small structured extract | You need a polished synthesis or source-conflict analysis |
| Synthesized research | `exa-cli` with `deep-reasoning` or `deep` | $0.015 / $0.012 | 28s / 25s | You want a comparison, landscape scan, buyer guide, or structured writeup | You need to know which sources disagree or where the evidence is weak |
| Iterative research | `web-search` subagent | ~$0.08 | 60-90s | You need claim-level citations, conflicts analysis, or follow-the-thread investigation | You only need a solid synthesis or structured extraction |

Quick rule:
- Need one answer fast: `auto`.
- Need a writeup fast: `deep-reasoning`.
- Need source-by-source analysis: `web-search` subagent.

## Cost And Latency Cheat Sheet

| Mode | Cost | Measured latency | What it is good at |
|:-----|:-----|:-----------------|:-------------------|
| `auto` / `fast` / `instant` | $0.007 | 1-2s | Cheap lookup, docs search, structured extraction on a budget |
| `deep-lite` | $0.012 | ~10s | A light middle option, but weak for synthesis |
| `deep` | $0.012 | ~25s | High-quality synthesis and markdown writeups |
| `deep-reasoning` | $0.015 | ~28s | Best default for synthesis and structured reports |
| `web-search` subagent | ~$0.08 | 60-90s | Iterative reasoning, conflicts, uncertainty tracking |

Pricing notes:
- First 10 results worth of contents are bundled, so do not cling to 5-result habits.
- Additional results beyond 10 add $0.001 per result.
- `summary` adds $0.001 per result.
- `deep-reasoning` is only $0.003 more than `deep`; default to it when the user wants synthesis.
- `deep-lite` tested poorly for synthesis. Treat it as optional completeness, not the recommended middle tier.

## Best Defaults

- Prefer `highlights` unless you truly need long excerpts.
- Prefer `maxAgeHours` over `fresh` when you want "recent enough" instead of forced recrawls.
- Use `additionalQueries` on `deep` and `deep-reasoning` when the topic has multiple phrasings.
- Use `outputSchema` and `systemPrompt` freely on every search type. They are not deep-only anymore.
- Set `synthOnly: true` when a synthesis response is the real deliverable. It suppresses the raw result dump.

## Useful Knobs

| Input | Why it matters |
|:------|:---------------|
| `content` | Can be a single mode or an array like `["highlights","text"]` when you want both snippets and long excerpts |
| `maxAgeHours` | Lets you say "use cache if newer than 24h, otherwise crawl" |
| `additionalQueries` | Gives Exa 2-3 alternate phrasings for better deep coverage |
| `schema` | Requests structured output on any tier |
| `systemPrompt` | Shapes tone, sections, and what to prioritize in the answer |
| `synthOnly` | CLI-only flag that drops the raw results list when synthesis is present |
| `contentQuery` | Tells highlights or summaries what to focus on inside each page |

## Worked Examples

### Tier 1 - Quick lookup

Use this for facts, docs, or cheap structured extraction.

**Factual lookup**

```bash
exa-cli '{"query":"current Node.js LTS version","domains":["nodejs.org"]}'
```

**Structured extraction on a cheap `auto` call**

```bash
exa-cli '{"query":"latest Node.js LTS release line and support dates","type":"auto","domains":["nodejs.org"],"schema":{"type":"object","required":["line","codename","support_end"],"properties":{"line":{"type":"string"},"codename":{"type":"string"},"support_end":{"type":"string"}}}}'
```

Use this pattern when the user wants a clean data object, not a prose report.

### Tier 2 - Synthesized research

Use this when the user wants a comparison, landscape summary, or polished writeup and does not need source-conflict analysis.

**Recommended synthesis pattern**

```bash
exa-cli '{
  "query":"latest technical approaches to reducing hallucinations in production LLM applications in 2025-2026, with specific techniques and evidence",
  "type":"deep-reasoning",
  "additionalQueries":[
    "production LLM hallucination mitigation techniques 2026",
    "grounding verification benchmark hallucination reduction 2025 2026"
  ],
  "systemPrompt":"Write for an engineering lead. Focus on named techniques, specific evidence, tradeoffs, and when each approach fits.",
  "schema":{
    "type":"text",
    "description":"Markdown report with sections: intro, techniques, benchmarks, tradeoffs, conclusion."
  },
  "synthOnly":true
}'
```

Why this works:
- `deep-reasoning` is the best default middle tier.
- `additionalQueries` improves coverage for broad research topics.
- `systemPrompt` shapes the answer.
- `outputSchema` turns the response into a clean deliverable.
- `synthOnly: true` avoids dumping 10 raw results after the synthesis.

**When to choose `deep` instead**

Use `deep` when you want a solid synthesis but do not need the extra tightness of `deep-reasoning`.

```bash
exa-cli '{"query":"compare hosted browser automation APIs for AI agents","type":"deep","systemPrompt":"Return a concise markdown comparison with strengths, weaknesses, and best fit.","schema":{"type":"text","description":"Markdown comparison"},"synthOnly":true}'
```

**Do not default to `deep-lite` for synthesis**

`deep-lite` is valid, but the live spike test showed that it often formats the top source instead of producing a true synthesis. If the user wants a writeup, pick `deep` or `deep-reasoning`.

### Tier 3 - Iterative research

Use a `web-search` subagent when the job is not just "summarize this topic" but "show me where the evidence agrees, disagrees, and gets shaky."

**Example escalation**

User asks: "Which sources disagree about the benchmark gains from speculative decoding, and which claims look weakest?"

Do not use `exa-cli` alone. Spawn a `web-search` subagent and ask for:
- primary-source citations for each major claim
- explicit conflicts between sources
- quoted evidence where possible
- uncertainties or weak spots in the public record

That is the line between middle-tier synthesis and full iterative research.

## Tool Choice Boundaries

- Prefer `exa-cli` over `webfetch` for multi-result web research.
- Use `webfetch` only when the URL is already known and you need that exact page.
- Use `deep-reasoning` before spawning `web-search` when the user wants a good report but not meta-analysis.
- Use local code tools, not `exa-cli`, for repo inspection.

## Gotchas

- `outputSchema` and `systemPrompt` work on all search types.
- `tweet` is not a valid category.
- `highlightScores` is deprecated and should not appear in output.
- `synthOnly` is a CLI formatter flag, not an Exa API field.
- `fresh: true` is just shorthand for `maxAgeHours: 0`.

## Environment

Requires `EXA_API_KEY`. Get one at https://dashboard.exa.ai/api-keys. If not set, the CLI exits with a clear error pointing to the dashboard.
