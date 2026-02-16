# Agent Framework Selection Report: NIP Handler Runtime

**Date**: February 2026
**Project**: agent-society (Nostr + ILP TypeScript monorepo)
**Scope**: Select an agent framework for the autonomous NIP Handler runtime

---

## 1. Executive Summary

### Primary Recommendation: Vercel AI SDK (v6)

Vercel AI SDK is the strongest fit for the NIP Handler runtime. It provides best-in-class multi-model support (25+ providers), clean Zod-based structured output via `Output.object()`, and a stateless per-call design that maps directly to the event-driven, kind-based dispatch architecture the project requires. At ~6.2 MB with only 4 direct dependencies, it integrates cleanly into the existing tsup/ESM monorepo without architectural compromise.

### Runner-up: Mastra

Choose Mastra if the project evolves to require built-in workflow orchestration (suspend/resume across multi-event correlation), production-grade guardrails (PII detection, prompt injection filtering), or richer observability out of the box. Mastra uses Vercel AI SDK internally for model abstraction, so the provider story is identical. The tradeoff is a 36 MB package and a rapidly evolving API surface (1.0 to 1.4 in six weeks).

### Key Risks and Dealbreakers

| Framework | Dealbreaker |
|-----------|------------|
| OpenAI Agents SDK | Requires Node 22+ (project targets 20+). Pre-1.0. Mandatory `openai` package even when using other providers. |
| Anthropic Agent SDK | 80 MB package bundles Claude Code binary. Claude-only model support. Not suitable as a core event loop. |
| LangChain.js | ~14 MB minimum install with mandatory `langsmith` dependency. Excessive abstraction layers for the required use case. |
| ElizaOS | Pulls in PostgreSQL, Express, Socket.IO, Playwright. Requires Node 23+. Web3/crypto coupling. Version instability (293 releases). |
| Build-from-scratch | Viable but requires reimplementing provider abstraction, structured output retry logic, and observability hooks that Vercel AI SDK already provides. |

---

## 2. Comparison Matrix

Criteria are weighted per the research prompt specification.

| Criteria (Weight) | Vercel AI SDK | OpenAI Agents | Anthropic Agent | LangChain.js | Mastra | ElizaOS | Build-Minimal |
|---|---|---|---|---|---|---|---|
| **Multi-model (25%)** | 5 | 2 | 1 | 5 | 5 | 3 | 4 |
| **Structured output / Zod (20%)** | 5 | 5 | 5 | 4 | 5 | 2 | 3 |
| **Composability (20%)** | 4 | 4 | 5 | 3 | 5 | 4 | 3 |
| **Event-driven fit (15%)** | 5 | 4 | 2 | 4 | 4 | 3 | 5 |
| **Integration burden (10%)** | 5 | 3 | 1 | 2 | 3 | 1 | 5 |
| **Community & maintenance (10%)** | 5 | 4 | 3 | 4 | 4 | 2 | N/A |
| **Weighted Score** | **4.75** | **3.55** | **2.80** | **3.75** | **4.50** | **2.65** | **3.85** |

### Scoring Rationale

- **5 = Excellent**: Best-in-class, no gaps for this use case
- **4 = Good**: Strong support with minor limitations
- **3 = Adequate**: Works but requires workarounds or carries concerns
- **2 = Fair**: Significant gaps or constraints
- **1 = Poor**: Fundamental mismatch or blocking issue

---

## 3. Detailed Analysis

### 3.1 Vercel AI SDK (v6)

#### Overview

- **Package**: `ai` v6.0.86
- **License**: Apache-2.0
- **GitHub**: ~21,800 stars
- **npm**: ~2.8M weekly downloads
- **Size**: ~6.2 MB unpacked, 4 direct dependencies
- **Maintained by**: Vercel
- **Maturity**: Stable. v6 is a major release with breaking changes from v4/v5 but well-documented migration path.

#### Multi-model Support

The strongest multi-model story of any framework evaluated. 25+ official provider packages follow a consistent `@ai-sdk/<provider>` naming pattern:

- Anthropic, OpenAI, Google, Mistral, Cohere, Amazon Bedrock, Azure, Groq, Perplexity, DeepSeek, xAI, and more
- Local models via `@ai-sdk/ollama` or any OpenAI-compatible endpoint
- Provider registry pattern via `createProviderRegistry()` enables model selection by string at runtime

Swapping models requires changing a single string identifier. No code changes to handler logic.

#### Structured Output

Native Zod integration via `Output.object({ schema })` passed to `generateText`. This maps directly to the NIP Handler action schema:

- `Output.object()` for single action responses
- `Output.choice()` for discriminated unions (e.g., reply vs. react vs. ignore)
- `NoObjectGeneratedError` on validation failure (retry logic is explicit, not hidden)
- Tool definitions accept Zod `inputSchema` and `outputSchema`

The explicit error handling is an advantage for the NIP Handler: retry policy can be kind-specific (retry social actions, escalate failed DVM results).

