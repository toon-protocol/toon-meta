# ElizaOS Deep Dive: Agent Framework Evaluation

**Date**: February 2026
**Context**: Evaluation for use in agent-society TypeScript Nostr event processing runtime
**Repository**: [elizaOS/eliza](https://github.com/elizaOS/eliza)

---

## 1. Overview

**What it is**: ElizaOS is an open-source, TypeScript-based framework for building autonomous AI agents. It brands itself as "The Open-Source Framework for Multi-Agent AI Development" and originated in the Web3/crypto ecosystem, particularly around the ai16z (now elizaOS) community.

**Maintainers**: Originally developed under `ai16z`, the organization rebranded to `elizaOS` in late 2025. The project is maintained by Eliza Labs with significant community contribution.

**Current version**: `@elizaos/core` v1.7.2 (published January 19, 2026). The latest GitHub release is v1.7.2 with 293 total releases.

**Maturity signals**:
- **GitHub stars**: ~17,500
- **Forks**: ~5,400
- **Contributors**: 583
- **npm weekly downloads** (`@elizaos/core`): ~20,600 (week of Feb 9-15, 2026)
- **License**: MIT

**Major version timeline**:
- **v0.x**: Original Eliza framework (2024-early 2025). Monolithic, character-file-driven.
- **v1.x**: Major refactor. Introduced Entity/Room/World model (replacing User/Participant), Service pattern, event system in plugins, enhanced plugin architecture. Current stable line.
- **v2 Beta**: Announced March 2025. Introduced Hierarchical Task Networks (HTN), enhanced event-driven architecture, unified wallet system, Chainlink CCIP cross-chain integration. Still in beta as of early 2026 — not yet merged to main. The v2 beta is heavily Web3-focused.

**Release cadence**: Very active — 293 releases total, with frequent alpha/patch releases. The pace is high but includes many pre-release tags, suggesting rapid iteration with some instability risk.

**Token/crypto context**: ElizaOS has a companion $elizaOS token (migrated from $ai16z in Nov 2025). This crypto-ecosystem coupling is notable — the project's development priorities are influenced by Web3/DeFi use cases, not pure agent infrastructure.

---

## 2. Multi-Model Support

ElizaOS supports all major LLM providers through a plugin-based model registration system:

**Supported providers**:

| Provider | Text Gen | Embeddings | Structured Output | Offline |
|----------|----------|------------|-------------------|---------|
| OpenAI | Yes | Yes | Yes | No |
| Anthropic | Yes | No | Yes | No |
| Google GenAI | Yes | Yes | Yes | No |
| Ollama | Yes | Yes | Yes | Yes |
| OpenRouter | Yes | Yes | Yes | No |
| Grok | Yes | ? | ? | No |
| Llama (local) | Yes | Yes | Yes | Yes |
| DeepSeek | Yes | ? | ? | No |

**Abstraction pattern**: The old `ModelProviderName` enum (e.g., `ModelProviderName.ANTHROPIC`) is **deprecated** in v1.x. The new pattern uses plugin-based model registration with priority levels:

```typescript
// Plugin registers a model capability with a priority
runtime.registerModel(ModelType.TEXT_LARGE, generateText, 'anthropic', 100);
```

Model selection follows a priority chain:
1. Match requested `ModelType` (e.g., `TEXT_LARGE`, `TEXT_SMALL`, `OBJECT_LARGE`)
2. Evaluate registered providers by priority weight
3. Fall back to lower-priority providers

**Swapping models**: Yes — swapping is done via environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.) and plugin loading order. No code changes required for basic swaps. Plugin loading order determines fallback priority (e.g., Anthropic first for text, Ollama as offline fallback).

**Local model support**: Ollama integration is first-class. Other local runtimes (llama.cpp) can work through Ollama or OpenAI-compatible API endpoints.

**Model types**:
- `TEXT_SMALL` / `TEXT_LARGE` — conversational generation
- `TEXT_EMBEDDING` — vector embeddings
- `OBJECT_SMALL` / `OBJECT_LARGE` — structured/JSON output

**Assessment**: Model abstraction is solid and flexible. The plugin-based registration with priority fallback is a well-designed pattern. The deprecation of the `ModelProviderName` enum in favor of dynamic registration shows the architecture is maturing.

---

## 3. Structured Output

