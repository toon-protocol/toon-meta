# 2. Requirements

## 2.1 Functional Requirements

- **FR1:** The library SHALL discover ILP peers by querying NIP-02 follow lists from configured Nostr relays
- **FR2:** The library SHALL query kind:10032 (ILP Peer Info) events to retrieve connector ILP addresses, BTP endpoints, and settlement info for discovered peers
- **FR3:** The library SHALL subscribe to peer updates and notify consumers when peer info changes
- **FR4:** The library SHALL query kind:10047 (SPSP Info) events to retrieve static SPSP destination_account and shared_secret parameters
- **FR5:** The library SHALL support dynamic SPSP handshakes via kind:23194 (SPSP Request) and kind:23195 (SPSP Response) ephemeral events with NIP-44 encryption
- **FR6:** The library SHALL publish kind:10047 events to advertise the agent's own SPSP parameters
- **FR7:** The library SHALL handle incoming kind:23194 SPSP requests and respond with kind:23195 encrypted responses
- **FR8:** The library SHALL compute trust scores based on social distance (hops in follow graph)
- **FR9:** The library SHALL provide a configurable trust calculator that can incorporate mutual followers, reputation (zaps), and historical payment success
- **FR10:** The library SHALL provide TypeScript interfaces for all ILP-related Nostr event kinds (10032, 10047, 23194, 23195)
- **FR11:** The library SHALL provide parser and builder utilities for ILP event kinds
- **FR12:** The ILP-gated relay reference implementation SHALL accept ILP payments for event writes using TOON-encoded events in ILP packets
- **FR13:** The ILP-gated relay SHALL provide a configurable pricing service supporting per-byte and per-kind pricing
- **FR14:** The ILP-gated relay SHALL serve NIP-01 reads over WebSocket without payment
- **FR15:** The ILP-gated relay SHALL bypass payment requirements for the agent's own events (self-write)
- **FR16:** The library SHALL integrate with agent-runtime via documented Admin API and BLS patterns

## 2.2 Non-Functional Requirements

- **NFR1:** Peer discovery SHALL complete in under 5 seconds for typical follow list sizes (<500 follows)
- **NFR2:** SPSP handshake latency SHALL be under 2 seconds
- **NFR3:** The library SHALL have minimal memory footprint suitable for resource-constrained agent environments
- **NFR4:** All unit tests SHALL use mocked SimplePool with no live relay dependencies
- **NFR5:** The library SHALL support Node.js 18+ and modern browsers via ESM
- **NFR6:** All code SHALL be written in TypeScript with strict mode enabled
- **NFR7:** Developer integration time for basic peer discovery SHALL be under 1 hour
- **NFR8:** The library SHALL achieve >80% peer discovery success rate for peers with published ILP info
- **NFR9:** SPSP handshake success rate SHALL exceed 95% when both parties are online
- **NFR10:** The library SHALL use nostr-tools as the sole Nostr library dependency

---
