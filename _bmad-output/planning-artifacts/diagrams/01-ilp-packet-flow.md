# ILP Packet Flow

How a TOON event travels from sender to receiver through the ILP network.

## Sequence Diagram — Full Packet Lifecycle

```mermaid
sequenceDiagram
    participant App as Application
    participant SDK as SDK (publishEvent)
    participant Enc as TOON Encoder
    participant ILP as ILP Prepare Builder
    participant Conn as Embedded Connector
    participant Net as Peer Connector(s)
    participant Dest as Destination Node
    participant Pipe as 5-Stage Pipeline
    participant Handler as Kind Handler

    Note over App: Build & sign NostrEvent

    App->>SDK: publishEvent(event, {destination, amount?})
    SDK->>Enc: encodeEventToToon(event)
    Enc-->>SDK: Uint8Array (compact binary)

    SDK->>SDK: resolveRouteFees(destination, peers)
    SDK->>SDK: calculateRouteAmount(basePricePerByte × bytes + hopFees)

    SDK->>ILP: buildIlpPrepare({destination, amount, data: base64(toon)})
    ILP-->>SDK: IlpPreparePacket

    SDK->>Conn: sendIlpPacket(packet)
    Note over Conn: Route by ILP address prefix

    Conn->>Net: Forward via BTP WebSocket
    Note over Net: Each hop deducts fee

    Net->>Dest: ILP PREPARE arrives

    Dest->>Pipe: handlePacket(request)

    Note over Pipe: Stage 1: Size check (max 1MB)
    Note over Pipe: Stage 2: shallowParseToon() → {kind, pubkey, id, sig}
    Note over Pipe: Stage 3: Schnorr signature verify
    Note over Pipe: Stage 4: amount ≥ basePricePerByte × byteLength
    Note over Pipe: Stage 5: Dispatch by kind

    Pipe->>Handler: HandlerContext {toon, kind, pubkey, amount}
    Handler->>Handler: ctx.decode() → full NostrEvent (lazy)
    Handler->>Handler: Business logic (store, compute, etc.)

    Handler-->>Dest: accept({data?}) or reject({code, message})
    Dest-->>Net: ILP FULFILL or ILP REJECT
    Net-->>Conn: Response propagates back
    Conn-->>SDK: {accepted, data?, code?, message?}
    SDK-->>App: PublishEventResult
```

## Flowchart — 5-Stage Pipeline Detail

```mermaid
flowchart TD
    A["ILP PREPARE arrives<br/>{destination, amount, data}"] --> B{"Stage 1:<br/>data.length ≤ 1MB?"}
    B -->|No| R1["REJECT F00<br/>Payload too large"]
    B -->|Yes| C["Stage 2:<br/>shallowParseToon(base64decode(data))"]
    C --> D{"Parse OK?<br/>kind, pubkey, id, sig extracted?"}
    D -->|No| R2["REJECT F06<br/>Invalid TOON data"]
    D -->|Yes| E["Stage 3:<br/>schnorr.verify(sig, id, pubkey)"]
    E --> F{"Signature valid?"}
    F -->|No| R3["REJECT F06<br/>Invalid signature"]
    F -->|Yes| G["Stage 4:<br/>amount ≥ basePricePerByte × byteLength?"]
    G --> H{"Sufficient payment?"}
    H -->|No| R4["REJECT F04<br/>Insufficient amount"]
    H -->|Yes| I["Stage 5:<br/>handlerRegistry.dispatch(kind)"]
    I --> J{"Handler found?"}
    J -->|No| R5["REJECT F00<br/>Unsupported kind"]
    J -->|Yes| K["Handler executes<br/>ctx.decode() if needed"]
    K --> L{"Handler accepts?"}
    L -->|No| R6["REJECT<br/>Handler-specific code"]
    L -->|Yes| M["ILP FULFILL<br/>Payment completes"]

    style R1 fill:#8b0000,color:#fff
    style R2 fill:#8b0000,color:#fff
    style R3 fill:#8b0000,color:#fff
    style R4 fill:#8b0000,color:#fff
    style R5 fill:#8b0000,color:#fff
    style R6 fill:#8b0000,color:#fff
    style M fill:#006400,color:#fff
```

## Data Format Transformations

```mermaid
flowchart LR
    A["NostrEvent<br/>(JSON object)"] -->|"encodeEventToToon()"| B["TOON Binary<br/>(Uint8Array)"]
    B -->|"Buffer.toString('base64')"| C["Base64 String<br/>(ILP packet data)"]
    C -->|"ILP network transport"| D["Base64 String<br/>(at destination)"]
    D -->|"Buffer.from(base64)"| E["TOON Binary<br/>(Uint8Array)"]
    E -->|"shallowParseToon()"| F["ToonRoutingMeta<br/>{kind, pubkey, id, sig}"]
    E -->|"decodeEventFromToon()<br/>(lazy, on demand)"| G["NostrEvent<br/>(full object)"]

    style A fill:#1a1a2e,color:#e94560
    style B fill:#1a1a2e,color:#0f3460
    style C fill:#1a1a2e,color:#16213e
    style D fill:#1a1a2e,color:#16213e
    style E fill:#1a1a2e,color:#0f3460
    style F fill:#1a1a2e,color:#533483
    style G fill:#1a1a2e,color:#e94560
```
