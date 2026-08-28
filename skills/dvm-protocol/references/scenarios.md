# DVM Protocol Scenarios

> **Why this reference exists:** Agents need step-by-step workflows for common DVM operations on TOON. Each scenario shows the complete flow from intent to published event, including TOON-specific considerations like the prepaid model, route pricing, and the `client.send()` API. These scenarios bridge the gap between knowing the tag format (nip-spec.md) and knowing the TOON publishing mechanics (toon-extensions.md).

## Scenario 1: Submitting a Job Request

**When:** A client wants to request a compute service from a DVM provider, such as text generation, translation, or blob storage.

**Why this matters:** On TOON, the job request IS the payment. Sending the kind:5xxx event pays the price of the route that terminates it. Getting the event structure right on the first attempt avoids wasting money on malformed requests.

### Steps

1. **Choose the job kind.** Select the appropriate kind:5xxx based on the service needed:
   - kind:5094 for blob storage (e.g., Arweave uploads) — **the only deployed TOON DVM kind**
   - kind:5000 for text generation (generic NIP-90 example — no TOON node fulfills this)
   - kind:5300 for discovery/search
   - kind:5600 for translation
   - kind:5250 (Dungeon DVM — **removed from TOON; do not use**)

2. **Construct input tags.** Add one or more `["i", "<data>", "<input-type>"]` tags:
   - `["i", "Summarize this article", "text"]` for inline text input
   - `["i", "https://example.com/data.json", "url"]` for URL-referenced input
   - `["i", "<event-id>", "event", "wss://relay.example.com"]` for Nostr event input
   - `["i", "<previous-job-id>", "job"]` for job pipelining

3. **Specify output type.** Add `["output", "<mime-type>"]` to declare the expected result format (e.g., `"text/plain"`, `"application/json"`, `"image/png"`).

4. **Set job parameters.** Add `["param", "<key>", "<value>"]` tags for service-specific settings (e.g., model, max_tokens, timeout, storage backend).

5. **Set the bid.** Add `["bid", "<amount-millisats>"]` with a fair price. On TOON the bid is informational -- the actual payment is the claim `send()` mints for the route that terminates the request.

6. **Target a provider (optional).** Add `["p", "<provider-pubkey>"]` to direct the request to a specific provider. Omit to broadcast to all providers monitoring for this job kind.

7. **Specify result delivery relays.** Add `["relays", "wss://relay1.com", "wss://relay2.com"]` so the provider knows where to publish results.

8. **Set expiration (optional).** Add `["expiration", "<unix-timestamp>"]` to prevent stale job pickup.

9. **Sign the event.** Use nostr-tools or equivalent to sign with the client's private key.

10. **Send it.** `await client.send({ body: signedJobRequest })` from `@toon-protocol/client`. The client seals the payload to the terminating connector, reads the route's price, mints the covering claim and carries it -- there is no separate fee-calculation, claim-signing or publish step. To reach a route other than the node's own published address, pass the destination as a leading string argument: `client.send('g.toon.store', { body })`.

### Considerations

- Keep input data concise -- but not to save money on the relay, whose route is flat at 1 base unit per event whatever the request weighs. Concision buys bandwidth, relay storage and provider parse cost. It buys money only on a sloped route such as the blob store (`g.toon.store`, 1000 + 10/KiB of sealed payload), and there you should read `client.routePrice()` rather than count bytes yourself.
- The `bid` tag is the NIP-90 standard mechanism for price signaling. On TOON, the actual payment is the claim the client mints.
- If targeting a specific provider, check that they have published a NIP-89 kind:31990 handler advertisement for the job kind, or that you have some other reason to believe they serve it.
- Job pipelining (input type `"job"`) chains DVM jobs -- the output of one job feeds into the next. Use this for multi-step workflows.

## Scenario 2: Receiving and Processing Job Results

**When:** A client has submitted a job request and needs to monitor for results and feedback.

**Why this matters:** Results are asynchronous. The client must subscribe to both kind:7000 feedback (for status updates) and kind:6xxx results (for completed output). On TOON, reads are free, so monitoring costs nothing.

### Steps

1. **Subscribe to feedback.** After publishing the job request, subscribe for kind:7000 feedback:
   ```json
   ["REQ", "job-feedback", { "kinds": [7000], "#e": ["<job-request-event-id>"] }]
   ```

2. **Subscribe to results.** Subscribe for the appropriate result kind (request kind + 1000):
   ```json
   ["REQ", "job-result", { "kinds": [6000], "#e": ["<job-request-event-id>"] }]
   ```

3. **Parse the responses.** The relay's reads speak plain NIP-01 -- `EVENT` messages carry standard JSON objects. Parse them as you would from any Nostr relay.