ElizaOS has a dedicated model type for structured output: `OBJECT_GENERATION` (with `OBJECT_SMALL` and `OBJECT_LARGE` variants). This delegates to each provider's native structured output capability.

**What is available**:
- `runtime.useModel(ModelType.OBJECT_LARGE, { prompt, schema })` — generate structured objects
- Providers like OpenAI, Anthropic, Google GenAI, and Ollama all support structured output mode
- The `ActionResult` interface provides a standardized return type with `success`, `text`, `values`, `data`, and `error` fields

**Zod integration**: ElizaOS itself uses Zod extensively (dependency: `zod@^4.3.5`). Character files are validated with Zod schemas. Action results follow typed interfaces. However, there is no documented first-class `generateObject(schema: z.ZodType)` pattern like Vercel AI SDK provides.

**Tool-use / function calling**: Actions serve as the tool-use equivalent. The LLM selects which action to invoke based on the action's name, description, and similes. This is more of a "routing + execution" pattern than true function-calling tool-use.

**Validation patterns**:
- Actions have a `validate` function that runs before the handler
- Evaluators can post-process and validate responses
- `ActionResult` has a standardized shape for success/failure

**Error handling**: The documentation shows retry patterns with exponential backoff in action handlers, but this is implemented manually per-action rather than as a framework-level feature.

**Assessment**: Structured output support exists but is less refined than Vercel AI SDK's `generateObject` with Zod schema types. You would need to build your own schema validation layer on top of the `OBJECT_GENERATION` model type. The `ActionResult` pattern is useful but is more about action output standardization than LLM output parsing.

---

## 4. Composability (Plugin Architecture)

This is ElizaOS's strongest feature. The plugin system is comprehensive and well-designed.

### Plugin Interface

```typescript
export const myPlugin: Plugin = {
  name: 'plugin-name',
  description: 'Plugin description',
  actions: [],        // Executable tasks
  providers: [],      // Data/context suppliers
  evaluators: [],     // Response assessors
  services: [],       // Background services
  init: async (config) => {},
  models: {},         // Model registrations
  routes: [],         // HTTP endpoints
  events: {},         // Event handlers
  tests: [],          // Built-in tests
  dependencies: [],   // Required plugins
};
```

### Action validate -> handle Flow

This is the core pattern that maps well to event-kind-based dispatch:

```typescript
const myAction: Action = {
  name: 'PROCESS_EVENT',
  similes: ['HANDLE_EVENT'],
  description: 'Process a Nostr event',

  // Pre-execution validation gate
  validate: async (runtime, message, state) => {
    // Return true/false to determine if this action applies
    return message.content.kind === 1;
  },

  // Execution logic
  handler: async (runtime, message, state, options, callback) => {
    await callback?.({ text: 'Processing...' });
    // ... do work ...
    return {
      success: true,
      text: 'Event processed',
      data: { eventId: '...' }
    };
  },

  examples: [/* conversation examples for LLM context */]
};
```

### Providers (Context Injection)

Providers inject dynamic context into the agent's decision-making:

```typescript
const nostrContextProvider: Provider = {
  name: 'NOSTR_CONTEXT',
  get: async (runtime, message, state) => {
    const relayData = await fetchRelayStatus();
    return {
      text: `Connected to ${relayData.count} relays`,
      values: { relayCount: relayData.count },
      data: relayData
    };
  }
};
```

### Evaluators (Post-Processing / Guardrails)

```typescript
const responseEvaluator: Evaluator = {
  name: 'RESPONSE_VALIDATOR',
  alwaysRun: true,  // Run on every response
  validate: async (runtime, message) => true,
  handler: async (runtime, message, state) => {
    // Assess and potentially modify the response
  }
};
```

### Plugin Registration Lifecycle

1. Validation (name, duplicate check)
2. Database adapter registration
3. Sequential: actions -> evaluators -> providers -> models -> routes -> events
4. Service start (deferred if runtime not ready)

### Event System

Plugins can register event handlers for lifecycle events:

```typescript
events: {
  [EventType.MESSAGE_RECEIVED]: [messageReceivedHandler],
  [EventType.POST_GENERATED]: [postGeneratedHandler],
  [EventType.RUN_COMPLETED]: [runCompletedHandler],
}
```

### Action Chaining

Actions can access results from previous actions via `ActionContext`:

