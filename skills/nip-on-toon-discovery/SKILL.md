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

# NIP-on-TOON — Open-world generative UI & the render trust gradient

**Status: draft.** This documents how a Nostr `kind` selects a *render strategy* on the client, and how a renderer travels as data over the same network the events do.

**Scope.** Render-side only. The route (`kind:10032`), capability/pricing (`kind:10035` beyond its `ui` tag), provider attestation, the paid-write invocation, and settlement are separate concerns specified elsewhere and deliberately excluded here. This doc touches `kind:10035` only for the `ui` tag that carries the renderer link.

Kind numbers are **established** (in the TOON glossary) or **proposed** (suggested here, to ratify).

## 0. Kind registry (render-scoped)

| Kind | Status | Role in this doc |
|---|---|---|
| `31036` | **proposed** | Renderer: holds the mcp-ui `UIResource` HTML for one target kind |
| `10035` | established | Only its `ui` tag is in scope — the kind→renderer link |

## 1. Thesis — a kind is an open component-catalog key

In Nostr the **client** interprets a kind; the relay just stores and forwards. Presentation is the receiver's job: `kind:30023` renders as an article, `kind:1` as a note. So a kind is already a key into an open, decentralized component catalog — which is the declarative generative-UI pattern (an agent emits typed, catalog-referencing data; the client renders with its own components) predating the name. **Kind = catalog key; NIP = props schema.**

The novel move is combining Nostr's *open* catalog with generative UI's *runtime* rendering: unlike Tambo / Thesys / A2UI / a single MCP Apps server — all closed, owned catalogs — the renderable set here is open, and "I've never seen this kind" becomes a first-class branch instead of an error.

## 2. The render trust gradient

The client forks on exactly one question — **do I know this kind?** — and the answer selects both the render strategy and the trust level:

| Branch | Condition | Strategy | Trust | Surface |
|---|---|---|---|---|
| 1 | known kind | native component | **full** | data only, audited UI |
| 2 | unknown + declarative spec | catalog render | **medium** | data only, client components |
| 3 | unknown + provider raw widget | sandboxed iframe (mcp-ui) | **low** | arbitrary HTML, consent-gated |
| 4 | unknown + nothing | generative fallback | **low** | model-made renderer (§3.1) |

Trust runs **opposite** to flexibility: the native branch is safest and least expressive (data hitting an audited component); the sandboxed branch is most expressive and least safe (arbitrary provider HTML). You accept less safety only in exchange for more freedom, and the kind tells the client exactly how much it is trading. On an adversarial open network this gradient is the only way rich UI is survivable.

## 3. Renderer linkage — `ui://` + `kind:31036`

This is the Nostr analog of the MCP Apps `_meta.ui.resourceUri` link. In MCP Apps a tool carries `_meta.ui.resourceUri`, the host fetches the resource via `resources/read`, and renders it with `AppRenderer`. Here a **kind** plays the role of the tool, a `["ui", ...]` tag is the link, and a `31036` event is the resource.

The link tag (its only in-scope appearance on `kind:10035`):

```
["ui", <kind>, <ui-uri>, <renderer-coord>]
["ui", "5312", "ui://acme-store/5312", "31036:<provider-pubkey-hex>:5312"]
```

`ui-uri` is the stable logical id handed to mcp-ui `AppRenderer`; `renderer-coord` is the addressable `31036` coordinate used to fetch the HTML from Nostr.

The renderer event:

```json
{
  "kind": 31036,
  "pubkey": "<provider-pubkey-hex>",
  "created_at": 1750000000,
  "tags": [
    ["d", "5312"],
    ["k", "5312"],
    ["m", "text/html;profile=mcp-app"]
  ],
  "content": "{\"uri\":\"ui://acme-store/5312\",\"mimeType\":\"text/html;profile=mcp-app\",\"text\":\"<form>…input + result view…</form>\"}",
  "id": "<...>", "sig": "<...>"
}
```

The `d` tag = the target kind, making the renderer addressable as `31036:<pubkey>:5312`. The `content` is a verbatim mcp-ui `UIResource` — the same shape `@mcp-ui/server`'s `createUIResource` emits. The client resolves the `ui` tag's `ui-uri` to this event via the coordinate, extracts the `UIResource`, and passes it to `@mcp-ui/client` `AppRenderer` unchanged — so existing mcp-ui hosts render it with no TOON-specific code. This is branch 3 of the gradient.

### 3.1 Generative fallback & self-populating catalog (branch 4)

When a kind is unknown *and* no provider renderer exists, the client can ask a model to generate a renderer on the spot, then optionally **publish that renderer back** as its own `kind:31036` event. The next client that fetches it now has a "known" renderer for that kind. The render layer accretes the same way the kind vocabulary does — permissionlessly — so branch 4 slowly feeds branch 1 over time.

### 3.2 Declarative format (branch 2): A2UI

