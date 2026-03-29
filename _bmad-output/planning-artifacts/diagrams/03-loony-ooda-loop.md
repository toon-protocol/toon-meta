# Loony — Autonomous Agent OODA Loop

Loony is an always-on consumer application that exercises all four TOON network primitives via a continuous OODA decision loop.

## Flowchart — Loony OODA Cycle

```mermaid
flowchart TD
    Start["OODA Cycle Start<br/>(configurable interval)"] --> O

    subgraph O ["OBSERVE"]
        O1["Read relay events (FREE)<br/>kind:1, kind:30023, etc."]
        O2["Check ServiceRegistry<br/>New/changed kind:10035 providers?"]
        O3["Check wallet balance<br/>ILP channels + on-chain USDC"]
        O1 --> O2 --> O3
    end

    O --> OR

    subgraph OR ["ORIENT"]
        OR1["Select inference provider<br/>from ServiceRegistry<br/>filter: features=['compute','inference']<br/>rank: price, reputation"]
        OR2["Submit observations to LLM<br/>kind:5250 compute job<br/>(pay via ILP)"]
        OR3["LLM returns<br/>situation assessment"]
        OR1 --> OR2 --> OR3
    end

    OR --> D

    subgraph D ["DECIDE"]
        D1["LLM outputs structured action plan<br/>List of LoonyAction items + rationale"]
        D2["Budget governor validates<br/>totalCost ≤ availableBalance - reserve"]
        D3{"Budget approved?"}
        D1 --> D2 --> D3
    end

    D3 -->|Yes| A
    D3 -->|No| Passive["Passive observation mode<br/>(observe only, skip act)"]
    Passive --> Wait

    subgraph A ["ACT — ActionDispatcher"]
        A1{"action.type?"}
        A1 -->|message| M["publishEvent()<br/>Pay basePricePerByte via ILP"]
        A1 -->|store| S["kind:5094 → Arweave DVM<br/>Store data permanently"]
        A1 -->|compute| C["kind:5250 → Compute DVM<br/>Run WASM / inference"]
        A1 -->|bridge| B["kind:5260 → Chain Bridge DVM<br/>Broadcast signed tx"]

        M --> Track
        S --> Track
        C --> Track
        B --> Track
        Track["Record cost per action<br/>LoonyResult: {receipt, cost, provider}"]
    end

    A --> Wait["Wait intervalMs<br/>then repeat"]
    Wait --> Start

    style O fill:#1a1a2e,color:#00d4ff
    style OR fill:#1a1a2e,color:#b388ff
    style D fill:#1a1a2e,color:#ffab40
    style A fill:#1a1a2e,color:#69f0ae
```

## Flowchart — Loony Earning Model (Composite Services)

```mermaid
flowchart TD
    subgraph "Loony as DVM CONSUMER"
        C1["Discover providers<br/>via kind:10035"]
        C2["Submit jobs to primitives<br/>kind:5094 / 5250 / 5260"]
        C3["Pay providers via ILP"]
        C1 --> C2 --> C3
    end

    subgraph "Loony as DVM PROVIDER"
        P1["Compose multi-step workflow<br/>from discovered primitives"]
        P2["Publish kind:10035 SkillDescriptor<br/>for composite service"]
        P3["Receive job requests<br/>via ILP (earn income)"]
        P4["Orchestrate sub-jobs<br/>across real providers"]
        P5["Return composed result<br/>Earn convenience fee margin"]
        P1 --> P2 --> P3 --> P4 --> P5
    end

    subgraph "Self-Sustaining Economics"
        E1["Revenue: composite service fees"]
        E2["Expense: primitive provider costs"]
        E3["Margin = Revenue - Expense"]
        E4{"margin > 0?"}
        E4 -->|Yes| E5["Keep offering service"]
        E4 -->|No, over N cycles| E6["De-register service<br/>(self-pruning)"]
        E1 --> E3
        E2 --> E3
        E3 --> E4
    end

    style E5 fill:#006400,color:#fff
    style E6 fill:#8b0000,color:#fff
```

## Flowchart — Runtime Capability Extension

```mermaid
flowchart TD
    A["New kind:10035 SkillDescriptor<br/>appears on relay"] --> B["ServiceRegistry detects it<br/>(real-time subscription)"]
    B --> C["CapabilityExtender feeds descriptor<br/>to LLM via kind:5250"]
    C --> D["LLM reads TOON-format descriptor<br/>(LLM-readable by design)"]
    D --> E["LLM proposes compositions<br/>combining new + existing services"]
    E --> F{"Estimated margin > 0?"}
    F -->|Yes| G["Auto-register as new<br/>composite service via<br/>CompositeServiceManager"]
    G --> H["Publish new kind:10035<br/>SkillDescriptor to relay"]
    H --> I["New capability live<br/>No code changes needed"]
    F -->|No| J["Log opportunity,<br/>revisit next cycle"]

    style I fill:#006400,color:#fff
    style J fill:#333,color:#aaa
```

## Class Diagram — Loony Architecture

```mermaid
classDiagram
    class LoonyAgent {
        +start()
        +stop()
        +getIdentity()
        +getBalance()
    }

    class ServiceRegistry {
        +discoverProviders(kind, features?)
        +getProvider(pubkey)
        +getBestProvider(kind, features?, rankBy?)
        -autoRefresh via relay subscription
        -stalePruning by TTL
    }

    class ReasoningEngine {
        +reason(prompt, context?)
        +reasonStructured~T~(prompt, schema)
        +selectInferenceProvider()
        -provider failover logic
    }

    class ActionDispatcher {
        +act(action: LoonyAction)
        -routeToMessage()
        -routeToBlobStorage()
        -routeToCompute()
        -routeToChainBridge()
        -trackCost()
    }

    class OODALoop {
        +intervalMs
        +maxActionsPerCycle
        +budgetPerCycle
        +goals: string[]
        -observe()
        -orient()
        -decide()
        -act()
    }

    class CompositeServiceManager {
        +registerService(descriptor, handler)
        -orchestrateSubJobs()
        -trackRevenue()
    }

    class CapabilityExtender {
        +proposeComposition(newService, existingServices)
        -monitorServiceRegistry()
        -autoRegisterProfitable()
    }

    LoonyAgent --> OODALoop
    LoonyAgent --> ServiceRegistry
    OODALoop --> ReasoningEngine : orient/decide
    OODALoop --> ActionDispatcher : act
    ActionDispatcher --> ServiceRegistry : find providers
    CompositeServiceManager --> ActionDispatcher : orchestrate
    CapabilityExtender --> ReasoningEngine : evaluate
    CapabilityExtender --> CompositeServiceManager : register
    CapabilityExtender --> ServiceRegistry : monitor
```
