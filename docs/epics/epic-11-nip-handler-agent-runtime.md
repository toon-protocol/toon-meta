# Epic 11: NIP Handler Agent Runtime

**Phase:** Integration
**Estimated Stories:** 6
**Dependencies:** Epic 10 (embedded connector integration — provides `createAgentSocietyNode()`), existing NIP Handler skill (`.claude/skills/nip-handler/`)
**Blocks:** Epics 12–17 (NIP-based epics benefit from autonomous event processing)

---

## Epic Goal

Create `packages/agent/` — an autonomous TypeScript runtime that subscribes to Nostr relays, routes events by kind to LLM-powered handlers via the Vercel AI SDK (v6), and executes structured actions (replies, reactions, zaps, DVM results) back to relays. The end state: a continuously running agent process that receives Nostr events in real-time, makes LLM-informed decisions using kind-specific handler references, and acts on those decisions — all with multi-model support, Zod-validated outputs, and a 10-layer security defense stack.

## Epic Description

### Existing System Context

- **Current functionality:** The NIP Handler exists as a Claude Code skill (`.claude/skills/nip-handler/`) — markdown reference files that guide an LLM through deterministic kind-based event dispatch. This works interactively but cannot run autonomously.
- **Technology stack:** TypeScript ESM monorepo, nostr-tools, @toon-format/toon, hono, better-sqlite3, ws, tsup
- **Integration points:**
  - `BusinessLogicServer` (`packages/bls/`) — TOON decoding, signature verification
  - `RelayMonitor` (`packages/core/`) — relay subscription patterns
  - Event builders/parsers (`packages/core/src/events/`) — construct and parse Nostr events
  - NIP Handler skill — 3 handler files (kind:1, kind:1059, kind:5000-5999), action schema, security patterns, kind registry
  - `createAgentSocietyNode()` from Epic 10 — full embedded ILP+Nostr stack

### Framework Selection

Based on the [Agent Framework Selection Report](../research/agent-framework-selection-report.md), the selected framework is **Vercel AI SDK (v6)** (`ai` npm package, v6.x). Key selection rationale:

- **Multi-model support:** 25+ providers via `@ai-sdk/*` packages, provider registry pattern for runtime model switching
- **Structured output:** Native Zod integration via `Output.object({ schema })` — maps directly to the existing action schema
- **Stateless per-call:** Does not impose its own event loop — the Nostr relay subscription owns the event source
- **Lightweight:** ~6.2 MB, 4 direct dependencies, Apache-2.0 license
- **Testing:** `MockLanguageModelV3` for deterministic unit tests without LLM calls

Runner-up Mastra (built on Vercel AI SDK) can be adopted later if workflow orchestration or built-in guardrails are needed.

### Target Architecture

```
packages/agent/ (new)
├── src/
│   ├── index.ts                    # Public API: createNipHandlerAgent()
│   ├── kind-registry.ts            # Kind → handler file path mapping
│   ├── handler-loader.ts           # Reads markdown handlers → system prompts
│   ├── schemas/
│   │   ├── actions.ts              # Zod schemas for all action types (from action-schema.md)
│   │   └── allowlists.ts           # Per-kind action allowlists
│   ├── handler.ts                  # handleNostrEvent(): core LLM decision function
│   ├── executor.ts                 # ActionExecutor: action JSON → relay publish
│   ├── security.ts                 # Content isolation, datamarkers, defense stack
│   ├── providers.ts                # Provider registry setup (Anthropic, OpenAI, Ollama)
│   ├── rate-limiter.ts             # Per-pubkey, per-kind rate limiting
│   ├── audit-log.ts                # SQLite audit logging for all actions
│   └── event-loop.ts              # Relay subscription → handler → executor loop
├── handlers/                       # Migrated handler reference files (markdown)
│   ├── kind-1-text-note.md
│   ├── kind-1059-gift-wrap.md
│   └── kind-5xxx-dvm-request.md
├── package.json                    # deps: ai, @ai-sdk/anthropic, zod, nostr-tools
├── tsconfig.json
└── tsup.config.ts
```

### Integration with Existing Packages