4. **Handle feedback events.** Process kind:7000 events by status:
   - `"processing"` -- Job accepted, work in progress. No action needed.
   - `"payment-required"` -- Provider needs more payment. Check the `amount` tag and decide whether to resubmit with a higher bid.
   - `"partial"` -- Partial results available. Process incrementally if supported.
   - `"error"` -- Job failed. Read the content field for error details. Consider retrying with different parameters.
   - `"success"` -- Job completed. Result event should follow.

5. **Process the result.** When a kind:6xxx event arrives:
   - Verify the `e` tag references your job request.
   - Verify the `p` tag matches your public key.
   - Check the `request` tag contains your original request JSON.
   - Extract result data from the content field or `i` tags.

6. **Handle payment negotiation (if needed).** If a `"payment-required"` feedback arrives:
   - Check the `amount` tag for the required price.
   - Decide whether to accept: submit a new kind:5xxx request with the required bid.
   - Or decline by not responding.

### Considerations

- All reads are free on TOON. Monitoring for feedback and results costs nothing.
- Multiple providers may respond to a broadcast request. Accept the first satisfactory result or compare quality across providers.
- Verify the `request` tag in the result to prevent response-spoofing attacks.
- Consider setting a timeout for monitoring. If no feedback arrives within a reasonable period, the job may have been ignored.

## Scenario 3: Handling Job Feedback and Status Updates

**When:** A provider is processing a job and needs to keep the client informed, or a provider needs to negotiate payment.

**Why this matters:** On TOON, every feedback event is a paid, signed, attributable write -- it needs an open channel and a claim. At 1 base unit the price is a gate rather than a toll, so the discipline comes from the client's attention, not their wallet: send meaningful updates (processing, error, success) and nothing else.

### Steps

1. **Accept the job.** After receiving a kind:5xxx request, validate the input and determine if the bid is sufficient.

2. **Publish processing status.** If accepting the job:
   ```json
   {
     "kind": 7000,
     "content": "Job accepted, beginning text generation.",
     "tags": [
       ["e", "<job-request-event-id>"],
       ["p", "<requester-pubkey>"],
       ["status", "processing"]
     ]
   }
   ```
   Send it with `client.send()`. Cost: 1 base unit of 6-decimal USDC -- the relay's route is flat, so a terse status message and a verbose one cost the same.

3. **Negotiate payment (if bid is too low).** If the bid is insufficient:
   ```json
   {
     "kind": 7000,
     "content": "Bid insufficient for requested model and token count.",
     "tags": [
       ["e", "<job-request-event-id>"],
       ["p", "<requester-pubkey>"],
       ["status", "payment-required"],
       ["amount", "100000"]
     ]
   }
   ```

4. **Report errors.** If processing fails:
   ```json
   {
     "kind": 7000,
     "content": "Failed: input data exceeds maximum size (1MB limit).",
     "tags": [
       ["e", "<job-request-event-id>"],
       ["p", "<requester-pubkey>"],
       ["status", "error", "input-too-large"]
     ]
   }
   ```

5. **Report success.** After publishing the result event (kind:6xxx), optionally publish a success feedback:
   ```json
   {
     "kind": 7000,
     "content": "",
     "tags": [
       ["e", "<job-request-event-id>"],
       ["p", "<requester-pubkey>"],
       ["status", "success"]
     ]
   }
   ```

### Considerations

- Each feedback event is a paid write: 1 base unit on the relay's flat route, regardless of length. Minimize unnecessary status updates because they cost the client attention, not because 1 base unit each will bankrupt you.
- The `processing` + `success`/`error` pattern is sufficient for most jobs. Do not spam intermediate "still working" updates.
- Error messages should be actionable -- tell the client what went wrong and whether retrying with different parameters would help.
- Payment negotiation should only happen when the bid is genuinely insufficient. Do not use `payment-required` as a bargaining tactic.

## Scenario 4: Discovering DVM Service Providers

**When:** A client wants to find available DVM services and what they cost before submitting a job request.

**Why this matters:** TOON has no service-announcement event. The old kind:10035 SkillDescriptor is retired, and nothing replaced it with another broadcast -- a connector answers rather than announces. So discovery splits in two: prices come from asking the node, and provider identity comes from the ordinary Nostr layer.

### Steps

1. **Ask the node what it routes and what it charges.** `GET /ilp` on a node's URL returns its self-description: its addresses, its settlement facts, and every route's price. It is free and unauthenticated. From a client, `await client.routePrice(destination)` returns the same terms as `{ price, pricePerKib? }`. An unpaid request to a priced route is answered with a greeting carrying that route's terms.

