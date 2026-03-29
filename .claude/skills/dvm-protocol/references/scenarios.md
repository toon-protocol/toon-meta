# DVM Protocol Scenarios

> **Why this reference exists:** Agents need step-by-step workflows for common DVM operations on TOON. Each scenario shows the complete flow from intent to published event, including TOON-specific considerations like the prepaid model, fee calculation, and the publishEvent API. These scenarios bridge the gap between knowing the tag format (nip-spec.md) and knowing the TOON publishing mechanics (toon-extensions.md).

## Scenario 1: Submitting a Job Request

**When:** A client wants to request a compute service from a DVM provider, such as text generation, translation, or blob storage.

**Why this matters:** On TOON, the job request IS the payment. The ILP payment attached to the kind:5xxx event covers both the relay write fee and the compute fee. Getting the event structure right on the first attempt avoids wasting money on malformed requests.

### Steps

1. **Choose the job kind.** Select the appropriate kind:5xxx based on the service needed:
   - kind:5000 for text generation
   - kind:5094 for blob storage (e.g., Arweave uploads)
   - kind:5250 for general compute
   - kind:5300 for discovery/search
   - kind:5600 for translation

2. **Construct input tags.** Add one or more `["i", "<data>", "<input-type>"]` tags:
   - `["i", "Summarize this article", "text"]` for inline text input
   - `["i", "https://example.com/data.json", "url"]` for URL-referenced input
   - `["i", "<event-id>", "event", "wss://relay.example.com"]` for Nostr event input
   - `["i", "<previous-job-id>", "job"]` for job pipelining

3. **Specify output type.** Add `["output", "<mime-type>"]` to declare the expected result format (e.g., `"text/plain"`, `"application/json"`, `"image/png"`).

4. **Set job parameters.** Add `["param", "<key>", "<value>"]` tags for service-specific settings (e.g., model, max_tokens, timeout, storage backend).

5. **Set the bid.** Add `["bid", "<amount-millisats>"]` with a fair price. Check the provider's kind:10035 SkillDescriptor for kindPricing to determine the expected rate. On TOON, the bid is informational -- the actual payment is the ILP payment attached to the publishEvent call.

6. **Target a provider (optional).** Add `["p", "<provider-pubkey>"]` to direct the request to a specific provider. Omit to broadcast to all providers monitoring for this job kind.

7. **Specify result delivery relays.** Add `["relays", "wss://relay1.com", "wss://relay2.com"]` so the provider knows where to publish results.

8. **Set expiration (optional).** Add `["expiration", "<unix-timestamp>"]` to prevent stale job pickup.

9. **Sign the event.** Use nostr-tools or equivalent to sign with the client's private key.

10. **Calculate the fee.** The relay write fee is `basePricePerByte * serializedEventBytes`. The total cost on TOON also includes the compute fee from the provider's kindPricing.

11. **Publish via `publishEvent()`** from `@toon-protocol/client`.

### Considerations

- Keep input data concise. Every byte costs money on TOON. For large inputs, use URL references instead of inline data.
- The `bid` tag is the NIP-90 standard mechanism for price signaling. On TOON, the actual payment is handled by the ILP layer.
- If targeting a specific provider, verify their kind:10035 SkillDescriptor supports the requested job kind.
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

3. **Parse TOON-format responses.** TOON relays return TOON-format strings, not JSON objects. Decode each response to extract event fields.

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

**Why this matters:** On TOON, every feedback event costs money to publish. Providers should send meaningful updates (processing, error, success) without spamming. The cost creates natural incentive for concise, informative status messages.

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
   Publish via `publishEvent()`. Cost: ~150-250 bytes = ~$0.0015-$0.0025.

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

- Each feedback event costs ~$0.0015-$0.003 on TOON. Minimize unnecessary status updates.
- The `processing` + `success`/`error` pattern is sufficient for most jobs. Do not spam intermediate "still working" updates.
- Error messages should be actionable -- tell the client what went wrong and whether retrying with different parameters would help.
- Payment negotiation should only happen when the bid is genuinely insufficient. Do not use `payment-required` as a bargaining tactic.

## Scenario 4: Discovering DVM Service Providers

**When:** A client wants to find available DVM providers and their capabilities before submitting a job request.

**Why this matters:** On TOON, provider discovery via kind:10035 SkillDescriptor events is free (reads cost nothing). Discovery before submission avoids wasting money on job requests sent to providers that do not support the needed service.

### Steps

1. **Query for SkillDescriptor events.** Subscribe for kind:10035 events to discover providers:
   ```json
   ["REQ", "dvm-providers", { "kinds": [10035] }]
   ```

2. **Parse TOON-format responses.** Decode each kind:10035 event to extract provider capabilities.

3. **Extract provider information.** From each SkillDescriptor:
   - Supported job kinds and their pricing (kindPricing)
   - Provider capabilities and constraints
   - Input/output format support
   - Maximum input sizes
   - Supported parameters

4. **Cross-reference with app handlers (optional).** Query for kind:31990 app handler events that reference DVM kinds:
   ```json
   ["REQ", "dvm-apps", { "kinds": [31990], "#k": ["5000"] }]
   ```
   This finds client applications that handle DVM job requests for kind:5000.

5. **Check provider reputation (optional).** Query for kind:30078 application-specific data with reputation information:
   ```json
   ["REQ", "reputation", { "kinds": [30078], "#d": ["dvm-reputation-<provider-pubkey>"] }]
   ```

6. **Select a provider.** Based on capabilities, pricing, and reputation, choose a provider and note their pubkey for targeted job requests.

### Considerations

- All discovery queries are free reads on TOON. Discovery is cost-free.
- TOON's kind:10035 SkillDescriptor provides more structured discovery than vanilla NIP-90, which relies on providers simply monitoring for job requests.
- Cross-referencing kind:10035 (provider capabilities) with kind:31990 (app handlers) gives a complete picture: what services are available AND what client apps can interact with them.
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

4. **Sign and publish via `publishEvent()`.** Cost: ~200-500 bytes = ~$0.002-$0.005.

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

- Each job in the pipeline costs a separate ILP payment on TOON. Design pipelines with the minimum necessary steps.
- Pipeline reliability depends on every job succeeding. If any job fails, downstream jobs stall. Monitor feedback for error status.
- Providers must support the `"job"` input type to participate in pipelines. Check kind:10035 SkillDescriptor for capability declarations.
- Pipeline latency is cumulative. For time-sensitive work, consider whether a single more capable provider can handle the full workflow.