#### Composability

- Dynamic tool registration per call (tools are a plain object, swap per kind)
- MCP client support for external tool servers
- System prompts are strings, loadable from the existing markdown handler files
- `callOptionsSchema` for parameterizing invocations (e.g., passing kind, trust score)
- No built-in plugin registry, but the stateless design means the calling code IS the composition layer

The existing handler reference files (`.claude/skills/nip-handler/references/handlers/*.md`) can be loaded as system prompts directly, with the kind registry controlling which file is read.

#### Event-driven Fit

This is where Vercel AI SDK excels for this project. It is stateless per-call: `generateText()` takes input, returns output, manages no state between calls. This means:

- The Nostr relay subscription (via nostr-tools `SimplePool`) owns the event loop
- Each incoming event triggers a `generateText()` call with the appropriate handler context
- State (rate limits, conversation memory, audit logs) lives in the existing `better-sqlite3` layer
- `streamText()` available for streaming responses but not required for the action-decision pattern
- `ToolLoopAgent` with `stopWhen` for multi-step agent loops when needed (e.g., DVM processing)

The framework does not impose its own event loop, which is exactly what an event-driven Nostr agent needs.

#### Integration Assessment

Minimal integration burden:

- ESM-first with CJS fallback (project is ESM)
- 4 dependencies, tree-shakeable
- Works with tsup (existing build tool), Vite, esbuild
- No conflicts with Hono, nostr-tools, better-sqlite3, or ws
- No infrastructure requirements (no database, no server)

#### Code Sketch

```typescript
// packages/agent/src/nip-handler.ts
import { generateText, Output } from 'ai';
import { createProviderRegistry } from 'ai';
import { z } from 'zod';
import { loadHandlerReference, getActionSchema } from './handler-registry';

const registry = createProviderRegistry({
  anthropic: createAnthropic({ apiKey: env.ANTHROPIC_KEY }),
  openai: createOpenAI({ apiKey: env.OPENAI_KEY }),
  ollama: createOllama({ baseURL: 'http://localhost:11434' }),
});

// Action schema matches existing action-schema.md
const ActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('reply'), content: z.string().min(1), reply_to: z.string().length(64) }),
  z.object({ action: z.literal('react'), emoji: z.string(), event_id: z.string().length(64) }),
  z.object({ action: z.literal('ignore'), reason: z.string() }),
  z.object({ action: z.literal('escalate'), reason: z.string(), event_id: z.string().length(64) }),
  z.object({ action: z.literal('unwrap'), event_id: z.string().length(64), note: z.string() }),
  z.object({ action: z.literal('fulfill_job'), job_id: z.string().length(64), result_content: z.string().min(1), result_kind: z.number().int().min(6000).max(6999) }),
  // ... remaining action types
]);

export async function handleNostrEvent(event: NostrEvent, model = 'anthropic/claude-4-sonnet') {
  const kind = event.kind;

  // Step 1: Registry lookup (deterministic, not LLM-based)
  const handlerRef = loadHandlerReference(kind);
  if (!handlerRef) {
    return { action: 'ignore', reason: `No handler for kind ${kind}` };
  }

  // Step 2: Get kind-specific action allowlist
  const allowedActions = getActionSchema(kind); // Subset of ActionSchema

  // Step 3: Build security-wrapped content
  const securedContent = wrapUntrustedContent(event);

  // Step 4: LLM decides action
  const { output, usage } = await generateText({
    model: registry.languageModel(model),
    system: handlerRef, // Loaded from markdown handler file
    prompt: securedContent,
    output: Output.object({ schema: allowedActions }),
  });

  // Step 5: Validate against kind allowlist (defense-in-depth)
  validateActionForKind(output, kind);

  // Step 6: Audit log
  auditLog({ kind, eventId: event.id, action: output, tokens: usage });

  return output;
}

// Integration with relay subscription
pool.subscribeMany(relays, filters, {
  onevent: async (event) => {
    const action = await handleNostrEvent(event);
    await executeAction(action, event);
  },
});
```

---

### 3.2 OpenAI Agents SDK

#### Overview

- **Package**: `@openai/agents` v0.4.10
- **License**: MIT
- **GitHub**: ~2,300 stars
- **npm**: ~341K weekly downloads
- **Size**: ~2.3 MB core + ~7 MB mandatory `openai` transitive dependency
- **Maintained by**: OpenAI
- **Maturity**: Pre-1.0. API surface is still evolving.

#### Multi-model Support

OpenAI-first by design. Non-OpenAI models require the Vercel AI SDK adapter (`aisdk()` from `@openai/agents-extensions`), which is in beta. The mandatory `openai` package (~7 MB) is always installed regardless of which provider you use. This creates unnecessary dependency weight and conceptual coupling.

Local model support is technically possible through the adapter but not a first-class path.

#### Structured Output

