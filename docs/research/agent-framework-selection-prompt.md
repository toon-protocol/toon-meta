# Deep Research Prompt: Agent Framework Selection for NIP Handler Runtime

## Research Objective

Evaluate and recommend an agent framework for building the autonomous NIP Handler runtime — a TypeScript service that subscribes to Nostr relays, routes events by kind to LLM-powered handlers, and executes structured actions (replies, reactions, zaps, DVM results) back to relays. The selected framework must support **multiple LLM providers** (Anthropic, OpenAI, local/open models) and be **compatible with a skill/handler pattern** where domain logic is defined as modular, composable reference files.

## Background Context

### What exists today

The crosstown project is a TypeScript monorepo (`packages/core`, `packages/bls`, `packages/relay`, `packages/ui-prototypes`) that bridges Nostr and Interledger Protocol (ILP). The NIP Handler is currently implemented as a **Claude Code skill** (`.claude/skills/nip-handler/`) — a set of markdown reference files that guide an LLM through deterministic kind-based event dispatch:

```
TOON Input → Extract Kind → Registry Lookup → Load Handler Reference → Security Sandbox → LLM Decides Action → Structured JSON Output
```

Key existing components:
- **BusinessLogicServer** (`packages/bls/`) — TOON decoding, signature verification, Hono HTTP server
- **RelayMonitor** (`packages/core/`) — relay subscription patterns using nostr-tools
- **Event builders/parsers** (`packages/core/src/events/`) — construct and parse Nostr events
- **NIP Handler skill** — 3 handler files (kind:1 text notes, kind:1059 gift wraps, kind:5000-5999 DVM), action schema with Zod-style validation, 10-layer security defense, kind registry

### What needs to be built

An autonomous runtime that:
1. Subscribes to Nostr relays and receives events in real-time
2. Passes raw TOON event data + handler context to an LLM
3. Gets back structured JSON action decisions (reply, react, zap, repost, ignore, etc.)
4. Validates actions with Zod schemas and kind-specific allowlists
5. Executes actions — publishes events back to relays
6. Handles NIP-59 unwrap → re-dispatch loops
7. Manages NIP-90 DVM lifecycle (feedback → processing → result)
8. Rate-limits and audit-logs all actions

### Technology constraints
- **Language**: TypeScript (ESM, Node.js)
- **Existing deps**: nostr-tools, @toon-format/toon, hono, better-sqlite3, ws
- **Build**: tsup, monorepo with packages/
- **Handler pattern**: Deterministic kind-based dispatch (not LLM semantic routing). Handler references define processing instructions, decision frameworks, and action allowlists per event kind.

## Research Questions

### Primary Questions (Must Answer)

1. **Which agent frameworks support true multi-model flexibility?** Evaluate at minimum:
   - **Vercel AI SDK** (`ai` package) — `generateText`, `generateObject`, tool-use, streaming; provider registry pattern
   - **OpenAI Agents SDK** (formerly Swarm?) — multi-agent orchestration; how locked-in is it to OpenAI models?
   - **Anthropic Agent SDK / Claude Code SDK** — does Anthropic offer a standalone agent SDK separate from Claude Code? What's available?
   - **LangChain.js / LangGraph.js** — mature ecosystem, many model providers, structured output; but large dependency, complexity concerns
   - **Mastra** — TypeScript-first agent framework; model support, tool system, workflow engine
   - **ElizaOS** — plugin architecture with validate→handle flow; already studied in prior research; how suitable as a runtime vs. inspiration?
   - **OpenCode SDK** — open-source AI coding agent; does it expose a reusable agent SDK? Evaluate its model abstraction, tool system, and whether it can be repurposed as a general agent runtime
   - **Any other notable TypeScript agent frameworks** emerging in 2025-2026

   For each: What models are supported? How is the provider abstracted? Can you swap models without code changes? Can you use local models (Ollama, llama.cpp)?

2. **How does each framework handle structured output / tool use?** The NIP handler requires the LLM to return well-formed JSON matching a Zod schema (action type + fields). Evaluate:
   - Native structured output / JSON mode support
   - Tool-use / function-calling patterns
   - Zod schema integration (validation, type inference)
   - Error handling when LLM output doesn't match schema (retries, fallbacks)

3. **How composable is each framework's "skill" or "tool" system?** The NIP handler uses modular handler reference files loaded on-demand based on event kind. Evaluate:
   - Can the framework load/unload context dynamically (progressive disclosure)?
   - Does it support a plugin or skill pattern where capabilities are defined modularly?
   - How does it handle system prompts, reference material, and context management?
   - Can handler logic be defined externally (markdown files, configs) rather than hard-coded?

