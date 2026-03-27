# Story 9.33: Relay Discovery Skill (`relay-discovery`)

Status: ready-for-dev

## Story

As a TOON agent,
I want a skill teaching relay discovery and network navigation,
so that I can find and evaluate TOON relays.

## Acceptance Criteria

1. **AC1: Skill produced via NIP-to-TOON pipeline.** The skill follows the exact directory layout: `relay-discovery/SKILL.md`, `relay-discovery/references/nip-spec.md`, `relay-discovery/references/toon-extensions.md`, `relay-discovery/references/scenarios.md`, `relay-discovery/evals/evals.json`. SKILL.md has YAML frontmatter with only `name` and `description` fields. Body is under 500 lines / ~5k tokens.
2. **AC2: Covers NIP-11 (Relay Information Document) with TOON enrichment.** The skill documents NIP-11 HTTP-based relay metadata (name, description, supported_nips, limitations, fees) and the TOON-enriched `/health` endpoint (pricing with basePricePerByte, ILP capabilities with ilpAddress, chain config, x402 status, TEE attestation state with attested/enclaveType/pcr0/state fields). Clearly distinguishes standard NIP-11 fields from TOON-specific enrichments.
3. **AC3: Covers kind:10002 (NIP-65 Relay List Metadata).** The skill documents how users advertise relay preferences via kind:10002 replaceable events with `r` tags containing relay URLs and optional `read`/`write` markers. Explains how clients use write relays to fetch user events and read relays to fetch mentions.
4. **AC4: Covers NIP-66 relay liveness monitoring.** The skill documents kind:30166 (relay discovery/metadata events with d tag, RTT measurements, network type, supported NIPs, requirements) and kind:10166 (relay monitor announcements with frequency, timeout, check types). Notes web-of-trust validation for relay monitor data.
5. **AC5: Read-focused skill classification.** The skill is classified as read-only (or both, since kind:10002 can be published). TOON read model documented: subscriptions return TOON-format strings, free reads. If kind:10002 publishing is included, TOON write model section present with publishEvent() usage and fee awareness.
6. **AC6: Social context present and NIP-specific.** A `## Social Context` section explains why relay choice matters on TOON: ILP-gated relays signal quality, relay selection reflects trust decisions, choosing relays with TEE attestation provides stronger guarantees. Passes the substitution test (would not make sense for a different NIP).
7. **AC7: Evals passing.** `evals/evals.json` contains 8-10 trigger evals (mix of should_trigger true/false) and 4-6 output evals with rubrics and TOON compliance assertions. Assertions include: `toon-format-check`, `social-context-check`, `trigger-coverage`. If write-capable: `toon-write-check`, `toon-fee-check`.
8. **AC8: TOON compliance passing.** All applicable compliance assertions pass: toon-format-check (TOON-format strings documented), social-context-check (specific to relay discovery), trigger-coverage (both protocol-technical and social-situation triggers in description).
9. **AC9: Cross-skill references.** The skill references `nostr-protocol-core` for underlying write/read model, `nostr-social-intelligence` for social judgment, and `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` for canonical protocol details.

## Tasks / Subtasks

