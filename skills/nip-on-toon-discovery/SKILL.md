---
name: nip-on-toon-discovery
description: >-
  Render-side spec for NIP-on-TOON — how a Nostr `kind` selects a render strategy
  on the client and how a renderer travels as data on the same network as the
  events. Covers the four-branch render trust gradient (native / A2UI / sandboxed
  mcp-ui / generative fallback), the addressable `kind:31036` renderer event, the
  `m` (mimeType) tag format selector, the A2UI branch-2 binding convention, the
  standard-catalog-only invariant, the consent invariant, and the client dispatch
  algorithm. Use when working on open-world generative UI on TOON ("how does the
  client render an unknown kind?", "what is kind:31036?", "how does the render
  trust gradient work?", "how does A2UI bind to a decoded TOON event?", "what is
  the consent invariant for sandboxed widgets?").
license: MIT
---

# NIP-on-TOON: Open-World Generative UI & the Render Trust Gradient

Render-side spec for NIP-on-TOON: how a Nostr `kind` selects a *render strategy*
on the client, and how a renderer travels as data on the same network as the
events themselves.

**Scope (deliberately narrow):** render-side only. Route (`kind:10032`),
capability/pricing (`kind:10035` beyond its `ui` tag), provider attestation, the
paid-write invocation, and settlement are **out of scope** here.

## Core thesis

A Nostr `kind` is an open component-catalog key — **kind = catalog key, NIP =
props schema**. The client forks on one question — *do I know this kind?* — and
the answer selects both render strategy and trust level.

Trust runs *opposite* to flexibility: the more open-ended the render path, the
less it is trusted.

## The four-branch render trust gradient

| Branch | Condition | Strategy | Trust |
|---|---|---|---|
| 1 | known kind | native component | full |
| 2 | unknown + A2UI spec | client A2UI catalog | medium |
| 3 | unknown + raw widget | sandboxed mcp-ui iframe | low |
| 4 | unknown + nothing | generative fallback | low |

- **Branch 1 — native.** The client recognizes the kind and renders it with a
  built-in, fully trusted native component from its own registry.
- **Branch 2 — A2UI.** The client does not know the kind but a renderer is
  available as an A2UI spec. The client renders it through its own A2UI catalog
  at medium trust.
- **Branch 3 — sandboxed mcp-ui.** The client does not know the kind and the
  renderer ships as a raw widget. The client renders it inside a sandboxed
  mcp-ui iframe at low trust.
- **Branch 4 — generative fallback.** The client does not know the kind and no
  renderer is available. The client falls back to a generative rendering at low
  trust.

## Renderer event: `kind:31036`

The renderer travels as a normal event on the network.

- **Renderer event:** new `kind:31036` — **addressable**, with `d` = the target
  kind it renders.
- **Format selector:** the `m` (mimeType) tag on the `kind:31036` event picks the
  branch and its trust tier:
  - `application/a2ui+json` → **branch 2** (A2UI, medium trust)
  - `text/html;profile=mcp-app` → **branch 3** (sandboxed mcp-ui, low trust)

A `ui` tag on the event being rendered resolves to a `kind:31036` renderer; where
that resolution lives (SDK vs client-local) is an open spike (see below).

## Branch 2 — A2UI binding convention

Branch 2 uses **A2UI** (Google, Apache-2.0). The binding between the renderer
and the decoded TOON event is:

- the renderer's **`surfaceUpdate`** is the stored template (from the
  `kind:31036` event), and
- the **decoded event** (via `core.decodeEventFromToon`) is fed in as the
  **`dataModelUpdate`**.

So: `surfaceUpdate` = template, decoded event = `dataModelUpdate`.

### Standard-catalog-only invariant

Branch 2 may use only the A2UI **"Basic"** standard catalog. Any custom
component or custom behavior in the renderer **drops it to branch 3** (the
sandboxed mcp-ui path). Medium trust is reserved for renderers that stay entirely
within the standard catalog.

## Branch 3 — sandboxed mcp-ui & the consent invariant

Branch 3 renders a raw widget inside a sandboxed mcp-ui iframe at low trust.

### Consent invariant

A sandboxed widget may only *request* an action. The **authorization surface is
rendered by the trusted client outside the iframe and is non-themeable**. The
sandboxed widget can never draw, style, or spoof the consent/authorization UI —
that surface always belongs to the trusted client, so the user's
authorization decision can never be captured or skinned by untrusted renderer
code.

## Client dispatch algorithm

For each event the client wants to render:

1. **Is this kind known?** If yes → **branch 1**: render with the native
   component registry. Done.
2. Otherwise, resolve the event's `ui` tag to a `kind:31036` renderer.
3. If a renderer is found, read its `m` (mimeType) tag:
   - `application/a2ui+json` → **branch 2**. Use the renderer's `surfaceUpdate`
     as the template and `core.decodeEventFromToon(event)` as the
     `dataModelUpdate`. Enforce the standard-catalog-only invariant; if a custom
     component/behavior is present, fall through to branch 3.
   - `text/html;profile=mcp-app` → **branch 3**. Render inside a sandboxed
     mcp-ui iframe; enforce the consent invariant (authorization surface drawn
     by the client outside the iframe, non-themeable).
4. If no renderer is found → **branch 4**: generative fallback (optionally
   publish back a `kind:31036` for the kind).

## Repos touched

| Repo | Role | Work |
|---|---|---|
| **toon-client** | primary | dispatch + consent (`client`), branch 1/2 render (`views`), branch 3 mcp-ui (`client-mcp`), Rig host |
| **toon** | dependency | `core.decodeEventFromToon` feeds A2UI `dataModelUpdate`; decide if `ui`→`31036` resolution is `sdk` or client-local (likely no code change) |
| **toon-meta** | spec home | this spec; the render-side epic |

**Not touched:** `relay`, `swap`, `store`, `connector` (settlement/route side).
One check only: confirm `relay` has no kind allowlist blocking the new
`kind:31036`.

## Work breakdown (candidate tickets)

- [ ] toon: confirm `ui`→`31036` resolution home (sdk vs client); expose `decodeEventFromToon` shape
- [ ] toon-client/client: kind-keyed dispatch skeleton (branches 1-4) keyed on the `m` tag
- [ ] toon-client/views: branch 1 native component registry for known kinds
- [ ] toon-client/views: branch 2 A2UI renderer
- [ ] toon-client/client-mcp: branch 3 mcp-ui AppRenderer integration (sandboxed iframe, UIResource passthrough)
- [ ] toon-client: branch 4 generative fallback + optional publish-back of `kind:31036`
- [ ] toon-client/client: consent invariant
- [ ] toon-client: renderer-swap defense
- [ ] relay: confirm no kind allowlist blocks `kind:31036`
- [ ] toon-meta: commit this spec under `skills/`

## Open questions (spikes)

- A2UI catalog version negotiation.
- A2UI client-defined functions (validation): treat as behavior, or whitelist
  pure validators at medium trust?
- Many providers, one kind: selection/ranking policy.
- Generative-fallback curation/namespacing for community-published
  `kind:31036`.
