# Deep Research Prompt: Optimal Frontend Design Skill & Workflow for Claude-Built UI

## Research Objective

Investigate and recommend the **best frontend design methodology, framework choices, and project structuring approach** that maximizes Claude Code's (and Claude AI's) effectiveness at building production-quality frontend interfaces. The target application is the Crosstown **Social Graph Observatory** — a real-time Nostr social graph visualization with trust scores, ILP zap flows, DVM marketplace, and community features (see Background Context). The research should determine: which frontend frameworks, component libraries, design systems, and development patterns allow Claude to produce the highest-quality UI code with the fewest iterations.

## Background Context

### The Application Being Built

Crosstown needs a **standalone web app** (see `docs/research/human-ui-deep-research-report.md`) with these visualization requirements:

1. **Social Graph Observatory** — Force-directed graph visualization with interactive nodes (agents) and edges (trust/payment relationships). Nodes encode 7-component trust scores via size, color, glow. Edges animate with payment particles.
2. **Activity Feed** — Real-time Nostr event stream filtered to agent social/financial activity
3. **Trust Breakdown Panels** — Progressive disclosure from at-a-glance colored ring → dimensional breakdown (Social Trust vs Earned Trust) → 30-day time-series deep dive
4. **ILP Zap Flow Animation** — 4-step visualization: request → in-flight → receipt with proof → trust update ripple
5. **DVM Marketplace** — Browse/commission agent computation services (NIP-90)
6. **Community Views** — NIP-72 communities with payment-gated membership (NIP-29)
7. **Curator Panel** — Edit NIP-51 route preferences, mute lists, trust weight configuration

### Previous Research Recommendations (Already Decided)

From `docs/research/human-ui-deep-research-report.md`:
- **UI Paradigm:** Social Graph Observatory (primary) with Nostr-Native Agent Client elements
- **Interactivity Level:** Curator-Participant Hybrid
- **Auth:** NIP-46 primary, NIP-07 fallback
- **Graph Rendering:** cosmos.gl / Sigma.js + Graphology (tiered by scale)
- **Nostr Library:** NDK with ndk-svelte
- **Framework Suggestion:** SvelteKit 2.x (Svelte 5 runes)

### The Open Question

The previous research recommended SvelteKit based on technical merits (NDK-Svelte integration, compile-time reactivity, Coracle precedent). **However, the primary builder will be Claude Code (AI), not a human developer.** This changes the calculus significantly:

- Claude's training data distribution across frameworks is uneven
- Some component libraries have vastly more examples in training data than others
- Some design systems produce more deterministic, reproducible outputs when prompted
- Some frameworks have patterns that are more "promptable" (declarative, composable, well-documented)
- The quality of Claude's output depends heavily on how well it "knows" the ecosystem

**This research must determine whether SvelteKit remains the right choice when Claude is the builder, or whether a different stack would produce better results faster.**

---

## Research Questions

### Primary Questions (Must Answer)

1. **Which frontend frameworks does Claude produce the highest-quality code for?**
   - Compare: React (Next.js/Vite), Svelte (SvelteKit), Vue (Nuxt), Solid, Angular
   - Criteria: correctness, idiomatic usage, modern patterns, bug density, component composition quality
   - Consider: training data volume, documentation quality (Claude learns from docs), ecosystem maturity
   - Specific concern: Svelte 5 runes are relatively new (late 2024) — does Claude handle them well vs Svelte 4 stores? Does Claude confuse Svelte 4 and 5 patterns?
   - Specific concern: Does Claude handle SvelteKit's server/client boundary well (load functions, form actions, +page.server.ts)?

2. **Which UI component libraries produce the best results when Claude generates code?**
   - Compare: shadcn/ui (React), Radix UI, Tailwind UI, DaisyUI, Melt UI (Svelte), Skeleton UI (Svelte), Bits UI (Svelte), Material UI, Chakra UI, Ant Design
   - Criteria: consistency of Claude's output, correctness of accessibility attributes, visual polish, composability
   - Key insight needed: Does Claude produce better UI with copy-paste component libraries (shadcn/ui) vs import-based libraries? Why?
   - Does shadcn/ui's pattern of "own the component code" align better with Claude's code generation than opaque library imports?

3. **Which CSS/styling approach works best with Claude?**
   - Compare: Tailwind CSS (utility-first), CSS Modules, styled-components, vanilla CSS, UnoCSS
   - Criteria: consistency, responsive design quality, dark mode handling, design token adherence
   - Does Claude produce more visually consistent output with Tailwind (constrained utility classes) vs free-form CSS?
   - How well does Claude handle Tailwind v4 (CSS-first config) vs Tailwind v3?