```typescript
const context = options?.context as ActionContext;
const previousResult = context?.getPreviousResult?.('PREVIOUS_ACTION');
```

**Assessment**: The plugin architecture is genuinely well-designed and maps closely to the NIP handler's kind-based dispatch pattern. The validate->handle flow is essentially the same pattern as "check event kind -> process event." The Provider pattern maps to context injection (relay state, trust scores, social graph data). Evaluators can serve as output validators. This is the aspect of ElizaOS most worth borrowing.

---

## 5. Event-Driven Architecture Fit

### Message Processing Pipeline

ElizaOS processes messages through this flow:

```
Incoming message -> Intent recognition -> Action selection
  -> Provider context injection -> Execution -> Evaluator assessment
  -> Response generation
```

### Runtime Loop

The `AgentRuntime` manages:
- Message queuing and processing
- State composition (`composeState`)
- Memory retrieval (vector-based)
- Action execution (`processActions`)
- Response evaluation (`evaluate`)

### Client Adapters / Services

ElizaOS connects to external platforms via Service plugins:
- Discord, Telegram, Twitter/X, Farcaster — each as a Service plugin
- The server uses **Socket.IO** for real-time client-server communication
- REST API with three delivery modes: WebSocket, SSE streaming, synchronous

### WebSocket / Event Source Integration

ElizaOS's native messaging is Socket.IO-based, not raw WebSocket. It uses a Room/Channel model where:
1. Client connects via Socket.IO
2. Client joins a Room
3. Messages are sent to the Room
4. Server processes and broadcasts responses

**For Nostr relay integration**: There is no native Nostr adapter. You would need to build a Service plugin that:
1. Subscribes to Nostr relays via `nostr-tools`
2. Converts Nostr events into ElizaOS `Memory` / message objects
3. Feeds them into the runtime for processing
4. Publishes action results back to relays

### Organization Model

- **Worlds** = separate projects/contexts (could map to relay groups)
- **Rooms** = channels/DMs within a world (could map to event threads)
- **Entities** = participants (agents, users)

**Assessment**: The event-driven architecture is designed for chat-platform interactions (Discord, Telegram), not for raw event stream processing. Adapting it to Nostr relay subscriptions is possible but requires writing a custom Service plugin that bridges nostr-tools subscriptions into the ElizaOS message pipeline. The overhead of the World/Room/Entity model may be unnecessary for event-kind-based dispatch. The runtime loop assumes conversational context (recent messages, memory retrieval) which adds latency and complexity that a Nostr event processor may not need.

---

## 6. Integration Assessment

### Dependency Weight

`@elizaos/core` v1.7.2 has 12 direct dependencies:

```
@langchain/core: ^1.0.0
@langchain/textsplitters: ^1.0.0
adze: ^2.2.5
crypto-browserify: ^3.12.0
dotenv: ^17.2.3
fast-redact: ^3.5.0
glob: ^13.0.0
handlebars: ^4.7.8
pdfjs-dist: ^5.2.133
unique-names-generator: ^4.7.1
uuid: ^13.0.0
zod: ^4.3.5
```

**Notable concerns**:
- `@langchain/core` and `@langchain/textsplitters` — pulls in LangChain as a transitive dependency, which is a significant dependency tree
- `pdfjs-dist` — PDF processing library, heavy for a core package
- `handlebars` — template engine used for prompt templates
- `crypto-browserify` — browser compatibility polyfill

The `@elizaos/plugin-node` package adds 54 more dependencies including Playwright, Puppeteer, Sharp, and AWS SDK. This is clearly a "kitchen sink" approach.

### Library vs. Full Runtime

**Can you use `@elizaos/core` as a library?** Partially. The core exports `AgentRuntime`, plugin interfaces, and utility functions. However:

- The runtime assumes a database adapter (PostgreSQL or PGLite)
- It expects Socket.IO for messaging
- The server package (`@elizaos/server`) is Express.js-based
- The build system uses Turbo + Bun (not compatible with npm/yarn monorepos without adaptation)
- Node.js v23+ is required

