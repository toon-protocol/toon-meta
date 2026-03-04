---
stepsCompleted: [1, 2]
inputDocuments: []
workflowType: 'research'
lastStep: 1
research_type: 'technical'
research_topic: 'Node.js/TypeScript alternatives to Forgejo for self-hosted Git'
research_goals: 'Identify strong Node.js/TypeScript self-hosted Git hosting solutions that could replace Forgejo in the Crosstown stack'
user_name: 'Jonathan'
date: '2026-03-03'
web_research_enabled: true
source_verification: true
---

# Research Report: technical

**Date:** 2026-03-03
**Author:** Jonathan
**Research Type:** technical

---

## Research Overview

[Research overview and methodology will be appended here]

---

## Technical Research Scope Confirmation

**Research Topic:** Node.js/TypeScript alternatives to Forgejo for self-hosted Git
**Research Goals:** Identify strong Node.js/TypeScript self-hosted Git hosting solutions that could replace Forgejo in the Crosstown stack

**Technical Research Scope:**

- Architecture Analysis - design patterns, frameworks, system architecture
- Implementation Approaches - development methodologies, coding patterns
- Technology Stack - languages, frameworks, tools, platforms
- Integration Patterns - APIs, protocols, interoperability
- Performance Considerations - scalability, optimization, patterns

**Research Methodology:**

- Current web data with rigorous source verification
- Multi-source validation for critical technical claims
- Confidence level framework for uncertain information
- Comprehensive technical coverage with architecture-specific insights

**Scope Confirmed:** 2026-03-03

## Technology Stack Analysis

### The Landscape: No Full-Featured Node.js/TypeScript Git Forge Exists

The most significant finding from this research is that **no production-grade, full-featured Git forge (comparable to Forgejo/Gitea/GitLab) exists in the Node.js/TypeScript ecosystem**. All major self-hosted Git platforms are written in Go (Forgejo, Gitea, Gogs), Java (OneDev), Ruby (GitLab), or Python (Klaus). This gap represents both a limitation and an opportunity.

