# DVM (Data Vending Machine) Flow

How consumers discover providers, submit jobs, and receive results — all paid via ILP.

## Sequence Diagram — Complete DVM Job Lifecycle

```mermaid
sequenceDiagram
    participant Consumer as Consumer (SDK Node)
    participant Relay as TOON Relay
    participant Provider as DVM Provider (SDK Node)
    participant Backend as Backend Service<br/>(Arweave / Compute / Chain)

    Note over Provider: Provider publishes capabilities
    Provider->>Relay: kind:10035 SkillDescriptor<br/>(kinds, pricing, features, inputSchema)

    Note over Consumer: Consumer discovers providers
    Consumer->>Relay: Subscribe to kind:10035 (FREE read)
    Relay-->>Consumer: SkillDescriptor events

    Consumer->>Consumer: Filter by kind + features<br/>Rank by price / reputation

    Note over Consumer: Build & submit job request
    Consumer->>Consumer: buildJobRequestEvent()<br/>kind:5xxx, tags: [bid, i, output, p, param]
    Consumer->>Provider: publishEvent(jobRequest)<br/>via ILP PREPARE → 5-stage pipeline

    Note over Provider: Provider receives job
    Provider->>Provider: Handler ctx.kind === 5xxx<br/>ctx.decode() → extract job params

    Provider->>Consumer: kind:7000 feedback<br/>status: "processing"

    Provider->>Backend: Execute job<br/>(upload to Arweave / run WASM / broadcast tx)
    Backend-->>Provider: Result + receipt metadata

    Provider->>Consumer: kind:6xxx result<br/>content + receipt tags<br/>(arweave-tx / compute-ms / tx-hash / gas-used)

    Note over Consumer: Consumer verifies receipt
    Consumer->>Consumer: Parse self-describing receipt tags<br/>Verify job completion
```

## Flowchart — DVM Event Kind Taxonomy

```mermaid
flowchart TB
    subgraph "Job Request Events (kind 5xxx)"
        K5094["kind:5094<br/>Blob Storage Request<br/>Upload to Arweave"]
        K5250["kind:5250<br/>Compute Request<br/>Run WASM / inference"]
        K5260["kind:5260<br/>Chain Bridge Request<br/>Broadcast signed tx"]
    end

    subgraph "Job Result Events (kind 6xxx)"
        K6094["kind:6094<br/>Blob Storage Result<br/>Arweave TX ID + receipt"]
        K6250["kind:6250<br/>Compute Result<br/>Output + compute-ms"]
        K6260["kind:6260<br/>Chain Bridge Result<br/>Per-chain tx-hash + status"]
    end

    subgraph "Control Events"
        K7000["kind:7000<br/>Job Feedback<br/>processing / error / success"]
        K10035["kind:10035<br/>SkillDescriptor<br/>Provider capabilities + pricing"]
    end

    K5094 -->|"result"| K6094
    K5250 -->|"result"| K6250
    K5260 -->|"result"| K6260

    K5094 -.->|"status update"| K7000
    K5250 -.->|"status update"| K7000
    K5260 -.->|"status update"| K7000

    K10035 -.->|"discovery"| K5094
    K10035 -.->|"discovery"| K5250
    K10035 -.->|"discovery"| K5260

    style K5094 fill:#0f3460,color:#fff
    style K5250 fill:#0f3460,color:#fff
    style K5260 fill:#0f3460,color:#fff
    style K6094 fill:#006400,color:#fff
    style K6250 fill:#006400,color:#fff
    style K6260 fill:#006400,color:#fff
    style K7000 fill:#533483,color:#fff
    style K10035 fill:#e94560,color:#fff
```

## Flowchart — DVM Job Request Tag Structure

```mermaid
flowchart LR
    subgraph "kind:5xxx Job Request"
        direction TB
        T1["['i', data, type, relay?, marker?]<br/>Input specification"]
        T2["['bid', amount, 'usdc']<br/>Payment offer (6 decimals)"]
        T3["['output', mimeType]<br/>Expected result MIME type"]
        T4["['p', providerPubkey]<br/>Target specific provider (optional)"]
        T5["['param', key, value]<br/>Key-value parameters (repeatable)"]
        T6["['relays', url1, url2]<br/>Preferred relay URLs (optional)"]
    end

    subgraph "kind:6xxx Job Result"
        direction TB
        R1["['e', requestEventId]<br/>Reference to request"]
        R2["['p', customerPubkey]<br/>Customer identity"]
        R3["['amount', cost, 'usdc']<br/>Actual cost (receipt)"]
        R4["Self-describing receipt tags<br/>(per-primitive)"]
    end

    subgraph "Receipt Tags by Primitive"
        direction TB
        B1["Blob: ['arweave-tx', txId]<br/>['content-type', mime]<br/>['size-bytes', n]"]
        C1["Compute: ['compute-ms', ms]<br/>['backend', name]<br/>['attestation', eventId]"]
        CH1["Chain: ['chain', name]<br/>['tx-hash', hash]<br/>['status', confirmed|pending]<br/>['gas-used', n]"]
    end

    R4 --- B1
    R4 --- C1
    R4 --- CH1

    style T2 fill:#e94560,color:#fff
    style R3 fill:#006400,color:#fff
```

## Sequence Diagram — Multi-Primitive Composition (Workflow)

```mermaid
sequenceDiagram
    participant Client as Client
    participant Composer as Composite Provider<br/>(e.g., Loony)
    participant Blob as Blob DVM<br/>(kind:5094)
    participant Compute as Compute DVM<br/>(kind:5250)
    participant Bridge as Chain Bridge DVM<br/>(kind:5260)

    Client->>Composer: kind:5250 job request<br/>"verified-deploy" composite service<br/>bid: 500 USDC-micro

    Note over Composer: Orchestrate sub-jobs

    Composer->>Compute: kind:5250 "lint code"<br/>cost: 50 USDC-micro
    Compute-->>Composer: kind:6250 result (pass)

    Composer->>Compute: kind:5250 "run tests"<br/>cost: 100 USDC-micro
    Compute-->>Composer: kind:6250 result (pass)

    Composer->>Blob: kind:5094 "store artifact"<br/>cost: 30 USDC-micro
    Blob-->>Composer: kind:6094 arweave-tx

    Composer->>Bridge: kind:5260 "deploy to chain"<br/>cost: 80 USDC-micro
    Bridge-->>Composer: kind:6260 tx-hash

    Note over Composer: Total cost: 260<br/>Charged client: 500<br/>Margin: 240 (convenience fee)

    Composer-->>Client: kind:6250 composed result<br/>lint ✓, tests ✓, artifact TX, deploy TX
```