**ESM compatibility**: The project is ESM-first. Documented issues exist around ESM configuration (GitHub issue #2598). The `tsup` build outputs ESM format with `@elizaos/core` externalized.

**Monorepo integration**: ElizaOS itself is a monorepo using Turbo + Bun. Integrating `@elizaos/core` into an existing monorepo using npm workspaces and tsup would require careful dependency management, particularly around the LangChain transitive dependencies.

**Assessment**: Using ElizaOS as a library in the agent-society monorepo would be a **heavy integration**. The core package pulls in LangChain, PDF processing, and template engines. The runtime expects a specific infrastructure (database, Socket.IO). The Bun requirement conflicts with the existing npm-based monorepo. This is not a lightweight SDK — it is a full platform designed to be used as the primary application framework.

---

## 7. Testing & Observability

### Testing

ElizaOS provides testing utilities in its plugin development scaffold:

- **Mock runtime**: `test-utils.ts` creates mock implementations of `IAgentRuntime`, messages, and state
- **Action testing**: Validate request handling, success/error flows, example structure correctness
- **Provider testing**: Verify data retrieval and error handling
- **Service testing**: Initialization, config validation, resource cleanup
- **E2E tests**: Integration testing with live runtime instances
- **Test runner**: `bun test` with coverage and watch mode

**LLM mocking**: The mock runtime can stub `useModel` calls, allowing deterministic testing without actual LLM calls. This is adequate for unit testing but not as refined as dedicated LLM mocking libraries.

### Observability

- **Logging**: Uses `adze` logging library (included in core dependencies). Log levels and structured logging are available.
- **Fast-redact**: The `fast-redact` dependency suggests built-in PII/secret redaction in logs.
- **Tracing**: No built-in OpenTelemetry or distributed tracing support. No native Langfuse, LangSmith, or similar LLM observability integration.
- **Event system**: The `EventType.RUN_COMPLETED` and similar lifecycle events can be used for custom observability hooks.

**Assessment**: Testing utilities are adequate for plugin development. LLM mocking is possible through the runtime abstraction. However, there is no first-class observability/tracing story — you would need to integrate third-party tools (Langfuse, etc.) manually.

---

## 8. Guardrails / Safety

### Built-in Mechanisms

- **Action `validate` function**: Pre-execution gate that can check permissions, rate limits, trust scores, etc.
- **Evaluators with `alwaysRun`**: Post-response assessment that runs on every response — can serve as output validators
- **ActionResult validation**: Standardized success/failure return types
- **Character configuration**: Agents have defined personality, allowed behaviors, and knowledge boundaries

### What's Missing

- No built-in content filtering (toxicity, PII detection)
- No output schema enforcement at the framework level (you implement this in action handlers)
- No action allowlist/blocklist system (you build this in `validate` functions)
- No rate limiting framework (you implement this in providers or validators)
- The 10-layer security defense stack from the NIP handler skill would need to be entirely custom-built

**Assessment**: The `validate` + Evaluator pattern provides hooks for implementing guardrails, but the guardrails themselves must be custom-built. ElizaOS provides the architectural skeleton but not the safety logic. For a Nostr event processor with financial implications (ILP payments, zaps), you would need to build all safety layers yourself.

---

## 9. Multi-Agent Patterns

ElizaOS has explicit multi-agent support:

- **Agent Swarms**: v2 Beta introduced swarm deployment with self-consistency (majority voting) across multiple agents
- **World/Room model**: Agents can share Worlds and Rooms, enabling inter-agent communication
- **Entity system**: All participants (human users, AI agents) are modeled as Entities with consistent interfaces
- **Service-level coordination**: Agents can signal each other through shared Rooms, enabling delegation, consensus, and load-balancing
- **TEE deployment**: Agent swarms can run in Trusted Execution Environments (Phala Cloud integration)

**Practical patterns**:
- Multiple homogeneous agents with voting consensus
- Heterogeneous agents with different capabilities sharing a World
- Agent-to-agent messaging through Rooms

**Assessment**: Multi-agent support is a genuine strength, particularly for future scenarios where specialized agents (social agent, DVM agent, payment agent) need to coordinate. However, this requires buying into the full ElizaOS runtime — you cannot extract just the multi-agent patterns without the World/Room/Entity infrastructure.

---

## 10. Cost / Token Management

**Built-in**: No dedicated token counting, cost tracking, or context window management features were found in the documentation or package analysis.

**What's available**:
- Model type selection (`TEXT_SMALL` vs `TEXT_LARGE`) provides coarse cost control
- Provider priority system allows routing to cheaper models first
- Memory retrieval limits can control context size

**What's missing**:
- No per-request token counting
- No cost accumulation / budget tracking
- No context window overflow management
- No token-aware prompt truncation

**Assessment**: Token/cost management would need to be built on top of ElizaOS, likely using the Provider pattern to inject cost-aware context and the Evaluator pattern to track usage. This is a significant gap for a production Nostr event processor that might handle high event volumes.

---

## 11. Code Sketch: Nostr Event Handler with ElizaOS

### Option A: Full ElizaOS Integration

```typescript
import { Plugin, Action, Provider, Service, EventType } from '@elizaos/core';
import { SimplePool, type Event as NostrEvent } from 'nostr-tools';

// --- Service: Nostr Relay Subscription ---
class NostrRelayService extends Service {
  static serviceType = 'NOSTR_RELAY';
  private pool: SimplePool;

  async start(runtime: IAgentRuntime) {
    this.pool = new SimplePool();
    const relays = runtime.getSetting('NOSTR_RELAYS').split(',');
    const pubkey = runtime.getSetting('NOSTR_PUBKEY');

    // Subscribe to events mentioning our agent
    const sub = this.pool.subscribeMany(relays, [
      { kinds: [1, 1059, 5000, 5001], '#p': [pubkey] }
    ], {
      onevent: async (event: NostrEvent) => {
        // Convert Nostr event to ElizaOS message and inject into runtime
        const memory = nostrEventToMemory(event);
        await runtime.processMessage(memory);
      }
    });
  }

  async stop() {
    this.pool?.close();
  }
}

// --- Action: Handle Kind 1 (Text Note) ---
const handleTextNote: Action = {
  name: 'HANDLE_TEXT_NOTE',
  similes: ['RESPOND_TO_NOTE', 'REPLY_TO_MENTION'],
  description: 'Process a kind:1 text note mentioning the agent',

  validate: async (runtime, message, state) => {
    // Only handle kind:1 events
    return message.content.nostrEvent?.kind === 1;
  },

  handler: async (runtime, message, state, options, callback) => {
    const event = message.content.nostrEvent;

    // Use LLM to decide action
    const decision = await runtime.useModel(ModelType.OBJECT_SMALL, {
      prompt: `You are a Nostr agent. Analyze this event and decide how to respond.

Event content: ${event.content}
Author: ${event.pubkey}
Trust score: ${state.values?.trustScore ?? 'unknown'}

Respond with JSON: { "action": "reply" | "react" | "ignore", "content": "..." }`,
      runtime
    });

    // Validate decision against allowlist
    if (!['reply', 'react', 'ignore'].includes(decision.action)) {
      return { success: false, text: 'Invalid action type', error: 'Action not in allowlist' };
    }

    if (decision.action === 'reply') {
      await publishNostrReply(event, decision.content);
    }

    return {
      success: true,
      text: `Handled kind:1 event with action: ${decision.action}`,
      data: { action: decision.action, eventId: event.id }
    };
  }
};

// --- Provider: Trust/Social Context ---
const trustContextProvider: Provider = {
  name: 'TRUST_CONTEXT',
  get: async (runtime, message, state) => {
    const pubkey = message.content.nostrEvent?.pubkey;
    if (!pubkey) return { text: '', values: {}, data: {} };

    const trustScore = await computeTrustScore(pubkey, runtime);
    const socialDistance = await computeSocialDistance(pubkey, runtime);

    return {
      text: `Author trust score: ${trustScore}, social distance: ${socialDistance} hops`,
      values: { trustScore, socialDistance },
      data: { trustScore, socialDistance, pubkey }
    };
  }
};

// --- Evaluator: Rate Limit Check ---
const rateLimitEvaluator: Evaluator = {
  name: 'RATE_LIMIT',
  alwaysRun: true,
  validate: async () => true,
  handler: async (runtime, message, state) => {
    const pubkey = message.content.nostrEvent?.pubkey;
    const count = await getRecentActionCount(pubkey, runtime);
    if (count > 10) {
      // Could modify state or flag for throttling
      state.values.rateLimited = true;
    }
  }
};

// --- Plugin Assembly ---
export const nostrAgentPlugin: Plugin = {
  name: 'nostr-agent',
  description: 'Nostr event processing for agent-society',
  actions: [handleTextNote, handleGiftWrap, handleDVM],
  providers: [trustContextProvider],
  evaluators: [rateLimitEvaluator],
  services: [NostrRelayService],
  events: {
    [EventType.MESSAGE_RECEIVED]: [logEventHandler],
    [EventType.RUN_COMPLETED]: [auditLogHandler],
  },
};
```

### Option B: ElizaOS-Inspired Pattern (Without the Dependency)

This extracts the key architectural patterns without requiring ElizaOS as a dependency:

```typescript
// --- Minimal type definitions inspired by ElizaOS ---

interface Action<TContext = unknown> {
  name: string;
  description: string;
  validate: (ctx: TContext) => Promise<boolean>;
  handler: (ctx: TContext) => Promise<ActionResult>;
}

interface ActionResult {
  success: boolean;
  text: string;
  data?: Record<string, unknown>;
  error?: string;
}

interface Provider<TContext = unknown> {
  name: string;
  get: (ctx: TContext) => Promise<{ text: string; values: Record<string, unknown> }>;
}

interface Evaluator<TContext = unknown> {
  name: string;
  alwaysRun: boolean;
  validate: (ctx: TContext) => Promise<boolean>;
  handler: (ctx: TContext) => Promise<void>;
}

interface Plugin<TContext = unknown> {
  name: string;
  actions: Action<TContext>[];
  providers: Provider<TContext>[];
  evaluators: Evaluator<TContext>[];
}

// --- Event processing context ---
interface NostrEventContext {
  event: NostrEvent;
  runtime: { useModel: Function; getSetting: Function };
  state: Map<string, unknown>;
}

// --- Agent loop ---
class NostrAgentRuntime {
  private actions: Action<NostrEventContext>[] = [];
  private providers: Provider<NostrEventContext>[] = [];
  private evaluators: Evaluator<NostrEventContext>[] = [];

  registerPlugin(plugin: Plugin<NostrEventContext>) {
    this.actions.push(...plugin.actions);
    this.providers.push(...plugin.providers);
    this.evaluators.push(...plugin.evaluators);
  }

  async processEvent(event: NostrEvent): Promise<ActionResult[]> {
    const ctx: NostrEventContext = {
      event,
      runtime: this.runtime,
      state: new Map()
    };

    // 1. Inject context from all providers
    for (const provider of this.providers) {
      const { values } = await provider.get(ctx);
      for (const [k, v] of Object.entries(values)) {
        ctx.state.set(k, v);
      }
    }

    // 2. Find matching actions (validate gate)
    const applicable = [];
    for (const action of this.actions) {
      if (await action.validate(ctx)) {
        applicable.push(action);
      }
    }

    // 3. Execute matching actions
    const results: ActionResult[] = [];
    for (const action of applicable) {
      const result = await action.handler(ctx);
      results.push(result);
    }

    // 4. Run evaluators (post-processing / guardrails)
    for (const evaluator of this.evaluators) {
      if (evaluator.alwaysRun || await evaluator.validate(ctx)) {
        await evaluator.handler(ctx);
      }
    }

    return results;
  }
}

// --- Usage ---
const runtime = new NostrAgentRuntime();
runtime.registerPlugin(nostrHandlerPlugin);

// Subscribe to relays
pool.subscribeMany(relays, filters, {
  onevent: async (event) => {
    const results = await runtime.processEvent(event);
    for (const result of results) {
      if (result.success && result.data?.publishEvent) {
        await pool.publish(relays, result.data.publishEvent);
      }
    }
  }
});
```

---

## Key Assessment: Runtime Dependency vs. Pattern Inspiration

### The Case Against Using ElizaOS as a Runtime Dependency

1. **Dependency weight**: `@elizaos/core` pulls in LangChain, pdfjs-dist, Handlebars, and crypto-browserify. This is heavy for a project that already has its own relay infrastructure.

2. **Web3 coupling**: ElizaOS's development roadmap is driven by crypto/DeFi use cases (token migration, Chainlink CCIP, multi-chain wallets). Its evolution may diverge from general-purpose agent needs.

3. **Infrastructure assumptions**: The runtime expects a database adapter (PostgreSQL/PGLite), Socket.IO messaging, Express.js server, and Bun as package manager. These conflict with agent-society's existing stack (Hono, better-sqlite3, npm workspaces, tsup).

4. **Overhead for event processing**: ElizaOS's conversational model (World/Room/Entity, memory retrieval, state composition) adds latency and complexity that a kind-based event dispatcher does not need.

5. **Version instability**: 293 releases, frequent alpha tags, and a v2 beta that has been in progress for nearly a year suggest the API surface is still shifting.

6. **Node.js v23+ requirement**: This is a recent Node.js version that may cause compatibility issues with other dependencies.

### The Case For Borrowing ElizaOS Patterns

1. **Plugin architecture**: The Plugin interface with `actions[]`, `providers[]`, `evaluators[]`, `services[]`, and `events{}` is an excellent compositional model that maps directly to NIP handler requirements.

2. **validate -> handle flow**: The Action pattern with `validate` (gate) and `handler` (execute) is exactly the pattern needed for kind-based dispatch. The `validate` function becomes "does this action handle this event kind?" and the `handler` becomes the processing logic.

3. **Provider pattern**: Context injection via Providers maps perfectly to injecting trust scores, social graph data, relay status, and rate limit state into handler decisions.

4. **Evaluator pattern**: Post-processing evaluators with `alwaysRun` are a clean way to implement guardrails, audit logging, and rate limit enforcement.

5. **ActionResult standardization**: The `{ success, text, data, error }` result type is a clean, typed contract for handler outputs.

6. **Action chaining**: The `ActionContext.getPreviousResult()` pattern enables multi-step processing (e.g., NIP-59 unwrap then re-dispatch).

7. **Event system**: Plugin-level event handlers for lifecycle events (message received, run completed) map to observability hooks.

### Recommendation

**Use ElizaOS as pattern inspiration, not as a runtime dependency.**

The plugin architecture, validate->handle flow, Provider/Evaluator patterns, and ActionResult interface are all worth adopting. However, these patterns can be implemented in ~200-300 lines of TypeScript without pulling in ElizaOS's dependency tree, infrastructure assumptions, or Web3 coupling.

The Option B code sketch above demonstrates that the core architectural value of ElizaOS can be extracted into a lightweight, purpose-built runtime that integrates cleanly with the existing agent-society stack. This approach gives you:

- ElizaOS's compositional plugin model
- Zero additional dependencies
- Full control over the event processing pipeline
- Clean integration with nostr-tools, Hono, and the existing monorepo
- Freedom to use Vercel AI SDK or any other LLM library for the actual model calls

If ElizaOS stabilizes around v2, drops the heavy dependencies, and offers `@elizaos/core` as a truly lightweight SDK, it would be worth re-evaluating. But as of early 2026, the framework is too tightly coupled to its full-platform vision to serve as a clean library dependency.

---

## Sources

- [ElizaOS GitHub Repository](https://github.com/elizaOS/eliza)
- [ElizaOS Documentation — Plugin System Overview](https://docs.elizaos.ai/plugin-registry/overview)
- [ElizaOS Documentation — LLM Configuration](https://docs.elizaos.ai/plugin-registry/llm)
- [ElizaOS Documentation — Messaging](https://docs.elizaos.ai/runtime/messaging)
- [ElizaOS Documentation — Plugin Patterns](https://docs.elizaos.ai/plugins/patterns)
- [ElizaOS Documentation — Plugin Development](https://docs.elizaos.ai/plugins/development)
- [ElizaOS Documentation — Migration](https://docs.elizaos.ai/plugins/migration)
- [Eliza: A Web3 Friendly AI Agent Operating System (arXiv paper)](https://arxiv.org/html/2501.06781v1)
- [ElizaOS v2: From Meme AI Fund to Full-Fledged Agent System](https://metalamp.io/magazine/article/elizaos-v2-from-a-meme-ai-fund-to-a-full-fledged-agent-system)
- [npm: @elizaos/core](https://www.npmjs.com/package/@elizaos/core)
- [Top 5 TypeScript AI Agent Frameworks in 2026](https://techwithibrahim.medium.com/top-5-typescript-ai-agent-frameworks-you-should-know-in-2026-5a2a0710f4a0)
- [ElizaOS v2 Beta with TEE on Phala Cloud](https://phala.com/posts/launch-eliza-v2-beta-agent-swarms-with-tee-security-on-phala-cloud)
- [QuickNode: Build Web3-Enabled AI Agents with Eliza](https://www.quicknode.com/guides/ai/how-to-setup-an-ai-agent-with-eliza-ai16z-framework)
- [Deep Dive into Actions, Providers, and Evaluators](https://elizaos.github.io/eliza/community/ai-dev-school/part2/)
