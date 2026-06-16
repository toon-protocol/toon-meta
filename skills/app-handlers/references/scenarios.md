# App Handler Scenarios

> **Why this reference exists:** Agents need step-by-step workflows for common application handler operations on TOON. Each scenario shows the complete flow from intent to published event, including TOON-specific considerations like fee calculation and the publishEvent API. These scenarios bridge the gap between knowing the tag format (nip-spec.md) and knowing the TOON publishing mechanics (toon-extensions.md).

## Scenario 1: Advertising an Application

**When:** A developer has built a Nostr client or tool and wants to advertise it in the NIP-89 application handler registry so other users and clients can discover it.

**Why this matters:** On TOON, publishing a handler advertisement costs money. This creates a quality signal -- only committed application developers will pay to register their apps, filtering out abandoned or test listings.

### Steps

1. **Choose an application identifier.** Pick a unique, stable `d` tag value for your app (e.g., `"my-article-reader"`, `"toon-dvm-manager"`). This identifier is permanent -- changing it creates a new listing rather than updating the existing one.

2. **Determine handled kinds.** List every event kind your app can meaningfully handle. For each kind, add a `["k", "<kind>"]` tag. Be honest -- advertising kinds you do not actually support wastes users' time.

3. **Construct platform URL templates.** For each platform your app supports, add the appropriate tag:
   - `["web", "https://myapp.com/<bech32>", "read"]` for web read access
   - `["web", "https://myapp.com/compose?ref=<bech32>", "write"]` for web write access
   - `["ios", "https://apps.apple.com/app/myapp/id123456"]` for iOS
   - `["android", "https://play.google.com/store/apps/details?id=com.myapp"]` for Android

4. **Write the content description.** Compose a concise markdown description of your application. Include key features, target audience, and any special capabilities (e.g., TOON ILP payment support).

5. **Add relay hints.** Include `["r", "wss://relay.myapp.com"]` tags for relays where your app publishes events, helping clients find your app's content.

6. **Construct the kind:31990 event.** Assemble all tags, set the content field to your markdown description, and sign the event.

7. **Calculate the fee.** A typical handler info event runs ~300-500 bytes. At default `basePricePerByte` of 10n, cost is approximately $0.003-$0.005.

8. **Publish via `publishEvent()`** from `@toon-protocol/client`.

### Considerations

- As a parameterized replaceable event, you can update your listing by publishing a new kind:31990 with the same `d` tag. You pay again for the update, but the old version is replaced -- no accumulation.
- Keep the markdown description concise. Every byte costs money, and excessively long descriptions increase the publishing fee without proportional value.
- If your app handles TOON-specific events, mention ILP payment support in the description so users know it works on paid relays.

## Scenario 2: Recommending an Application

**When:** A user has found an application they like for a specific event kind and wants to recommend it to others.

**Why this matters:** On TOON, paying to recommend an app is an economic endorsement. Your recommendation carries the weight of money spent, making it a stronger signal than a free upvote.

### Steps

1. **Identify the app's kind:31990 event.** You need the app publisher's pubkey and `d` tag to construct the `a` tag reference. The format is `31990:<pubkey>:<d-tag>`.

2. **Determine the event kind to recommend for.** The `d` tag of your kind:31989 event is the event kind you are recommending the app for (e.g., `"30023"` for long-form articles).

3. **Write an optional review.** The content field can contain a short review explaining why you recommend this app. Keep it genuine and concise.

4. **Construct the kind:31989 event.** Include:
   - `["d", "<kind-number>"]` -- the kind you are recommending for
   - `["a", "31990:<app-pubkey>:<app-d-tag>", "<relay-hint>"]` -- reference to the app's handler info event

5. **Sign the event.**

6. **Calculate the fee.** A recommendation event with a short review runs ~200-400 bytes. Cost is approximately $0.002-$0.004.

7. **Publish via `publishEvent()`** from `@toon-protocol/client`.

### Considerations