```
┌─────────────────────────────────────────────────────────────────┐
│                    packages/agent/ (new)                         │
│                                                                 │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐     │
│  │ Kind        │   │ Handler      │   │ Action           │     │
│  │ Registry    │──▶│ Loader       │──▶│ Executor         │     │
│  │ (kind→file) │   │ (md→prompt)  │   │ (action→relay)   │     │
│  └─────────────┘   └──────────────┘   └──────────────────┘     │
│         │                  │                    │               │
│         │          ┌───────▼────────┐           │               │
│         │          │ Vercel AI SDK  │           │               │
│         │          │ generateText() │           │               │
│         │          │ Output.object()│           │               │
│         │          │ Provider Reg.  │           │               │
│         │          └───────┬────────┘           │               │
│         │                  │                    │               │
│  ┌──────▼──────────────────▼────────────────────▼──────┐       │
│  │              Event Processing Loop                   │       │
│  │  pool.subscribeMany → decode → route → decide → act │       │
│  └──────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────┐    ┌──────────────┐    ┌──────────────────┐
│ packages/   │    │ packages/    │    │ packages/        │
│ core/       │    │ bls/         │    │ relay/           │
│             │    │              │    │                  │
│ - Events    │    │ - TOON codec │    │ - Relay pool     │
│ - Constants │    │ - Sig verify │    │ - Subscriptions  │
│ - Trust     │    │ - Hono HTTP  │    │ - Publishing     │
│ - Discovery │    │ - SQLite     │    │                  │
└─────────────┘    └──────────────┘    └──────────────────┘
```

### What's Being Built

1. **Package scaffolding** — new `packages/agent/` with package.json (`ai`, `@ai-sdk/anthropic`, `zod`, `nostr-tools`), tsconfig, tsup config
2. **Kind Registry + Handler Loader** — deterministic kind→handler mapping from kind-registry.md, reads markdown handler files as system prompts
3. **Zod Action Schemas** — port existing action-schema.md to runtime Zod schemas with discriminated unions and per-kind allowlists
4. **Core handler function** — `handleNostrEvent()` using `generateText()` + `Output.object()` with kind-specific system prompts and Zod validation
5. **Action Executor** — takes validated action JSON and publishes appropriate Nostr events using existing event builders from `packages/core/src/events/`
6. **Event processing loop** — subscribes to Nostr relays via nostr-tools `SimplePool`, routes events through handler, executes actions
7. **Security defense stack** — content isolation with datamarkers, allowlist enforcement, rate limiting, audit logging
8. **Multi-model provider registry** — `createProviderRegistry()` with Anthropic, OpenAI, Ollama; model selection per kind
9. **Integration tests** — using Vercel AI SDK `MockLanguageModelV3` for deterministic testing without LLM calls

### What's NOT Changing

- `packages/core/` — events, constants, trust scoring, peer discovery unchanged
- `packages/bls/` — TOON codec, signature verification, Hono HTTP unchanged
- `packages/relay/` — relay pool, subscriptions, publishing unchanged
- NIP Handler skill files — remain as Claude Code skill; `packages/agent/` migrates the patterns to runtime code
- Nostr event kinds, SPSP protocol, ILP peer info format

### Key Technical Decisions

1. **Vercel AI SDK (v6) as the LLM layer** — selected via weighted framework evaluation (scored 4.75/5.0) over OpenAI Agents SDK, Anthropic Agent SDK, LangChain.js, Mastra, and ElizaOS. See [selection report](../research/agent-framework-selection-report.md).

2. **Deterministic dispatch, not LLM routing** — event kind number determines the handler, not LLM semantic classification. The LLM decides *what action to take within a handler*, not *which handler to use*.

3. **Handler references as system prompts** — the existing markdown handler files become system prompts loaded at runtime. This preserves the progressive disclosure pattern (only the relevant handler is loaded per event).

4. **Zod discriminated unions for action schemas** — `z.discriminatedUnion('action', [...])` with per-kind allowlist subsets. Validation failures return `NoObjectGeneratedError` with retry or escalation.

5. **Application-owned event loop** — Nostr relay subscription via nostr-tools `SimplePool` is application code, not framework-managed. Each event invokes `generateText()` independently (stateless per-call).

## Acceptance Criteria

