# 1. Introduction

This document outlines the overall project architecture for **Crosstown Protocol**, including the core library packages, shared services, agent runtime, UI prototypes, and integration patterns. Its primary goal is to serve as the guiding architectural blueprint for AI-driven development, ensuring consistency and adherence to chosen patterns and technologies.

**Relationship to Frontend Architecture:**
The `ui-prototypes` package contains React-based UI prototypes for visualizing the agent network. These are design exploration tools, not production frontend code. No separate Frontend Architecture Document is required.

## 1.1 Starter Template or Existing Project

**Decision:** No starter template. This is a greenfield TypeScript monorepo using standard pnpm/TypeScript tooling configured manually.

**Rationale:** Specialized protocol library with unique Nostr + ILP requirements. Manual setup provides complete control over tooling without removing unnecessary boilerplate. The project has grown from a 3-package library to a 5-package monorepo with Docker deployment and an autonomous agent runtime.

## 1.2 Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-05 | 0.1 | Initial architecture document | Architect |
| 2026-02-17 | 0.2 | Major update: BLS package extraction, bootstrap/compose modules, embedded connector, agent runtime, settlement negotiation, layered peer discovery, ui-prototypes, Docker entrypoint, NIP adoption roadmap (Epics 12-17), tech stack version updates | Architect |

---