Strong Zod integration via `outputType` on agent definitions. Uses Zod v4 as a peer dependency (the project would need to evaluate Zod v4 compatibility). Auto-generates tool schemas from Zod definitions. Error handling for schema validation failures is adequate but less explicit than Vercel AI SDK's `NoObjectGeneratedError`.

#### Composability

Good multi-agent patterns: agent handoffs, agents-as-tools, `RunContext<T>` for dependency injection. MCP tool support is included. However, there is no formal plugin registry and the agent handoff model is more oriented toward conversational agents than event-driven dispatch.

#### Event-driven Fit

The `run(agent, input)` invocation model is cleanly callable from an external event loop. The framework does not impose its own event loop, which is good. However, the agent model carries conversational state assumptions (message history, handoff chains) that add overhead for stateless event processing.

#### Integration Assessment

- Dual ESM/CJS, TypeScript-native
- **Requires Node 22+**: The project's `package.json` specifies `"node": ">=20"`. Adopting this SDK would force a Node version bump across the entire monorepo.
- Mandatory `openai` dependency adds ~7 MB even when using Anthropic or local models
- Documentation quality is good but focused on OpenAI-native patterns

#### Code Sketch

```typescript
import { Agent, run } from '@openai/agents';
import { aisdk } from '@openai/agents-extensions';
import { z } from 'zod';

const nipHandler = new Agent({
  name: 'NIP Handler',
  model: aisdk(anthropicModel), // adapter wrapping non-OpenAI
  instructions: loadHandlerReference(kind),
  outputType: ActionSchema,
  tools: [
    // kind-specific tools
  ],
});

// In event loop
pool.subscribeMany(relays, filters, {
  onevent: async (event) => {
    const result = await run(nipHandler, wrapUntrustedContent(event));
    const action = result.finalOutput; // typed via outputType
    await executeAction(action, event);
  },
});
```

---

### 3.3 Anthropic Agent SDK (Claude Agent SDK)

#### Overview

- **Package**: `@anthropic-ai/agent-sdk` v0.2.44
- **License**: Anthropic Commercial Terms (not Apache/MIT)
- **GitHub**: ~800 stars
- **npm**: ~1.85M weekly downloads (inflated by Claude Code bundling)
- **Size**: ~80 MB (bundles entire Claude Code binary)
- **Maintained by**: Anthropic
- **Maturity**: Pre-1.0. Formerly "Claude Code SDK", rebranded.

#### Multi-model Support

Claude-only. Supports Anthropic API, AWS Bedrock, Google Vertex, and Azure Foundry as deployment targets, but all run Claude models. Cannot use OpenAI, Google Gemini, Mistral, or local models. This is a fundamental mismatch with the multi-model requirement.

#### Structured Output

Strong JSON Schema integration via `outputFormat`, with Zod support through `z.toJSONSchema()`. Automatic retry on validation failure is a nice touch. The structured output story is excellent in isolation but locked to Claude.

#### Composability

The richest composability model of any framework evaluated:

- MCP tool servers via `createSdkMcpServer()`
- Subagents with per-agent model and tool configuration
- Plugins, skills (markdown-based), and hooks (PreToolUse, PostToolUse, etc.)
- Slash commands for interactive use

The markdown-based skills concept aligns closely with the existing NIP handler reference files. However, the implementation spawns a Claude Code subprocess per query, which is not suitable for high-throughput event processing.

#### Event-driven Fit

Poor fit for the core event loop. The `query()` method returns an AsyncGenerator for streaming, but each invocation spawns a Claude Code subprocess. This adds latency, memory overhead, and process management complexity that is inappropriate for a hot path processing Nostr events at relay speed.

Better suited as a "specialist" for infrequent, complex tasks (e.g., trust assessment, peer evaluation, long-form content analysis) rather than every-event dispatch.

#### Integration Assessment

- **80 MB package size**: Bundles the Claude Code binary. This is 13x larger than Vercel AI SDK.
- Zero runtime deps (everything is bundled), but the bundle itself is the problem.
- Commercial license terms may conflict with the project's MIT license.
- Process-per-query model conflicts with the event-driven architecture.

#### Code Sketch

```typescript
import { Agent, query } from '@anthropic-ai/agent-sdk';

// Only viable as a specialist, not the core loop
const trustAssessor = new Agent({
  name: 'Trust Assessor',
  model: 'claude-4-sonnet',
  system: loadHandlerReference('trust-assessment'),
  outputFormat: { type: 'json', schema: TrustAssessmentSchema },
  maxBudgetUsd: 0.05, // per-query budget cap
});

// Called selectively, not for every event
async function assessTrust(event: NostrEvent): Promise<TrustAssessment> {
  const stream = query(trustAssessor, { prompt: formatEvent(event) });
  for await (const message of stream) {
    if (message.type === 'result') return message.output;
  }
}
```

---

### 3.4 LangChain.js / LangGraph.js

#### Overview

