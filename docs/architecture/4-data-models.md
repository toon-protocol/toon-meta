# 4. Data Models

## 4.1 IlpPeerInfo

**Purpose:** Represents ILP connection information published by a peer via kind:10032 events.

**Key Attributes:**
- `ilpAddress`: string - ILP address of the peer's connector
- `btpEndpoint`: string - BTP WebSocket endpoint URL
- `settlementEngine`: string | undefined - *(deprecated)* Use supportedChains instead
- `assetCode`: string - Asset code (e.g., "USD", "XRP")
- `assetScale`: number - Asset scale (decimal places)
- `supportedChains`: string[] | undefined - Settlement chain identifiers (e.g., `["evm:base:8453", "xrp:mainnet"]`)
- `settlementAddresses`: Record<string, string> | undefined - Maps chain to settlement address
- `preferredTokens`: Record<string, string> | undefined - Maps chain to token contract address
- `tokenNetworks`: Record<string, string> | undefined - Maps chain to TokenNetwork contract (EVM)

**Relationships:**
- Associated with a Nostr pubkey (event author)
- Used by SocialPeerDiscovery to populate connector peer list
- Settlement fields used during SPSP negotiation (Epic 7)

## 4.2 SpspInfo

**Purpose:** SPSP parameters for payment setup, exchanged via kind:23195 (dynamic response).

**Key Attributes:**
- `destinationAccount`: string - ILP address to send payment to
- `sharedSecret`: string - Base64-encoded shared secret for STREAM

**Relationships:**
- Associated with a Nostr pubkey
- Used by NostrSpspClient/Server for payment setup

## 4.3 SpspRequest

**Purpose:** Request for fresh SPSP parameters with settlement negotiation, sent as kind:23194 ephemeral event.

**Key Attributes:**
- `requestId`: string - Unique request identifier
- `timestamp`: number - Request timestamp
- `ilpAddress`: string | undefined - Requester's ILP address
- `supportedChains`: string[] | undefined - Chains the requester supports
- `settlementAddresses`: Record<string, string> | undefined - Requester's settlement addresses per chain
- `preferredTokens`: Record<string, string> | undefined - Requester's preferred tokens per chain

**Relationships:**
- Sent to a specific recipient pubkey
- Triggers SpspResponse from recipient
- Encrypted with NIP-44

## 4.4 SpspResponse

**Purpose:** Response containing SPSP parameters with negotiated settlement details, sent as kind:23195 ephemeral event.

**Key Attributes:**
- `requestId`: string - Matching request identifier
- `destinationAccount`: string - ILP address
- `sharedSecret`: string - Base64-encoded shared secret
- `negotiatedChain`: string | undefined - Agreed settlement chain
- `settlementAddress`: string | undefined - Responder's settlement address
- `tokenAddress`: string | undefined - Token contract on negotiated chain
- `tokenNetworkAddress`: string | undefined - TokenNetwork contract (EVM)
- `channelId`: string | undefined - Payment channel ID if opened
- `settlementTimeout`: number | undefined - Challenge period in seconds

**Relationships:**
- Response to SpspRequest
- Encrypted with NIP-44 for recipient

## 4.5 TrustScore

**Purpose:** Computed trust assessment between two pubkeys.

**Key Attributes:**
- `score`: number - Overall trust score (0-1)
- `socialDistance`: number - Hops in follow graph
- `mutualFollowerCount`: number - Shared followers
- `breakdown`: TrustBreakdown - Component score details (socialDistanceScore, mutualFollowersScore, reputationScore)

**Relationships:**
- Computed from social graph data
- Used to derive credit limits via CreditLimitConfig
- Future: expanded with zapVolume, zapDiversity, settlementReliability, qualityLabelScore, badgeScore (Epics 14-15)

## 4.6 HandlePacketRequest / HandlePacketResponse

**Purpose:** ILP packet handling types for BLS communication with the connector.

**HandlePacketRequest:**
- `amount`: string - Payment amount (parsed to bigint)
- `destination`: string - ILP destination address
- `data`: string - Base64-encoded TOON Nostr event
- `sourceAccount`: string | undefined - Source ILP address

**HandlePacketAcceptResponse:**
- `accept`: true
- `fulfillment`: string - Base64-encoded SHA-256 fulfillment
- `metadata`: { eventId, storedAt } | undefined

**HandlePacketRejectResponse:**
- `accept`: false
- `code`: string - ILP error code (F00, F06, T00)
- `message`: string - Human-readable error
- `metadata`: { required, received } | undefined

## 4.7 Bootstrap Types

**Key Interfaces:**
- `BootstrapConfig` - Known peers, query timeout, ArDrive settings
- `BootstrapServiceConfig` - Extends BootstrapConfig with agent-runtime URL, settlement info, TOON codec DI callbacks
- `DiscoveredPeer` - Peer found via kind:10032 (pubkey, peerId, peerInfo, discoveredAt)
- `KnownPeer` - Genesis peer configuration (pubkey, relayUrl, btpEndpoint)
- `BootstrapResult` - Successful bootstrap result (knownPeer, peerInfo, registeredPeerId, channelId, negotiatedChain)
- `BootstrapPhase` - State machine: `'discovering' | 'registering' | 'handshaking' | 'announcing' | 'ready' | 'failed'`
- `BootstrapEvent` - Discriminated union of lifecycle events (phase changes, peer registration, channel opens, announcements)

## 4.8 Client Interfaces

**AgentRuntimeClient:**
- `sendIlpPacket(params): Promise<IlpSendResult>` - Send ILP packets (HTTP or direct)

**ConnectorAdminClient:**
- `addPeer(config): Promise<void>` - Register peer with connector (supports routes with priority, settlement config)
- `removePeer?(peerId): Promise<void>` - Optional peer removal

**ConnectorChannelClient:**
- `openChannel(params): Promise<OpenChannelResult>` - Open payment channel
- `getChannelState(channelId): Promise<ChannelState>` - Query channel state

## 4.9 Settlement Types

**Key Interfaces:**
- `SettlementNegotiationConfig` - Own chains, addresses, tokens, deposit amount, timeouts
- `SettlementNegotiationResult` - Negotiated chain, addresses, channel ID
- `OpenChannelParams` - Peer ID, chain, token, peer address, deposit
- `OpenChannelResult` - Channel ID and status
- `ChannelState` - Channel ID, status (`opening | open | closed | settled`), chain

## 4.10 NostrEvent (External)

**Purpose:** Standard Nostr event structure from nostr-tools.

**Key Attributes:**
- `id`: string - Event hash
- `pubkey`: string - Author public key
- `kind`: number - Event kind
- `content`: string - Event content
- `tags`: string[][] - Event tags
- `created_at`: number - Unix timestamp
- `sig`: string - Schnorr signature

---
