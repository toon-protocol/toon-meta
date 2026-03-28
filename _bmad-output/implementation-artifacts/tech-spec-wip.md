---
title: 'Replace Rig Frontend with Forgejo-style Git Forge UI'
slug: 'rig-forgejo-frontend'
created: '2026-03-28'
status: 'in-progress'
stepsCompleted: [1]
tech_stack: ['react-19', 'react-router-v7', 'shadcn-ui-v4', 'tailwind-css-v4', 'shiki', 'vite']
files_to_modify: ['packages/rig/src/web/']
code_patterns: []
test_patterns: []
---

# Tech-Spec: Replace Rig Frontend with Forgejo-style Git Forge UI

**Created:** 2026-03-28

## Overview

### Problem Statement

The current Rig frontend is a vanilla TypeScript SPA with 40KB of HTML string concatenation in a single `templates.ts` file and a 47KB monolith dispatcher in `main.ts`. It lacks visual polish, proper component architecture, and key forge features (open/closed issue tabs, syntax highlighting, responsive layout, loading states). It needs to match the professional quality of Forgejo/Codeberg's git forge UI.

### Solution

Replace the rendering layer with React 19 + shadcn-ui v4 + Tailwind CSS, keeping the existing data layer (relay-client, arweave-client, git-objects, nip34-parsers) intact and wrapping it as React hooks. Visually replicate Forgejo's layout patterns using shadcn components. Use real local TOON infrastructure (relay on port 7100, BLS on port 3100) and Arweave gateways for all data — no mocks.

### Scope

**In Scope:**
- All read-only forge views: repo list, code browser, file viewer, commit log, commit detail, blame, issues (open/closed tabs), PRs (open/closed tabs + diff), comments on issues/PRs
- Syntax highlighting via Shiki
- Skeleton loading states for all async data
- Dark mode support (shadcn built-in)
- Responsive/mobile layout
- Arweave deployment compatibility (static SPA, relative base `./`)
- Standardized routes: `/:owner/:repo/...` (owner = npub)
- `window.__RIG_CONFIG__` bootstrap for relay URL + repo filter
- React Testing Library for component tests (fresh test suite)

**Out of Scope:**
- Write operations (creating issues/PRs/comments)
- Authentication UI / user registration / login
- Wiki, releases, packages, actions/CI, admin panels
- Search (NIP-50)
- Activity feeds / heatmaps
- Short-form routes (`/:repo/...` without owner)

## Context for Development

### Codebase Patterns

{codebase_patterns}

### Files to Reference

| File | Purpose |
| ---- | ------- |

{files_table}

### Technical Decisions

- **Framework**: React 19 (required by shadcn-ui v4)
- **Router**: React Router v7 with standardized `/:owner/:repo/...` routes
- **UI Library**: shadcn-ui v4 + Tailwind CSS v4 (mandated by CLAUDE.md)
- **Syntax Highlighting**: Shiki (lightweight, works with React)
- **Bootstrap**: Continue using `window.__RIG_CONFIG__` for relay URL + repo filter
- **Data Layer**: Keep 100% of existing TS modules, wrap as React hooks
- **Delete**: `templates.ts`, `main.ts`, `router.ts`, `styles.css`, `layout.ts`
- **Testing**: Fresh React Testing Library suite (no migration of old tests)
- **No Mocks**: All tests and dev use real local TOON genesis infra + real Arweave gateways

### Forgejo Source Reference

Verified from codeberg.org/forgejo/forgejo:
- 23 Vue components in `web_src/js/components/` (branch selector, diff tree, PR merge form)
- 69 feature modules in `web_src/js/features/`
- Go templates in `templates/repo/` define page layouts
- Key CSS: `repo.css` (62KB), `base.css` (29KB), Fomantic UI + Tailwind utilities

### shadcn Components

tabs, table, badge, button, dropdown-menu, command, breadcrumb, avatar, card, pagination, separator, scroll-area, skeleton, tooltip, collapsible, select, toggle-group, popover

### Component Architecture

```
App
├── AppLayout (TopNav + Outlet)
├── RepoLayout (RepoHeader + RepoTabs + RepoSidebar + Outlet)
└── Routes:
    ├── / → RepoListPage (card grid of repos)
    ├── /:owner/:repo → RepoHomePage (tree + README)
    ├── /:owner/:repo/tree/:ref/*path → TreePage
    ├── /:owner/:repo/blob/:ref/*path → BlobPage
    ├── /:owner/:repo/commits/:ref → CommitLogPage
    ├── /:owner/:repo/commit/:sha → CommitDetailPage
    ├── /:owner/:repo/blame/:ref/*path → BlamePage
    ├── /:owner/:repo/issues → IssueListPage (open/closed tabs)
    ├── /:owner/:repo/issues/:id → IssueDetailPage
    ├── /:owner/:repo/pulls → PRListPage (open/closed tabs)
    └── /:owner/:repo/pulls/:id → PRDetailPage
```

### Forgejo → shadcn Component Mapping

| Forgejo Source | React Component | shadcn Parts |
|---|---|---|
| header.tmpl | RepoHeader + RepoTabs | tabs, badge, avatar, breadcrumb |
| RepoBranchTagSelector.vue | BranchSelector | command, popover, badge |
| view_list.tmpl | FileTree | table, skeleton |
| view_file.tmpl | FileViewer | scroll-area, breadcrumb |
| issue/list.tmpl + openclose.tmpl | IssueList | table, toggle-group, pagination, badge |
| issue/view_title.tmpl + view_content.tmpl | IssueDetail | card, avatar, separator, badge |
| diff/section_unified.tmpl | UnifiedDiff | collapsible, table |
| commits.tmpl + commits_table.tmpl | CommitLog | table, avatar, pagination |

## Implementation Plan

### Tasks

{tasks}

### Acceptance Criteria

{acceptance_criteria}

## Additional Context

### Dependencies

{dependencies}

### Testing Strategy

{testing_strategy}

### Notes

{notes}