- **Packages**: `@langchain/core` v1.1.24 (~7.7 MB, 1762 files), `@langchain/langgraph` v1.1.4 (~3.3 MB)
- **License**: MIT
- **GitHub**: langchainjs ~17K stars, langgraphjs ~2.5K stars
- **npm**: ~1.2M and ~400K weekly downloads respectively
- **Maintained by**: LangChain Inc. (Sequoia-backed)
- **Maturity**: v1.0 GA since October 2025.

#### Multi-model Support

Excellent breadth: 50+ provider integrations via `@langchain/<provider>` packages. Clean `BaseChatModel` abstraction. Ollama and llama.cpp support for local models. Provider switching is straightforward.

#### Structured Output

`withStructuredOutput()` method on chat models with Zod schema support. Dual strategy: provider-native structured output or tool-call-based extraction. Auto-retry on validation failure with error feedback to the model. The implementation works but adds abstraction layers compared to Vercel AI SDK's direct approach.

#### Composability

LCEL (LangChain Expression Language) pipe composition and middleware system (new in v1.0). Tools defined with Zod schemas. LangGraph adds `StateGraph` with conditional edges that could map to kind-based routing. However, progressive context disclosure (loading different handler references per kind) requires manual implementation.

#### Event-driven Fit

LangGraph's `StateGraph` with conditional edges maps reasonably well to kind-based routing. Checkpointing provides fault tolerance for multi-step workflows. However, LangGraph is designed for directed graph workflows, not continuous event processing. Each event would instantiate a graph run, which adds overhead compared to a simple function call.

#### Integration Assessment

The primary concern is dependency weight:

- ~14 MB minimum install (`@langchain/core` + `@langchain/langgraph`)
- Mandatory `langsmith` dependency (hosted SaaS for tracing)
- 2,000+ files in `@langchain/core` alone
- Steep learning curve: LCEL, Runnables, StateGraph, Channels, Reducers
- "Is LangChain too complex?" is a recurring community concern

For a project that needs to call an LLM with structured output on each Nostr event, LangChain adds substantial abstraction for marginal benefit over Vercel AI SDK.

#### Code Sketch

```typescript
import { StateGraph, END } from '@langchain/langgraph';
import { ChatAnthropic } from '@langchain/anthropic';

const model = new ChatAnthropic({ model: 'claude-4-sonnet' });
const structuredModel = model.withStructuredOutput(ActionSchema);

// Define graph
const graph = new StateGraph({ channels: { event: null, action: null } })
  .addNode('classify', async (state) => {
    const handler = loadHandlerReference(state.event.kind);
    return { handler };
  })
  .addNode('decide', async (state) => {
    const action = await structuredModel.invoke([
      { role: 'system', content: state.handler },
      { role: 'user', content: wrapUntrustedContent(state.event) },
    ]);
    return { action };
  })
  .addEdge('classify', 'decide')
  .addEdge('decide', END);

const app = graph.compile();

// In event loop
pool.subscribeMany(relays, filters, {
  onevent: async (event) => {
    const result = await app.invoke({ event });
    await executeAction(result.action, event);
  },
});
```

---

### 3.5 Mastra

#### Overview

- **Package**: `@mastra/core` v1.4.0
- **License**: Apache-2.0
- **GitHub**: ~21,100 stars
- **npm**: 300K+ weekly downloads
- **Size**: ~36 MB for `@mastra/core`
- **Maintained by**: Gatsby team (YC W25, $13M seed)
- **Maturity**: Stable 1.0 since January 2026. Rapid iteration (1.0 to 1.4 in six weeks).
- **Production users**: Replit, PayPal, Sanity, WorkOS

#### Multi-model Support

Excellent. Mastra uses Vercel AI SDK internally for model abstraction, giving it access to 80+ providers via the same `@ai-sdk/<provider>` packages. Model selection uses a simple string format: `"anthropic/claude-4.5-sonnet"`. Dynamic model selection via function is supported, enabling per-kind or per-trust-level model routing.

#### Structured Output

Native Zod via `structuredOutput` parameter on agent calls. Three error strategies: `strict` (throw), `warn` (log and return raw), `fallback` (use default value). An optional separate "structuring model" can be specified to use a cheaper model for JSON extraction. This is useful for cost optimization on high-volume event processing.

#### Composability

The richest composability story alongside the Anthropic Agent SDK:

- `createTool()` with Zod input/output schemas
- vNext workflow engine: graph-based steps, branch/parallel/suspend/resume
- Agent Networks for multi-agent routing (LLM-driven or deterministic)
- `runtimeContext` for dependency injection (pass relay pool, trust manager, rate limiter)
- MCP tool support

The suspend/resume workflow capability is uniquely valuable for NIP-90 DVM jobs, which involve multi-step lifecycles (receive request, publish feedback, process, publish result).

#### Event-driven Fit

Not inherently event-driven, but agents and workflows are cleanly invokable from external event loops. The suspend/resume pattern enables multi-event correlation (e.g., a DVM job that waits for payment before processing). However, this adds complexity that may not be needed initially.