- [ ] `packages/agent/` builds and passes type checks (`npx tsc --noEmit`)
- [ ] Kind registry maps all existing kinds (1, 1059, 5000-5999) to handler files
- [ ] Handler loader reads markdown files and returns valid system prompt strings
- [ ] Zod action schemas validate all action types defined in action-schema.md
- [ ] Per-kind allowlists reject actions not in the kind's allowed set
- [ ] `handleNostrEvent()` returns Zod-validated structured output for kind:1 events
- [ ] `handleNostrEvent()` returns Zod-validated structured output for kind:1059 events
- [ ] `handleNostrEvent()` returns Zod-validated structured output for kind:5000-5999 events
- [ ] Action executor publishes reply events to relays using existing event builders
- [ ] Event processing loop subscribes to relays and processes incoming events end-to-end
- [ ] Content isolation wraps untrusted event content with datamarkers before LLM processing
- [ ] Rate limiter enforces per-pubkey, per-kind limits
- [ ] Audit log records all actions to SQLite
- [ ] Provider registry supports at least Anthropic and one alternative (OpenAI or Ollama)
- [ ] Integration tests pass using `MockLanguageModelV3` (no live LLM calls)
- [ ] Unhandled kinds return `{ action: "ignore", reason: "No handler for kind {N}" }`

## Stories

| # | Story | Description | Size |
|---|-------|-------------|------|
| 11.1 | Create agent package scaffolding and provider registry | New `packages/agent/` with package.json (ai, @ai-sdk/anthropic, zod, nostr-tools), tsconfig, tsup. Implement `createProviderRegistry()` with Anthropic + OpenAI + Ollama. Verify build and type checks pass. | S |
| 11.2 | Implement Kind Registry, Handler Loader, and Zod action schemas | Port kind-registry.md to `KindRegistry` class (kind→handler file path). Implement `HandlerLoader` that reads markdown handlers as system prompts. Port action-schema.md to Zod discriminated union schemas with per-kind allowlist subsets. Unit tests for registry lookup, handler loading, and schema validation. | L |
| 11.3 | Implement core handler function with structured output | Implement `handleNostrEvent()` using Vercel AI SDK `generateText()` + `Output.object()`. Accepts a Nostr event, loads kind-specific handler reference as system prompt, calls LLM with Zod-validated output. Handle `NoObjectGeneratedError` with retry and escalation fallback. Integration tests using `MockLanguageModelV3`. | L |
| 11.4 | Implement security defense stack and content isolation | Port security.md patterns to runtime code: content isolation with `<untrusted-content>` tags and `^` datamarkers, allowlist enforcement (reject actions not in kind's allowed set), input sanitization. Implement rate limiter (per-pubkey, per-kind, configurable thresholds in SQLite). Implement audit logger (all actions recorded to SQLite with event ID, kind, pubkey, action, timestamp, token usage). | L |
| 11.5 | Implement Action Executor | Takes validated action JSON and executes it: publish reply events (kind:1), publish reactions (kind:7), publish reposts (kind:6), publish DVM results (kind:6000-6999), publish DVM feedback (kind:7000). Uses existing event builders from `packages/core/src/events/`. Handles NIP-59 unwrap → re-dispatch loop. Signs and publishes events to relay pool. | L |
| 11.6 | Implement event processing loop and end-to-end integration | Wire everything together: subscribe to Nostr relays via nostr-tools `SimplePool`, route incoming events through `handleNostrEvent()`, execute actions via `ActionExecutor`. Implement `createNipHandlerAgent(config)` as the public API with start/stop lifecycle. Add configurable model selection per kind (cheaper models for simple events, stronger for DVM/trust). OpenTelemetry tracing via `experimental_telemetry`. End-to-end integration tests. | L |

---

## Risks and Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Vercel AI SDK v7 breaking changes | Medium | Medium | Pin to v6.x. Provider registry pattern is stable. Migration guides historically thorough. |
| Structured output unreliability with weaker models | Medium | High | Use `Output.object()` with provider-native JSON mode. Kind-specific retry with escalation fallback. Test with each target model. |
| Handler reference files too large for context window | Low | Medium | Monitor token usage per kind. Implement handler compression for large references. Use `js-tiktoken` for pre-flight checks. |
| Rate limiting on LLM APIs during event bursts | Medium | Medium | Queue with backpressure. Local models (Ollama) for low-stakes decisions. Cache deterministic responses. |
| Vercel corporate priorities shift from SDK | Low | High | Apache-2.0 license enables fork. Provider protocol is thin interface. Migration to raw SDKs straightforward. |

## References

- [Agent Framework Selection Report](../research/agent-framework-selection-report.md)
- [NIP Handler Skill](../../.claude/skills/nip-handler/SKILL.md)
- [Action Schema Reference](../../.claude/skills/nip-handler/references/action-schema.md)
- [Kind Registry](../../.claude/skills/nip-handler/references/kind-registry.md)
- [Security Patterns](../../.claude/skills/nip-handler/references/security.md)
- [Vercel AI SDK Documentation](https://ai-sdk.dev/docs/introduction)