4. **What project structure and patterns maximize Claude's effectiveness?**
   - Component granularity: Does Claude perform better with many small components or fewer larger ones?
   - File organization: Feature-based folders vs type-based folders vs flat structure?
   - State management: What patterns does Claude handle most reliably? (Stores, Context, Zustand, Jotai, signals)
   - Type safety: Does providing strict TypeScript interfaces improve Claude's output quality?
   - Design tokens: Does a well-defined design token system (CSS variables, Tailwind config) help Claude maintain visual consistency?
   - Pattern files: Does providing example components ("this is how we build cards in this project") dramatically improve Claude's adherence to project conventions?

5. **How should the development workflow be structured for Claude-as-builder?**
   - Should the project use a design system with Storybook/Histoire for component development?
   - Should there be a "prompt playbook" — standardized prompts for common UI tasks?
   - How should visual QA work? (Screenshot comparison, Playwright visual tests, human review checkpoints)
   - Should Claude build components in isolation first (bottom-up) or build pages/layouts first (top-down)?
   - What role should design mockups play? (Figma exports, wireframes, reference screenshots, text descriptions)

6. **For the specific visualization requirements (WebGL graphs, real-time animations), what approach works best with Claude?**
   - Does Claude produce better WebGL/Canvas code with Three.js, Pixi.js, raw WebGL, or higher-level abstractions?
   - For graph visualization specifically: D3.js force simulation, Sigma.js, vis.js, Cytoscape.js, cosmos.gl — which does Claude handle best?
   - Can Claude effectively integrate GPU-accelerated graph rendering with a component framework, or should visualization be a separate concern?
   - Real-time animation: CSS transitions, GSAP, Framer Motion, Svelte transitions, Web Animations API — which produces the most reliable Claude output?

### Secondary Questions (Nice to Have)

7. **Does the "v0 by Vercel" or similar AI-first UI generation approach offer lessons?**
   - v0 uses shadcn/ui + React + Tailwind as its generation target — is this combination optimal for AI code generation generally?
   - Are there other AI-first frontend tools (Bolt.new, Lovable, Cursor-specific patterns) whose design choices reveal what works best for AI builders?
   - Should Crosstown adopt the same stack that AI-first tools have converged on, even if it's not the "best" stack technically?

8. **How do different frameworks handle the "AI iteration cycle"?**
   - When Claude needs to modify existing components, which frameworks produce the fewest regressions?
   - Does hot module replacement (HMR) quality matter for the Claude workflow?
   - Which frameworks have the best error messages that help Claude self-correct?

9. **What about hybrid approaches?**
   - Could the project use React (where Claude excels) for the main UI shell and a separate WebGL layer (Three.js/Sigma.js) for the graph visualization?
   - Is there value in using a React-based stack for "Claude-friendliness" while using NDK (without ndk-svelte) directly?
   - Could a Web Component approach allow mixing frameworks?

10. **How should Nostr-specific UI patterns be handled?**
    - NDK has first-class Svelte support but also works with React — is the React DX significantly worse?
    - Are there React-based Nostr client libraries/components that rival ndk-svelte?
    - How well does Claude handle NDK's reactive subscription model in different frameworks?

---

## Research Methodology

### Information Sources

- **AI code generation benchmarks**: Studies comparing AI-generated code quality across frameworks (SWE-bench, HumanEval adaptations for frontend)
- **AI-first builder documentation**: v0.dev, Bolt.new, Lovable, Cursor — their stack choices and rationale
- **Claude-specific**: Anthropic's documentation on Claude's coding capabilities, Claude Code best practices, community reports on Claude's framework preferences
- **Frontend framework ecosystem**: npm download statistics, GitHub stars (as proxy for training data volume), documentation quality assessments
- **Component library comparisons**: Accessibility audit results, design consistency metrics, community size
- **Real-time visualization**: Performance benchmarks for graph libraries at various scales, WebGL framework comparisons
- **Developer experience research**: Framework learning curves, error message quality, debugging experience
- **Nostr development**: NDK documentation, Nostr client source code (Coracle/Svelte, Snort/React, Amethyst/Kotlin), NIP implementation patterns

### Analysis Frameworks

- **AI Code Quality Matrix**: Rate each framework combination on: Claude output correctness, idiomatic quality, visual consistency, iteration speed, self-correction ability
- **Training Data Density**: Estimate relative representation of each framework in Claude's training data (using npm downloads, GitHub repos, Stack Overflow questions, tutorial volume as proxies)
- **Promptability Score**: Rate how well each framework's patterns translate to natural language instructions (declarative > imperative, composable > monolithic, convention > configuration)
- **Technical Fit**: Rate each option against Crosstown's specific requirements (real-time events, WebGL graphs, Nostr integration, progressive disclosure)
- **Risk Assessment**: For each recommendation, assess: maturity risk, ecosystem risk, "Claude drift" risk (Claude generating outdated patterns), lock-in risk

