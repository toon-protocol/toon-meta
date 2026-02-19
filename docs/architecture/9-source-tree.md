# 9. Source Tree

```
crosstown/
├── packages/
│   ├── core/                              # @crosstown/core
│   │   ├── src/
│   │   │   ├── index.ts                  # Package exports
│   │   │   ├── constants.ts              # Event kind constants (10032, 23194, 23195)
│   │   │   ├── types.ts                  # Core TypeScript interfaces
│   │   │   ├── errors.ts                 # CrosstownError hierarchy
│   │   │   ├── compose.ts               # createCrosstownNode()
│   │   │   ├── bootstrap/
│   │   │   │   ├── index.ts
│   │   │   │   ├── types.ts             # Bootstrap types, client interfaces
│   │   │   │   ├── BootstrapService.ts   # Multi-phase bootstrap orchestration
│   │   │   │   ├── RelayMonitor.ts       # Real-time kind:10032 monitoring
│   │   │   │   ├── agent-runtime-client.ts  # HTTP AgentRuntimeClient
│   │   │   │   ├── direct-runtime-client.ts # In-process AgentRuntimeClient
│   │   │   │   ├── direct-connector-admin.ts # In-process ConnectorAdminClient
│   │   │   │   └── direct-channel-client.ts  # In-process ConnectorChannelClient
│   │   │   ├── discovery/
│   │   │   │   ├── index.ts
│   │   │   │   ├── SocialPeerDiscovery.ts   # Layered: genesis → ArDrive → NIP-02
│   │   │   │   ├── NostrPeerDiscovery.ts    # NIP-02 follow list discovery
│   │   │   │   ├── ArDrivePeerRegistry.ts   # ArDrive peer lookup
│   │   │   │   ├── GenesisPeerLoader.ts     # Hardcoded genesis peers
│   │   │   │   └── genesis-peers.json       # Genesis peer configuration
│   │   │   ├── spsp/
│   │   │   │   ├── index.ts
│   │   │   │   ├── NostrSpspClient.ts       # SPSP request over Nostr
│   │   │   │   ├── NostrSpspServer.ts       # SPSP response + settlement negotiation
│   │   │   │   ├── IlpSpspClient.ts         # ILP-first SPSP (PREPARE/FULFILL)
│   │   │   │   ├── settlement.ts            # Settlement chain negotiation logic
│   │   │   │   └── negotiateAndOpenChannel.ts # Channel opening during handshake
│   │   │   ├── events/
│   │   │   │   ├── index.ts
│   │   │   │   ├── parsers.ts               # Event kind parsers
│   │   │   │   └── builders.ts              # Event kind builders
│   │   │   └── __integration__/
│   │   │       └── five-peer-bootstrap.test.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   │
│   ├── bls/                               # @crosstown/bls
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── errors.ts                 # BlsBaseError, ConfigError
│   │   │   ├── config.ts                 # Environment config loading
│   │   │   ├── entrypoint.ts             # BLS server entrypoint
│   │   │   ├── server.ts                 # Hono HTTP server
│   │   │   ├── bls/
│   │   │   │   ├── index.ts
│   │   │   │   ├── types.ts             # HandlePacketRequest/Response, BlsConfig
│   │   │   │   └── BusinessLogicServer.ts # Core BLS (handlePacket, TOON, pricing)
│   │   │   ├── pricing/
│   │   │   │   ├── index.ts
│   │   │   │   ├── types.ts             # PricingConfig, PricingError
│   │   │   │   ├── PricingService.ts    # Per-kind event pricing
│   │   │   │   └── config.ts            # Pricing config loading
│   │   │   ├── storage/
│   │   │   │   ├── index.ts
│   │   │   │   ├── EventStore.ts        # EventStore interface
│   │   │   │   ├── InMemoryEventStore.ts
│   │   │   │   ├── SqliteEventStore.ts
│   │   │   │   └── createEventStore.ts  # Factory function
│   │   │   ├── filters/
│   │   │   │   ├── index.ts
│   │   │   │   └── matchFilter.ts       # NIP-01 filter matching
│   │   │   └── toon/
│   │   │       ├── index.ts
│   │   │       ├── encoder.ts           # Nostr event → TOON bytes
│   │   │       └── decoder.ts           # TOON bytes → Nostr event
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   │
│   ├── relay/                             # @crosstown/relay
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── types.ts
│   │   │   ├── websocket/
│   │   │   │   ├── index.ts
│   │   │   │   ├── NostrRelayServer.ts   # NIP-01 WebSocket server
│   │   │   │   └── ConnectionHandler.ts  # Per-connection NIP-01 handler
│   │   │   ├── subscriber/
│   │   │   │   ├── index.ts
│   │   │   │   └── RelaySubscriber.ts    # Upstream relay event propagation
│   │   │   ├── bls/                      # Relay-specific BLS wrapper
│   │   │   ├── pricing/                  # Relay pricing config
│   │   │   ├── storage/                  # InMemoryEventStore, SqliteEventStore
│   │   │   ├── filters/                  # NIP-01 filter matching
│   │   │   └── toon/                     # TOON encoder/decoder
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   │
│   ├── examples/                          # @crosstown/examples
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── ilp-gated-relay-demo/
│   │   │       ├── agent.ts
│   │   │       ├── relay.ts
│   │   │       ├── mock-connector.ts
│   │   │       └── README.md
│   │   ├── package.json
│   │   └── tsconfig.json
│
├── docker/                                # Docker entrypoint
│   ├── src/
│   │   ├── entrypoint.ts                # BLS + relay + bootstrap wiring
│   │   └── entrypoint.test.ts
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── vitest.config.ts
│
├── docs/
│   ├── architecture.md                    # This document
│   ├── architecture/                     # Sharded architecture sections
│   ├── prd.md                            # Product requirements
│   ├── prd/                              # Sharded PRD sections
│   ├── epics/                            # Epic definitions (1-17)
│   ├── stories/                          # Story files (1.x-10.x)
│   ├── research/                         # Research reports
│   └── qa/                               # QA gate files
│
├── .github/
│   └── workflows/
│       └── ci.yml                        # CI pipeline
│
├── package.json                           # Root package.json (workspaces)
├── pnpm-workspace.yaml                   # pnpm workspace config
├── tsconfig.json                         # Root TypeScript config
├── vitest.config.ts                      # Unit test configuration
├── vitest.integration.config.ts          # Integration test configuration
├── eslint.config.js                      # ESLint flat configuration
└── prettier.config.js                    # Prettier configuration
```

---