#### Integration Assessment

- ESM-first, TypeScript-first
- 36 MB package size is a concern (6x larger than Vercel AI SDK)
- API moving fast: 1.0 to 1.4 in six weeks means potential churn
- Explicit monorepo documentation suggests good compatibility with the project structure
- `@mastra/evals` package for testing is a strong addition

#### Code Sketch

```typescript
import { Mastra, Agent, createTool } from '@mastra/core';
import { z } from 'zod';

const nipAgent = new Agent({
  name: 'NIP Handler',
  model: 'anthropic/claude-4-sonnet', // string-based model selection
  instructions: (ctx) => loadHandlerReference(ctx.runtimeContext.get('kind')),
  structuredOutput: {
    schema: ActionSchema,
    errorStrategy: 'strict',
  },
  tools: {
    lookupTrust: createTool({
      description: 'Look up trust score for a pubkey',
      inputSchema: z.object({ pubkey: z.string().length(64) }),
      outputSchema: z.object({ score: z.number(), distance: z.number() }),
      execute: async ({ pubkey }) => trustManager.getTrustScore(pubkey),
    }),
  },
});

const mastra = new Mastra({ agents: { nipAgent } });

// In event loop
pool.subscribeMany(relays, filters, {
  onevent: async (event) => {
    const result = await mastra.getAgent('nipAgent').generate(
      wrapUntrustedContent(event),
      { runtimeContext: new RuntimeContext({ kind: event.kind }) },
    );
    await executeAction(result.object, event);
  },
});
```

---

### 3.6 ElizaOS

#### Overview

- **Package**: `@elizaos/core` v1.7.2
- **License**: MIT
- **GitHub**: ~17,500 stars
- **npm**: ~20,600 weekly downloads
- **Maintained by**: elizaOS community (formerly ai16z)
- **Maturity**: Unstable. 293 releases with frequent alpha tags. v2 beta unmerged for approximately one year.

#### Multi-model Support

Supports OpenAI, Anthropic, Google, Ollama, DeepSeek, and OpenRouter. Adequate breadth but the provider abstraction is less clean than Vercel AI SDK or LangChain.

#### Composability

The Action pattern (validate/handle) is conceptually strong and maps well to the NIP Handler's kind-based dispatch:

- **Actions**: validate (should this event be processed?) then handle (process it)
- **Providers**: inject context (trust scores, social graph data)
- **Evaluators**: post-processing (audit logging, rate limit checks)
- **Services**: lifecycle management (relay connections)

This pattern is worth studying as architectural inspiration.

#### Problems

ElizaOS has fundamental integration conflicts with the agent-society project:

1. **Heavy dependencies**: `@langchain/core`, pdfjs-dist, handlebars, crypto-browserify (12 direct in core). `@elizaos/plugin-node` adds 54 more including Playwright and Puppeteer.
2. **Infrastructure assumptions**: PostgreSQL/PGLite, Socket.IO, Express.js. The project uses better-sqlite3 and Hono.
3. **Runtime requirements**: Bun preferred, Node.js v23+ required. Project targets Node 20+.
4. **Web3/crypto coupling**: Token economics, Chainlink CCIP, DeFi priorities baked into the core.
5. **Missing features**: No built-in token/cost tracking, no tracing/observability, no content filtering, no structured output with Zod.
6. **Version instability**: 293 releases, frequent alpha tags, v2 beta unmerged for ~1 year.

#### Recommendation

Use ElizaOS as **pattern inspiration**, not a runtime dependency. The Action (validate/handle), Provider, and Evaluator patterns can be implemented in approximately 200-300 lines of TypeScript tailored to the project's actual needs. The framework itself carries too much incompatible infrastructure to justify as a dependency.

#### Code Sketch (Pattern Inspiration Only)

```typescript
// Inspired by ElizaOS Action pattern, implemented independently
interface NipAction {
  name: string;
  kinds: number[];  // Which event kinds this action handles
  validate: (event: NostrEvent, context: AgentContext) => Promise<boolean>;
  handle: (event: NostrEvent, context: AgentContext) => Promise<ActionResult>;
}

interface NipProvider {
  name: string;
  get: (event: NostrEvent, context: AgentContext) => Promise<string>;
  // Returns context string injected into LLM prompt
}

// Example action registration
const replyAction: NipAction = {
  name: 'reply',
  kinds: [1, 30023],
  validate: async (event, ctx) => {
    return ctx.trustManager.getTrustScore(event.pubkey) > 0.3;
  },
  handle: async (event, ctx) => {
    const handlerRef = loadHandlerReference(event.kind);
    const result = await generateText({ /* ... */ });
    return result;
  },
};
```

---

### 3.7 Other Frameworks and Build-Minimal

#### OpenCode SDK

OpenCode is an open-source AI coding agent with ~105K GitHub stars. It uses Vercel AI SDK internally for model abstraction. The npm package (`@opencode-ai/opencode`) is a client SDK for controlling an OpenCode server instance, not an embeddable agent runtime. It cannot be repurposed as a general-purpose agent framework. **Not viable.**