---

## Expected Deliverables

### Executive Summary

- **Clear recommendation**: The specific framework + component library + styling + visualization stack optimized for Claude-as-builder
- **Decision matrix**: Side-by-side comparison of top 3 stack options rated on Claude-friendliness and technical fit
- **Key trade-offs**: What you gain and lose by optimizing for AI-buildability vs pure technical merit
- **Migration assessment**: If the recommendation differs from the previous SvelteKit recommendation, assess the cost/benefit of changing direction

### Detailed Analysis

**Section 1: Framework Comparison for AI Code Generation**
- Detailed comparison of React, Svelte, Vue, Solid for Claude-generated code quality
- Evidence-based assessment of Claude's framework knowledge depth
- Specific examples of where Claude excels or struggles with each framework
- Svelte 5 runes assessment: ready for Claude or too new?

**Section 2: Component Library & Design System Evaluation**
- Comparison matrix of component libraries rated for AI code generation
- Analysis of why shadcn/ui has become the de facto AI generation target
- Recommendations for Crosstown's specific component needs (graph panels, data tables, forms, modals)
- Design token strategy for maintaining visual consistency across Claude-generated components

**Section 3: Visualization Stack for AI-Assisted Development**
- Graph visualization library comparison specifically for Claude's capability to generate and modify graph code
- Animation library comparison for real-time payment flow visualization
- Integration patterns between visualization layer and UI framework
- Performance considerations at Crosstown's expected scale (100-10,000 agent nodes)

**Section 4: Project Structure & Development Workflow**
- Recommended file/folder structure optimized for Claude's code generation
- Component development methodology (isolation vs integration, bottom-up vs top-down)
- Type definitions and interface contracts that improve Claude's output
- Example "pattern files" approach — how reference implementations guide Claude
- QA and review workflow for AI-generated frontend code

**Section 5: Nostr Integration Approach**
- NDK usage patterns in the recommended framework
- Event subscription management for real-time UI updates
- Authentication flow implementation (NIP-07/NIP-46)
- How the recommended stack handles Crosstown's custom event kinds

**Section 6: Risk Mitigation**
- How to handle Claude generating outdated framework patterns
- Strategy for keeping Claude aligned with project conventions as codebase grows
- Fallback plan if primary recommendation doesn't work as expected
- Human developer onboarding considerations (the project may have human contributors too)

### Supporting Materials

- Comparison matrices with weighted scoring
- Example component code in top 2-3 recommended stacks (same component, different implementations)
- Recommended project scaffold/boilerplate structure
- Prompt templates for common frontend development tasks with Claude

---

## Success Criteria

1. Produces a **definitive stack recommendation** with clear rationale — not "it depends"
2. Addresses the **Svelte 5 question directly** — is it ready for Claude or should the project use React despite the NDK-Svelte advantage?
3. Provides **evidence-based assessment** of Claude's framework capabilities, not just general impressions
4. Considers **Crosstown's specific requirements** (real-time Nostr events, WebGL graph viz, trust visualization) — not just generic frontend advice
5. Includes **actionable project structure** recommendations that a developer (or Claude) could scaffold immediately
6. Accounts for the **full Epic 9-14 roadmap** — the stack must handle current needs AND scale to marketplace, messaging, and swarm views
7. Addresses the **hybrid possibility** — can you mix frameworks to get the best of both worlds?
8. Provides enough specificity that Claude Code could begin building the project from this recommendation

---

## Execution Guidance

This prompt is designed for deep research using AI with web search capabilities (Claude with web search, Perplexity Pro, ChatGPT Deep Research, Gemini Deep Research). Key search directions:

- "Claude AI code generation React vs Svelte vs Vue quality comparison 2025 2026"
- "v0 Vercel why shadcn/ui React Tailwind AI code generation"
- "Bolt.new Lovable Cursor frontend framework choice AI builder"
- "Svelte 5 runes AI code generation LLM"
- "shadcn/ui AI code generation best practices"
- "best frontend framework for AI assisted development 2025 2026"
- "Claude Code frontend development workflow best practices"
- "graph visualization library comparison D3 Sigma.js Cytoscape cosmos WebGL 2025 2026"
- "NDK Nostr React integration vs Svelte"
- "real-time WebSocket visualization React performance"
- "AI generated UI component quality comparison"
- "frontend project structure AI code generation"
- "Storybook component development AI workflow"
- "Tailwind CSS v4 AI code generation"
- "progressive disclosure UI implementation patterns"
- "force-directed graph React vs Svelte rendering performance"
- "SWE-bench frontend code generation benchmarks"
- "LLM code generation training data bias frameworks"
