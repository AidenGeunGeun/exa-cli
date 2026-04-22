---
name: exa-cli
description: Provides three-tier web research via the Exa Search API. Triggers for current web information, API docs, vendor comparisons, landscape scans, and structured extraction from search results. Should be preferred over webfetch for multi-result research. For frontier-model agents, prefer `auto` — synthesis tiers mostly produce output you'd reason through anyway.
---

# exa-cli

`exa-cli` is the default web research gateway for this stack. It is usually the right first step when a task needs current web information, and it now covers two distinct jobs: cheap lookup and fast synthesis.

## Start Here

**For frontier-model agents (Claude Opus/Sonnet, GPT-5, Gemini 2.5): default to `auto`.** You reason better than what Exa's synthesis tiers produce. The value of Exa is sourcing — 10 ranked raw results with highlights — not summarization. Live comparison on an identical query showed `auto` returned the same top sources as `deep` / `deep-reasoning` at 2.1x less cost and 10-15x less latency, with synthesis you'd mostly ignore anyway. Worse, weak synthesis can actively *mislead* a downstream reasoning step into formatting the top source instead of doing real analysis.

Use synthesis tiers (`deep`, `deep-reasoning`) only when the synthesis itself is the deliverable — a user-facing writeup, a comparison table for a human, or explicit structured extraction via `schema`. Use a `web-search` subagent when you need claim-level citations, conflicts analysis, or iterative reasoning.

| Tier | Use this | Cost | Latency | Reach for it when | Do not use it when |
|:-----|:---------|:-----|:--------|:------------------|:-------------------|
| Quick lookup (**default for agents**) | `exa-cli` with `auto` (or `fast` / `instant`) | $0.007 | 1-2s | You want sources and highlights, and you will reason through them yourself. Frontier-model default. | You need a polished human-facing writeup and the synthesis itself is the output |
| Synthesized research | `exa-cli` with `deep-reasoning` or `deep` | $0.015 / $0.012 | 28s / 25s | You want a comparison or landscape scan *as the output*, or you need `schema`-driven structured extraction | A frontier model will read and reason over the results anyway — `auto` gets you there faster |
| Iterative research | `web-search` subagent | ~$0.08 | 60-90s | You need claim-level citations, conflicts analysis, or follow-the-thread investigation | You only need a solid synthesis or structured extraction |

Quick rule:
- Frontier-model agent doing research: **`auto`**.
- Need a human-facing writeup fast and the synthesis *is* the deliverable: `deep-reasoning`.
- Need source-by-source conflict analysis: `web-search` subagent.

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
- `deep-reasoning` is only $0.003 more than `deep`; prefer it over `deep` *when synthesis is genuinely wanted*.
- `deep-lite` tested poorly for synthesis. Treat it as optional completeness, not a recommended tier.
- **For frontier-model agents specifically: `auto` is a better default than any synthesis tier.** You save $0.005-0.008 per call and ~25 seconds of latency, and the frontier model's own reasoning over raw highlights typically beats Exa's synthesis anyway.

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

Use this only when the synthesis itself is the deliverable — a user-facing markdown writeup, a comparison table to hand to a human, or `schema`-driven structured extraction. A frontier-model agent reasoning over the output will typically do better with `auto` + its own reasoning than with a synthesis tier.

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