2. **Know what is actually deployed.** Two DVM-shaped routes are live: the blob store at `g.toon.store` (also reachable as `g.toon.relay.store`), which serves kind:5094 Arweave storage at `1000 + 10 per KiB` of sealed payload, and the gas station at `g.toon.gas` at a flat 1000. Nostr event publishing itself is `g.toon.relay` at a flat 1. Generic NIP-90 kinds have no TOON node to fulfill them.

3. **Find provider software on the Nostr layer (optional).** Query for NIP-89 kind:31990 app handler events that declare a DVM kind:
   ```json
   ["REQ", "dvm-apps", { "kinds": [31990], "#k": ["5094"] }]
   ```
   This finds applications that handle kind:5094 job requests. It is a free read.

4. **Check provider reputation (optional).** Query for kind:30078 application-specific data with reputation information:
   ```json
   ["REQ", "reputation", { "kinds": [30078], "#d": ["dvm-reputation-<provider-pubkey>"] }]
   ```

### Considerations

- All Nostr discovery queries are free reads on TOON, and `GET /ilp` is free too. Discovery costs nothing.
- Do not look for a pricing event. Nothing on TOON broadcasts its prices; the node answers when asked, and that answer is authoritative in a way a stale announcement never was.
- The relay speaks plain NIP-01 on reads. Responses are standard JSON `EVENT` messages; no TOON decoding is involved.
- Provider reputation data in kind:30078 is self-reported or community-aggregated. Treat it as a signal, not a guarantee.

## Scenario 5: Storing Application-specific Data

**When:** A DVM provider or client needs to persist configuration, job templates, or preferences using kind:30078.

**Why this matters:** kind:30078 is parameterized replaceable, so updates replace the previous version. On TOON, this means you pay per update but never accumulate storage costs for outdated configurations.

### Steps

1. **Choose a `d` tag identifier.** Use a descriptive, namespaced identifier to avoid collisions:
   - `"dvm-config-<your-provider-id>"` for provider configuration
   - `"job-template-<template-name>"` for reusable job templates
   - `"dvm-prefs-<client-id>"` for client preferences

2. **Construct the content.** Serialize your data as JSON in the content field:
   ```json
   {
     "supportedKinds": [5000, 5094],
     "pricing": { "5000": "50000", "5094": "100000" },
     "maxInputSize": 1048576
   }
   ```

3. **Build the kind:30078 event:**
   ```json
   {
     "kind": 30078,
     "content": "<json-string>",
     "tags": [
       ["d", "dvm-config-my-provider"]
     ]
   }
   ```

4. **Sign and send with `client.send()`.** Cost: 1 base unit on the relay's flat route, whatever the configuration weighs.

5. **Update by republishing.** To change configuration, publish a new kind:30078 with the same `d` tag. The old event is replaced.

### Considerations

- Use kind:30078 for small configuration data. For large datasets, use blob storage (kind:5094) and reference the result.
- Namespace your `d` tags to avoid collisions with other applications using kind:30078.
- Content is public by default. For sensitive configuration, encrypt the content using NIP-44.
- As a parameterized replaceable event, only the latest version is retained. Version history is not preserved by relays.

## Scenario 6: Chaining DVM Jobs (Pipelining)

**When:** A client needs a multi-step workflow where the output of one DVM job feeds into the next.

**Why this matters:** Job pipelining enables complex workflows without the client needing to manually shuttle data between steps. On TOON, each job in the pipeline is a separate ILP payment, so pipeline design should minimize unnecessary steps.

### Steps

1. **Submit the first job.** Publish a kind:5xxx request as in Scenario 1. Note the event ID.

2. **Submit the second job referencing the first.** Use `"job"` input type:
   ```json
   {
     "kind": 5600,
     "content": "",
     "tags": [
       ["i", "<first-job-request-event-id>", "job"],
       ["output", "text/plain"],
       ["param", "target_language", "es"]
     ]
   }
   ```

3. **The second provider waits.** The provider processing the second job monitors for the kind:6xxx result of the first job. Once the first result arrives, it uses the output as input for the second job.

4. **Monitor the pipeline.** Subscribe to kind:7000 feedback and kind:6xxx results for each job in the chain.

5. **Collect the final result.** The last job in the pipeline produces the final output.

### Considerations

- Each job in the pipeline is a separate payment on TOON. On the relay's flat route each step's publication is 1 base unit whatever it carries, so a pipeline's cost is driven by its step count. Design pipelines with the minimum necessary steps.
- Pipeline reliability depends on every job succeeding. If any job fails, downstream jobs stall. Monitor feedback for error status.
- Providers must support the `"job"` input type to participate in pipelines. There is no on-network capability declaration for this -- a NIP-89 kind:31990 handler advertisement is the closest signal, and otherwise you find out by trying.
- Pipeline latency is cumulative. For time-sensitive work, consider whether a single more capable provider can handle the full workflow.