#### Other Emerging Frameworks

- **Google ADK** (v0.3.0, December 2025): Too new for production use. Google Cloud-optimized. TypeScript support is early-stage.
- **VoltAgent** (~5,100 stars): Observability-first agent framework with interesting design. Less established ecosystem. Worth monitoring but not ready for this use case.
- **Agentica**: Compiler-driven function calling from TypeScript types. Novel approach but niche, small community.
- **Instructor-JS**: Structured output extraction only, not an agent framework. Useful concept but Vercel AI SDK's `Output.object()` covers this.
- **ModelFusion**: Deprecated, folded into Vercel AI SDK.

#### Build-Minimal Approach

A minimal approach using Vercel AI SDK's `generateText` + a custom event loop is viable. This is what OpenCode itself uses internally. The pattern:

```typescript
// The "build-minimal" approach IS Vercel AI SDK + custom glue code
import { generateText, Output } from 'ai';

// Custom event loop (already exists via nostr-tools)
pool.subscribeMany(relays, filters, {
  onevent: async (event) => {
    const handler = kindRegistry.get(event.kind);
    if (!handler) return { action: 'ignore' };

    const { output } = await generateText({
      model: getModel(event.kind),
      system: await readFile(handler.referencePath, 'utf-8'),
      prompt: wrapUntrustedContent(event),
      output: Output.object({ schema: handler.actionSchema }),
    });

    await executeAction(output, event);
  },
});
```

This is effectively the recommended approach. "Vercel AI SDK" and "build-minimal with Vercel AI SDK" are the same recommendation. The framework provides the model abstraction and structured output; the project provides the event loop, state management, and handler registry.

---

## 4. Build-vs-Compose Sidebar

The NIP Handler runtime sits at an unusual point in the framework spectrum. It needs:

1. **Multi-model LLM calls with structured output** (framework territory)
2. **Deterministic kind-based event dispatch** (application logic, not LLM routing)
3. **External event loop integration** (Nostr relay subscriptions)
4. **Domain-specific state management** (trust scores, rate limits, audit logs)

Points 2-4 are application-specific and should not be delegated to a framework. Point 1 is the only capability that benefits from a framework, and Vercel AI SDK covers it with minimal overhead.

**The build-vs-compose question is a false dichotomy for this project.** The right answer is a thin framework (Vercel AI SDK) for the LLM interaction layer, with application-owned code for everything else.