_Confidence: HIGH - verified across multiple sources including [AlternativeTo](https://alternativeto.net/software/gitea/?platform=self-hosted), [Forgejo comparison](https://forgejo.org/compare/), and [nixCraft](https://www.cyberciti.biz/open-source/github-alternatives-open-source-seflt-hosted/)_

### Node.js/TypeScript Git Building Blocks

While no complete forge exists, several npm packages provide the foundational primitives for building Git server functionality in Node.js:

#### isomorphic-git (Pure JS Git Implementation)

- **What it is**: A pure JavaScript reimplementation of git that works in Node.js and browsers
- **Stars**: ~7k on GitHub
- **Status**: Actively maintained, v1.27.1
- **Strengths**: Zero native dependencies, full git operations (read, write, clone, push, fetch), TypeScript definitions included
- **Limitations**: Primarily a **client library** - does not implement Git Smart HTTP server protocol; no built-in server-side repo hosting
- **Use case**: Reading/writing git repos programmatically, not serving them
- _Source: [isomorphic-git.org](https://isomorphic-git.org/), [GitHub](https://github.com/isomorphic-git/isomorphic-git), [npm](https://www.npmjs.com/package/isomorphic-git)_

#### node-git-server (Configurable Git Server)

- **What it is**: A configurable git server written in Node.js, hard fork of `pushover`
- **Version**: 1.0.0 (last published ~3 years ago)
- **Strengths**: Zero-dependency goal, simple API for creating git HTTP/SSH servers
- **Limitations**: Stale maintenance, small community (8 dependents on npm), no web UI, no issue tracking, no PR workflows
- **Use case**: Bare-bones git push/pull server
- _Source: [GitHub](https://github.com/gabrielcsapo/node-git-server), [npm](https://www.npmjs.com/package/node-git-server)_

#### git-http-backend (HTTP Protocol Bridge)

- **What it is**: Serves git repositories over HTTP using the Smart HTTP protocol
- **Version**: 1.1.2 (last published ~3 years ago)
- **Strengths**: 19 dependents on npm, straightforward API, shells out to `git` binary
- **Limitations**: Requires `git` installed on server, stale maintenance, low-level plumbing only
- **Use case**: Building custom HTTP Git endpoints
- _Source: [npm](https://www.npmjs.com/package/git-http-backend)_

#### gitserve (Express/Connect Middleware)

- **What it is**: Node.js port of git http-backend for Smart HTTP/HTTPS Protocol
- **Strengths**: Express/Connect compatible middleware, supports fetch/clone/push/pull
- **Limitations**: Requires `git` binary, limited documentation
- **Use case**: Adding git hosting to an existing Express app
- _Source: [npm (gitserve)](https://snyk.io/advisor/npm-package/gitserve)_

#### express-git / express-git2 (Express Middleware)

- **What it is**: Express middleware wrapping git-http-backend
- **Limitations**: express-git last published 10 years ago; express-git2 is a more recent fork
- **Use case**: Quick integration of git serving into Express applications
- _Source: [npm (express-git)](https://www.npmjs.com/package/express-git), [GitHub (express-git2)](https://github.com/remyar/express-git2)_

#### NodeGit (Native Bindings to libgit2)

- **What it is**: Asynchronous native Node bindings to libgit2
- **Strengths**: Full git functionality via battle-tested libgit2, async API
- **Limitations**: Native C++ dependency (compilation issues), heavier install, not pure JS
- **Use case**: High-performance git operations where native deps are acceptable
- _Source: [nodegit.org](https://www.nodegit.org/)_

### Established Non-Node.js Alternatives (Context)

For comparison, here are the dominant self-hosted Git forges that any Node.js solution would compete with:

| Platform       | Language | Resource Footprint | Key Differentiator                    |
| -------------- | -------- | ------------------ | ------------------------------------- |
| **Forgejo**    | Go       | Low (~128MB RAM)   | Community governance, Codeberg-backed |
| **Gitea**      | Go       | Low (~128MB RAM)   | Lightweight, Raspberry Pi capable     |
| **Gogs**       | Go       | Very Low           | Minimalist, even lighter than Gitea   |
| **OneDev**     | Java     | Medium (~2GB)      | Built-in CI/CD, code intelligence     |
| **GitLab CE**  | Ruby/Go  | High (~4GB+)       | Full DevOps platform                  |
| **Soft Serve** | Go       | Very Low           | SSH TUI, CLI-first, single binary     |

_Sources: [dasroot.net](https://dasroot.net/posts/2026/01/self-hosted-git-platforms-gitlab-gitea-forgejo-2026/), [Forgejo compare](https://forgejo.org/compare/), [charmbracelet/soft-serve](https://github.com/charmbracelet/soft-serve)_

### Technology Adoption Trends

- **Go dominates** the self-hosted Git space due to single-binary deployment, low memory footprint, and excellent concurrency
- **Forgejo is gaining momentum** in 2025-2026 with its copyleft license shift and community governance model
- **Node.js/TypeScript** is conspicuously absent from Git forge development, likely because Go's deployment model (single static binary) is a natural fit for infrastructure tooling
- **isomorphic-git** remains the most vibrant JS git project but is client-focused, not server-focused
- **The "build your own" approach** using primitives like `git-http-backend` + `isomorphic-git` + Express is the most viable Node.js path, but requires significant custom development

_Sources: [OpenReplay](https://blog.openreplay.com/github-alternatives-2026/), [HouseOfFOSS](https://www.houseoffoss.com/post/top-3-open-source-alternatives-to-github-in-2025-gitlab-gitea-and-gogs)_

## Recommended TypeScript Stack for Mechanical Forgejo Port

### The Complete Stack

| Layer               | Go (Forgejo)          | TypeScript (Port)                              | Why                                                                                                                                                                                        |
| ------------------- | --------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Runtime**         | Go binary             | **Bun** (dev + compile)                        | Single-binary output via `bun compile`, ~50ms startup, Node.js API compatible. Production-proven (Claude Code ships this way).                                                             |
| **Web Framework**   | Chi router + net/http | **Fastify**                                    | Plugin encapsulation = Chi's `Group()`. `@fastify/view` = `ctx.HTML()`. Hook lifecycle maps to auth→context→permissions→handler pipeline. 35K stars, battle-tested at scale.               |
| **Template Engine** | Go `html/template`    | **Nunjucks**                                   | Closest syntax: `{% if %}` ↔ `{{if}}`, `{{ X.Y }}` ↔ `{{.X.Y}}`. Template inheritance, custom filters/globals, auto-escaping. Mechanical regex conversion handles most of the translation. |
| **ORM**             | XORM                  | **Drizzle ORM**                                | Schema-as-code (closest to XORM structs-with-tags). `sql` tagged template for raw SQL. 3x faster than Prisma. ~7KB bundle. Migration auto-generation.                                      |
| **Auth**            | Custom (in Go)        | **Passport.js** + custom                       | Only library covering OAuth2 + LDAP + WebAuthn. 500+ strategies. SSH keys + API tokens as custom strategies. Authorization layer is custom regardless.                                     |
| **Background Jobs** | Goroutines + channels | **BullMQ** (Redis)                             | Job dependencies, priority queues, rate limiting, cron scheduling, retry with backoff. Covers all goroutine use cases: webhooks, mirror sync, indexing, mail, CI dispatch.                 |
| **WebSocket**       | Go stdlib             | **ws**                                         | Pure RFC 6455. ~3KB/connection. 110M weekly downloads. Full control for auth handshake and log streaming.                                                                                  |
| **Git Operations**  | Shell out to `git`    | **simple-git** + `git-http-backend` + **ssh2** | Same architecture: shell out to `git` binary. simple-git for UI operations, git-http-backend for Smart HTTP, ssh2 for SSH transport.                                                       |
| **Single Binary**   | `go build`            | **Bun compile** + Docker                       | Cross-platform binaries via `--target`. Docker for container deployments. `git` binary remains external dependency (same as Forgejo).                                                      |

### Framework Decision: Why Fastify Over Hono

Both are strong candidates. Forgejo uses **Chi** (Go router) with a linear middleware chain, hierarchical route groups, and per-request context injection.

| Criterion                 | Fastify                                                          | Hono                                                                                        |
| ------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Middleware pattern**    | Hook lifecycle (onRequest→preHandler→handler)                    | Linear `app.use()` with `next()`                                                            |
| **Route scoping**         | Plugin encapsulation (parent→child inheritance, isolation)       | `app.route()` sub-apps (known [scoping issues](https://github.com/honojs/hono/issues/2988)) |
| **Template rendering**    | First-class via `@fastify/view` → `reply.view("template", data)` | No first-class engine; manual wiring                                                        |
| **Context injection**     | `decorateRequest()` with TypeScript generics                     | `c.set()`/`c.get()` with generics                                                           |
| **WebSocket**             | `@fastify/websocket` integrates with hook lifecycle              | Built-in `upgradeWebSocket()`                                                               |
| **Monolith track record** | Proven (Microsoft, Walmart)                                      | Edge/API-focused, less monolith experience                                                  |
| **Chi pattern match**     | 7/10 (different paradigm, equivalent capability)                 | 8/10 (closer linear model, weaker scoping)                                                  |

**Fastify wins** because:

- `reply.view("template", data)` is a near-direct translation of `ctx.HTML(status, "template")`
- Plugin encapsulation handles Forgejo's 500+ routes without middleware leaking
- Hook lifecycle maps cleanly to Forgejo's auth→context→permissions pipeline
- WebSocket hooks fire before upgrade (needed for authentication)

### ORM Decision: Why Drizzle Over Alternatives

| Criterion               | Drizzle                    | Kysely                   | TypeORM                   | Prisma               |
| ----------------------- | -------------------------- | ------------------------ | ------------------------- | -------------------- |
| **XORM mapping**        | High (schema-as-code)      | Medium (interfaces only) | Highest (decorators~tags) | Low (separate DSL)   |
| **Multi-DB one schema** | No (per-dialect tables)    | Yes                      | Yes                       | Yes                  |
| **Raw SQL**             | Excellent (`sql` template) | Excellent (first-class)  | Good (QueryBuilder)       | Adequate (bolt-on)   |
| **Type inference**      | Excellent (no codegen)     | Outstanding              | Weak                      | Excellent (codegen)  |
| **Performance**         | 2-3x faster than Prisma    | Near-zero overhead       | Moderate                  | Rust engine overhead |
| **Bundle**              | ~7KB                       | ~2MB, 0 deps             | ~2-3MB                    | ~6.5MB + Rust binary |
| **Maintenance**         | Active, growing fast       | Active, focused          | Uncertain revival         | Active (VC-backed)   |

**Drizzle wins** because:

- Schema-as-TypeScript-code is the most natural mapping from XORM's schema-as-Go-structs
- The per-dialect schema issue can be solved with a thin code generator that emits `pgTable`/`mysqlTable`/`sqliteTable` from a shared definition
- Raw SQL via `sql` tagged template preserves type safety while matching Forgejo's heavy raw SQL usage
- Migration system covers both XORM's `Sync2()` (via `push`) and sequential production migrations (via `generate`/`migrate`)

### Template Decision: Why Nunjucks

| Go Syntax                 | Nunjucks                       | Conversion                                      |
| ------------------------- | ------------------------------ | ----------------------------------------------- |
| `{{if .IsAdmin}}`         | `{% if isAdmin %}`             | Regex: `\{\{if \.(\w+)\}\}` → `{% if $1 %}`     |
| `{{range .Issues}}`       | `{% for issue in issues %}`    | Requires variable naming                        |
| `{{template "header" .}}` | `{% include "header.njk" %}`   | Regex + file rename                             |
| `{{.Repository.Name}}`    | `{{ repository.name }}`        | Regex: `\{\{\.(\w+)\.(\w+)\}\}` → `{{ $1.$2 }}` |
| `{{end}}`                 | `{% endif %}` / `{% endfor %}` | Context-aware replacement                       |
| `{{.locale.TrN ...}}`     | `{{ trN(...) }}`               | Register as global function                     |

Nunjucks scores highest on syntax proximity, template inheritance, custom functions, auto-escaping, and async support. The Vue/CSS/Webpack frontend layer stays **completely untouched**.

### Infrastructure Dependencies

| Dependency              | Forgejo              | TypeScript Port       | Change             |
| ----------------------- | -------------------- | --------------------- | ------------------ |
| `git` binary            | Required             | Required              | Same               |
| PostgreSQL/MySQL/SQLite | Required             | Required              | Same               |
| Redis                   | Not required         | **Required** (BullMQ) | **New dependency** |
| Runtime                 | None (static binary) | Bun (compiled away)   | Equivalent         |
| Docker                  | Optional             | Optional              | Same               |

The only new infrastructure dependency is **Redis** for BullMQ. If avoiding Redis is a hard requirement, **pg-boss** (PostgreSQL-backed queue) is the alternative, though it lacks job dependency chains and rate limiting.

### Go → TypeScript Language Mapping (Refined)

| Go Pattern                 | TypeScript Equivalent                          | Friction                          |
| -------------------------- | ---------------------------------------------- | --------------------------------- |
| `struct` with XORM tags    | Drizzle table definition                       | Low - schema-as-code              |
| `interface` (implicit)     | `interface` (explicit)                         | Low                               |
| `func (r *Repo) Method()`  | Class method or standalone function            | Low                               |
| Goroutine (background)     | BullMQ job                                     | Low - different API, same concept |
| Goroutine (concurrent I/O) | `Promise.all()` / async/await                  | Low - Node.js natural fit         |
| Channel                    | BullMQ event / EventEmitter                    | Medium                            |
| `context.Context`          | Fastify request decorators / AsyncLocalStorage | Low                               |
| `html/template`            | Nunjucks                                       | Low - regex-convertible           |
| Chi middleware             | Fastify hooks / plugins                        | Low-Medium                        |
| `os/exec` git binary       | `child_process.spawn` / simple-git             | Trivial                           |
| `error` returns            | throw / Result pattern                         | Low                               |
| `go.mod`                   | `package.json`                                 | Trivial                           |

### LLM-Assisted Porting Strategy

This stack was specifically chosen to minimize translation friction for LLM-assisted porting:

1. **Models**: Feed XORM struct → get Drizzle table definition. Mechanical, ~95% automatable.
2. **Services**: Feed Go function → get async TypeScript function. `error` returns become throws. ~80% automatable, human review needed for goroutine→BullMQ patterns.
3. **Routers**: Feed Chi route group → get Fastify plugin. `ctx.HTML()` → `reply.view()`. ~85% automatable.
4. **Templates**: Regex-based bulk conversion for 70% of lines, LLM for complex template functions and context-aware `{{end}}` → `{% endif %}`/`{% endfor %}` mapping. ~75% automatable.
5. **Tests**: Port each Go test file → TypeScript test. Use Forgejo's test suite as the correctness oracle. ~80% automatable.

### Estimated Timeline (1 Dev + LLM)

| Phase                   | Duration        | What                                                                 |
| ----------------------- | --------------- | -------------------------------------------------------------------- |
| **Setup**               | 1 week          | Project scaffold, Fastify + Drizzle + Nunjucks + BullMQ wiring, CI   |
| **Models + Migrations** | 2 weeks         | Port 50+ tables, migration system, seed data                         |
| **Modules**             | 2-3 weeks       | Port utilities (git, markdown, cache, logging, settings, storage)    |
| **Services**            | 4-6 weeks       | Port business logic (repo, issue, PR, user, org, webhook, mirror)    |
| **Routers**             | 2-3 weeks       | Port HTTP handlers, API endpoints, middleware chain                  |
| **Templates**           | 2 weeks         | Bulk regex conversion + manual fixup of complex templates            |
| **Git Protocol**        | 2 weeks         | Smart HTTP (git-http-backend) + SSH (ssh2) transport                 |
| **Auth**                | 2 weeks         | Passport.js strategies + permissions model                           |
| **Integration + Debug** | 4-6 weeks       | Wire everything, fix edge cases, verify against Forgejo's test suite |
| **Total**               | **~5-7 months** | Functional port with core features                                   |

<!-- Content will be appended sequentially through research workflow steps -->
