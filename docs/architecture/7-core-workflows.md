# 7. Core Workflows

## 7.1 Layered Peer Discovery Flow

```mermaid
sequenceDiagram
    participant Agent
    participant BS as BootstrapService
    participant GPL as GenesisPeerLoader
    participant ARP as ArDrivePeerRegistry
    participant SPD as SocialPeerDiscovery
    participant Relay as Nostr Relays
    participant Connector as ILP Connector

    Agent->>BS: start()
    BS->>GPL: loadGenesisPeers()
    GPL-->>BS: KnownPeer[] (hardcoded)

    BS->>ARP: discoverPeers()
    ARP-->>BS: KnownPeer[] (from ArDrive)

    BS->>SPD: discoverPeers(myPubkey)
    SPD->>Relay: REQ kind:3 (follow list)
    Relay-->>SPD: Follow list event

    loop For each followed pubkey
        SPD->>Relay: REQ kind:10032 (ILP Peer Info)
        Relay-->>SPD: Peer info event (or none)
    end

    SPD-->>BS: Map<pubkey, IlpPeerInfo>
    BS->>Connector: addPeer() for each discovered peer
```

## 7.2 SPSP Handshake with Settlement Negotiation

```mermaid
sequenceDiagram
    participant Sender as Sender Agent
    participant NSC as NostrSpspClient
    participant Relay as Nostr Relays
    participant NSS as NostrSpspServer
    participant CCC as ConnectorChannelClient
    participant Recipient as Recipient Agent

    Sender->>NSC: requestSpspInfo(recipientPubkey)
    NSC->>NSC: Generate request with supportedChains
    NSC->>NSC: Encrypt (NIP-44)
    NSC->>Relay: EVENT kind:23194
    NSC->>Relay: REQ kind:23195 (subscribe for response)

    Relay-->>NSS: kind:23194 event
    NSS->>NSS: Decrypt request
    NSS->>NSS: Negotiate chain (intersect supportedChains)
    NSS->>CCC: openChannel(negotiatedChain, peerAddress)
    CCC-->>NSS: channelId
    NSS->>NSS: Build response with negotiated settlement
    NSS->>NSS: Encrypt response (NIP-44)
    NSS->>Relay: EVENT kind:23195

    Relay-->>NSC: kind:23195 event
    NSC->>NSC: Decrypt response
    NSC-->>Sender: SpspResponse (with channelId, negotiatedChain)
```

## 7.3 ILP-Gated Relay Write Flow

```mermaid
sequenceDiagram
    participant Agent
    participant Connector as ILP Connector
    participant BLS as BusinessLogicServer
    participant Relay as Nostr Relay
    participant DB as SQLite

    Agent->>Agent: Create Nostr event
    Agent->>Agent: TOON-encode event
    Agent->>Connector: ILP PREPARE with TOON data
    Connector->>BLS: handlePacket(amount, destination, data)

    BLS->>BLS: Decode TOON -> Nostr event
    BLS->>BLS: Verify signature
    BLS->>BLS: Calculate price (PricingService)

    alt Payment sufficient
        BLS->>Relay: Store event
        Relay->>DB: INSERT event
        BLS-->>Connector: Accept (fulfillment = SHA256(event.id))
        Connector-->>Agent: FULFILL
    else Payment insufficient
        BLS-->>Connector: Reject (F06, required amount)
        Connector-->>Agent: REJECT
    end
```

## 7.4 Network Bootstrap Flow

```mermaid
sequenceDiagram
    participant BS as BootstrapService
    participant SPD as SocialPeerDiscovery
    participant CAC as ConnectorAdminClient
    participant NSC as NostrSpspClient
    participant ARC as AgentRuntimeClient
    participant Relay as Nostr Relays

    Note over BS: Phase 1: DISCOVERING
    BS->>SPD: discoverPeers()
    SPD-->>BS: DiscoveredPeer[]

    Note over BS: Phase 2: REGISTERING
    loop For each discovered peer
        BS->>CAC: addPeer(peerId, btpEndpoint, routes)
    end

    Note over BS: Phase 3: HANDSHAKING
    loop For each registered peer
        BS->>NSC: requestSpspInfo(peerPubkey, settlementInfo)
        NSC-->>BS: SpspResponse (channelId, negotiatedChain)
    end

    Note over BS: Phase 4: ANNOUNCING
    loop For each peer with channel
        BS->>ARC: sendIlpPacket(TOON(kind:10032), amount)
        ARC-->>BS: IlpSendResult (accepted/rejected)
    end

    Note over BS: Phase 5: READY
    BS->>BS: Emit bootstrap:ready event
```

