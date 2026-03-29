# TOON Extensions for DVM Protocol

> **Why this reference exists:** DVM operations on TOON differ fundamentally from vanilla NIP-90 because of the prepaid model -- the job request IS the payment. This file covers TOON-specific DVM extensions: the prepaid payment model, kindPricing from SkillDescriptor events (kind:10035), how ILP payment replaces Lightning invoices, the economics of job requests and results, and provider discovery mechanics unique to the TOON network.

## The Prepaid Model: Job Request IS Payment

On standard Nostr relays, NIP-90 uses a request-negotiate-pay cycle:
1. Client submits job request with a `bid` tag
2. Provider responds with kind:7000 `payment-required` and a Lightning invoice
3. Client pays the invoice
4. Provider processes the job

On TOON, the model is simplified to prepaid:
1. Client submits kind:5xxx job request via `publishEvent()` -- the ILP payment attached to the event covers BOTH the relay write fee AND the compute fee
2. Provider processes the job (payment already received)
3. Provider publishes kind:6xxx result

There is no separate settlement step. The ILP payment is atomic with the event publication. This eliminates the `payment-required` negotiation round-trip for providers that publish kindPricing.

### Why Prepaid Works on TOON

TOON's ILP-gated relay model means every write requires payment. The job request event (kind:5xxx) is a write operation. The payment attached to that write can be calibrated to cover the provider's compute fee in addition to the relay write fee. The provider sees a paid event arrive and knows the compute fee has been covered.

### When Payment Negotiation Still Happens

The prepaid model does not eliminate all negotiation. kind:7000 `payment-required` feedback is still used when:

- The client's payment is insufficient for the requested work (e.g., underbid relative to kindPricing)
- The job requires more compute than initially estimated
- The provider's pricing has changed since the client last checked kind:10035
- The job involves variable-cost work where the final price depends on processing results

In these cases, the provider publishes kind:7000 with `payment-required` and `amount` tag, and the client can submit a new kind:5xxx request with the adjusted payment.

## kindPricing and SkillDescriptor (kind:10035)

TOON extends NIP-90 with kind:10035 SkillDescriptor events that advertise provider capabilities and pricing. These are TOON-specific -- vanilla NIP-90 does not define a structured discovery mechanism.

### SkillDescriptor Structure

A kind:10035 event published by a DVM provider contains:

- **Supported job kinds** and per-kind pricing (kindPricing)
- **Capabilities** -- what parameters, input types, and output formats are supported
- **Constraints** -- maximum input sizes, timeouts, rate limits
- **Provider identity** -- the pubkey that will process jobs and publish results

### kindPricing

kindPricing defines the compute fee per job kind, separate from the relay write fee:

| Component | Source | Calculation |
|-----------|--------|-------------|
| Relay write fee | Relay's `basePricePerByte` | `basePricePerByte * serializedEventBytes` |
| Compute fee | Provider's kindPricing (kind:10035) | Per-kind fixed or variable rate |
| **Total payment** | Sum | Relay write fee + compute fee |

The client must attach a total ILP payment sufficient to cover both components when publishing the kind:5xxx event.

### Discovery Flow

1. Query `{ kinds: [10035] }` to fetch all SkillDescriptor events (free read)
2. Parse each event to extract supported kinds and pricing
3. Filter by the job kind you need (e.g., kind:5000 for text generation)
4. Compare pricing across providers
5. Select a provider and note their pubkey for targeted requests or broadcast to all

## Publishing Flow on TOON

### Job Request (kind:5xxx)

1. **Discover providers.** Query for kind:10035 SkillDescriptor events to find providers and their pricing.
2. **Construct the kind:5xxx event.** Add `i` tags for input, `output` tag for expected result type, `param` tags for parameters, and optionally `p` tag for a specific provider.
3. **Sign the event.**
4. **Calculate total fee:** relay write fee (`basePricePerByte * eventBytes`) + provider compute fee (from kindPricing).
5. **Publish via `publishEvent()`** with the total ILP payment.

### Job Result (kind:6xxx)

Providers publish results using `publishEvent()` -- result publication also costs a relay write fee. This cost is borne by the provider and should be factored into their kindPricing.

### Job Feedback (kind:7000)