Attempting to force the NIP Handler into a framework-managed agent loop (LangGraph's StateGraph, Mastra's workflow engine, OpenAI's agent handoffs) adds abstraction without value. The dispatch is deterministic (kind number lookup), the state is domain-specific (Nostr social graph, ILP balances), and the event source is external (relay WebSockets).

A full "build from scratch" approach using raw provider SDKs (`@anthropic-ai/sdk`, `openai`) is possible but costs approximately 60% more boilerplate for provider abstraction, structured output parsing, and error handling that Vercel AI SDK already provides.

---

## 5. Recommendation

### Primary Recommendation: Vercel AI SDK (v6)

**Justification**: Vercel AI SDK scores highest on the weighted matrix (4.75) because it excels precisely where this project needs framework support (multi-model abstraction, structured output) while imposing no constraints where the project needs freedom (event loop, state management, dispatch logic). Its 6.2 MB footprint, 4 dependencies, and stateless per-call design make it the lowest-risk integration.

### Architecture Sketch

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

### Migration Path / Incremental Adoption

**Phase 1: Foundation (1-2 days)**
- Add `packages/agent/` to the monorepo
- Install `ai` and one provider package (e.g., `@ai-sdk/anthropic`)
- Implement `KindRegistry` class: maps kind numbers to handler reference file paths
- Implement `HandlerLoader`: reads markdown handler files, returns system prompt strings
- Port existing Zod-style action schema from `action-schema.md` to actual Zod schemas

**Phase 2: Core Loop (2-3 days)**
- Implement `handleNostrEvent()` function (as shown in code sketch)
- Wire into existing relay subscription via nostr-tools `SimplePool`
- Implement `ActionExecutor`: takes validated action JSON, publishes appropriate Nostr events using existing event builders from `packages/core/src/events/`
- Add rate limiting and audit logging (SQLite via `better-sqlite3`)

**Phase 3: Handlers (1-2 days per handler)**
- Migrate kind:1 text note handler (reply, react, repost, zap decisions)
- Migrate kind:1059 gift wrap handler (unwrap and re-dispatch)
- Migrate kind:5000-5999 DVM handler (fulfill or decline jobs)
- Each migration: convert markdown handler reference to tested system prompt, define kind-specific action allowlist in Zod

**Phase 4: Multi-model (1 day)**
- Add `createProviderRegistry()` with multiple providers
- Implement model selection logic (e.g., use cheaper models for simple kinds, stronger models for DVM/trust decisions)
- Add Ollama support for local development

**Phase 5: Production Hardening (2-3 days)**
- OpenTelemetry integration for tracing
- Error handling and retry policies per kind
- Security defense stack validation (content isolation, allowlist enforcement)
- Integration tests with mocked LLM responses

### Risks and Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Vercel AI SDK v7 breaking changes | Medium | Medium | Pin to v6.x. The provider registry pattern is stable. Migration guides are historically thorough. |
| Structured output unreliability with weaker models | Medium | High | Use `Output.object()` which leverages provider-native JSON mode where available. Implement kind-specific retry with escalation fallback. Test with each target model. |
| Vercel corporate priorities shift away from SDK | Low | High | SDK is Apache-2.0 and could be forked. The actual provider protocol (`@ai-sdk/provider`) is a thin interface. Migration to raw SDKs is straightforward. |
| Handler reference files too large for context window | Low | Medium | Monitor token usage per kind. Implement handler compression or section loading for large references. Use `js-tiktoken` for pre-flight token counting. |
| Rate limiting on LLM APIs during event bursts | Medium | Medium | Implement queue with backpressure. Use local models (Ollama) for low-stakes decisions. Cache deterministic responses. |

---

## 6. Secondary Questions

### 6.1 Testing and Observability

**Vercel AI SDK (recommended)**:
- `MockLanguageModelV3` and `simulateReadableStream` in the `ai/test` module enable deterministic unit tests without LLM calls
- Native OpenTelemetry integration via `experimental_telemetry` option on `generateText`
- `@ai-sdk/devtools` for local development debugging
- Integrations with Langfuse, MLflow, and other observability platforms
- Example test pattern:

```typescript
import { MockLanguageModelV3 } from 'ai/test';

const mockModel = new MockLanguageModelV3({
  defaultObjectGenerationMode: 'json',
  doGenerate: async () => ({
    text: JSON.stringify({ action: 'reply', content: 'test', reply_to: '0'.repeat(64) }),
    usage: { promptTokens: 100, completionTokens: 50 },
  }),
});

const result = await handleNostrEvent(testEvent, mockModel);
expect(result.action).toBe('reply');
```

**Comparison across frameworks**:
- **Mastra**: `@mastra/evals` package with LLM-based and code-based scoring. Best evaluation story. OpenTelemetry with 12+ exporters.
- **LangChain.js**: `FakeChatModel` for testing. LangSmith auto-tracing (hosted SaaS, free tier available).
- **OpenAI Agents SDK**: Built-in tracing but no mock model utilities. DIY mocking required.
- **Anthropic Agent SDK**: Budget tracking per query. No mock model support.
- **ElizaOS**: No built-in testing, tracing, or observability tooling.

### 6.2 Community and Maintenance Trajectory

| Framework | Stars | Weekly Downloads | Release Cadence | Corporate Backing | Risk Assessment |
|-----------|-------|-----------------|-----------------|-------------------|-----------------|
| Vercel AI SDK | ~21.8K | ~2.8M | Active (v6 current) | Vercel ($250M+ raised) | Low risk |
| LangChain.js | ~17K | ~1.2M | Active (v1.0 GA) | LangChain Inc. (Sequoia) | Low risk |
| Mastra | ~21.1K | ~300K | Very active (1.0→1.4 in 6 weeks) | YC W25, $13M seed | Medium risk (API churn) |
| ElizaOS | ~17.5K | ~20.6K | Unstable (293 releases) | Community | High risk |
| OpenAI Agents SDK | ~2.3K | ~341K | Pre-1.0, evolving | OpenAI | Medium risk |
| Anthropic Agent SDK | ~800 | ~1.85M* | Pre-1.0 | Anthropic | Medium risk |

*Anthropic Agent SDK downloads are inflated by Claude Code bundling.

Vercel AI SDK has the strongest combination of adoption (2.8M weekly downloads), stability (v6 GA), and corporate backing (Vercel). Its provider protocol (`@ai-sdk/provider`) has become a de facto standard that other frameworks build on (Mastra, OpenCode).

### 6.3 Guardrails and Safety Layers

The NIP Handler has a 10-layer defense stack defined in `security.md`. Framework support for safety:

**Vercel AI SDK**:
- `LanguageModelV3Middleware` for pre/post generation filtering (content moderation, PII detection)
- `needsApproval` on tool definitions (human-in-the-loop for destructive actions)
- Zod validation on all outputs (schema-level guardrail)
- Streaming guardrails are limited (post-complete validation only)
- The 10-layer defense stack is best implemented as application code wrapping `generateText`, not delegated to the framework

**Mastra** (strongest guardrails):
- Processor system with built-in components: `PromptInjectionDetector`, `PIIDetector`, `ModerationProcessor`, `SystemPromptScrubber`, `TokenLimiter`
- Four strategies per processor: block, warn, detect, redact
- These could be applied as middleware before the LLM call

**OpenAI Agents SDK**:
- 4-type guardrail system (input, output, tool input, tool output) running in parallel with agent execution
- Guardrails can short-circuit agent execution

**LangChain.js**:
- Middleware hooks + graph validation nodes in LangGraph
- No built-in content filtering framework

**Anthropic Agent SDK**:
- Strongest safety story: sandbox, permissions, budget limits, static analysis, `canUseTool` callback
- Overkill for structured output decisions, appropriate for autonomous code execution

**Recommendation**: Implement the 10-layer defense stack as application middleware wrapping Vercel AI SDK calls. The stack includes content isolation (datamarkers), schema validation (Zod), action allowlists (per-kind), rate limiting (SQLite counters), and audit logging. These are domain-specific and better owned by the application than delegated to a framework. If production needs demand it, Mastra's processor system can be adopted later as a complement.

### 6.4 Multi-agent Patterns

Future consideration: specialized agents for social interactions, DVM processing, payment routing, and trust assessment.

**Vercel AI SDK**: No built-in multi-agent orchestration. Multi-agent patterns are implemented via composition: an orchestrator function calls `generateText` with different models, system prompts, and tools per agent role. This is explicit and debuggable but requires manual implementation of agent coordination.

**LangChain.js / LangGraph**: Best multi-agent story. Supervisor pattern, `Command` handoffs, subgraph composition, `Send` for map-reduce. If the project evolves to need complex agent coordination, LangGraph could be introduced for the orchestration layer while keeping Vercel AI SDK for individual agent calls.

**Mastra**: Agent Networks with LLM-driven or deterministic routing. Good for adding multi-agent later without replacing the core framework.

**OpenAI Agents SDK**: Handoffs and agents-as-tools. Good patterns but locked to the OpenAI ecosystem.

**Anthropic Agent SDK**: Subagents (hierarchical) and Agent Teams (experimental peer-to-peer). Claude-only.

**Recommendation**: Start with simple composition in Vercel AI SDK (different `generateText` calls per agent role). If multi-agent coordination becomes complex, evaluate introducing Mastra's Agent Networks or LangGraph's supervisor pattern as an orchestration layer on top.

### 6.5 Cost and Token Management

Token optimization matters for the NIP Handler given the volume of Nostr events processed.

**Vercel AI SDK**:
- Usage data returned per `generateText` call: `promptTokens`, `completionTokens`, `totalTokens`
- Detailed breakdowns: cache read/write tokens, reasoning tokens (for models that support them)
- No built-in tokenizer or cost calculator
- Pair with `js-tiktoken` for pre-flight token counting and `better-sqlite3` for cost tracking

**Mastra**:
- `js-tiktoken` integration
- `TokenLimiterProcessor` for context window management
- Token usage captured in OpenTelemetry traces
- No built-in cost calculator

**LangChain.js**:
- `js-tiktoken` built-in
- `usage_metadata` on model responses
- LangSmith tracks cost per trace
- Context window summarization middleware (auto-compress long conversations)

**OpenAI Agents SDK**:
- Automatic token counting per run with per-request breakdown
- No budget enforcement (track only)

**Anthropic Agent SDK**:
- Best cost tracking: per-query, per-model, per-message USD cost
- `maxBudgetUsd` budget cap per query
- Only works for Claude models

**Recommendation**: Implement cost tracking in the application layer:
1. Use Vercel AI SDK's `usage` return value from each `generateText` call
2. Store per-kind, per-model cost data in SQLite
3. Use `js-tiktoken` for pre-flight context window checks on large events
4. Implement configurable cost thresholds per kind (e.g., max $0.01 per kind:1 decision, max $0.10 per DVM job)
5. Route to cheaper/local models for high-volume, low-stakes decisions (reactions, simple ignores)

---

## Appendix: Data Sources

- Vercel AI SDK: https://ai-sdk.dev (v6 docs), https://github.com/vercel/ai, https://www.npmjs.com/package/ai
- OpenAI Agents SDK: https://github.com/openai/openai-agents-js, https://www.npmjs.com/package/@openai/agents
- Anthropic Agent SDK: https://github.com/anthropics/anthropic-agent-sdk, https://www.npmjs.com/package/@anthropic-ai/agent-sdk
- LangChain.js: https://js.langchain.com, https://github.com/langchain-ai/langchainjs, https://www.npmjs.com/package/@langchain/core
- LangGraph.js: https://langchain-ai.github.io/langgraphjs, https://www.npmjs.com/package/@langchain/langgraph
- Mastra: https://mastra.ai/docs, https://github.com/mastra-ai/mastra, https://www.npmjs.com/package/@mastra/core
- ElizaOS: https://github.com/elizaOS/eliza, https://www.npmjs.com/package/@elizaos/core
- OpenCode: https://github.com/nicepkg/opencode, https://www.npmjs.com/package/@opencode-ai/opencode

All data points (stars, downloads, versions, package sizes) reflect values as of February 2026.
