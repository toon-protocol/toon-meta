# Which NIPs model "a third party reports what it observed about, or recommends, something else on the network"?

**Status:** Research note · **Date:** 2026-08-28 · **Audience:** protocol design

**Summary.** Of the five NIPs surveyed, exactly one defines an event whose signer is a third party and whose payload is an *observation* of the subject: NIP-66's kind `30166` relay discovery event, signed by a monitor, addressed by the relay's URL in its `d` tag, carrying probe results (`rtt-open`/`rtt-read`/`rtt-write`) and inferred capability tags, with the spec stating outright that the data "MAY contradict" the relay's own NIP-11 self-description and that a monitor "may publish erroneous `30166` events" [66.md §Relay Discovery Events; §Risk Mitigation]. NIP-89's kind `31989` is also third-party-signed, but it is a *recommendation* keyed by event kind rather than a measurement keyed by subject [89.md §Recommendation event]. NIP-90's `6000-6999`/`7000` events are signed by a service provider about a specific customer's job — a per-request receipt, not a standing report about a network resource — and the NIP is marked `unrecommended` [90.md header; §Job result]. NIP-11 (an unsigned HTTP JSON document served by the relay itself), NIP-65 (kind `10002`, the user's own relay list), NIP-66's kind `10166` (the monitor announcing itself), and NIP-89's kind `31990` (the application describing itself) are all self-description [11.md §Relay Information Document; 65.md; 66.md §Relay Monitor Announcements; 89.md §Handler information]. None of the surveyed NIPs defines a staleness rule or references NIP-40; freshness comes only from NIP-01's replaceable/addressable "latest wins" overwrite, and NIP-40's `expiration` tag is a generic, advisory (`SHOULD`) mechanism any of them could carry [01.md §Kinds; 40.md]. None defines verification of the claim; NIP-66 and NIP-89 both push trust to querying multiple sources / the user's follow graph [66.md §Risk Mitigation; 89.md §Example].

All quotes below are from the raw files in `nostr-protocol/nips` at `master` = commit `24b2ae9fdfeb4e5c0d3be854df5977b81afe1983` (2026-08-27T15:14:00Z), fetched 2026-08-28. Where a spec does not state something, this note says "not stated".

---

## Sources

| Cite key | URL |
|---|---|
| `01.md` | https://raw.githubusercontent.com/nostr-protocol/nips/master/01.md |
| `11.md` | https://raw.githubusercontent.com/nostr-protocol/nips/master/11.md |
| `40.md` | https://raw.githubusercontent.com/nostr-protocol/nips/master/40.md |
| `65.md` | https://raw.githubusercontent.com/nostr-protocol/nips/master/65.md |
| `66.md` | https://raw.githubusercontent.com/nostr-protocol/nips/master/66.md |
| `89.md` | https://raw.githubusercontent.com/nostr-protocol/nips/master/89.md |
| `90.md` | https://raw.githubusercontent.com/nostr-protocol/nips/master/90.md |

Commit pin: https://github.com/nostr-protocol/nips/commit/24b2ae9fdfeb4e5c0d3be854df5977b81afe1983

---

## 0. Prerequisites: NIP-01 kind classes and NIP-40 expiration

### NIP-01 kind ranges

NIP-01 defines four classes by kind number [01.md §Kinds]:

> - for kind `n` such that `1000 <= n < 10000 || 4 <= n < 45 || n == 1 || n == 2`, events are **regular**, which means they're all expected to be stored by relays.
> - for kind `n` such that `10000 <= n < 20000 || n == 0 || n == 3`, events are **replaceable**, which means that, for each combination of `pubkey` and `kind`, only the latest event MUST be stored by relays, older versions MAY be discarded.
> - for kind `n` such that `20000 <= n < 30000`, events are **ephemeral**, which means they are not expected to be stored by relays.
> - for kind `n` such that `30000 <= n < 40000`, events are **addressable** by their `kind`, `pubkey` and `d` tag value -- which means that, for each combination of `kind`, `pubkey` and the `d` tag value, only the latest event MUST be stored by relays, older versions MAY be discarded.

Tie-break and query behaviour: "In case of replaceable events with the same timestamp, the event with the lowest id (first in lexical order) should be retained, and the other discarded." and "When answering to `REQ` messages for replaceable events ... even if the relay has more than one version stored, it SHOULD return just the latest one." [01.md §Kinds]. The spec adds: "These are just conventions and relay implementations may differ." [01.md §Kinds].

Two consequences used throughout this note:

- **Replaceable** = one live record per `(pubkey, kind)`. Overwrite is the only freshness mechanism NIP-01 gives; nothing in NIP-01 says when a latest-but-old record becomes stale.
- **Addressable** = one live record per `(pubkey, kind, d)`. The `d` value is the address; a third-party report keyed on the subject's identifier in `d` yields exactly one live report *per reporter per subject*.

The `a` tag addresses these: `["a", "<kind>:<pubkey>:<d tag value>", <relay URL, optional>]` for addressable, and `"<kind>:<pubkey>:"` with a trailing colon for replaceable [01.md §Tags].

### NIP-40 expiration

"The `expiration` tag enables users to specify a unix timestamp at which the message SHOULD be considered expired (by relays and clients) and SHOULD be deleted by relays." [40.md]. Tag shape: `tag: expiration`, value `[UNIX timestamp in seconds]: required` [40.md §Spec].

Client behaviour: "Clients SHOULD use the `supported_nips` field to learn if a relay supports this NIP. Clients SHOULD NOT send expiration events to relays that do not support this NIP." and "Clients SHOULD ignore events that have expired." [40.md §Client Behavior].

Relay behaviour: "Relays MAY NOT delete expired messages immediately on expiration and MAY persist them indefinitely. Relays SHOULD NOT send expired events to clients, even if they are stored. Relays SHOULD drop any events that are published to them if they are expired. An expiration timestamp does not affect storage of ephemeral events." [40.md §Relay Behavior].

Warning: "So don't consider expiring messages as a security feature" [40.md §Warning]. NIP-40 is `draft` `optional` `relay` [40.md header], i.e. relay support is discoverable via NIP-11 `supported_nips`, and it is per-event (a tag), not per-kind.

**None of the five surveyed NIPs mentions NIP-40 or the `expiration` tag.** (Checked by reading each file in full; the strings "expiration" and "NIP-40"/"40.md" do not occur in 11.md, 65.md, 66.md, 89.md or 90.md.)

---

## 1. NIP-66 — Relay Liveness Monitoring

Status: `draft` `optional` `relay`. "This NIP defines events for relay discovery and the announcement of relay monitors." [66.md header].

### 1.1 Kind `30166` — relay discovery event

**Class:** addressable (`30000 <= 30166 < 40000`) [01.md §Kinds]. Live record per `(monitor pubkey, 30166, relay URL)`.

**Signer:** a third party — the monitor. The example's `"pubkey": "<monitor's pubkey>"` [66.md §Relay Discovery Events, example]. The subject is a relay identified only by its URL in `d`; the relay does not sign, and nothing in the event is attributed to the relay's key. This is the single unambiguous **third-party observation** event in the survey.

**What it claims:** "`30166` relay discovery events document relay characteristics inferred either from a relay's NIP 11 document, or via probing." and "Information corresponding to field in a relay's NIP 11 document MAY contradict actual values if monitors find that a different policy is implemented than is advertised." [66.md §Relay Discovery Events]. So the spec explicitly frames the third-party record as potentially *overriding* the subject's self-description.

**Content:** "`content` MAY include the stringified JSON of the relay's NIP-11 informational document." [66.md §Relay Discovery Events].

**Tags** [66.md §Relay Discovery Events]:

| Tag | Required? | Carries (spec text) |
|---|---|---|
| `d` | **MUST** — "The only required tag is the `d` tag" | "MUST be set to the relay's normalized URL. For relays not accessible via URL, a hex-encoded pubkey MAY be used instead." |
| `rtt-open` | optional | "The relay's open round-trip time in milliseconds." |
| `rtt-read` | optional | "The relay's read round-trip time in milliseconds." |
| `rtt-write` | optional | "The relay's write round-trip time in milliseconds." |
| `n` | optional | "The relay's network type. SHOULD be one of `clearnet`, `tor`, `i2p`, `loki`" |
| `T` | optional | "The relay type. Enumerated relay type formatted as `PascalCase`, e.g. `PrivateInbox`" (links to nips issue #1282) |
| `N` | optional | "NIPs supported by the relay" |
| `R` | optional | "Keys corresponding to requirements per NIP 11's `limitations` array, including `auth`, `writes`, `pow`, and `payment`. False values should be specified using a `!` prefix, for example `!auth`." |
| `t` | optional | "A topic associated with this relay" |
| `k` | optional | "Accepted and unaccepted kinds (false values prepended by `!`)" |
| `g` | optional | "A NIP-52 geohash" |

Multi-value rule: "Tags with more than one value should be repeated, rather than putting all values in a single tag, for example `[["t", "cats"], ["t", "dogs"]]`" [66.md §Relay Discovery Events]. The example event additionally carries `["l", "en", "ISO-639-1"]`, which is not in the tag list [66.md §Relay Discovery Events, example].

**Freshness:** not stated. No staleness rule, no NIP-40 reference. The only mechanism is addressable overwrite: a monitor's newer `30166` for the same `d` replaces its older one [01.md §Kinds]. The example gives `"created_at": "<created_at  [some recent date ...]>"` [66.md example] — a hint, not a rule. The monitor's cadence is advertised separately in `10166` `frequency` (below), but NIP-66 does not say how a reader should combine `frequency` with `created_at` to decide a record is stale.

**Verification:** none defined. The spec instead states the risk and delegates trust to the reader [66.md §Risk Mitigation]:

> - Clients MUST NOT require `30166` events to function. Absence of monitoring data MUST NOT prevent relay connections.
> - A monitor may publish erroneous `30166` events, either by misconfiguration or malicious intent.
> - Clients SHOULD NOT trust a single source. Defenses include: web-of-trust filtering, querying multiple monitors, and discarding filter results if they would remove an unreasonable proportion of relays.

### 1.2 Kind `10166` — relay monitor announcement

**Class:** replaceable (`10000 <= 10166 < 20000`) [01.md §Kinds]. One per monitor.

**Signer:** the monitor, about itself — **self-description**. "Kind `10166` relay monitor announcements advertise the author's intent to publish `30166` events. This event is optional and is intended for monitors who intend to provide monitoring services at a regular and predictable frequency." [66.md §Relay Monitor Announcements].

**Tags** [66.md §Relay Monitor Announcements]:

| Tag | Required? | Carries (spec text) |
|---|---|---|
| `frequency` | not marked | "The frequency in seconds at which the monitor publishes events." |
| `timeout` | "(optional)" | "The timeout values for various checks conducted by a monitor. Index `1` is the monitor's timeout in milliseconds. Index `2` describes what test the timeout is used for. If no index `2` is provided, it is inferred that the timeout provided applies to all tests." |
| `c` | not marked | "a lowercase string describing the checks conducted by a monitor. Examples include `open`, `read`, `write`, `auth`, `nip11`, `dns`, and `geo`." |
| `g` | not marked | "NIP-52 geohash tag" |

Discrepancy worth noting: the prose puts milliseconds at index 1 and the test name at index 2, but the example is `[ "timeout", "open", "5000" ]` — test name at index 1, milliseconds at index 2 [66.md §Relay Monitor Announcements, prose vs example]. The example's `c` values (`ws`, `nip11`, `ssl`, `dns`, `geo`) also differ from the prose examples (`open`, `read`, `write`, `auth`, `nip11`, `dns`, `geo`). The spec does not resolve either.

Also: "Monitors SHOULD also publish a `kind 0` profile and a `kind 10002` relay selections event." [66.md §Relay Monitor Announcements] — i.e. the monitor is expected to be a discoverable Nostr identity with a NIP-65 list.

**Freshness / verification:** not stated beyond replaceable overwrite; nothing verifies that a monitor actually runs at `frequency` or performs the checks in `c`.

---

## 2. NIP-89 — Recommended Application Handlers

Status: `draft` `optional`. "This NIP describes `kind:31989` and `kind:31990`: a way to discover applications that can handle unknown event-kinds." [89.md header].

Three parties [89.md §Parties involved]:

> * application that handles a specific event kind (note that an application doesn't necessarily need to be a distinct entity and it could just be the same pubkey as user A)
>   * Publishes `kind:31990`, detailing how apps should redirect to it
> * user A, who recommends an app that handles a specific event kind
>   * Publishes `kind:31989`
> * user B, who seeks a recommendation for an app that handles a specific event kind
>   * Queries for `kind:31989` and, based on results, queries for `kind:31990`

### 2.1 Kind `31990` — handler information

**Class:** addressable [01.md §Kinds]. Live record per `(application pubkey, 31990, d)`.

**Signer:** the application — **self-description**. Example: `"pubkey": "<application-pubkey>"` [89.md §Handler information]. The spec allows the app pubkey to be the same as a user's [89.md §Parties involved], but the event still describes the signer's own capability.

**Tags** [89.md §Handler information]. NIP-89 does not use MUST/required language for any tag; `d` is structurally required by the addressable class [01.md §Kinds].

| Tag | Carries (spec text) |
|---|---|
| `d` | `<random-id>` |
| `k` | "`k` tags' value is the event kind that is supported by this `kind:31990`." Multiple allowed: "Multiple `k` tags can exist in the same event if the application supports more than one event kind and their handler URLs are the same." and "The same pubkey can have multiple events with different apps that handle the same event kind." |
| `latest`, `next` | "For web applications, `kind:31990` events SHOULD include `latest` and `next` tags referencing related nsite manifests when applicable. These tags use the same shape as an `a` tag: the second element is `<kind>:<pubkey>:<d-tag>` and the third element is an optional relay hint." (example uses kind `35128`) |
| `web`, `ios`, … (platform tags) | URL template plus optional NIP-19 entity type: "`bech32` in a URL MUST be replaced by clients with the NIP-19-encoded entity that should be loaded by the application." "Multiple tags might be registered by the app, following NIP-19 nomenclature as the second value of the array." "A tag without a second value in the array SHOULD be considered a generic handler for any NIP-19 entity that is not handled by a different tag." |

Content: "`content` is an optional `metadata`-like stringified JSON object, as described in NIP-01. ... If `content` is empty, the `kind:0` of the pubkey should be used to display application information" [89.md §Handler information].

### 2.2 Kind `31989` — recommendation

**Class:** addressable [01.md §Kinds]. Live record per `(recommender pubkey, 31989, d = event kind)`.

**Signer:** a third party — the recommending user. Example: `"pubkey": <recommender-user-pubkey>` [89.md §Recommendation event]. This is **third-party**, but the content is an endorsement, not an observation.

**Tags** [89.md §Recommendation event]:

| Tag | Carries (spec text) |
|---|---|
| `d` | "The `d` tag in `kind:31989` is the supported event kind this event is recommending." |
| `a` | Address of a `31990`: `["a", "31990:app1-pubkey:<d-identifier>", "wss://relay1", "ios"]`. "Multiple `a` tags can appear on the same `kind:31989`." "The second value of the tag SHOULD be a relay hint. The third value of the tag SHOULD be the platform where this recommendation might apply." |

Note the addressing: `d` is the **kind being recommended**, not the subject app. One `31989` per recommender per kind points at potentially many apps. There is no per-subject address, so a recommender cannot hold two live recommendations for the same kind — the newer one overwrites.

### 2.3 `client` tag (on any event)

"When publishing events, clients MAY include a `client` tag. Identifying the client that published the note. This tag is a tuple of `name`, `address` identifying a handler event and, a relay `hint` for finding the handler event. This has privacy implications for users, so clients SHOULD allow users to opt-out of using this tag." [89.md §Client tag].

### 2.4 Freshness and verification

**Freshness:** not stated; no NIP-40 reference; addressable overwrite only.

**Verification:** none. The query pattern scopes trust to the social graph: `["REQ", <id>, { "kinds": [31989], "#d": ["31337"], "authors": [<user>, <users-contact-list>] }]` [89.md §Example]. Bypassing recommendations is flagged as risky: "Clients SHOULD be careful doing this and use spam-prevention mechanisms or querying high-quality restricted relays to avoid directing users to malicious handlers." [89.md §Alternative query bypassing `kind:31989`].

---

## 3. NIP-11 — Relay Information Document

Status: `draft` `optional` `relay` [11.md header].

**Not an event.** "Relays may provide server metadata to clients to inform them of capabilities, administrative contacts, and various server attributes. This is made available as a JSON document over HTTP, on the same URI as the relay's websocket." and "When a relay receives an HTTP(s) request with an `Accept` header of `application/nostr+json` to a URI supporting WebSocket upgrades, they SHOULD return a document" [11.md §Relay Information Document]. There is no kind and no kind class.

**Signer:** none. The document is served, not signed. It is **self-description** by the relay operator. The spec defines no integrity or authenticity mechanism for the document itself; the only key material is the `pubkey` (admin contact) and `self` fields, and NIP-11 says of `self`: "A relay MAY maintain an identity independent from its administrator using the `self` field, which MUST be a 32-byte hex public key. This allows relays to respond to requests with events published either in advance or on demand by their own key." [11.md §Self].

**Fields** [11.md §Relay Information Document; §Field Descriptions]. "Any field may be omitted, and clients MUST ignore any additional fields they do not understand." [11.md].

| Field | Spec text |
|---|---|
| `name` | "string identifying relay" ... "SHOULD be less than 30 characters" |
| `description` | "string with detailed information" |
| `banner`, `icon` | image links |
| `pubkey` | "administrative contact pubkey" — "a recommended address to send encrypted direct messages ... to a system administrator" |
| `self` | "relay's own pubkey" (see quote above) |
| `contact` | "administrative alternate contact" — "SHOULD be a URI, using schemes such as `mailto` or `https`" |
| `supported_nips` | "a list of NIP numbers supported by the relay" ... "Client-side `NIPs` SHOULD NOT be advertised" |
| `software` | "MUST be a URL to the project's homepage" |
| `version` | "string version identifier" |
| `terms_of_service` | link |
| `limitation` | object: `max_message_length`, `max_subscriptions`, `max_limit`, `max_subid_length`, `max_event_tags`, `max_content_length`, `min_pow_difficulty`, `auth_required`, `payment_required`, `restricted_writes`, `created_at_lower_limit`, `created_at_upper_limit`, `default_limit` [11.md §Server Limitations] |
| `payments_url`, `fees` | `fees.admission` / `fees.subscription` / `fees.publication` with `amount`, `unit`, optional `period`, optional `kinds` [11.md §Pay-to-Relay] |

CORS: "Relays MUST accept CORS requests by sending `Access-Control-Allow-Origin`, `Access-Control-Allow-Headers`, and `Access-Control-Allow-Methods` headers." [11.md].

**Freshness:** not stated. The document is fetched live per request; there is no timestamp field and no caching rule in the spec.

**Verification:** none. NIP-66 explicitly treats NIP-11 as a claim a monitor may contradict: "Information corresponding to field in a relay's NIP 11 document MAY contradict actual values if monitors find that a different policy is implemented than is advertised." [66.md §Relay Discovery Events]. NIP-66's `R` tag maps directly onto NIP-11 `limitation` keys (`auth`, `writes`, `pow`, `payment`) [66.md §Relay Discovery Events].

---

## 4. NIP-65 — Relay List Metadata

Status: `draft` `optional` [65.md header].

**Kind `10002`. Class:** replaceable — "Defines a replaceable event using `kind:10002`" [65.md]; `10000 <= 10002 < 20000` [01.md §Kinds]. One per user.

**Signer:** the user, about their own relays — **self-description**. "to advertise relays where the user generally **writes** to and relays where the user generally **reads** mentions." [65.md].

**Tags** [65.md]:

| Tag | Required? | Carries |
|---|---|---|
| `r` | **MUST** — "The event MUST include a list of `r` tags with relay URLs as value and an optional `read` or `write` marker. If the marker is omitted, the relay is both **read** and **write**." | relay URL + optional `read`/`write` |

Content: `""` in the example [65.md].

Client rules (all SHOULD): "When downloading events **from** a user, clients SHOULD use the **write** relays of that user." "When downloading events **about** a user, where the user was tagged (mentioned), clients SHOULD use the user's **read** relays." Publishing: send to author's write relays, to all read relays of each tagged user, and "Send the author's `kind:10002` event to all relays the event was published to" [65.md]. Size: "Clients SHOULD guide users to keep `kind:10002` lists small (2-4 relays of each category)." [65.md §Size].

**Freshness:** not stated; replaceable overwrite only.

**Verification:** none. The list is a statement of intent ("generally writes to"), not a measurement; nothing checks the relays exist or accept the user.

Cross-reference: NIP-66 monitors "SHOULD also publish a ... `kind 10002` relay selections event" [66.md §Relay Monitor Announcements].

---

## 5. NIP-90 — Data Vending Machine

Status: `draft` `unrecommended` `optional`, with the header warning: "`unrecommended`: this got totally out of control, prefer use-case-specific microstandards" [90.md header]. "Money in, data out." [90.md].

**Kinds** [90.md §Kinds]: `5000-5999` job request, `6000-6999` job result, `7000` job feedback. "Job results always use a kind number that is `1000` higher than the job request kind." Job request types are "defined separately" in the `nostr-protocol/data-vending-machines` repo [90.md §Kinds].

**Class:** all **regular** (`1000 <= n < 10000`) [01.md §Kinds]. Every request, result and feedback is stored as its own event; nothing overwrites.

**Signers** [90.md §Actors; §Job request; §Job result; §Job feedback]:

| Kind | Signer | Relation |
|---|---|---|
| `5xxx` | customer — "A request to process data, published by a customer." | self (states own want) |
| `6xxx` | service provider — `"pubkey": "<service-provider pubkey>"` | third party relative to the customer; reports output of work on the request's inputs |
| `7000` | service provider — "Service providers can give feedback about a job back to the customer." | third party relative to the customer; status of the job |

**Tags — job request** [90.md §Job request]. "All tags are optional."

| Tag | Carries |
|---|---|
| `i` | `[ "i", "<data>", "<input-type>", "<relay>", "<marker>" ]`; input-type "MUST be one of" `url`, `event`, `job`, `text`; `<relay>` "If `event` or `job` input-type, the relay where the event/job was published, otherwise optional or empty string"; `<marker>` optional usage hint |
| `output` | "Expected output format" (mime type) |
| `param` | key/value job parameters |
| `bid` | "Customer MAY specify a maximum amount (in millisats) they are willing to pay" |
| `relays` | "List of relays where Service Providers SHOULD publish responses to" |
| `p` | "Service Providers the customer is interested in. Other SPs MIGHT still choose to process the job" |
| `encrypted` | marks `i`/`param` encrypted into `content` with NIP-04 to the `p` key [90.md §Encrypted Params] |

**Tags — job result** [90.md §Job result]:

| Tag | Carries |
|---|---|
| `request` | "The job request event stringified-JSON." |
| `e` | `["e", "<job-request-id>", "<relay-hint>"]` |
| `i` | "The original input(s) specified in the request." |
| `p` | customer's pubkey |
| `amount` | "millisats that the Service Provider is requesting to be paid. An optional third value can be a bolt11 invoice." |
| `encrypted` | output encrypted in `content` [90.md §Encrypted Output] |

Content: `<payload>`.

**Tags — job feedback (`7000`)** [90.md §Job feedback]:

| Tag | Carries |
|---|---|
| `status` | `["status", "<status>", "<extra-info>"]`; status ∈ `payment-required`, `processing`, `error`, `success`, `partial` [90.md §Job feedback status] |
| `amount` | as in job result |
| `e`, `p` | job request id + relay hint; customer pubkey |

Content: "Either empty or a job-result (e.g. for partial-result samples)".

Cancellation: "A job request might be canceled by publishing a `kind:5` delete request event tagging the job request event." [90.md §Cancellation].

**Freshness:** not stated. No NIP-40 reference. Being regular kinds, results and feedback accumulate; the spec defines no "latest result" rule.

**Verification:** none. "The flow is deliberately ambiguous" and "It's not up to this NIP to define how individual vending machines should choose to run their business." [90.md §Notes about the protocol flow]. Payment is a "suggestion to pay" [90.md §Protocol Flow]. The chaining appendix names a trust gap the spec leaves to providers: "Service Provider of job #1 might delay publishing the zap event in order to have an advantage. This risk is up to Service Providers to mitigate" [90.md §Appendix 1].

Discoverability leans on NIP-89: "Service Providers MAY use NIP-89 announcements to advertise their support for job kinds" via a `31990` with `["k", "5005"]` [90.md §Appendix 2] — again self-description by the provider.

---

## 6. Comparison table

| NIP | Kind(s) | Class [01.md §Kinds] | Signer | Subject named by | Freshness | Verifiability |
|---|---|---|---|---|---|---|
| NIP-66 | `30166` | addressable | **third party** (monitor) [66.md ex.] | `d` = relay normalized URL (or hex pubkey) [66.md] | none stated; addressable overwrite per (monitor, relay); cadence hinted by `10166` `frequency` | none; "may publish erroneous" events; clients "SHOULD NOT trust a single source" [66.md §Risk Mitigation] |
| NIP-66 | `10166` | replaceable | self (monitor about itself) [66.md] | signer | none stated; replaceable overwrite | none |
| NIP-89 | `31990` | addressable | self (application) [89.md] | signer + `d` random id | none stated; addressable overwrite | none; direct queries warned "to avoid directing users to malicious handlers" [89.md] |
| NIP-89 | `31989` | addressable | **third party** (recommender) [89.md] | `d` = event kind; subjects in `a` tags | none stated; addressable overwrite per (recommender, kind) | none; trust scoped by `authors: [user, contacts]` query [89.md §Example] |
| NIP-11 | — (HTTP JSON, `Accept: application/nostr+json`) | n/a | none — unsigned, served by relay (self) [11.md] | the serving URI | none stated; fetched live | none; NIP-66 says it "MAY contradict actual values" [66.md] |
| NIP-65 | `10002` | replaceable | self (user) [65.md] | signer | none stated; replaceable overwrite | none |
| NIP-90 | `5000-5999` | regular | self (customer) [90.md] | signer | none stated; accumulates | none |
| NIP-90 | `6000-6999`, `7000` | regular | **third party** (service provider) [90.md] | `e` = job request id, `p` = customer | none stated; accumulates | none; "deliberately ambiguous" [90.md]; NIP is `unrecommended` |
| NIP-40 | any (tag) | n/a | event author | — | `expiration` unix seconds; clients SHOULD ignore expired, relays SHOULD NOT serve expired, MAY persist [40.md] | not applicable |

---

## 7. What maps to "someone walked this road and reports it held", and what does not

1. **The only surveyed object with the right shape is NIP-66 `30166`**: signer ≠ subject; the subject is named by a stable identifier in `d`; the payload is a measurement (`rtt-open`/`rtt-read`/`rtt-write`) plus inferred properties (`N`, `R`, `k`, `n`, `T`); and NIP-01's addressable class gives exactly one live report per reporter per subject [66.md §Relay Discovery Events; 01.md §Kinds].
2. NIP-66 also states the trust model in the open: the report is "inferred ... via probing", it "MAY contradict" the subject's self-description, and the reporter "may publish erroneous" events by "misconfiguration or malicious intent" — so aggregation across monitors and web-of-trust filtering is the spec's answer, not any in-event proof [66.md §Relay Discovery Events; §Risk Mitigation].
3. NIP-66 splits "who I am and how often I walk" (`10166`: `frequency`, `timeout`, `c`) from "what I saw" (`30166`); the announcement is self-signed and the observation is about another party [66.md §Relay Monitor Announcements].
4. **NIP-89 `31989` is third-party but is an opinion, not an observation**: no measurement tags, and it is addressed by the *kind* being recommended, so one recommender holds one live event per kind pointing at N apps — the subject is not the address [89.md §Recommendation event].
5. **NIP-90 `6xxx`/`7000` is third-party but per-job, not per-subject**: it is a receipt tied to one request via `e`/`p`, stored as a regular event with no overwrite and no address for the thing computed over; the NIP is also `unrecommended` [90.md header; §Job result; 01.md §Kinds].
6. **NIP-11, NIP-65 `10002`, NIP-66 `10166`, NIP-89 `31990` are self-description** — the subject serves or signs its own claims. NIP-11 is not even an event; it has no signature at all [11.md; 65.md; 66.md; 89.md].
7. **No surveyed NIP defines staleness.** Freshness is implied only by NIP-01 "latest wins" for replaceable/addressable kinds, and by nothing for regular kinds [01.md §Kinds]. None references NIP-40.
8. NIP-40 is the only generic expiry: a per-event `expiration` tag, advisory (`SHOULD`) on both sides, relay support discoverable through NIP-11 `supported_nips`, and explicitly not a security feature [40.md]. It composes with any of the above kinds but none of them asks for it.
9. **No surveyed NIP defines verification of the claim.** NIP-66 and NIP-89 both push it to multiple sources / the follow graph; NIP-90 says the flow "is deliberately ambiguous" [66.md §Risk Mitigation; 89.md §Example; 90.md §Notes about the protocol flow].
10. Two textual inconsistencies in NIP-66 would matter to an implementer: the `timeout` tag's index order differs between prose and example, and the `c` check vocabulary differs between prose and example [66.md §Relay Monitor Announcements].
