---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments: []
workflowType: 'research'
lastStep: 1
research_type: 'technical'
research_topic: 'Claude.md vs BMAD project-context.md for AI coding agent context management'
research_goals: 'Compare effectiveness, maintenance burden, and scalability of flat CLAUDE.md rule files vs BMAD structured artifacts for guiding AI coding agents'
user_name: 'Jonathan'
date: '2026-03-23'
web_research_enabled: true
source_verification: true
---

# Research Report: technical

**Date:** 2026-03-23
**Author:** Jonathan
**Research Type:** technical

---

## Research Overview

This report investigates two competing paradigms for providing AI coding agents with persistent project knowledge: **flat configuration files** (CLAUDE.md, .cursorrules, AGENTS.md) versus **structured artifact systems** (BMAD's project-context.md + architecture.md with workflow-driven maintenance). The research draws on Anthropic's official documentation, academic papers, practitioner blog posts, community discussions, and expert analyses from figures like Addy Osmani and Martin Fowler.

**Research Methodology:**
- Current web data with rigorous source verification
- Multi-source validation for critical technical claims
- Confidence level framework for uncertain information
- Community and practitioner experience prioritized alongside official documentation

---

## Technical Research Scope Confirmation

**Research Topic:** Claude.md vs BMAD project-context.md for AI coding agent context management
**Research Goals:** Compare effectiveness, maintenance burden, and scalability of flat CLAUDE.md rule files vs BMAD structured artifacts for guiding AI coding agents

**Technical Research Scope:**

- Architecture Analysis - design patterns, file organization, context loading mechanisms
- Implementation Approaches - what goes where, how rules are expressed, maintenance workflows
- Integration Patterns - how each approach interacts with AI context windows and agent workflows
- Performance Considerations - token efficiency, context rot, scalability under growth
- Community Evidence - practitioner experiences, academic research, expert recommendations

**Scope Confirmed:** 2026-03-23

---

## Technology Stack Analysis

### The Landscape: AI Coding Context Configuration Files

The practice of providing AI coding agents with persistent project knowledge has rapidly evolved from ad-hoc prompting into a recognized engineering discipline called **context engineering**. As of early 2026, virtually every major AI coding tool has adopted some form of configuration file:

| Tool | Config File(s) | Loading Strategy |
|------|----------------|------------------|
| Claude Code | `CLAUDE.md` + Skills (`.claude/skills/`) | Hierarchical; CLAUDE.md always-loaded, Skills on-demand |
| Cursor | `.cursor/rules/*.mdc` | Glob-pattern matching; conditional per file type |
| Windsurf | `.windsurfrules` | Single file, loaded wholesale every prompt |
| GitHub Copilot | `.github/copilot-instructions.md` | Always-loaded |
| OpenCode | Rules files | Configurable loading |
| BMAD Method | `project-context.md` + `architecture.md` + workflow artifacts | Workflow-driven; auto-loaded by specific agent workflows |

_Source: [Killer Skills - Claude Code vs Cursor vs Windsurf](https://killer-skills.com/en/blog/claude-code-vs-cursor-vs-windsurf/), [Cursor Docs - Rules](https://cursor.com/docs/context/rules), [BMAD Method Docs](https://docs.bmad-method.org/)_

### Approach 1: CLAUDE.md (Flat Configuration)

**Architecture:**
CLAUDE.md is a markdown file read at conversation start, providing Claude Code with persistent context it cannot infer from code alone. The official Anthropic guidance is clear: include bash commands, code style, and workflow rules — and ruthlessly prune everything else.

**Key Design Principles (from Anthropic):**
- **Concision is king**: "For each line, ask: 'Would removing this cause Claude to make mistakes?' If not, cut it." There is roughly a **150-200 instruction budget** before compliance drops, and the system prompt already uses ~50 of those.
- **Pointers over content**: Don't include code snippets — they go stale. Use `file:line` references instead.
- **Hierarchical loading**: In monorepos, nest CLAUDE.md files in subdirectories. Parent files load at startup; subdirectory files load on-demand as Claude accesses those directories.
- **Skills for procedures**: Unlike CLAUDE.md (always loaded), Skills load only when relevant — frontmatter descriptions (~30-50 tokens each) are loaded at startup, full content loads on invocation.

_Source: [Best Practices for Claude Code](https://code.claude.com/docs/en/best-practices), [Anthropic - Effective Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents), [Rules vs Skills in Claude Code](https://dev.to/jeffreese/rules-vs-skills-in-claude-code-5cfi)_

**Monorepo Scaling Pattern:**
One practitioner documented reducing a **47,000-word** monolithic CLAUDE.md to a hierarchy of ~8,000-character files per service, achieving an ~80% reduction in per-task context:

```
CLAUDE.md              (8,902 chars) — root: shared rules only
frontend/CLAUDE.md     (8,647 chars) — frontend-specific
backend/CLAUDE.md      (7,892 chars) — backend-specific
core/CLAUDE.md         (7,277 chars) — core library context
```

_Source: [How I Organized My CLAUDE.md in a Monorepo](https://dev.to/anvodev/how-i-organized-my-claudemd-in-a-monorepo-with-too-many-contexts-37k7)_

**Strengths:**
- Zero ceremony — create a file, start using it immediately
- Native integration with Claude Code's loading hierarchy
- Skills system provides on-demand context without front-loading tokens
- Community-tested patterns and extensive best-practice documentation
- Version-controlled alongside code

**Weaknesses:**
- Manual maintenance burden — no workflow to keep it current
- Drift risk — rules go stale as code evolves, creating "two sources of truth"
- No cross-session learning — same mistakes can recur in new conversations
- Flat structure doesn't express relationships between architectural decisions
- Recent ETH Zurich research found **auto-generated** context files (via `/init`) reduced task success by 2-3% while increasing costs by 20%

_Source: [Addy Osmani - Stop Using /init for AGENTS.md](https://addyosmani.com/blog/agents-md/), [XDA - Stop using CLAUDE.md](https://www.xda-developers.com/claude-md-helping-your-projects-is-myth/)_

### Approach 2: BMAD project-context.md (Structured Artifacts)

**Architecture:**
BMAD (Breakthrough Method for Agile AI-Driven Development) takes a fundamentally different approach. Instead of a single configuration file, it creates a **constellation of living artifacts** maintained through structured workflows:

- **`project-context.md`** — The "constitution" for coding rules, conventions, and patterns. Auto-loaded by every implementation workflow.
- **`architecture.md`** — Solution design, technology decisions, component relationships. Consumed by the architect agent and fed forward to implementation.
- **PRD, Epic plans, Story specs** — Cascading documents that feed context forward through the development lifecycle.
- **Workflow-driven maintenance** — Specialized agents (Analyst, PM, Architect, Dev, QA) create and update artifacts through structured workflows.

**Key Design Principles:**
- **Separation of concerns**: Coding rules (project-context.md) are separated from setup/ops (CLAUDE.md), architecture decisions (architecture.md), and requirements (PRD).
- **Workflow-driven updates**: The architect workflow generates/updates project-context.md after design decisions. Retrospective workflows capture learnings. It's not manual — the workflow prompts for it.
- **LLM-optimized format**: Focus on the "unobvious" — patterns agents would miss. Keep it lean because every implementation workflow loads it.
- **Forward-feeding context**: Each phase's documents (PRD → architecture → stories → implementation) feed into the next, ensuring decisions propagate.

_Source: [BMAD Method - Project Context](https://docs.bmad-method.org/explanation/project-context/), [BMAD Method - Workflow Map](https://docs.bmad-method.org/reference/workflow-map/)_

**Strengths:**
- Structured lifecycle prevents context drift — workflows trigger updates
- Separation of concerns keeps each file focused and lean
- Multi-agent consistency — all agents share the same "constitution"
- Forward-feeding context chain preserves architectural intent through implementation
- Built-in adversarial review catches inconsistencies between artifacts
- Institutional knowledge that survives team changes

**Weaknesses:**
- Significant setup overhead and learning curve
- Prescriptive workflow can feel inflexible for exploratory work
- PRDs and architecture files alone can exceed tens of thousands of tokens
- Assumes a level of project complexity that not all projects have
- Requires context window capacity to load multiple artifacts simultaneously
- The framework itself is the product of one methodology — it bakes in Agile/Scrum assumptions

_Source: [You should BMAD — Part 2 (Critical Analysis)](https://adsantos.medium.com/you-should-bmad-part-2-a007d28a084b), [BMAD Structural Gaps Issue #2003](https://github.com/bmad-code-org/BMAD-METHOD/issues/2003)_

### The "Context Rot" Problem: Why This Matters

Research from Morphllm and others has documented that **more tokens actively makes agents worse** — a phenomenon called "context rot":

- Models hit a performance ceiling around 1M tokens, with meaningful degradation past that point
- Stanford/UC Berkeley research found correctness drops around 32K tokens due to "lost-in-the-middle" effects
- Softmax normalization means each token's attention weight shrinks as context grows — the signal doesn't get louder, the noise floor rises
- At 70% context utilization, Claude starts losing precision; at 85%, hallucinations increase

This finding is **critical** for both approaches: whether you're loading a bloated CLAUDE.md or BMAD's full artifact chain, the penalty for excess context is real and measurable.

_Source: [Context Engineering: Why More Tokens Makes Agents Worse](https://www.morphllm.com/context-engineering), [Context Rot: Why LLMs Degrade as Context Grows](https://www.morphllm.com/context-rot)_

### The Addy Osmani "Routing Layer" Model

Google's Addy Osmani has articulated a middle-ground architecture that's gaining significant community traction:

1. **Layer 1: Minimal Protocol File** — Available personas, skills, MCP connections, and genuinely non-discoverable repo facts. Nothing the agent can figure out from code.
2. **Layer 2: Focused Persona/Skill Files** — Task-specific context loaded selectively. UX work gets different context than backend debugging.
3. **Layer 3: Maintenance Sub-agent** — Automatically keeps documentation current as the codebase evolves.

The key insight: **Treat AGENTS.md as a living list of codebase smells you haven't fixed yet.** Every line is a signal that something in your codebase is confusing enough to trip an AI agent — which means it probably trips human contributors too. The better response is to fix the root cause rather than adding another instruction.

_Source: [Addy Osmani - Stop Using /init for AGENTS.md](https://addyosmani.com/blog/agents-md/), [Addy Osmani - My LLM Coding Workflow Going into 2026](https://addyosmani.com/blog/ai-coding-workflow/)_

### Academic Evidence: Codified Context Infrastructure

A February 2026 paper from arXiv presents a **three-component codified context infrastructure** developed during construction of a 108,000-line C# distributed system:

1. **Hot-memory constitution** — Encoding conventions, retrieval hooks, and orchestration protocols (analogous to CLAUDE.md + project-context.md combined)
2. **19 specialized domain-expert agents** — Each with scoped context (analogous to BMAD's agent roles)
3. **Cold-memory knowledge base** — 34 on-demand specification documents (analogous to Skills or BMAD's artifact chain)

Quantitative metrics across **283 development sessions** showed that codified context propagates across sessions to prevent failures and maintain consistency.

_Source: [Codified Context: Infrastructure for AI Agents in a Complex Codebase (arXiv:2602.20478)](https://arxiv.org/abs/2602.20478)_

### The Spec-Driven Development Movement

By early 2026, spec-driven development has become a major movement, with GitHub launching **Spec Kit** (72,000+ stars) and AWS building **Kiro** around the concept. The key distinction:

- **Living-spec platforms** (like BMAD) keep documentation synchronized with code as agents work
- **Static-spec tools** structure requirements upfront but require manual reconciliation when implementation diverges
- **Rules files** (CLAUDE.md, .cursorrules) are the lowest-friction entry point but lack lifecycle management

Martin Fowler's analysis notes that tools separate into these categories, with the choice depending on project complexity and team size.

_Source: [Martin Fowler - Understanding Spec-Driven Development](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html), [Spec-Driven Development Is Eating Software Engineering](https://medium.com/@visrow/spec-driven-development-is-eating-software-engineering-a-map-of-30-agentic-coding-frameworks-6ac0b5e2b484)_

### Community Sentiment and Adoption Trends

**Pro-CLAUDE.md camp:**
- Zero friction to start — ideal for solo devs and small teams
- Claude Code's hierarchical loading + Skills system addresses most scaling concerns
- Community resources are extensive (ClaudeLog, awesome-cursorrules, etc.)
- "Good enough" for 80% of projects — overhead of structured methods isn't justified

**Pro-BMAD camp:**
- Essential for multi-sprint projects where context must survive across many sessions
- The workflow-driven update model prevents the #1 failure mode of flat files: drift
- Multi-agent consistency is architecturally enforced, not manually maintained
- Institutional knowledge compounds — retrospectives feed forward to future work

**Emerging consensus (Osmani/Fowler):**
- Start minimal — **both approaches fail when bloated**
- Only include what agents **genuinely cannot discover** from code
- Use a routing/loading strategy — not everything needs to be in context simultaneously
- Fix the codebase rather than documenting workarounds
- Skills/on-demand loading is the scaling mechanism, not bigger files

_Source: [Anthropic - Effective Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents), [BMAD Comparisons](https://theonlymittal.medium.com/bmad-comparisons-expansion-packs-7961f6d9ddc0), [Martin Fowler - Context Engineering for Coding Agents](https://martinfowler.com/articles/exploring-gen-ai/context-engineering-coding-agents.html)_

---

## Integration Patterns Analysis

### Context Loading Mechanisms: How Each Approach Feeds the Agent

The fundamental architectural difference between CLAUDE.md and BMAD is **when and how** context enters the agent's working memory:

**CLAUDE.md Progressive Disclosure Model:**
```
Session Start
  ├─ CLAUDE.md (root) ─────────── Always loaded (~50-200 instructions)
  ├─ CLAUDE.md (parent dirs) ──── Always loaded (hierarchical)
  ├─ Skill descriptions ────────── Always loaded (~30-50 tokens each)
  ├─ MCP server definitions ───── Always loaded
  │
  │  [On-demand, as work progresses]
  ├─ CLAUDE.md (subdirs) ──────── Loaded when Claude accesses that directory
  ├─ Skill full content ────────── Loaded when skill is invoked
  └─ Tool results (grep, glob) ── Loaded per-query, cleared during compaction
```

**BMAD Workflow-Driven Model:**
```
Workflow Invocation
  ├─ project-context.md ────────── Auto-loaded by every implementation workflow
  ├─ Workflow step file ────────── Loaded for the specific workflow phase
  │
  │  [Phase-dependent artifact loading]
  ├─ architecture.md ──────────── Loaded by architect/dev workflows
  ├─ PRD ───────────────────────── Loaded by PM/architect workflows
  ├─ Story spec ────────────────── Loaded by dev/QA workflows
  └─ Retrospective findings ───── Loaded by sprint planning workflows
```

The key distinction: Claude Code's model is **spatially-driven** (context loads based on which files/directories you're working in), while BMAD's model is **workflow-driven** (context loads based on which development phase you're executing).

_Source: [Claude Code - How It Works](https://code.claude.com/docs/en/how-claude-code-works), [BMAD - Workflow Map](https://docs.bmad-method.org/reference/workflow-map/)_

### Multi-Agent Coordination Patterns

**Claude Code Sub-Agent Architecture:**
Claude Code's native sub-agent system provides context isolation through git worktrees — each sub-agent gets a clean context window and an isolated copy of the repository. The orchestrating agent receives condensed summaries (typically 1,000-2,000 tokens) from each sub-agent, preventing context rot in the main conversation.

This pattern is called **Parallel Context Isolation (PCI)** in the community — a distributed systems approach where multiple Claude instances execute simultaneously on bounded tasks. The architecture addresses context rot by ensuring no single agent is overwhelmed with cross-cutting concerns.

**BMAD Multi-Agent Handoff:**
BMAD takes a fundamentally different approach: agents don't run simultaneously — they run **sequentially** with explicit artifact handoff. Each phase (Analyst → PM → Architect → Scrum Master → Dev → QA) produces versioned artifacts that persist in git. The handoff is explicit: "Project brief is complete. Save it as `docs/project-brief.md`, then create the PRD."

The orchestrator evaluates artifact quality before permitting handoff to the next agent, preventing the "cascade of failures" that occurs when incomplete artifacts propagate through the pipeline. Each phase runs in a **fresh chat** to avoid context limitations — the artifacts themselves carry the context, not the conversation history.

_Source: [BMAD - The Agile Framework That Makes AI Predictable](https://dev.to/extinctsion/bmad-the-agile-framework-that-makes-ai-actually-predictable-5fe7), [Multi-Agent Orchestration: BMAD, Claude Flow, and Gas Town](https://re-cinq.com/blog/multi-agent-orchestration-bmad-claude-flow-gastown), [Beyond the Single Prompt: Orchestrating PCI with Claude Code](https://dev.to/rsri/beyond-the-single-prompt-orchestrating-parallel-context-isolation-pci-with-claude-code-f58)_

### Session Persistence and Context Survival

A critical integration concern is how project knowledge survives across sessions:

| Mechanism | CLAUDE.md Approach | BMAD Approach |
|-----------|-------------------|---------------|
| **Cross-session persistence** | CLAUDE.md file (always reloaded), auto-memory system | Artifact files in `_bmad-output/` (always reloaded by workflows) |
| **In-session compaction** | Auto-compact at ~80% context; clears old tool results first, then summarizes conversation | Fresh chat per phase; artifacts carry context, not conversation history |
| **Knowledge accumulation** | Manual CLAUDE.md updates + auto-memory entries | Workflow-driven: retrospectives → project-context.md updates |
| **Architectural decisions** | Stored in CLAUDE.md or referenced files | Stored in architecture.md, propagated to project-context.md |
| **Session recovery** | CLAUDE.md reloaded; /compact summary lost | Artifact chain provides full recovery from any phase |

The BMAD approach has a structural advantage for **long-running projects**: because each phase's output is a file, not conversation history, there is no information loss during context compaction. The CLAUDE.md approach relies on the user to manually update the file with learnings, creating a maintenance burden that often goes unfulfilled.

However, Claude Code's **auto-memory system** (the `~/.claude/projects/` memory files loaded in this conversation) partially bridges this gap by automatically persisting user preferences, feedback, and project knowledge across sessions without manual CLAUDE.md updates.

_Source: [Claude Code - Compaction](https://platform.claude.com/docs/en/build-with-claude/compaction), [How Claude Code Got Better by Protecting More Context](https://hyperdev.matsuoka.com/p/how-claude-code-got-better-by-protecting)_

### Hooks, Automation, and Deterministic Enforcement

**Claude Code Hooks:**
Hooks are shell commands that fire automatically on specific events (18 hook events, 4 hook types). They enable **deterministic enforcement** — rules the model cannot ignore, regardless of context or instruction-following quality:

- `PreToolUse`: Block or modify tool calls before execution (e.g., prevent writes to protected files)
- `PostToolUse`: Validate results after tool execution (e.g., run linters after edits)
- `Stop`: Execute actions when Claude finishes (e.g., run tests, format code)

This is architecturally significant: hooks move enforcement **out of the LLM's context** and into deterministic code. The instruction "always run tests" in CLAUDE.md might be ignored; a `Stop` hook that runs `pnpm test` cannot be.

**BMAD Workflow Enforcement:**
BMAD achieves similar deterministic enforcement through its workflow step files and checklists. Each step has explicit success metrics, failure modes, and mandatory execution rules (e.g., "NEVER generate content without user confirmation"). The adversarial review workflow provides quality gates between phases.

However, BMAD's enforcement is still ultimately within the LLM context — it relies on the model following the workflow instructions. There is no external deterministic mechanism equivalent to Claude Code's hooks.

_Source: [Claude Code - Hooks Guide](https://code.claude.com/docs/en/hooks-guide), [Claude Code to AI OS Blueprint](https://dev.to/jan_lucasandmann_bb9257c/claude-code-to-ai-os-blueprint-skills-hooks-agents-mcp-setup-in-2026-46gg)_

### Cross-Tool Portability

**The Convergence Problem:**
Cursor, Claude Code, Copilot, and Windsurf each invented their own configuration formats before any cross-tool standard existed — four different file paths, three different JSON schemas, two different concepts of what a "skill" even is.

**Emerging Solutions:**
- **AGENTS.md** is converging as the cross-tool standard for persistent project context
- Claude Code's Skills follow the **Agent Skills open standard**, which works across multiple tools
- Community tools like `skills-sync` and `ClaudeMDEditor` provide mechanical migration between formats
- The migration from `.cursorrules` to Claude Code is "mostly mechanical": sort content into declarative conventions (→ AGENTS.md, .cursor/rules/) and procedural how-tos (→ .claude/skills/)

**BMAD's Portability:**
BMAD integrates with 20+ AI tools through its installer (`npx bmad-method install`), generating tool-native configuration. The artifacts themselves (project-context.md, architecture.md) are plain markdown — inherently portable. But the workflow orchestration (slash commands, agent loading, step files) is deeply coupled to whichever IDE invokes it.

_Source: [Unifying AI Skills Across Cursor and Claude Code](https://yozhef.medium.com/unifying-ai-skills-across-cursor-and-claude-code-3c34c44eafd2), [BMAD IDE Integration](https://deepwiki.com/bmad-code-org/BMAD-METHOD/2.2-ide-integration), [How to Sync Your AI Coding Setup](https://aicourses.com/ai-for-developers/sync-ai-coding-setup-cursor-claude-code-copilot/)_

### MCP Server Integration

Claude Code's MCP (Model Context Protocol) server integration provides a significant architectural extension point that neither BMAD nor flat rule files can replicate:

- **Semantic code search**: MCP servers can index the codebase and return only relevant code slices, dramatically reducing context consumption for large repos
- **External tool integration**: Database queries, API calls, web search — all accessible through the same interface
- **Hook-MCP interplay**: Hooks can intercept MCP tool calls using the `mcp__<server>__<tool>` pattern, enabling deterministic validation of external tool usage

This represents a **fundamentally different context architecture** — instead of pre-loading knowledge into files, MCP servers provide **just-in-time retrieval** from any data source. For repositories exceeding grep's practical limits, MCP-based semantic search becomes essential.

BMAD currently has no equivalent to MCP — its context model is entirely file-based. However, because BMAD workflows are invoked within Claude Code (or Cursor), they can leverage MCP servers that the IDE has configured, inheriting the capability without needing its own integration.

_Source: [50+ Best MCP Servers for Claude Code](https://claudefa.st/blog/tools/mcp-extensions/best-addons), [Claude Code Setup Guide: MCP, Hooks, Skills](https://okhlopkov.com/claude-code-setup-mcp-hooks-skills-2026/)_

---

## Architectural Patterns and Design

### The Memory Architecture Lens

Both CLAUDE.md and BMAD can be understood through the lens of **AI agent memory architecture** — a field that has converged on four memory types:

| Memory Type | Definition | CLAUDE.md Implementation | BMAD Implementation |
|-------------|-----------|--------------------------|---------------------|
| **Working Memory** | Current context window | Conversation + loaded CLAUDE.md + active skill | Conversation + loaded workflow step + artifacts |
| **Procedural Memory** | How to behave — rules, decision logic | CLAUDE.md rules, Skills | project-context.md, workflow step files |
| **Semantic Memory** | Facts, knowledge, preferences | Auto-memory files (`~/.claude/projects/`) | Architecture.md, PRD, story specs |
| **Episodic Memory** | Past experiences, interaction history | Auto-memory (feedback type), git history | Retrospective findings, sprint status |

The critical architectural question is: **where does each memory type live relative to the context window?**

- **Hot memory** (always in context): CLAUDE.md rules, project-context.md
- **Warm memory** (loaded on demand): Skills, architecture.md, story specs
- **Cold memory** (external, requires retrieval): MCP servers, git history, documentation files

Both approaches face the same fundamental constraint: the context window is finite, and **attention quality degrades with size**. The architectural choice is about what gets hot vs. warm vs. cold placement.

_Source: [IBM - What Is AI Agent Memory?](https://www.ibm.com/think/topics/ai-agent-memory), [3 Decisions That Shape Every Agent's Context Architecture](https://blog.getzep.com/three-decisions-that-shape-every-agents-context-architecture/), [Beyond Short-term Memory: 3 Types of Long-term Memory AI Agents Need](https://machinelearningmastery.com/beyond-short-term-memory-the-3-types-of-long-term-memory-ai-agents-need/)_

### Architecture Pattern 1: The Flat File with Progressive Disclosure

**Pattern:** A single entry-point file (CLAUDE.md) contains high-signal rules that always load, with Skills and hierarchical sub-files providing on-demand depth.

```
┌─────────────────────────────────────────────┐
│  HOT (always loaded)                        │
│  ├── CLAUDE.md root (~150-200 instructions) │
│  ├── CLAUDE.md parent dirs                  │
│  └── Skill descriptions (~30-50 tok each)   │
│                                             │
│  WARM (loaded on demand)                    │
│  ├── CLAUDE.md subdirectories               │
│  ├── Skill full content                     │
│  └── Referenced doc files                   │
│                                             │
│  COLD (retrieved via tools)                 │
│  ├── grep/glob results                      │
│  ├── MCP server queries                     │
│  └── git history                            │
└─────────────────────────────────────────────┘
```

**Design Trade-offs:**

- **Simplicity** — One concept (markdown file) with one loading rule (nearest directory wins)
- **Token efficiency** — Only ~50-200 instructions always loaded; everything else is JIT
- **Maintenance risk** — No workflow triggers updates; relies on developer discipline
- **Failure mode** — Drift between CLAUDE.md rules and actual codebase state creates "pink elephant problem" (Osmani) where agents anchor on stale instructions

**When this pattern excels:**
- Solo developer or small team
- Single-service or small monorepo
- Exploratory/rapidly changing projects where formal specs would be instantly outdated
- When MCP servers provide the semantic retrieval layer

_Source: [Best Practices for Claude Code](https://code.claude.com/docs/en/best-practices), [Addy Osmani - Stop Using /init](https://addyosmani.com/blog/agents-md/)_

### Architecture Pattern 2: The Workflow-Driven Artifact Chain

**Pattern:** Multiple specialized documents maintained by workflow steps, with a central constitution (project-context.md) auto-loaded by implementation workflows.

```
┌─────────────────────────────────────────────────┐
│  HOT (auto-loaded per workflow)                 │
│  ├── project-context.md (all impl workflows)    │
│  └── Current workflow step file                 │
│                                                 │
│  WARM (loaded by specific workflow phases)       │
│  ├── architecture.md (architect/dev workflows)  │
│  ├── PRD (PM/architect workflows)               │
│  ├── Story spec (dev/QA workflows)              │
│  └── Sprint plan (SM workflows)                 │
│                                                 │
│  COLD (referenced but not auto-loaded)           │
│  ├── Previous retrospectives                    │
│  ├── Research documents                         │
│  └── Planning artifacts                         │
└─────────────────────────────────────────────────┘
```

**Design Trade-offs:**

- **Lifecycle maintenance** — Workflows trigger document updates; drift is structurally reduced
- **Separation of concerns** — Each document has a clear owner (agent role) and update trigger
- **Context overhead** — Multiple artifacts can consume significant tokens when loaded together
- **Rigidity** — The workflow structure assumes a specific development methodology (Agile/Scrum)
- **Forward-feeding** — Architectural decisions propagate automatically through PRD → architecture → stories → implementation

**When this pattern excels:**
- Multi-sprint projects with evolving requirements
- Teams where multiple people (or agents) need consistent context
- Projects where architectural decisions must be traceable
- When the overhead of formal specs is justified by project complexity

_Source: [BMAD Method - Project Context](https://docs.bmad-method.org/explanation/project-context/), [BMAD: The Agile Framework That Makes AI Predictable](https://dev.to/extinctsion/bmad-the-agile-framework-that-makes-ai-actually-predictable-5fe7)_

### Architecture Pattern 3: The Hybrid (Codified Context Infrastructure)

**Pattern:** The arXiv paper "Codified Context" (Feb 2026) and Addy Osmani's "routing layer" model both point toward a hybrid that combines the best of both approaches:

```
┌──────────────────────────────────────────────────┐
│  HOT: Constitution / Protocol Layer              │
│  ├── Non-discoverable rules only                 │
│  ├── Available personas/skills/MCP (routing)     │
│  └── Critical gotchas and landmines              │
│  (~100-150 instructions, ruthlessly pruned)      │
│                                                  │
│  WARM: Domain Expert / Skill Layer               │
│  ├── Task-specific context (skills, specs)       │
│  ├── Architectural decisions (ADRs, arch.md)     │
│  └── Loaded selectively per task type            │
│                                                  │
│  COLD: Knowledge Base / Retrieval Layer          │
│  ├── On-demand spec documents                    │
│  ├── MCP semantic search                         │
│  ├── Git history / blame                         │
│  └── External documentation                      │
│                                                  │
│  META: Maintenance Layer                         │
│  ├── Hooks for deterministic enforcement         │
│  ├── Workflow-triggered document updates         │
│  └── Self-improving agent (Osmani Layer 3)       │
└──────────────────────────────────────────────────┘
```

This hybrid treats the hot layer as a **routing index** rather than a knowledge store — it tells the agent where to find things, not what the things are. The warm layer provides focused context loaded only when relevant. The cold layer uses tools (MCP, grep, git) for JIT retrieval. The meta layer handles maintenance through both deterministic mechanisms (hooks) and workflow-triggered updates.

_Source: [Codified Context: Infrastructure for AI Agents (arXiv:2602.20478)](https://arxiv.org/abs/2602.20478), [Addy Osmani - Stop Using /init](https://addyosmani.com/blog/agents-md/), [Anthropic - Effective Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)_

### Anti-Patterns and Failure Modes

Research and community experience have identified clear failure modes for both approaches:

**Universal Anti-Patterns (apply to both):**

| Anti-Pattern | Symptom | Root Cause |
|-------------|---------|------------|
| **Context bloat** | Instructions ignored after ~200 rules | Attention dilution; softmax spreads weight across too many tokens |
| **Discoverable redundancy** | Agent reads file, reads code, reconciles two sources of truth | Including information the agent can infer from code itself |
| **Stale instructions** | Agent follows outdated patterns | No update trigger when code evolves |
| **Priority inversion after compaction** | Agent reverts to base model behavior | Compaction preserves code context but drops operational instructions |

**CLAUDE.md-Specific Anti-Patterns:**

- **The /init trap**: Auto-generated files reduce task success by 2-3% and increase costs by 20% (ETH Zurich). The generated content duplicates what agents can discover.
- **The 47K-word monolith**: A single CLAUDE.md grows unbounded until warnings fire at 40K words. Solution: hierarchical split per service/package.
- **Pink elephant anchoring**: Mentioning a deprecated pattern in CLAUDE.md causes the agent to overweight it as current best practice.
- **Instruction-as-advisory**: After 2-5 prompts or compaction, Claude treats CLAUDE.md instructions as suggestions rather than mandatory process steps.

**BMAD-Specific Anti-Patterns:**

- **Ceremony for simple tasks**: Quick bug fixes don't need a PRD → architecture → story pipeline. BMAD's Quick Flow partially addresses this.
- **Token budget exhaustion**: Loading project-context.md + architecture.md + story spec can consume 10K+ tokens before the agent starts working, leaving less room for the actual code.
- **Methodology lock-in**: BMAD bakes in Agile/Scrum assumptions. Projects using other methodologies must fight the framework.
- **The competence assumption gap**: BMAD v6 assumes a level of technical competence that many users don't possess, leading to workflow confusion.

_Source: [Claude Code Issues #7777](https://github.com/anthropics/claude-code/issues/7777), [Context Window Degradation](https://docs.bswen.com/blog/2026-03-19-claude-context-window-degradation/), [You should BMAD — Part 2](https://adsantos.medium.com/you-should-bmad-part-2-a007d28a084b), [BMAD Structural Gaps #2003](https://github.com/bmad-code-org/BMAD-METHOD/issues/2003)_

### Decision Framework: When to Use What

Based on the research, the following decision matrix emerges:

| Factor | Use CLAUDE.md (Flat) | Use BMAD (Structured) | Use Hybrid |
|--------|---------------------|----------------------|------------|
| **Project duration** | Days to weeks | Months to quarters | Weeks to months |
| **Team size** | Solo or pair | 3+ contributors or multi-agent | 1-3 with occasional multi-agent |
| **Codebase complexity** | Single service, <50K LOC | Multi-service, >100K LOC | Moderate, growing |
| **Methodology flexibility** | Need to pivot frequently | Committed to structured sprints | Mix of structured and ad-hoc |
| **Context window** | Standard (200K) sufficient | Need careful token budgeting | 1M context available |
| **Maintenance discipline** | High (will manually update) | Prefer automated triggers | Want automation without ceremony |
| **Multi-session continuity** | Auto-memory sufficient | Need artifact-level traceability | Skills + selective artifacts |

**The TOON Protocol Case:**
Your project (TOON) currently uses a **practical hybrid**: CLAUDE.md as a lightweight pointer → project-context.md for all coding rules → BMAD workflows for structured development. This is architecturally sound because:
- CLAUDE.md stays lean (~deployment/ops only)
- project-context.md carries the heavy coding rules (owned by architect workflow)
- BMAD workflows trigger updates when architecture evolves
- Skills provide on-demand procedural knowledge

The primary risk is that project-context.md becomes a "second monolith" — the same bloat problem as a large CLAUDE.md, just in a different file. The mitigation is the same: keep it focused on the unobvious, and let agents discover the rest.

### Architecture Decision Records for Context Management

An emerging best practice is treating context management decisions as **Architecture Decision Records (ADRs)**:

- **ADR-001**: "We use CLAUDE.md as a routing index, not a knowledge store" — *Why: prevents bloat, agents discover code-derivable facts themselves*
- **ADR-002**: "project-context.md documents only non-obvious patterns" — *Why: reduces token overhead, prevents discoverable redundancy*
- **ADR-003**: "Skills handle procedural knowledge, CLAUDE.md handles declarative rules" — *Why: on-demand loading prevents context rot*
- **ADR-004**: "Hooks enforce critical rules deterministically" — *Why: instruction-following degrades under context pressure; hooks cannot be ignored*

This approach makes the context architecture itself a first-class architectural concern, subject to the same rigor as API design or database schema decisions.

_Source: [AI Generated Architecture Decision Records](https://adolfi.dev/blog/ai-generated-adr/), [Google Cloud - Choose Design Pattern for Agentic AI](https://docs.google.com/architecture/choose-design-pattern-agentic-ai-system), [Codified Context (arXiv:2602.20478)](https://arxiv.org/abs/2602.20478)_

---

## Implementation Approaches and Technology Adoption

### Getting Started: Setup Time and Learning Curve

| Dimension | CLAUDE.md (Flat) | BMAD (Structured) |
|-----------|-----------------|-------------------|
| **Time to first use** | 5 minutes (create file, add rules) | 30 minutes (install, configure, learn basics) |
| **Time to proficiency** | 1-2 days | ~2 months for advanced techniques |
| **First project overhead** | Near zero | ~3 hours for first project |
| **Concepts to learn** | 3 (CLAUDE.md, Skills, Hooks) | 6-7 agent personas, YAML config, workflow steps, artifact handoffs |
| **Tooling required** | Claude Code (or any IDE) | Claude Code/Cursor + BMAD installer |

**CLAUDE.md Quick Start:**
1. Run `/init` to generate a starter file (or better: write manually per Osmani's advice)
2. Add bash commands, code style, and architectural pointers
3. Prune ruthlessly — ask "Would removing this cause mistakes?"
4. Add Skills in `.claude/skills/` for procedural knowledge
5. Add Hooks in `settings.json` for deterministic enforcement

**BMAD Quick Start:**
1. Run `npx bmad-method install` and select IDE targets
2. Complete the configuration wizard (project name, output folder, skill level)
3. Start with the Quick Flow for simpler tasks (skips full PRD/architecture cycle)
4. Use standard templates for at least 3 projects before customizing
5. Graduate to full workflow (Analyst → PM → Architect → Dev → QA) for complex projects

_Source: [BMAD Getting Started](https://docs.bmad-method.org/tutorials/getting-started/), [Claude Code Best Practices](https://code.claude.com/docs/en/best-practices), [BMAD Practical Guide](https://www.vibesparking.com/en/blog/ai/bmad-method/2026-01-14-bmad-method-getting-started-guide/)_

### Token Economics and Cost Optimization

Context management choices have direct cost implications. With every token costing money on every LLM call, the approach to loading project knowledge materially affects both cost and quality.

**The 80% Waste Problem:**
Research shows AI coding agents waste ~80% of their tokens on orientation — finding things, understanding structure, re-reading context — rather than solving the actual problem. Progressive disclosure (Skills) and on-demand loading can achieve **70% token reduction** and **5x response speed improvement**.

**Cost Comparison by Approach:**

| Approach | Hot Context (always loaded) | Per-Task Overhead | Cost Profile |
|----------|---------------------------|-------------------|--------------|
| **Minimal CLAUDE.md** (~100 lines) | ~500-1,000 tokens | Low (grep/glob on demand) | Lowest baseline |
| **Bloated CLAUDE.md** (>200 lines) | 2,000-5,000 tokens | Medium (redundant re-reading) | +20% per ETH Zurich |
| **BMAD project-context.md** | ~1,000-3,000 tokens | Medium-High (artifact loading) | Higher baseline, lower per-task waste |
| **Hybrid (routing + Skills)** | ~300-500 tokens (routing only) | Variable (on-demand) | Optimal when well-tuned |

**Key Optimization Strategies (applicable to both):**
- **Semantic caching**: Cached tokens are 75% cheaper (Anthropic prompt caching)
- **Model routing**: Use Haiku/Sonnet for routine tasks, Opus for complex architectural decisions
- **Progressive disclosure**: Discovery → Activation → Execution tiers
- **Context budgeting**: Set per-request, per-task, and per-day limits

_Source: [AI Agent Cost Optimization Guide 2026](https://moltbook-ai.com/posts/ai-agent-cost-optimization-2026), [AGENTS.md Token Optimization Guide](https://smartscope.blog/en/generative-ai/claude/agents-md-token-optimization-guide-2026/), [Context Compression to Reduce LLM Costs](https://medium.com/@jakenesler/context-compression-to-reduce-llm-costs-and-frequency-of-hitting-limits-e11d43a26589)_

### Team Collaboration and Scaling

**CLAUDE.md Team Workflow:**
CLAUDE.md files committed to version control create a **shared development experience** — all team members and Claude Code instances load the same project rules. Agent Teams (Claude Code's multi-agent feature) inherit CLAUDE.md, MCP servers, and Skills automatically. The cascaded CLAUDE.md system (root → package → feature-level) scales naturally with team growth.

Best practice: 3 agents is the sweet spot for most tasks; beyond 5 agents, coordination overhead exceeds speed gains.

**BMAD Team Workflow:**
BMAD's artifact chain provides **institutional knowledge** that survives team changes. New team members (human or AI) can read the PRD, architecture doc, and project-context.md to get full project context without verbal handoff. The Scrum Master agent tracks sprint status, and retrospectives feed lessons forward.

However, BMAD's sequential agent model means only one "developer" works at a time in each workflow instance. Parallel development requires separate story branches with separate BMAD invocations — the framework doesn't natively coordinate multiple simultaneous dev agents the way Claude Code's Agent Teams do.

_Source: [Claude Code Agent Teams](https://code.claude.com/docs/en/agent-teams), [30 Tips for Claude Code Agent Teams](https://getpushtoprod.substack.com/p/30-tips-for-claude-code-agent-teams)_

### Testing and Quality Assurance for Context Files

An often-overlooked implementation concern: **how do you validate that your context management is working?**

**For CLAUDE.md:**
- Run `/context` to see what's consuming space
- Monitor instruction-following compliance across sessions
- Track compaction frequency — frequent auto-compaction signals bloat
- Use hooks to enforce critical rules deterministically (don't rely on CLAUDE.md for must-not-violate constraints)
- Periodically audit: "Is this line still true? Can Claude discover this from code?"

**For BMAD:**
- Adversarial review workflow validates artifact consistency
- Retrospective workflow assesses what went right/wrong
- Sprint status workflow surfaces risks
- The `bmad-check-implementation-readiness` workflow validates PRD, UX, Architecture, and Epic specs are complete before dev starts

**For Both:**
- Measure: task completion rate, rework rate, hallucination frequency
- Compare: sessions with full context loaded vs. minimal context
- Track: token usage per task over time (is it growing or stabilizing?)

_Source: [BMAD Method - Adversarial Review](https://docs.bmad-method.org/explanation/adversarial-review/), [Claude Code - Context Management Guide](https://supatest.ai/blog/claude-context-management-guide)_

### Risk Assessment and Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **CLAUDE.md becomes stale** | High | Medium | Periodic audit cadence; auto-memory captures corrections; hooks enforce critical rules |
| **BMAD artifacts diverge from code** | Medium | High | Retrospective workflow; project-context.md regeneration after architecture changes |
| **Context rot in long sessions** | High | High | Compact early and often; use sub-agents for isolated tasks; persist decisions in files, not conversation |
| **Instruction-following degradation** | Medium | High | Move must-not-violate rules to hooks; keep CLAUDE.md under 150 instructions |
| **Cross-tool lock-in** | Medium | Medium | Use AGENTS.md for portable context; Agent Skills open standard; keep artifacts in plain markdown |
| **Over-engineering context** | Medium | Medium | Start minimal, add only what causes mistakes when absent; Osmani's "codebase smell" test |

## Technical Research Recommendations

### Implementation Roadmap

**For teams currently using only CLAUDE.md:**

1. **Audit existing CLAUDE.md** — Remove anything discoverable from code. Target <150 instructions.
2. **Extract procedural knowledge to Skills** — Migration, deployment, testing workflows → `.claude/skills/`
3. **Add Hooks for critical rules** — Formatting, linting, test execution → deterministic enforcement
4. **Split monolith in monorepos** — Package-level CLAUDE.md files for context isolation
5. **Consider BMAD** only when: multi-sprint projects, team >2, or architectural traceability needed

**For teams adopting BMAD:**

1. **Start with Quick Flow** — Skip full lifecycle for first 2-3 small features
2. **Use standard templates** for at least 3 projects before customizing
3. **Keep project-context.md lean** — Same "unobvious only" rule as CLAUDE.md
4. **Leverage CLAUDE.md as the routing layer** — Let CLAUDE.md point to BMAD artifacts, not duplicate them
5. **Graduate to full workflow** when project complexity demands traceability

**For the optimal hybrid (recommended for TOON-class projects):**

1. **CLAUDE.md** = Lightweight routing index (setup, deployment, troubleshooting, pointers)
2. **project-context.md** = Coding constitution (conventions, patterns, gotchas)
3. **Skills** = Procedural knowledge (workflows, research, story creation)
4. **Hooks** = Deterministic enforcement (linting, testing, format checks)
5. **MCP servers** = Just-in-time retrieval (semantic search, external APIs)
6. **BMAD workflows** = Lifecycle management (PRD → arch → stories → dev → QA)

### Success Metrics and KPIs

| Metric | Target | How to Measure |
|--------|--------|---------------|
| **Task completion rate** | >90% first attempt | Track rework/retry frequency |
| **Token efficiency** | <30% on orientation | Compare context usage vs. active work |
| **Context staleness** | 0 stale instructions | Monthly audit of CLAUDE.md / project-context.md |
| **Instruction compliance** | >95% | Sample check: does output match stated rules? |
| **Cross-session continuity** | No repeated mistakes | Monitor auto-memory growth and feedback patterns |
| **Compaction frequency** | <2x per session | Track via `/context` monitoring |

_Source: [State of Context Engineering in 2026](https://www.newsletter.swirlai.com/p/state-of-context-engineering-in-2026), [Faros - Context Engineering for Developers](https://www.faros.ai/blog/context-engineering-for-developers)_