4. **What is the framework's approach to agent loops and event-driven processing?** The runtime needs to process a continuous stream of events, not just single request-response. Evaluate:
   - Support for event-driven / streaming architectures
   - Agent loop patterns (observe → decide → act)
   - State management between events (conversation memory, rate limit counters, etc.)
   - Ability to integrate with external event sources (WebSocket relay subscriptions)

5. **What is the integration burden?** How much of the existing codebase would need to change?
   - Can the framework wrap around existing nostr-tools relay subscriptions?
   - Does it play well with Hono (existing HTTP server)?
   - Dependency size and tree — will it bloat the project?
   - Learning curve and documentation quality

### Secondary Questions (Nice to Have)

6. **What are the testing and observability stories?** Can you mock the LLM for deterministic tests? Does it provide tracing, logging, or debugging tools?

7. **What is the community and maintenance trajectory?** GitHub stars, release cadence, corporate backing, contributor count as of early 2026.

8. **Does the framework support guardrails or safety layers?** The NIP handler has a 10-layer defense stack. Can the framework natively enforce output validation, content filtering, or action allowlists?

9. **Can the framework support multi-agent patterns?** Future consideration: multiple specialized agents (social agent, DVM agent, payment agent) coordinating. Which frameworks make this natural?

10. **How does each framework handle cost/token management?** The TOON budget research showed token optimization matters. Does the framework provide token counting, cost tracking, or context window management?

## Research Methodology

### Information Sources

- **Official documentation** for each framework (prefer 2025-2026 docs, noting any recent major version changes)
- **GitHub repositories** — stars, issues, recent commits, release notes
- **npm package analysis** — download trends, dependency graphs, bundle size
- **Example projects and tutorials** — especially TypeScript agent implementations with structured output
- **Community discussions** — Discord, GitHub Discussions, X/Twitter threads from framework authors
- **Benchmark comparisons** — if any exist for structured output reliability, latency, multi-model support

### Analysis Frameworks

- **Weighted decision matrix** with these criteria (suggested weights, adjust based on findings):
  - Multi-model support (25%) — breadth of providers, ease of swapping, local model support
  - Structured output / Zod integration (20%) — reliability of JSON output, schema validation
  - Skill/plugin composability (20%) — modular handler loading, progressive context disclosure
  - Event-driven architecture fit (15%) — streaming, agent loops, external event source integration
  - Integration burden (10%) — dependency weight, learning curve, compatibility with existing stack
  - Community & maintenance (10%) — longevity, support, ecosystem

- **Build-vs-compose sidebar** — Briefly note whether a lightweight approach (e.g., Vercel AI SDK's `generateObject` + custom event loop) could work, but focus the analysis on established frameworks. Only recommend "build minimal" if no framework adequately meets the requirements.

### Data Requirements

- Information should be current as of early 2026 — these frameworks evolve rapidly
- Distinguish between stable/released features vs. experimental/beta
- Note any breaking changes or major version transitions underway
- Prefer first-party documentation over blog posts for API details

## Expected Deliverables

### Executive Summary
- Recommended framework (or "build minimal" approach) with 2-3 sentence rationale
- Runner-up option and when you'd choose it instead
- Key risks or dealbreakers identified

### Detailed Analysis

For each framework evaluated:
1. **Overview** — What it is, who maintains it, maturity level
2. **Multi-model support** — Provider list, abstraction pattern, local model support
3. **Structured output** — How it handles JSON/Zod, tool-use patterns, error recovery
4. **Composability** — Plugin/skill system, context management, modularity
5. **Event-driven fit** — Agent loop, streaming, state management
6. **Integration assessment** — How it would integrate with crosstown's existing code
7. **Code sketch** — Pseudocode or short example showing how a NIP handler event would flow through the framework

### Comparison Matrix

| Criteria | Framework A | Framework B | ... |
|----------|------------|------------|-----|
| Multi-model | ... | ... | ... |
| Structured output | ... | ... | ... |
| ... | ... | ... | ... |

### Recommendation

- Primary recommendation with justification
- Architecture sketch showing how the recommended framework integrates with existing packages
- Migration path / incremental adoption strategy
- Risks and mitigation

## Success Criteria

The research is successful if:
1. At least 5 frameworks are evaluated with sufficient depth to make an informed decision
2. The multi-model and skills-compatibility requirements are specifically addressed for each option
3. A clear recommendation emerges (or a well-reasoned "build minimal" argument)
4. The recommendation includes enough architectural detail that an epic/story can be written from it
5. Any framework-specific risks or lock-in concerns are explicitly documented

## Scope Boundaries

- **In scope**: TypeScript agent frameworks, AI SDK libraries, and lightweight "build your own" approaches
- **Out of scope**: Python-only frameworks (CrewAI, AutoGen), hosted agent platforms (without self-hosted option), frameworks that only support a single model provider
- **Edge cases to consider**: Frameworks that are model-agnostic in theory but practically only work well with one provider