- [ ] Task 1: Create skill directory structure (AC: #1)
  - [ ] 1.1 Create `.claude/skills/relay-discovery/` directory
  - [ ] 1.2 Create `references/` subdirectory
  - [ ] 1.3 Create `evals/` subdirectory

- [ ] Task 2: Author `references/nip-spec.md` — NIP specification summary (AC: #2, #3, #4)
  - [ ] 2.1 Document NIP-11 relay information: HTTP request format (`Accept: application/nostr+json`), all metadata fields (name, description, banner, icon, pubkey, self, contact, supported_nips, software, version, terms_of_service), limitation object fields, payment info (fees, payments_url)
  - [ ] 2.2 Document NIP-65 kind:10002: replaceable event, `r` tag format with optional read/write markers, client behavior (write relays for fetching user events, read relays for mentions)
  - [ ] 2.3 Document NIP-66 kind:30166 relay metadata events: d tag with relay URL, RTT measurements (rtt-open/read/write), network type (n tag), relay type (T tag), supported NIPs (N tag), requirements (R tag), content field with stringified NIP-11 document
  - [ ] 2.4 Document NIP-66 kind:10166 relay monitor announcements: frequency, timeout, check types (c tag: open/read/write/auth/nip11/dns/geo), geographic geohash (g tag)
  - [ ] 2.5 Document risk mitigation: clients should not depend on 30166 for basic functionality, consult multiple monitors, web-of-trust validation

- [ ] Task 3: Author `references/toon-extensions.md` — TOON-specific relay discovery (AC: #2, #5, #6)
  - [ ] 3.1 Document TOON-enriched `/health` endpoint: HealthResponse shape (status, phase, pubkey, ilpAddress, peerCount, discoveredPeerCount, channelCount, pricing with basePricePerByte and currency, x402 with enabled and endpoint, tee with attested/enclaveType/lastAttestation/pcr0/state)
  - [ ] 3.2 Document comparison: standard NIP-11 vs TOON `/health` — NIP-11 is static metadata, TOON `/health` adds live runtime state (bootstrap phase, peer count, channel count, TEE state)
  - [ ] 3.3 Document kind:10032 (ILP Peer Info) as pricing discovery mechanism: basePricePerByte, feePerByte, ilpAddress
  - [ ] 3.4 Document kind:10035 (Service Discovery) for DVM capability advertisement
  - [ ] 3.5 Document kind:10036 (Seed Relay List) for bootstrap peer discovery
  - [ ] 3.6 Document how kind:10002 relay list publishing works on TOON: costs per-byte via publishEvent(), deliberate relay list curation
  - [ ] 3.7 Document TOON read model for relay discovery: all reads free, TOON-format strings in EVENT messages

- [ ] Task 4: Author `references/scenarios.md` — usage scenarios (AC: #2, #3, #4, #6)
  - [ ] 4.1 Scenario: Discovering TOON relays (fetch NIP-11, check `/health`, evaluate pricing and capabilities)
  - [ ] 4.2 Scenario: Evaluating relay quality (TEE attestation, peer count, bootstrap phase, pricing comparison)
  - [ ] 4.3 Scenario: Building a relay list (selecting read/write relays, publishing kind:10002)
  - [ ] 4.4 Scenario: Monitoring relay liveness (subscribing to kind:30166, interpreting RTT measurements)
  - [ ] 4.5 Scenario: Choosing between relays (ILP-gated vs free, TEE-attested vs unattested, pricing tiers)

- [ ] Task 5: Author `SKILL.md` — main skill file (AC: #1, #5, #6, #9)
  - [ ] 5.1 Write YAML frontmatter: name `relay-discovery`, description 80-120 words with both protocol-technical triggers (NIP-11, NIP-65, NIP-66, kind:10002, kind:30166, relay information) and social-situation triggers ("which relay should I use?", "how do I find TOON relays?", "is this relay trustworthy?")
  - [ ] 5.2 Write Protocol Mechanics section: overview of NIP-11 relay info + NIP-65 relay lists + NIP-66 monitoring
  - [ ] 5.3 Write TOON Read Model section: free subscriptions, TOON-format strings, reference to nostr-protocol-core
  - [ ] 5.4 Write TOON Write Model section (for kind:10002 publishing): publishEvent() usage, fee awareness, reference to nostr-protocol-core
  - [ ] 5.5 Write Social Context section: relay choice as trust decision, ILP-gated relay quality signal, TEE attestation as stronger guarantee, anti-patterns
  - [ ] 5.6 Write When to Read Each Reference section with progressive disclosure pointers
  - [ ] 5.7 Write Integration with Other Skills section: nostr-protocol-core, nostr-social-intelligence, content-references

- [ ] Task 6: Author `evals/evals.json` (AC: #7, #8)
  - [ ] 6.1 Write 10 trigger_evals: ~6 should_trigger:true (NIP-11, NIP-65, NIP-66, relay discovery, relay list, relay liveness queries) + ~4 should_trigger:false (unrelated NIP queries)
  - [ ] 6.2 Write 5 output_evals with rubrics covering: relay info retrieval, TOON health endpoint usage, relay list publishing, relay quality evaluation, relay liveness monitoring
  - [ ] 6.3 Include TOON compliance assertions in all output evals: toon-format-check, social-context-check, trigger-coverage, and toon-write-check + toon-fee-check for kind:10002 publishing eval

- [ ] Task 7: Validate and finalize (AC: #1, #8, #9)
  - [ ] 7.1 Run `scripts/validate-skill.sh` if available to check structure
  - [ ] 7.2 Verify SKILL.md body < 500 lines
  - [ ] 7.3 Verify frontmatter has only name and description
  - [ ] 7.4 Verify all cross-skill references point to existing skills
  - [ ] 7.5 Verify evals cover all acceptance criteria

## Dependencies

- Story 9.0 (Social Intelligence Base Skill) — provides `nostr-social-intelligence` skill referenced by this skill
- Story 9.1 (TOON Protocol Core Skill) — provides `nostr-protocol-core` skill and `toon-protocol-context.md` referenced by this skill

## Dev Notes

- **NIP classification:** This skill covers both read and write operations. NIP-11 and NIP-66 are read-only (fetching relay metadata). NIP-65 kind:10002 is a publishable event (relay list). Classify as "both" to ensure write model section is included for kind:10002.
- **TOON-enriched NIP-11:** The standard NIP-11 document is augmented by TOON's `/health` endpoint which returns live runtime state not available in static NIP-11. The key TOON enrichments are: `pricing` (basePricePerByte, currency), `x402` (enabled, endpoint), `tee` (attested, enclaveType, lastAttestation, pcr0, state), plus runtime fields like phase, peerCount, channelCount. Source: `packages/town/src/health.ts` (HealthResponse interface).
- **Skill installation path:** `.claude/skills/relay-discovery/` (follows existing pattern from social-interactions, public-chat, etc.)
- **Reference skills for pattern:** `.claude/skills/public-chat/` (most recent pipeline-produced skill), `.claude/skills/social-interactions/` (another good example)
- **Existing relay discovery in toon-protocol-context.md:** The canonical protocol context already documents kind:10032, NIP-11 `/health`, kind:10035, kind:10036. This skill provides deeper coverage specifically for relay discovery and navigation use cases.

### Project Structure Notes

- Skill files go in `.claude/skills/relay-discovery/` (follows established pattern)
- No changes to `packages/` source code required — this is a knowledge skill, not a code feature
- Evals follow skill-creator `evals/evals.json` format with trigger_evals and output_evals arrays

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.33 — Phase 10 Relay Discovery]
- [Source: packages/town/src/health.ts — HealthResponse, HealthConfig, TeeHealthInfo interfaces]
- [Source: .claude/skills/nostr-protocol-core/references/toon-protocol-context.md — Relay Discovery section]
- [Source: .claude/skills/nip-to-toon-skill/references/skill-structure-template.md — skill directory layout]
- [Source: .claude/skills/nip-to-toon-skill/references/toon-compliance-assertions.md — 5 assertion templates]
- [Source: .claude/skills/public-chat/ — reference pattern for pipeline-produced skill]
- [Source: NIP-11 spec — https://github.com/nostr-protocol/nips/blob/master/11.md]
- [Source: NIP-65 spec — https://github.com/nostr-protocol/nips/blob/master/65.md]
- [Source: NIP-66 spec — https://github.com/nostr-protocol/nips/blob/master/66.md]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

### Change Log
