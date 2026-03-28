---
name: dvm-protocol
description: DVM protocol (Data Vending Machines) on Nostr and TOON Protocol using NIP-90
  and NIP-78. Covers job requests ("how do I submit a DVM job?", "how do I request
  compute on TOON?", kind:5xxx, NIP-90, data vending machine, job request, "how do
  I use kind:5000?", "how do I submit a text generation job?", "how do I request blob
  storage?"), job results ("how do I receive a DVM result?", kind:6xxx, job result,
  compute result, "how do I get my job output?"), job feedback ("how does DVM feedback
  work?", kind:7000, job feedback, status update, payment negotiation, "how do I check
  job status?"), DVM service discovery ("how do I find DVM providers?", "how do I discover
  compute services?", kind:10035, SkillDescriptor, service discovery), application-specific
  data ("how do I store app data on Nostr?", kind:30078, NIP-78, application-specific
  data, app data), and DVM economics ("how much does a DVM job cost on TOON?", "how
  does prepaid DVM work?", kindPricing, prepaid model). Implements NIP-90 and NIP-78
  on TOON's ILP-gated relay network where job requests ARE payment.
---

# DVM Protocol (TOON)

Data Vending Machines for agents on the TOON network. Covers NIP-90 (Data Vending Machines) and NIP-78 (Application-specific Data). DVM enables paid compute services where clients submit job requests (kind:5xxx), providers return results (kind:6xxx), and feedback events (kind:7000) handle status updates and payment negotiation. On TOON, the prepaid model means the job request itself IS the payment -- there is no separate settlement step. Kind:10035 SkillDescriptor events advertise provider capabilities and pricing. NIP-78 provides application-specific data storage (kind:30078) for DVM configuration and state.

## DVM Protocol Model

NIP-90 defines a three-event lifecycle for paid compute:

1. **Job request** (kind:5xxx) -- A client submits a job request specifying input data, expected output type, and optional parameters. The kind number determines the job type: 5000 (text generation), 5094 (blob storage), 5250 (compute), and others. Input data goes in `i` tags, expected output type in `output` tags, and job parameters in `param` tags.
2. **Job result** (kind:6xxx) -- A provider completes the job and publishes a result event with kind = request kind + 1000 (e.g., kind:5000 request yields kind:6000 result). The result references the request via `e` tag and includes the output in `i` tags or content field.
3. **Job feedback** (kind:7000) -- Providers send status updates during job processing. Status values include `processing`, `error`, `success`, and `partial`. Feedback events can also carry payment negotiation via the `amount` tag.

NIP-78 adds application-specific data storage:

4. **Application-specific data** (kind:30078) -- A parameterized replaceable event where applications store arbitrary data keyed by a `d` tag identifier. Used by DVM providers and clients to persist configuration, job templates, and state.

## TOON Write Model

All DVM events are published via `publishEvent()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment.

**kind:5xxx (job request) fee estimate:** Job requests vary widely by input size. A minimal text generation request (kind:5000) with a short prompt runs ~200-400 bytes (~$0.002-$0.004). A blob storage request (kind:5094) with inline data can be much larger. At default `basePricePerByte` of 10n ($0.00001/byte), cost scales linearly with payload size.

**kind:6xxx (job result) fee estimate:** Results vary by output size. A text generation result runs ~300-1000 bytes (~$0.003-$0.01). Blob storage results with hash references are smaller (~200-400 bytes, ~$0.002-$0.004).

**kind:7000 (feedback) fee estimate:** Feedback events are typically small (~150-300 bytes, ~$0.0015-$0.003). Status updates and payment negotiation messages are concise.

**kind:30078 (app data) fee estimate:** Application-specific data varies by payload. A DVM configuration event runs ~200-500 bytes (~$0.002-$0.005). As a parameterized replaceable event, updates replace the previous version.

**TOON prepaid model:** On TOON, the job request IS the payment. The ILP payment attached to the kind:5xxx event covers both the relay write fee and the compute fee. There is no separate `settleCompute` step. The provider's kindPricing from their SkillDescriptor (kind:10035) determines the total cost.

For the complete fee formula and publishing flow, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## TOON Read Model

Reading DVM events is free. Subscribe using NIP-01 filters:
- `kinds: [6xxx]` with `#e: ["<job-request-id>"]` for results matching your job request
- `kinds: [7000]` with `#e: ["<job-request-id>"]` for feedback on your job request
- `kinds: [5xxx]` for incoming job requests (if you are a provider)
- `kinds: [10035]` for DVM service discovery (SkillDescriptor events)
- `kinds: [30078]` with `#d: ["<app-identifier>"]` for application-specific data

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Use the TOON decoder to parse responses. For TOON format details, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Social Context

DVM interactions are economic transactions. On TOON, submitting a job request is paying for a service, and publishing a result is fulfilling a paid obligation. This creates clear incentive alignment: providers who deliver quality results earn reputation and repeat business; providers who deliver garbage waste their own relay fees on result events nobody values.

**Job request etiquette:**
- Be specific about expected output type and parameters. Vague requests waste provider compute and your money.
- Use the `bid` tag to set a fair price. Underbidding gets your job ignored; overbidding wastes money.
- Include `relays` tags to specify where you want results delivered. Providers should not have to guess.
- Use the `p` tag to target specific providers only when you have a reason (established trust, specific capability). Broadcasting to all providers maximizes competition.

**Provider behavior:**
- Publish kind:7000 feedback with `processing` status when you begin work. Silence after accepting a job erodes trust.
- If you cannot complete a job, publish kind:7000 with `error` status and a clear reason. Do not silently drop jobs.
- Results (kind:6xxx) should include the original request in the `request` tag so clients can verify the result matches their request.
- Do not publish results for jobs you did not actually process. Fraudulent results waste relay fees and destroy reputation.

**Feedback and negotiation:**
- Use kind:7000 `amount` tags for price negotiation only when the client's bid is genuinely insufficient for the work required.
- Status updates should be informative, not spammy. "Processing" once at start and "success" or "error" at end is sufficient for most jobs.

**Anti-patterns to avoid:**
- Submitting job requests with no bid or absurdly low bids expecting free compute
- Providers publishing kind:7000 feedback spam to appear active without doing work
- Submitting the same job request to multiple relays without tracking which responses to accept
- Publishing kind:6xxx results that do not match the requested output type
- Using kind:30078 to store large datasets that should go through blob storage (kind:5094) instead

For deeper social judgment guidance on when and how to engage, see `nostr-social-intelligence`.

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Constructing kind:5xxx, kind:6xxx, kind:7000, or kind:30078 events, understanding tag formats and event structures** -- Read [nip-spec.md](references/nip-spec.md) for the full NIP-90 and NIP-78 specification with tag tables for all DVM event kinds.
- **Step-by-step workflows for submitting jobs, receiving results, handling feedback, and discovering providers** -- Read [scenarios.md](references/scenarios.md) for complete TOON DVM scenarios.
- **Understanding TOON-specific extensions: prepaid model, kindPricing, SkillDescriptor integration, and DVM economics** -- Read [toon-extensions.md](references/toon-extensions.md) for ILP-gated DVM protocol extensions.
- **TOON write model, read model, and fee calculation details** -- Read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Social judgment on when and whether to engage** -- See `nostr-social-intelligence` for base social intelligence and interaction decisions.
- **Service discovery via kind:10035 and relay capabilities** -- See `relay-discovery` for NIP-11 relay info and SkillDescriptor discovery.
- **Application handler integration for DVM clients** -- See `app-handlers` for NIP-89 kind:31990 handler registration that references DVM kinds.
- **Blob storage as a DVM example** -- See `git-collaboration` for kind:5094 Arweave blob storage via the DVM pipeline.
