# Can Web5's pieces (DIDs, did:dht, did:web, DWNs, DWAs, VCs) close TOON's route-discovery gap?

**Status:** Research note · **Date:** 2026-08-28 · **Audience:** whoever designs a relay-published, third-party-signed "walked this road and it held" object for TOON clients; companion to `route-discovery-law-research.md` (cited here as `[rdlr]`) and `nip-third-party-report-research.md`

The question: TOON's connector law (`[adr-0046]`, `[adr-0050]`, `[adr-0044]`, `[adr-0011]`, `[nd-spec]`) leaves a client
able to see only the roads that start at a node it already knows, and able to extend that only by paying to probe. Web5 —
Block/TBD's "decentralized web" stack — was wound down in late 2024. Do its concepts (DIDs, DID Documents, `did:dht`,
`did:web`, Decentralized Web Nodes and their protocols, Decentralized Web Apps, Verifiable Credentials) answer any of the
twenty open questions in `[rdlr §6]`?

Everything below is quoted verbatim from primary sources fetched on 2026-08-28 and cited inline as `[key §section]`. Where a
source is silent this note says **not stated**. No design recommendations are made; §8 maps concepts onto TOON's three
categories and §9 answers, question by question, "does it address this or not".

---

## 1. Summary

Web5 is not a product any more; it is a set of specifications and repositories that Block handed to the Decentralized
Identity Foundation (DIF) on 2024-11-26, three weeks after telling shareholders it was "winding down TBD" `[sec-8k]`
`[dif-blog]`. Every one of the 132 public repos in the `TBD54566975` GitHub org is archived; the Web5 ones now live under
`decentralized-identity/` with last human commits in October–December 2024 and last npm publishes on 2024-12-04
`[gh-api]` `[npm]`. `did-dht.com` and the TBD gateway `diddht.tbddev.org` no longer resolve in DNS; the DWN spec still
publishes at DIF and DIF still runs a non-production "Community Node" DWN at `dwn.gcda.xyz` `[probe]` `[dif-dwn-page]`.

Conceptually the pieces sort cleanly into TOON's three bins. A **DID Document** — under any method, `did:dht` and `did:web`
included — is the controller's own statement about the subject: DID Core's own security section says signed documents "do
not necessarily prove control over a DID, or guarantee that the DID document is the correct one for the DID"
`[did-core §9.2]`, and `did:dht` adds "Controllers are not cryptographically verified by Gateways or this DID method"
`[did-dht §Verification Methods]`. That is **self-description**, the thing `GET /ilp` already is and `[nd-spec]` forbids
from growing. `did:web` resolves to exactly the `/.well-known/did.json` origin-root URL that `[adr-0050]` rejected for the
connector, though its path form (`did:web:host:path` → `https://host/path/did.json`) does not need the root. `did:dht` is
the closest thing to "an announce that needs no relay": a 1000-byte signed DNS packet pushed into Mainline DHT, which
"retains data for multiple hours at no cost" and must be republished — i.e. a pushed copy with a `7200`-second TTL, the
shape `[adr-0050]` dropped `ttl_secs` to avoid `[did-dht §Republishing Data]`. Its "Type Indexing" feature exists so that
"DIDs become discoverable" through gateways — an index of self-declared types, which the spec itself calls "a relatively
unreliable practice" `[did-dht §Type Indexing]`.

A **Verifiable Credential** is the one Web5 piece whose data model is natively a third-party statement: `issuer` and
`credentialSubject` are distinct properties, "The claims in a credential can be about different subjects" `[vc-2.0 §2]`, and
it carries `validFrom`/`validUntil`, `credentialStatus` (revocation) and a choice of proof envelope. It is therefore a
candidate *format* for the object ADR 0046 permits. But it settles none of the trust questions: "How verifiers decide
which issuers to trust, and for what data or purposes, is out of scope for this recommendation" `[vc-2.0 §5.1]`.

A **DWN** is a per-DID data store plus a "message relay mechanism" — a discovery *transport*, the role the Nostr relay plays
today. A third party may write into someone else's DWN only where the owner has installed a protocol whose `$actions` say
`who: anyone`; the spec never states that the owner can override a rule, but the reference implementation grants the
tenant everything unconditionally (`if (recordsDelete.author === tenant) { return; }`) `[dwn-sdk records-delete]`. So "anyone
may write an observation about X into X's DWN and X cannot delete it" is not expressible in the reference DWN. Stored in
the *walker's* DWN instead, the observation is reachable only by someone who already knows the walker's DID — the same
"you can only see what starts at a node you already know" gap, moved one layer up. DWN "Sync" is between one DID's own
nodes, not across DIDs `[dwn-spec §Sync]`. A **DWA** was, in TBD's own words, an app that "can store data on a locally
reproduced DWN" `[web5-docs upgrade]` — nothing beyond thin client over DWN.