Each feedback event costs ~$0.0015-$0.003 to publish. Providers should minimize unnecessary status updates -- the cost creates natural incentive for concise, meaningful feedback.

### Application-specific Data (kind:30078)

kind:30078 is parameterized replaceable. Updates replace the previous version, so you pay per update but never accumulate storage costs for outdated data. Cost: ~$0.002-$0.005 per publish.

## Fee Considerations

### kind:5xxx (Job Request) Costs

Job request costs vary widely by input size:

| Job Type | Input Profile | Event Size | Relay Write Fee |
|----------|--------------|-----------|----------------|
| Text generation (short prompt) | ~100 chars text | ~300 bytes | ~$0.003 |
| Text generation (long prompt) | ~2000 chars text | ~2.5 KB | ~$0.025 |
| Blob storage (small file) | ~1 KB base64 | ~1.5 KB | ~$0.015 |
| Blob storage (large file) | ~100 KB base64 | ~140 KB | ~$1.40 |
| Compute (URL reference) | URL only | ~300 bytes | ~$0.003 |
| Discovery/search | Query text | ~250 bytes | ~$0.003 |

The relay write fee is always `basePricePerByte * serializedEventBytes`. The compute fee from kindPricing is additional.

### kind:6xxx (Job Result) Costs

Result costs are borne by the provider:

| Result Type | Output Profile | Event Size | Provider's Relay Fee |
|------------|---------------|-----------|---------------------|
| Text result (short) | ~500 chars | ~800 bytes | ~$0.008 |
| Text result (long) | ~5000 chars | ~6 KB | ~$0.060 |
| Blob storage result (hash ref) | Hash + URL | ~400 bytes | ~$0.004 |
| Compute result (JSON) | Structured output | ~500-2000 bytes | ~$0.005-$0.020 |

Providers must account for result publication cost in their kindPricing.

### kind:7000 (Feedback) Costs

Feedback events are small and cheap:

| Feedback Type | Event Size | Cost |
|--------------|-----------|------|
| Processing status | ~200 bytes | ~$0.002 |
| Payment required (with amount) | ~250 bytes | ~$0.003 |
| Error status | ~250 bytes | ~$0.003 |
| Success status | ~180 bytes | ~$0.002 |

The per-event cost creates natural incentive against feedback spam.

## TOON-specific DVM Economics

### Job Request as Economic Signal

On TOON, submitting a job request is paying for a service. The prepaid model creates clear economic alignment:

- **Clients** pay upfront, signaling genuine demand. No free job spam.
- **Providers** receive payment atomically with the request. No invoice chasing.
- **Quality incentive** -- providers who deliver poor results lose reputation but keep the payment. Repeat business depends on quality.

### Provider Economics

Providers must balance three costs:
1. **Monitoring cost** -- subscribing to incoming job requests is free (reads are free)
2. **Compute cost** -- the actual work of processing the job (provider's infrastructure)
3. **Result publication cost** -- publishing kind:6xxx results and kind:7000 feedback costs relay write fees

A viable provider's kindPricing must cover compute cost + result publication cost + margin.

### Job Pipelining Economics

Chained DVM jobs (using `"job"` input type) incur separate ILP payments for each step. Pipeline costs are additive:

| Pipeline | Steps | Approximate Total Cost |
|----------|-------|----------------------|
| Generate text then translate | 2 | ~$0.01-$0.05 |
| Upload blob then index | 2 | ~$0.02-$1.50 |
| Multi-step data processing | 3-5 | ~$0.03-$0.10 |

Design pipelines with minimum necessary steps to control costs.

### Broadcast vs Targeted Requests

- **Broadcast** (no `p` tag): All providers monitoring for the job kind can respond. Creates competition but may yield multiple responses (each costing the provider a result publication fee).
- **Targeted** (`p` tag set): Only the specified provider should respond. Reduces provider waste but removes competition.

On TOON, broadcast requests are more efficient for the client (read responses for free, pick the best one). Targeted requests are more efficient for providers (no wasted result publications).

## Integration with Protocol Core

For the complete TOON write model, read model, and fee calculation details, refer to `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers DVM-specific protocol extensions; the protocol core covers the foundational mechanics shared by all event kinds.