- You can recommend multiple apps for the same kind by including multiple `a` tags. Order implies preference (first = most preferred).
- Since kind:31989 is parameterized replaceable keyed by `d` tag, publishing a new recommendation for the same kind replaces the previous one. You get one active recommendation per kind.
- Include a relay hint in the `a` tag (third element) so others can find the app's handler info event even if it is on a different relay.

## Scenario 3: Discovering Handlers for a Specific Event Kind

**When:** A client encounters an event kind it does not natively handle and wants to find applications that can handle it.

**Why this matters:** This is the primary consumer-side use case for NIP-89. On TOON, reading is free, so discovery costs nothing -- only the app publishers and recommenders paid.

### Steps

1. **Query for handler info events.** Subscribe with:
   ```json
   ["REQ", "find-handlers", { "kinds": [31990], "#k": ["<target-kind>"] }]
   ```
   For example, to find apps that handle kind:30023 (articles):
   ```json
   ["REQ", "find-handlers", { "kinds": [31990], "#k": ["30023"] }]
   ```

2. **Parse the TOON-format responses.** TOON relays return TOON-format strings, not JSON objects. Decode each response to extract the event fields.

3. **Extract app information.** For each kind:31990 result, parse:
   - `d` tag: application identifier
   - `k` tags: all kinds the app handles
   - `web`/`ios`/`android` tags: platform URLs
   - `content`: application description
   - `r` tags: relay hints

4. **Check user recommendations (optional).** Query for the current user's recommendations for this kind:
   ```json
   ["REQ", "my-recs", { "kinds": [31989], "authors": ["<my-pubkey>"], "#d": ["<target-kind>"] }]
   ```

5. **Query community recommendations (optional).** Broaden the search to see what others recommend:
   ```json
   ["REQ", "all-recs", { "kinds": [31989], "#d": ["<target-kind>"] }]
   ```

6. **Rank and present.** Prioritize apps the user has recommended, then apps with many recommendations, then apps by recency.

### Considerations

- All queries are free reads on TOON. Discovery imposes no cost on the searcher.
- Cross-reference kind:31989 recommendations with kind:31990 handler info to ensure recommended apps actually exist and have valid listings.
- Platform URL templates with `<bech32>` can be populated with the specific event's bech32 encoding to create a deep link.

## Scenario 4: Querying Recommendations from Trusted Users

**When:** An agent wants to see which applications its followed users recommend for a specific event kind, to make an informed app selection based on social trust.

**Why this matters:** Recommendations from trusted users carry more weight than anonymous listings. On TOON, each recommendation cost money to publish, adding an economic trust signal on top of the social one.

### Steps

1. **Gather the user's follow list.** Fetch the user's kind:3 (contacts) event to get the list of followed pubkeys.

2. **Query recommendations from followed users.** Subscribe with:
   ```json
   ["REQ", "trusted-recs", { "kinds": [31989], "authors": ["<pubkey1>", "<pubkey2>", "..."], "#d": ["<target-kind>"] }]
   ```

3. **Parse TOON-format responses.** Decode each kind:31989 event to extract the `a` tags (app references) and content (reviews).

4. **Resolve app handler info.** For each recommended app, fetch the kind:31990 event:
   ```json
   ["REQ", "app-detail", { "kinds": [31990], "authors": ["<app-pubkey>"], "#d": ["<app-d-tag>"] }]
   ```

5. **Present recommendations with context.** Show the recommending user, their review text, and the app's platform URLs. Prioritize apps recommended by multiple followed users.

### Considerations

- This pattern combines NIP-89 with NIP-02 (follow lists). The follow list provides the social trust graph; NIP-89 provides the app discovery layer.
- All reads are free on TOON. The cost was borne by the recommenders when they published their kind:31989 events.
- If no followed users have recommendations for the target kind, fall back to the broader discovery in Scenario 3.
- Consider caching follow-list recommendations to avoid repeated queries for the same data.