Net: Web5 offers a **format** (VC) and a **transport** (DWN, or a did:dht record) for the object, and a naming scheme (a
DID for the road, since "Anything can be the subject of a DID") — and answers, at most partially, six of the twenty
questions in `[rdlr §6]` (#1, #2, #3, #14, #15, #17), all at the level of "here is a field for it", never at the level of
"here is what it means or whom to believe". It does not touch the road-unit, cost/cap, verification, or who-pays questions.

---

## Sources

| Cite key | What | URL / path |
|---|---|---|
| `sec-8k` | Block, Inc. Form 8-K Ex. 99.1, Q3 2024 shareholder letter (filed 2024-11-07) | https://www.sec.gov/Archives/edgar/data/1512673/000119312524253135/d835206dex991.htm |
| `dif-blog` | DIF blog, "Block Contributes Digital Identity Components to the Decentralized Identity Foundation", 26 Nov 2024 | https://blog.identity.foundation/block-contributes-to-dif/ |
| `block-post` | Same announcement on block.xyz, 26 Nov 2024 | https://block.xyz/inside/block-contributes-digital-identity-components-to-the-decentralized-identity-foundation |
| `did-core` | W3C DID Core 1.0, Recommendation 19 July 2022 | https://www.w3.org/TR/did-core/ |
| `did-1.1` | W3C DID 1.1, Candidate Recommendation Snapshot 05 March 2026 | https://www.w3.org/TR/did-1.1/ |
| `did-dht` | DID DHT Method Specification 1.0, Implementer's Draft, last updated July 25 2024 (`spec/spec.md` at `main`; `did-dht.com` does not resolve) | https://raw.githubusercontent.com/decentralized-identity/did-dht/main/spec/spec.md |
| `did-dht-registry` | did:dht registry (`spec/registry/spec.md`) | https://raw.githubusercontent.com/decentralized-identity/did-dht/main/spec/registry/spec.md |
| `did-web` | did:web Method Specification (W3C CCG) | https://w3c-ccg.github.io/did-method-web/ |
| `dwn-spec` | DIF Decentralized Web Node spec, Draft | https://identity.foundation/decentralized-web-node/spec/ |
| `dwn-sdk` | `decentralized-identity/dwn-sdk-js` at `main` (README, `src/types/protocols-types.ts`, `src/handlers/records-write.ts`, `src/handlers/records-delete.ts`, `src/core/protocol-authorization.ts`) | https://github.com/decentralized-identity/dwn-sdk-js |
| `dwn-server` | `decentralized-identity/dwn-server` README | https://github.com/decentralized-identity/dwn-server |
| `dwn-user-guide` | `decentralized-identity/dwn-user-guide` README | https://github.com/decentralized-identity/dwn-user-guide |
| `dif-dwn-page` | DIF "DWN Community Node" page | https://identity.foundation/dwn/ |
| `web5-js` | `decentralized-identity/web5-js` README | https://github.com/decentralized-identity/web5-js |
| `web5-docs` | `decentralized-identity/web5-docs`, `site/docs/apps/upgrade-to-web5.mdx` and `site/docs/decentralized-web-nodes/what-are-dwns.md` | https://github.com/decentralized-identity/web5-docs |
| `vc-2.0` | W3C Verifiable Credentials Data Model v2.0, Recommendation 15 May 2025 | https://www.w3.org/TR/vc-data-model-2.0/ |
| `pkarr` | `pubky/pkarr` README | https://github.com/pubky/pkarr |
| `gh-api` | `gh api repos/...` / `orgs/.../repos` results, 2026-08-28 | — |
| `npm` | `npm view <pkg> time.modified`, 2026-08-28 | — |
| `probe` | `curl -o /dev/null -w %{http_code}` against listed hosts, 2026-08-28 | — |
| `adr-0011` | connector ADR 0011 | `/home/jonathan/Documents/connector/docs/adr/0011-rejects-accumulate-fees-and-probes-discover-cost.md` |
| `adr-0044` | connector ADR 0044 | `/home/jonathan/Documents/connector/docs/adr/0044-a-probe-answers-what-a-route-costs-and-what-it-does.md` |
| `adr-0046` | connector ADR 0046 | `/home/jonathan/Documents/connector/docs/adr/0046-the-kind-10032-announce-is-removed-a-connector-needs-no-relay.md` |
| `adr-0050` | connector ADR 0050 | `/home/jonathan/Documents/connector/docs/adr/0050-a-connectors-url-resolves-to-its-self-description.md` |
| `nd-spec` | connector self-description spec | `/home/jonathan/Documents/connector/docs/protocol/self-description-spec.md` |
| `rdlr` | sibling note | `/home/jonathan/Documents/toon-meta/docs/route-discovery-law-research.md` |

---

## 0. The TOON constraints this note measures against

Quoted so the later sections can point at them by key.

> "**A third party's announce is a different object, and this record does not define one.** If a controller publishes
> facts about a node it did not sign, the event is that controller's claim about the node rather than the node's claim
> about itself — a materially different security property from what kind:10032 has meant. Anyone building that is
> defining a new thing and should say so." — `[adr-0046 §Consequences]`

> "A well-known URI (`/.well-known/toon`) assumes the connector owns the origin root; it does not, and `/ilp` is the mount
> point precisely because the root is not the connector's to claim." — `[adr-0050 §Considered alternatives]`

> "A caller learns a description only for a route it addressed and a node that answered. There is no listing, no
> enumeration and no index — those would be announcing, and ADR 0022 still refuses them." — `[adr-0044 §Consequences]`

> "A probe traverses the network and pays nothing, so it is accepted only from a sender that already holds an open payment
> channel with this connector, and is rate-limited per that identity." — `[adr-0011 §Consequences]`

> "**ND-05** … Everything in the document MUST be true **of this connector**" · "**ND-08** … It MUST NOT describe software
> **behind** the connector." · "**ND-09** … It MUST NOT carry **per-peer** facts" · "**ND-14** … A client learns an
> identity **from the node that owns it**." · "**ND-16** … A client MUST NOT trust an identity learned from an unsealed
> reject. It fetches the identity from the URL, over TLS, from the node itself." — `[nd-spec]`

The three bins used in §8: **(a) self-description** — the subject signs claims about itself (what `GET /ilp` is);
**(b) third-party observation** — the object ADR 0046 permits and does not define; **(c) discovery transport/index** —
what a relay is, which the connector may not depend on but an app layer may.

---

## 2. Web5 status — what was actually announced

### 2.1 The wind-down

Block's Q3 2024 shareholder letter, filed to the SEC as an 8-K exhibit on 2024-11-07:

> "Within our emerging initiatives, we are refining our investments based on our progress. We are scaling back our
> investment in TIDAL and winding down TBD. This gives us room to invest in our bitcoin mining initiative, which has strong
> product market fit and a healthy pipeline of demand, and Bitkey, our self-custody wallet for bitcoin." — `[sec-8k]`

That is the whole primary statement. The letter does not mention Web5, DWNs, DIDs, or any repository by name (**not
stated**).

### 2.2 The hand-off to DIF

DIF's post of 26 Nov 2024 (identical text on block.xyz):

> "In support of its decentralized identity work, Block is contributing foundational components developed under the Web5
> umbrella to the Decentralized Identity Foundation (DIF)." — `[dif-blog]`

> "This contribution includes open source repositories for: Decentralized Identifiers (DIDs) … Verified Credentials (VCs)
> … Decentralized Web Nodes (DWNs/ DWeb Nodes) … This technology was developed by TBD and other contributors in open
> source organizations." — `[dif-blog]`

> "These components will now reside in DIF's ecosystem, where they can be further developed and supported by the open
> source community of decentralized identity experts." — `[dif-blog]`

> "'DIF has the right balance of builders and standards creators, commitment to decentralized identity and open source,
> and ability to **incubate the Web5 SDK and components like DWNs and the did:dht method** …' said Manik Surtani, Block
> Open Source Program Office lead." — `[dif-blog]`

> "As one of the most mature, full-featured decentralized DID methods, did:dht is already advancing toward formal
> standardization." — `[dif-blog]`

Who maintains what now, named maintainers, a roadmap, or a working-group assignment for the SDKs: **not stated** in
either post. The DWN *specification* was already a DIF work item before the hand-off: "Decentralized Web Node is a DRAFT
specification under development within the Decentralized Identity Foundation (DIF). It is an active work item of the
Secure Data Storage Working Group at DIF." `[dwn-spec §Status of This Document]`.

### 2.3 What the repositories say

`gh api orgs/TBD54566975/repos` lists 132 public repos; all 132 have `archived: true` `[gh-api]`. Every Web5 repo name
under `TBD54566975/` redirects to `decentralized-identity/`: `web5-js`, `dwn-sdk-js`, `dwn-server`, `did-dht`, `web5-spec`,
`web5-rs` `[gh-api]`. `TBD54566975/developer.tbd.website` (the docs site source) is archived, last push 2024-12-04, and
`https://developer.tbd.website/` returns HTTP 500 `[probe]`. The transferred READMEs were not rewritten: `web5-js` still
opens with "🎉 Hacktoberfest 2024 🎉" and links "the [TBD Developer site](https://developer.tbd.website/docs/)"
`[web5-js README]`; `dwn-sdk-js` still says "This specification is in a draft state and very much so a WIP"
`[dwn-sdk README §Introduction]`. No repo carries a wind-down or maintenance-status notice (**not stated**; checked the
READMEs of `web5-js`, `dwn-sdk-js`, `dwn-server`, `did-dht`, `web5-spec`, `web5-rs`).

Full dates are in §10.

---

## 3. DID Core (W3C) — what a DID Document is and is not

### 3.1 The model

> "Decentralized identifiers (DIDs) are a new type of identifier that enables verifiable, decentralized digital identity. A
> DID refers to any subject (e.g., a person, organization, thing, data model, abstract entity, etc.) as determined by the
> controller of the DID." — `[did-1.1 §Abstract]`

> "The subject of a DID is, by definition, the entity identified by the DID. The DID subject might also be the DID
> controller. Anything can be the subject of a DID: person, group, organization, thing, or concept." — `[did-core §1.3]`

> "The controller of a DID is the entity (person, organization, or autonomous software) that has the capability—as defined
> by a DID method—to make changes to a DID document. This capability is typically asserted by the control of a set of
> cryptographic keys used by software acting on behalf of the controller" — `[did-core §1.3]`

> "DID documents contain information associated with a DID. They typically express verification methods, such as
> cryptographic public keys, and services relevant to interactions with the DID subject." — `[did-core §1.3]`

Core properties: `id` (required), `controller`, `verificationMethod`, `authentication` and the other verification
relationships, and `service` `[did-1.1 §5]`.

### 3.2 Services

> "Services are used in DID documents to express ways of communicating with the DID subject or associated entities. A
> service can be any type of service the DID subject wants to advertise, including decentralized identity management
> services for further discovery, authentication, authorization, or interaction." — `[did-core §5.4]`

> "Each service map MUST contain `id`, `type`, and `serviceEndpoint` properties." — `[did-core §5.4]`; `serviceEndpoint`
> "must be a single string, a single map, or a set composed of one or more strings and/or maps. Each string value MUST be a
> valid URL." — `[did-1.1 §5.4]`

### 3.3 Resolution is method-specific

> "A DID resolver is a system component that takes a DID as input and produces a conforming DID document as output. This
> process is called DID resolution. The steps for resolving a specific type of DID are defined by the relevant DID method
> specification." — `[did-core §1.3]`

> "The DID resolution functions resolve a DID into a DID document by using the "Read" operation of the applicable DID
> method … The details of how this process is accomplished are outside the scope of this specification" — `[did-core §7.1]`

### 3.4 What a DID Document proves

> "Some DID methods allow digital signatures and other proofs to be included in the DID document or a 7.3 Metadata
> Structure. However, such proofs by themselves do not necessarily prove control over a DID, or guarantee that the DID
> document is the correct one for the DID. In order to obtain the correct DID document and verify control over a DID, it
> is necessary to perform the DID resolution process as defined by the DID method." — `[did-core §9.2 Note: Signed DID documents]`

### 3.5 Read against TOON

A DID Document is the controller's assertion about the subject; everything in it — keys, services — is placed there by
whoever holds the controlling keys. That is the same trust shape as `GET /ilp`: "a fact it either proved at startup or
was configured with, about itself" `[nd-spec ND-05]`. The two differences are structural, not trust-related:
(i) a DID is a *name* whose resolution is method-defined, whereas `/ilp` is a URL you must already hold — a DID can
therefore name a road or a node before you know where it lives, if the method's registry is reachable; (ii) a DID
Document has a `service` array of typed endpoints, whereas `/ilp` carries the connector's own endpoints only. Whether a
`service` entry could carry "what runs behind this connector" is exactly what ND-08 forbids the connector's own document
from carrying; a DID Document that did so would be a self-description grown past ND-08, not a third-party object.

Could a *road* be a DID subject? By the definition ("thing, or concept") yes; but the DID's controller would be whoever
minted it, and §3.4 says the document proves nothing about the subject beyond the controller's key. DID Core gives a road
an identifier; it does not say what a road is (`[rdlr §6]` #4).

---

## 4. did:dht — the closest analogue to "an announce that needs no relay"

### 4.1 Mechanism

> "DID DHT makes use of Mainline DHT, specifically BEP44 to store signed mutable records. This DID method uses DNS
> Resource Records to efficiently represent DID Documents." — `[did-dht §Abstract]`

Why Mainline: "1. It has a proven track record of 15 years. 2. It is the biggest DHT in existence with an estimated 10
million servers. 3. It retains data for multiple hours at no cost. 4. It has been implemented in most languages and is
stable." `[did-dht §Abstract]`

> "A unique property of DID DHT is its dependence on a single non-rotatable key, which we refer to as an *Identity Key
> Pair* … This requirement stems from BEP44" — quoting BEP44: "To authenticate that only the original publisher can update
> an item, it is signed by a private key generated by the original publisher." — `[did-dht §Identity Key Pair]`

> "Consequently, DHT records, including DID DHT Documents, are *independently verifiable*. This independence implies that
> trust in a specific Mainline or Gateway server for providing unaltered messages is unnecessary." — `[did-dht §Identity Key Pair]`

Who can publish: "Entries to the DHT require a signed record as per BEP44. As such, the key pair used for the Mainline
identifier is also used to sign the DHT record." `[did-dht §Operations]` — only the identity-key holder. The DID *is* the
key: `did-dht-format := did:dht:Z-BASE-32(raw-public-key-bytes)` `[did-dht §Format]`.

Size: the DNS packet is "stored in the DHT encoded as a BEP44 payload" `[did-dht §DIDs as DNS Records]`; Pkarr, the
underlying scheme, states the bound plainly: "**1000-byte limit** — PKARR is for discovery, not storage" `[pkarr README]`.

### 4.2 TTL and republishing

> "The ****RECOMMENDED**** TTL value is 7200 seconds (2 hours), the default TTL for Mainline records." — `[did-dht §DIDs as DNS Records]`

> "Mainline offers a limited duration (approximately 2 hours) for retaining records in the DHT. To ensure the
> verifiability of data signed by a DID, consistent republishing of DID Document records is crucial." — `[did-dht §Republishing Data]`

> "It is ****RECOMMENDED**** that updates be infrequent — at least every 2 hours — as DHT caching is highly encouraged."
> — `[did-dht §Update]`

Pkarr: "**Records are ephemeral** — The DHT drops records after hours; republish periodically" `[pkarr README]`.

Deactivation: "1. Let the DHT record expire and cease to publish it. 2. Publish a new DHT record where the `rdata` of the
root DNS record is the string `deactivated`." `[did-dht §Deactivate]`

### 4.3 Gateways, retention, and the registry

> "Gateways serve as specialized servers, providing a range of DID-centric functionalities that extend beyond the
> capabilities of a standard Mainline DHT servers." — `[did-dht §Gateways]`

> "As a feature of the DID DHT Method, operators of a Gateway ****MUST**** support retaining DIDs for extended periods of
> time to reduce the burden on DID controllers and Clients in needing to republish their records to Mainline." — `[did-dht §Retained DID Set]`

Retention is bought with proof of work, not money: "A Retention Solution is a form of proof of work bound to a specific
DID identifier … Difficulty values are supplied by the gateway, and ****MUST**** be no less than 26 bits of the 256-bit
hash value." `[did-dht §Generating a Retention Solution]`; "conformant Gateways respond with an `expiry` timestamp"
`[did-dht §Generating a Retention Solution, note]`.

Gateway discovery: "operators of a Gateway ****MAY**** choose to make their server discoverable through a Gateway
Registry … As a convenience, one such registry is provided by this specification" `[did-dht §Discovering Gateways]`. The
registry's only defined mechanism is Bitcoin-anchored: "By scanning the Bitcoin blockchain, active gateways can be
identified … Generate a relative timelock transaction … Set the lock duration to 1000 … Add an `OP_RETURN` string
composed of … The `URI` where your node can be addressed" `[did-dht-registry §Bitcoin Anchored Gateways]`. The registry
file lists **no** concrete gateway hostnames (**not stated**).

### 4.4 Type indexing — the spec's own discovery feature

> "Type indexing is an **optional** feature that enables DIDs to become **discoverable**, by flagging themselves as being
> of a particular type. Types are not included as part of the DID Document, but rather as part of the DNS packet. This
> allows for DIDs to be indexed by type by Gateways, and for DIDs to be resolved by type." — `[did-dht §Type Indexing]`

Registered types: `Discoverable 0`, `Organization 1`, `Government Organization 2`, `Corporation 3`, `Local Business 4`,
`Software Package 5`, `Web App 6`, `Financial Institution 7` `[did-dht-registry §Indexed Types]`.

> "Identifying entities through type-based indexing is a relatively unreliable practice. It serves as an initial step in
> recognizing the identity linked to a DID. To validate identity assertions in a more robust manner, it is essential to
> delve deeper, employing tools like verifiable credentials and the interrogation of related data." — `[did-dht §Type Indexing, note]`

### 4.5 Controllers are not checked

> "Controllers are not cryptographically verified by Gateways or this DID method. This means any DID may choose to list a
> controller, even if there is no relationship between the identifiers. As such, DID controllers should be interrogated
> to assert the integrity of their relations." — `[did-dht §Verification Methods, note]`

### 4.6 Is it still running?

`did-dht.com` — the spec's "Latest Draft" URL and the target of the `identity.foundation/did-dht/` redirect — fails DNS
resolution; so does `diddht.tbddev.org`, the TBD gateway `[probe]`. The spec's own example service record points at
`https://dwn.tbddev.org/dwn5` `[did-dht §DIDs as DNS Records]`, which also fails DNS `[probe]`. The Mainline DHT itself and
Pkarr are independent of TBD: `pubky/pkarr` was pushed 2026-08-25 and its relays `relay.pkarr.org` and
`pkarr.pubky.app` answer HTTP 200 `[gh-api]` `[probe]`. So a `did:dht` record can still be published and resolved through
Pkarr today; what is gone is TBD's gateway, and with it the retained-set and type-index services the gateway provided.
The `did-dht` repo's last commit is 2024-11-01 ("Remove take action after Hacktoberfest") `[gh-api]`.

### 4.7 Read against TOON

Every property of a `did:dht` record is the identity-key holder's own statement — bin **(a)**. What it adds over `/ilp` is
purely *where the copy lives*: not at a URL you must already know but in a DHT keyed by the public key, republished every
two hours by the holder or a PoW-paying gateway. `[adr-0050]` dropped `ttl_secs` on the reasoning that "a *pushed* copy
needed a shelf life; a pulled one does not" (`[rdlr §6]` #14); a `did:dht` record is precisely a pushed copy with a
`7200`-second shelf life and a republish obligation. It is an announce; ADR 0022/0046 say the connector never makes one,
and the controller may. Type indexing is a **(c)** index of **(a)** self-declared types — the thing `[adr-0044]` refuses
for the connector, offered here as an optional gateway service, and described by its own authors as "relatively
unreliable".

---

## 5. did:web — the `/.well-known/` comparison

### 5.1 Resolution

> "The method specific identifier is a fully qualified domain name that is secured by a TLS/SSL certificate with an
> optional path to the DID document." — `[did-web §Method-specific identifier]`

The resolve steps, verbatim: "Replace ":" with "/" in the method specific identifier … Generate an HTTPS URL to the
expected location of the DID document by prepending `https://`. If no path has been specified in the URL, append
`/.well-known`. Append `/did.json` to complete the URL. Perform an HTTP `GET` request … Verify that the ID of the resolved
DID document matches the Web DID being resolved." `[did-web §Read (Resolve)]`

Examples: `did:web:w3c-ccg.github.io -> https://w3c-ccg.github.io/.well-known/did.json`;
`did:web:w3c-ccg.github.io:user:alice -> https://w3c-ccg.github.io/user/alice/did.json` `[did-web §Create (Register)]`.

### 5.2 What controls the document

> "This DID method does not specify any authentication or authorization mechanism for writing to, removing or creating
> the DID Document, leaving it up to implementations to protect did:web documents as with any other web resource." —
> `[did-web §Authentication and Authorization]`

> "To delete the DID document, the `did.json` has to be removed or has to be no longer publicly available due to any other
> means." — `[did-web §Deactivate (Revoke)]`

> "When optional paths to DID documents are used to resolve documents rather than bare domains, verification with signed
> data proves that the entity in control of the file indicated in the path has the private keys. It does not prove that
> the domain operator has the private keys." — `[did-web §Optional Path Considerations]`

### 5.3 Leakage on resolution

> "Due to the nature of the did:web method relying upon a DNS in order to resolve the web server, all resolutions of a
> did:web identifier have the potential to be tracked by a DNS provider. Additionally, due to the DID Document being
> stored on a web server, each time the DID Document resource is retrieved, the web server has the ability to track the
> resolution of the DID Document." — `[did-web §DNS Privacy Considerations]`

### 5.4 Read against TOON

The bare-domain form is exactly the shape `[adr-0050]` rejected: it "assumes the connector owns the origin root". The path
form does not — `did:web:relay.example:ilp` would resolve to `https://relay.example/ilp/did.json`, a sub-path the
connector could own on the same reasoning that gave it `/ilp`. But the document is still a file the origin operator
serves and can remove — bin **(a)**, with the same trust properties as `/ilp` (TLS-to-origin) and one fewer guarantee (no
statement that the document is signed at all; did:web relies on transport security). The resolution-tracking note in §5.3
is the same leakage `[rdlr §6]` #15 asks about for relay reads, stated for HTTPS fetches.

---

## 6. Decentralized Web Nodes (DIF spec)

### 6.1 What a DWN is

> "A Decentralized Web Node (DWN) is a data storage and message relay mechanism entities can use to locate public or
> private permissioned data related to a given Decentralized Identifier (DID)." — `[dwn-spec §Abstract]`

Located via the DID Document: "The following DID Document Service Endpoint entries MUST be present in the DID Document of
a target DID for resolution to properly locate the URI for addressing a DID owner's Decentralized Web Nodes" — `id`
"MUST be set to `#dwn`", `type` "MUST be set to `DecentralizedWebNode`", `serviceEndpoint` a URL or array of URLs, and
"If a Service Endpoint URL is a DID, it MUST NOT not be followed more than 1 level deep when resolving." `[dwn-spec §Service Endpoints]`

### 6.2 Records

`RecordsWrite`: "The message object MUST contain a `recordId` property … The object MUST contain an `interface` property,
and its value MUST be the string `Records`. The object MUST contain a `method` property, and its value MUST be the string
`Write`." Optional `protocol` (+ mandatory `protocolVersion`), `schema` ("MUST be treated as an immutable value for the
lifetime of the logical record"), and `published`: "A value of `true` indicates the record has been published for public
queries and consumption without requiring authorization. A value of `false` or the absence of the property indicates the
record MUST NOT be served in response to public queries that lack proper authorization." `[dwn-spec §RecordsWrite]`

Timestamps are attributed to "the DID owner or another permitted party": "`dateCreated` … the time the RecordsWrite was
created by the DID owner or another permitted party" `[dwn-spec §RecordsWrite]`.

`RecordsQuery`: descriptor `interface: Records`, `method: Query`, `messageTimestamp`, and an optional `filter` that "MAY
contain" `attester` ("representing the creator of the Record(s) did"), `recipient` (sic: "receipient property representing
the recipient of the Record(s) DID"), `schema`, `recordId`, `parentId`, `contextId`, `dateCreated`, `protocol`,
`protocolVersion`, `dataFormat`, `dateSort` `[dwn-spec §RecordsQuery]`.

### 6.3 Protocols — who may write what

> "Protocols are used to describe common rules that DWNs will follow when dealing with specific types and structures of
> data. Through Protocol Definitions a DWN Owner can define how a protocol should behave." — `[dwn-spec §Protocols]`

> "Protocol Definition objects are declarative rules within ProtocolConfigure messages that specify the types,
> relationships, and interactions that are permitted under a given protocol installed in a DWeb Node. Inbound callers who
> wish to interact with a protocol must adhere to these rules, which DWeb Nodes enforce." — `[dwn-spec §Protocol Definitions]`

The rule grammar appears twice in the draft with different `can` vocabularies. In the definition-object section:
"The object MUST contain a `who` property and it MUST have one of the following values: `anyone` `author` `recipient` …
The object MUST contain a `can` property and it MUST have a value of either `read` or `write` … The object MAY contain a
`of` property and it MUST have a string value that references one of the `types`" `[dwn-spec §Protocol Definitions]`. In
the ruleset section: "`can` property, which MUST be one of the following values: `create` `delete` `query` `subscribe`
`read` `updated` `co-delete` `co-update`" `[dwn-spec §Protocol Ruleset]` (the string `updated` is as printed). The
reference implementation's enum is `CoDelete, CoPrune, CoUpdate, Create, Delete, Prune, Query, Read, Subscribe, Update`
and `ProtocolActor` is `Anyone | Author | Recipient` `[dwn-sdk protocols-types.ts]`; a rule may alternatively name a
`role` ("Mutually exclusive with `who`") `[dwn-sdk protocols-types.ts]`.

So "anyone may write an observation into X's DWN" is expressible: X installs a protocol whose `structure` has a type with
`$actions: [{ who: "anyone", can: ["create"] }]` (or `can: write` in the older grammar). The spec's example is exactly
this: `"post": { "$actions": [{ "who": "anyone", "can": ["read", "write"] }] }` `[dwn-spec §Protocols, example]`.

### 6.4 Can the owner be prevented from deleting it?

The spec: **not stated**. There is no sentence granting or denying the DWN owner authority over protocol-governed records;
the `$actions` grammar has no actor value for "the tenant" and no negative rule. The "Permissions" section is a
placeholder: "TODO Detail how Permissions are requested, granted, revoked and processed" `[dwn-spec §Permissions]`.

The reference implementation answers it: the tenant is authorised before any rule is consulted.

> ```ts
> if (recordsDelete.author === tenant) {
>   return;
> } else if (recordsWrite.message.descriptor.protocol !== undefined) {
>   await ProtocolAuthorization.authorizeDelete(tenant, recordsDelete, recordsWrite, messageStore);
> }
> ```
> — `[dwn-sdk records-delete.ts §authorizeRecordsDelete]`

> ```ts
> } else if (recordsWrite.author === tenant) {
>   // if author is the same as the target tenant, we can directly grant access
>   return;
> ```
> — `[dwn-sdk records-write.ts §authorizeRecordsWrite]`

> "// NOTE: We have already checked that the message is not from tenant, owner, or permission grant authorized prior to
> this method being called." — `[dwn-sdk protocol-authorization.ts §authorizeAgainstAllowedActions]`

Queries likewise split on ownership: "Fetches the records as the owner of the DWN with no additional filtering." vs
"Fetches the records as a non-owner." `[dwn-sdk records-query.ts]`. In the reference DWN, then, a record a third party
writes about X into X's DWN is X's to delete; the "cannot delete" half of the question has no mechanism.

### 6.5 Sync

> "The Sync interface and its methods allow different Decentralized Web Nodes to communicate and sync on the state of the
> data they contain, including replication of messages and files." — `[dwn-spec §Sync]`

That is the whole normative text of the section in the draft; it is about one DID's several nodes ("enabling the owning
entity to operate multiple nodes that sync to the same state across one another" `[dwn-spec §Abstract]`), not about
replication between different DIDs' nodes (**not stated**).

### 6.6 Servers and hosting

`dwn-server` "Exposes a multi-tenanted DWN (aka Decentralized Web Node) through a JSON-RPC API over `http:` and `ws:`"
`[dwn-server README]`. DIF's community instance: "Powered by Google Cloud and TBD, and operated by the Decentralized
Identity Foundation … It's designed to enable easy integration of DWNs for non-production use … The DWN Community Node
service provides a platform for testing and development purposes, and is not intended for production environments."
`[dif-dwn-page]`. Endpoint `https://dwn.gcda.xyz` `[dwn-user-guide README]`, HTTP 200 on 2026-08-28 `[probe]`.

### 6.7 Read against TOON

A DWN is bin **(c)**: a per-DID store with a query interface and `published: true` records anyone may read — a relay whose
address you learn from the owner's DID Document rather than out of band. Two placements of the road object are possible
and neither closes the gap:

- **In the observed node's DWN.** Requires the node's operator to (i) have a DID with a `#dwn` service, (ii) install a
  protocol with `who: anyone`, and (iii) not delete. (iii) is unenforceable in the reference implementation (§6.4).
  Functionally this is the node hosting a guestbook about itself — a **(c)** transport the node controls, which for the
  connector `[adr-0046]` says it must not depend on and `[adr-0050 §What it carries]` says the operator "advertises …
  elsewhere".
- **In the walker's DWN.** A clean **(b)** object, signed by the walker, about a road. But it is reachable only by
  resolving the walker's DID — you must already know who walked. There is no cross-DID query in the spec; the walker's
  DWN is an index of one signer's records, and finding walkers is the original problem. (`[rdlr §6]` #18 "which relay"
  becomes "which walker's DWN".)

---

## 7. Decentralized Web Apps

TBD's own definition, from the migration guide in the transferred docs repo:

> "Unlike in a traditional web app, where storage is remote, your Decentralized Web App (DWA) can store data on a locally
> reproduced DWN. Although DWNs are publicly addressable, you'll simply need to connect to your DWN once using the
> connect method, then you can repeatedly query its data." — `[web5-docs upgrade-to-web5.mdx §Creating or connecting with a DWN]`

> "DWNs are one monolithic data store, so you don't need to call specific endpoints on them. Instead, once you've
> connected to a DWN with your instance of `web5`, you can make calls into the data store using the query method" —
> `[web5-docs upgrade-to-web5.mdx §Reading from the DWN]`

The SDK README: "Web5 decentralized web applications are built using decentralized identifiers (DIDs), verifiable
credentials (VCs), and decentralized web node (DWN) datastores." `[web5-js README §Decentralized Web Packages]`. The DWN
docs distinguish the two authorisation routes an app uses: "**Permissions:** Allow someone access to read, write, or
delete specific data records on your node. **Protocols:** Install a protocol that lets you define data types and
authorization for a decentralized web app." `[web5-docs what-are-dwns.md]`

No concept beyond "app whose storage is a DWN" appears in these sources (**not stated**). A DWA is the consumer of §6, not
a fourth mechanism; it contributes nothing to discovery that the DWN does not.

---

## 8. Verifiable Credentials

### 8.1 Roles and the third-party shape

> "**issuer** A role an entity can perform by asserting claims about one or more subjects, creating a verifiable
> credential from these claims, and transmitting the verifiable credential to a holder." · "**subject** A thing about
> which claims are made." · "**credential** A set of one or more claims made by an issuer. The claims in a credential can
> be about different subjects." — `[vc-2.0 §2 Terminology]`

> "A verifiable credential MUST have an `issuer` property." … "the issuer selects this URL to identify itself in a
> globally unambiguous way. It is RECOMMENDED that the URL be one which, if dereferenced, results in a controlled
> identifier document … about the issuer that can be used to verify the information expressed in the credential." —
> `[vc-2.0 §4.7]`

> "A verifiable credential MUST contain a `credentialSubject` property." … "Each object MAY also contain an `id` property
> to identify the subject" — `[vc-2.0 §4.8]`

Issuer and subject are separate slots by construction; "I walked road R from node A and N packets came back fulfilled"
is a claim by the walker (issuer) about R (subject) and fits the model as-is.

### 8.2 What VC adds over a NIP-01 signed event

- **Proof envelope choice:** "This specification recognizes two classes of securing mechanisms: those that use enveloping
  proofs and those that use embedded proofs … One such RECOMMENDED enveloping proof mechanism is defined in Securing
  Verifiable Credentials using JOSE and COSE … One such RECOMMENDED embedded proof mechanism is defined in Verifiable
  Credential Data Integrity 1.0" `[vc-2.0 §4.12]`.
- **Validity window:** `validFrom` / `validUntil` `[vc-2.0 §4.9]`.
- **Status / revocation:** "This specification defines the `credentialStatus` property for discovering information related
  to the status of a verifiable credential, such as whether it is suspended or revoked." `[vc-2.0 §4.10]`
- **Schema:** `credentialSchema` `[vc-2.0 §4.11]`.
- **Selective disclosure:** the data model names it and defers to cryptosuites ("Some selective disclosure schemes can
  share a subset of claims" `[vc-2.0 §5.7]`); the example credentials in §4 are rendered in `ecdsa`, `ecdsa-sd`, `bbs`
  variants `[vc-2.0 §4.7, §4.8 examples]`.

A NIP-01 event has one signature scheme, no validity window (NIP-40 is advisory), no status pointer, and no schema slot;
its `d`-tag addressability and relay overwrite semantics are what it has instead (see the sibling NIP note).

### 8.3 Trust is explicitly out of scope

> "The verifier expects the issuer to verifiably issue the credential that it receives." … "The holder and verifier
> expect the issuer to stand by claims it makes in credentials about the subject, and to revoke credentials quickly if
> and when they no longer stand by those claims." — `[vc-2.0 §5.1 Trust Model]`

> "Where no pre-existing trust relationship exists, the holder might have some out-of-band means of determining whether
> the issuer is qualified to issue the verifiable credential being provided." — `[vc-2.0 §5.1]`

> "How verifiers decide which issuers to trust, and for what data or purposes, is out of scope for this recommendation."
> — `[vc-2.0 §5.1]`

> "a verifier validates the included claims using their own business rules before relying on them" — `[vc-2.0 §1.2]`

### 8.4 Read against TOON

VC is the only Web5 piece that is natively bin **(b)**. It is a format for the object ADR 0046 permits and would satisfy
"should say so" mechanically (a `type` array names the credential class). What it does *not* do is decide anything: who
the issuer must be, what a fulfilled-packet count means, or whether a verifier should believe it — all handed to
"business rules". That is the same place the yellow-brick-road essay leaves it ("only you can" — `[rdlr §4.4]`).

---

## 9. Mapping to TOON's bins and to the §6 questions

### 9.1 Which bin each concept falls in

| Concept | (a) self-description | (b) third-party observation | (c) transport / index | Note |
|---|---|---|---|---|
| DID Document (any method) | **yes** — controller-asserted `[did-core §9.2]` | no | no | adds a resolvable *name* and typed `service` slots over `/ilp` |
| `did:dht` record | **yes** — identity-key holder only `[did-dht §Operations]` | no | gateway type-index is (c) over (a) `[did-dht §Type Indexing]` | pushed copy, 7200 s TTL, republish `[did-dht §Republishing Data]` |
| `did:web` document | **yes** — file the origin serves `[did-web §Authentication and Authorization]` | no | no | bare form = the `/.well-known/` ADR 0050 rejected; path form does not need the root |
| DWN protocol with `who: anyone` | no | can *hold* (b) records | **yes** — per-DID store + `RecordsQuery` `[dwn-spec §Abstract]` | owner overrides rules in reference impl `[dwn-sdk records-delete.ts]` |
| DWN in the walker's DID | no | **yes** — walker's signed records | (c) of one signer only | reachable only via the walker's DID |
| DWN Sync | — | — | intra-DID only `[dwn-spec §Sync]` | not cross-DID replication |
| DWA | — | — | consumer of DWN `[web5-docs upgrade]` | no additional concept |
| Verifiable Credential | can be (issuer = subject) | **yes** — issuer ≠ subject `[vc-2.0 §2]` | no | format only; trust "out of scope" `[vc-2.0 §5.1]` |
| Pkarr / Mainline DHT | — | — | **yes** — key-addressed 1000-byte store `[pkarr README]` | live and independent of TBD |

### 9.2 The twenty questions, one by one

"Addresses" below means *a Web5 source states something that bears on the question*; "partial" means it supplies a slot or
mechanism but not the semantics or the trust decision; "does not address" means the sources are silent.

**Identity and signing**

1. *Who signs; what does the signature attest?* — **partial.** VC makes the signer a first-class `issuer` distinct from the
   subject `[vc-2.0 §4.7, §2]`; DWN records carry an `attester` `[dwn-spec §RecordsQuery]`. Neither says what a walker's
   signature attests beyond "the issuer generated the credential" `[vc-2.0 §5.1]`.
2. *Trust root, distribution path, revocation story.* — **partial.** Revocation: `credentialStatus` `[vc-2.0 §4.10]`; a
   `did:dht` document can be `deactivated` `[did-dht §Deactivate]`; a did:web doc is revoked by removing the file
   `[did-web §Deactivate]`. Distribution path: DWN or DHT (§9.1). Trust root: "out of scope" `[vc-2.0 §5.1]`;
   "Controllers are not cryptographically verified" `[did-dht §Verification Methods]`. **Does not address** the trust root.
3. *Naming it visibly as "a different object".* — **partial.** VC `type`, DWN `protocol` URI + `schema`
   `[dwn-spec §RecordsWrite]` give a namespace to say so in; whether a namespace suffices is not something these sources
   speak to.

**What a road is**

4. *Unit of the object — prefix, hop, or path.* — **does not address.** DID Core lets "concept" be a subject
   `[did-core §1.3]`, so a road could be given a DID; nothing defines what the DID would denote.
5. *Whose per-peer facts are disclosed.* — **does not address.**
6. *What may be said about the end of the road.* — **does not address.** DID `service` entries are the subject's own
   advertisement `[did-core §5.4]`; the DWN spec caps service-DID indirection at one level
   `[dwn-spec §Service Endpoints]`; nothing is said about third parties describing a node.
7. *May the object carry a terminating node's key?* — **does not address**, and DID Core's own advice runs the other way:
   to trust a key "it is necessary to perform the DID resolution process as defined by the DID method"
   `[did-core §9.2]` — i.e. go to the registry, which for `did:dht` is the holder's own signed record, consistent with
   ND-14/ND-16's "from the node that owns it".

**Cost, cap, "worth walking"**

8–11. *Unit/currency of cost; meaning of a published cost; cap; "worth walking".* — **does not address.** No Web5 source
   models cost, price, cap, or reputation. `did:dht`'s retention challenge prices *gateway retention* in proof of work
   `[did-dht §Generating a Retention Solution]`, which is a fee for storage, not a statement about a road.

**Verification by the client**

12. *How does a client verify a claim?* — **does not address.** VC: "a verifier validates the included claims using their
    own business rules" `[vc-2.0 §1.2]`.
13. *Object vs node self-description disagree.* — **does not address.** (DID Core's only priority rule is between
    signatures-in-document and resolution, §3.4; not between a third party and the subject.)
14. *Shelf life.* — **partial.** VC `validFrom`/`validUntil` `[vc-2.0 §4.9]`; `did:dht` TTL `7200` and "approximately 2
    hours" DHT retention `[did-dht §Republishing Data]`; DWN records: **not stated**. These are mechanisms; whether a
    pushed road object *should* have one is what ADR 0050 argued and these sources do not.

**What leaks about the walker**

15. *What a read reveals.* — **partial.** did:web names the same leakage for its own resolution: "all resolutions … have
    the potential to be tracked by a DNS provider … the web server has the ability to track the resolution"
    `[did-web §DNS Privacy Considerations]`; `did:dht` claims the opposite property, "trust in a specific Mainline or
    Gateway server … is unnecessary" `[did-dht §Identity Key Pair]` (about integrity, not about who sees the lookup —
    **not stated**). DWN: **not stated**.
16. *Attributable probes / steering patterns.* — **does not address.**
17. *Publishing a walker's packet history; consent.* — **partial.** VC selective disclosure `[vc-2.0 §5.7]` and DWN
    `published: false` + `encryption` `[dwn-spec §RecordsWrite]` are mechanisms by which the walker chooses what to
    reveal; whose history and with what consent are not addressed.

**Relay and the rest of the stack**

18. *Which relay; who pays to write.* — **does not address** in TOON's terms. The DWN answer is "the DID's own node",
    reached via its DID Document `[dwn-spec §Service Endpoints]`; DIF's community node is free and "not intended for
    production" `[dif-dwn-page]`; `did:dht` gateways charge proof of work, not payment `[did-dht §Retained DID Set]`.
19. *Replacement for `g.toon.ario`'s discoverability.* — **does not address.**
20. *Stale toon-meta readers.* — **does not address.**

---

## 10. Practical status on 2026-08-28

| Item | Where | Archived? | Last push / commit | Notes |
|---|---|---|---|---|
| `TBD54566975` org | GitHub | 132 / 132 public repos archived `[gh-api]` | — | Web5 repos redirect to `decentralized-identity/` |
| `web5-js` | `decentralized-identity/web5-js` | no | pushed 2025-03-01; last `main` commit 2024-10-22 "Version Packages (#962)" `[gh-api]` | README unchanged from TBD era |
| `dwn-sdk-js` | `decentralized-identity/dwn-sdk-js` | no | pushed 2024-10-23; last commit 2024-10-23 "update version for new release (#828)" `[gh-api]` | |
| `dwn-server` | `decentralized-identity/dwn-server` | no | pushed 2025-02-11 `[gh-api]` | |
| `did-dht` | `decentralized-identity/did-dht` | no | pushed 2025-03-10; last `main` commit 2024-11-01 `[gh-api]` | spec "Last Updated: July 25, 2024" `[did-dht]` |
| `decentralized-web-node` (spec) | `decentralized-identity/` | no | pushed 2024-09-04; last commit "fixes #297 (#311)" `[gh-api]` | "Draft" `[dwn-spec]` |
| `web5-spec` | `decentralized-identity/web5-spec` | no | pushed 2026-05-06 (dependabot branches); last `main` commit 2024-10-24 `[gh-api]` | |
| `web5-go` | `decentralized-identity/web5-go` | no | pushed 2026-07-02; last `main` commit 2024-12-16 `[gh-api]` | |
| `web5-docs` | `decentralized-identity/web5-docs` | no | pushed 2024-12-17 `[gh-api]` | source of the DWA text in §7 |
| `developer.tbd.website` | `TBD54566975/` | **yes**, 2024-12-04 `[gh-api]` | — | site returns HTTP 500 `[probe]` |
| `@web5/api`, `@web5/dids`, `@web5/agent`, `@web5/credentials`, `@web5/dwn-server`, `@tbd54566975/dwn-sdk-js` | npm | — | all `time.modified` 2024-12-04 `[npm]` | latest `0.12.0`, `1.2.0`, `0.8.1`, `1.1.3`, `0.6.1`, `0.5.2` |
| `did-dht.com` | DNS | — | — | does not resolve `[probe]`; `identity.foundation/did-dht/` 301s to it |
| `diddht.tbddev.org`, `dwn.tbddev.org` | DNS | — | — | do not resolve `[probe]` |
| `dwn.gcda.xyz` (DIF community DWN) | HTTP | — | — | 200 `[probe]`; "not intended for production" `[dif-dwn-page]` |
| `pubky/pkarr` | GitHub | no | pushed 2026-08-25 `[gh-api]` | relays `relay.pkarr.org`, `pkarr.pubky.app` return 200 `[probe]` |
| DID 1.1 | W3C | — | CR Snapshot 05 March 2026 `[did-1.1]` | DID Core 1.0 remains the Recommendation (19 July 2022) `[did-core]` |
| VC Data Model 2.0 | W3C | — | Recommendation 15 May 2025 `[vc-2.0]` | |

---

## 11. What I could not verify

- **A named maintainer or roadmap for the transferred SDKs.** Neither `[dif-blog]` nor `[block-post]` names one; the
  transferred READMEs still point at TBD's Discord and dead docs site. "Incubate" is the only word used.
- **Whether any `did:dht` gateway is running anywhere.** The registry defines only a Bitcoin-timelock discovery mechanism
  and lists no hostnames; I did not scan the Bitcoin chain for `OP_RETURN` gateway records. TBD's gateway hostname is
  gone from DNS. Pkarr relays (not did:dht gateways) are up.
- **The Block shareholder letter's full context.** I quoted the one sentence naming TBD from the SEC exhibit; the
  surrounding document is a financial letter and says nothing further about Web5 that I found by searching for "TBD".
- **DWN owner-override in the *spec*.** §6.4 rests on the reference implementation's code; the spec is silent, and a
  different implementation could in principle honour a `who: anyone` rule against its own tenant. I found no such
  implementation and no spec text requiring or forbidding it.
- **Live behaviour of `dwn.gcda.xyz`.** I confirmed HTTP 200 on the root, not that it accepts `RecordsWrite` from an
  arbitrary DID today or what its terms of service permit.
- **did:dht resolution end-to-end.** I did not publish or resolve a `did:dht` document through Pkarr in this session; the
  claim that it "can still be published and resolved" (§4.6) rests on Pkarr's relays answering and its repo being active,
  not on a test.
- **Contents of the DIF Secure Data Storage WG's current agenda** for the DWN spec beyond the "active work item" line in
  the spec's status section; the WG page I fetched describes scope, not activity.
- **`did-dht.com` archival copies.** I used the repo's `spec/spec.md` at `main`, which states it is the same document; I
  did not diff against a cached rendering of the site.