## 7.5 Embedded Connector Composition

```mermaid
sequenceDiagram
    participant App as Agent Application
    participant COMP as createCrosstownNode()
    participant CN as ConnectorNode
    participant BLS as BusinessLogicServer
    participant BS as BootstrapService
    participant RM as RelayMonitor

    App->>COMP: createCrosstownNode(config)
    COMP->>COMP: Create DirectRuntimeClient(CN)
    COMP->>COMP: Create DirectConnectorAdmin(CN)
    COMP->>COMP: Create DirectChannelClient(CN)
    COMP->>BLS: Wire handlePacket callback
    COMP->>CN: setPacketHandler(bls.handlePacket)
    COMP->>BS: new BootstrapService(directClients)
    COMP->>RM: new RelayMonitor(directClients)

    App->>COMP: node.start()
    COMP->>BS: start() (discover, register, handshake, announce)
    COMP->>RM: start() (monitor for new kind:10032 events)

    Note over App,RM: All ILP packets flow in-process (zero latency)

    App->>COMP: node.stop()
    COMP->>RM: stop()
    COMP->>BS: stop()
```

## 7.6 Cross-Town DVM Work Dispatch (Planned -- Epics 12-13)

```mermaid
sequenceDiagram
    participant TownA as Town A (Gas Town / Go)
    participant Relay as Nostr Relay
    participant NIP as NIP Handler (packages/agent/)
    participant TownB as Town B (Gas Town / Go)
    participant ILP as ILP Connector

    Note over TownA: Mayor publishes DVM job request
    TownA->>Relay: EVENT kind:5xxx (DVM job + bid amount)

    Relay-->>NIP: kind:5xxx subscription match
    NIP->>NIP: Verify sender is NIP-02 peer (peering gate)
    NIP->>NIP: Route to DVM handler reference

    alt Sender is peered
        NIP-->>TownB: Forward job to local Mayor
        TownB->>Relay: EVENT kind:7000 (DVM feedback: "payment-required", counter-offer)

        Relay-->>TownA: kind:7000 feedback
        TownA->>ILP: ILP PREPARE (bid amount, condition)
        Note over ILP: Funds locked in payment channel

        TownB->>TownB: Local Polecat executes work
        TownB->>Relay: EVENT kind:6xxx (DVM result + fulfillment data)

        Relay-->>TownA: kind:6xxx result
        TownA->>TownA: Verify result meets requirements
        TownA->>ILP: ILP FULFILL (release payment)
    else Sender not peered
        NIP->>NIP: Reject (no peering relationship)
    end
```

## 7.7 Cross-Town NIP-34 Patch Merge (Planned -- Epic 15)

```mermaid
sequenceDiagram
    participant TownA as Town A (Contributing)
    participant Relay as Nostr Relay
    participant TownB as Town B (Reviewer)
    participant TownC as Town C (Reviewer)
    participant MA as Merge Authority

    Note over TownA: Refinery merges to integration branch
    TownA->>Relay: EVENT kind:1617 (NIP-34 patch)

    Relay-->>TownB: kind:1617 subscription match
    Relay-->>TownC: kind:1617 subscription match

    TownB->>TownB: Review patch
    TownB->>Relay: EVENT kind:1985 (NIP-32 label: "approved")

    TownC->>TownC: Run CI via DVM
    TownC->>Relay: EVENT kind:1985 (NIP-32 label: "tests-passing")
    TownC->>Relay: EVENT kind:1985 (NIP-32 label: "approved")

    Note over MA: Σ trust(approvers) >= threshold
    MA->>MA: Select merge authority (highest trust with push access)
    MA->>MA: Apply patch to shared remote
    MA->>Relay: EVENT kind:1631 (NIP-34 status: merged)

    Relay-->>TownA: kind:1631 (merged confirmation)
    Note over TownA: ILP FULFILL sent to contributing Town
```

---