Branch 2 is the medium-trust middle: expressive but **data, not code**, rendered with the client's own audited component catalog. The declared format is **A2UI** (Google, Apache-2.0) — chosen because it is the declarative sibling to MCP Apps (so branches 2 and 3 are the two halves of one taxonomy, with A2UI building MCP-Apps interop upstream), and because its structure/data split maps exactly onto the renderer-template / event-data binding this doc needs.

**The `m` tag is the trust selector.** The renderer event's mimeType picks the format and therefore the branch — one renderer kind, format-discriminated:

```
["m", "application/a2ui+json"]        → branch 2, client A2UI catalog (medium trust)
["m", "text/html;profile=mcp-app"]    → branch 3, sandboxed iframe     (low trust)
```

The client reads `m`, and that single field tells it which branch of §2 to take.

**Binding convention (structure vs. data).** A2UI separates the component tree from its data model: `surfaceUpdate` describes structure, `dataModelUpdate` supplies values, `beginRendering` signals paint. TOON uses that split directly:

- The `kind:31036` `content` for an A2UI renderer carries the **`surfaceUpdate`** — the durable template, published once.
- At render time the client decodes the incoming kind event and feeds it as the **`dataModelUpdate`**, bound as the root data object. The decoded TOON event *is* the data model.
- `beginRendering` is the client deciding the data is in and painting.

So unlike A2UI's usual agent-streamed JSONL flow, here the surface is static (stored in the event) and only the per-invocation data model is dynamic — a static-surface + dynamic-data reframe, not a fight with the spec.

```json
{
  "kind": 31036,
  "pubkey": "<provider-pubkey-hex>",
  "created_at": 1750000000,
  "tags": [
    ["d", "30023"],
    ["k", "30023"],
    ["m", "application/a2ui+json"],
    ["a2ui", "0.9"]
  ],
  "content": "{\"surfaceUpdate\":{\"surfaceId\":\"article\",\"components\":[ …A2UI Basic catalog tree… ]}}",
  "id": "<...>", "sig": "<...>"
}
```

**Standard-catalog-only invariant.** A2UI 0.9 allows client-extended catalogs and client-side functions. Branch 2 forbids them. It is medium-trust *only because* the vocabulary is a fixed, client-audited set (A2UI "Basic"). The instant a renderer needs a custom component or behavior, it is no longer data-against-a-known-catalog — it must drop to branch 3 (`text/html;profile=mcp-app`, sandboxed). The `["a2ui", <version>]` tag lets the client confirm it supports the catalog version before rendering, and refuse/fall back otherwise. This keeps format and trust tier locked together.

## 4. Consent invariant (load-bearing)

The gradient only holds if the untrusted branch cannot reach a trusted action surface. The mcp-ui sandboxed widget may only **request** an action via an intent; it never performs it. The authorization surface (and anything that commits an action) is rendered by the **trusted client, outside the iframe, and is never themeable by the widget.**

The branch feeding that surface (branch 3/4) is by definition untrusted code, so a widget able to paint the confirm/authorize UI would let any provider spoof consent and collapse the whole gradient to its lowest tier. The split is simple and absolute: the iframe *requests*; the host *renders the authorization*; those two responsibilities never share a rendering context.

## 5. Client dispatch algorithm

1. Receive event (free read), decode `kind`.
2. **Known kind?** → render with the native component. *(branch 1, full trust)*
3. Else resolve a renderer: read the `ui` tag for this kind, fetch the `31036` event at `renderer-coord`, extract the `UIResource`.
4. Read the `m` tag. `application/a2ui+json` → render the A2UI `surfaceUpdate` against the decoded event as `dataModelUpdate`, using the client's Basic catalog *(branch 2, §3.2)*; `text/html;profile=mcp-app` → hand the `UIResource` to mcp-ui `AppRenderer`, sandboxed *(branch 3)*.
5. No renderer found → generative fallback; optionally publish the result back as `kind:31036` *(branch 4, §3.1)*.
6. On the widget's submit **intent**, render the trusted authorization surface **outside** the iframe (§4); only then perform the action.

## 6. Open questions (render-scoped)

- **Renderer swap.** `kind:31036` is addressable-replaceable, so the same coordinate can later serve different HTML. For high-trust kinds, allowlist by **event id / content hash**, not by coordinate — if the coordinate resolves to a new id, refuse and fall back to the client's native form (branch 1). Low-stakes kinds can render any provider widget sandboxed.
- **Many providers, one kind.** If several providers publish renderers for the same kind, the `ui` tag is per-descriptor — the client needs a selection/ranking policy (which is where a provider-trust signal would enter, out of scope here).
- **A2UI catalog versioning.** Branch 2 is fixed to the A2UI "Basic" catalog (§3.2), but versions will drift. Decide whether the client's supported catalog version is itself discoverable (an event/advertisement) or simply assumed, and the fallback when a renderer's `["a2ui", <version>]` exceeds what the client supports (render a subset, or fall through to branch 1/native).
- **Generative-fallback quality & namespacing.** Community-published `kind:31036` renderers (§3.1) need a way to namespace and curate so a low-quality or hostile generated renderer doesn't become the de-facto catalog entry for a kind.
