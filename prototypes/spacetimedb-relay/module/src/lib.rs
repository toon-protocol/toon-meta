//! Minimal SpacetimeDB module modeling the TOON relay's store+broadcast role.
//!
//! Two paths, mirroring the relay's NIP-16 split:
//! - `events`  — persistent table (regular kinds; journaled + state-persisted),
//!   with btree indexes on kind/author standing in for the relay's sqlite indexes.
//! - `frames`  — EVENT table (ephemeral kinds 20000..30000; rows broadcast to
//!   subscribers at commit then dropped from state — but still journaled in the
//!   commitlog, which is the crux this prototype measures).
//!
//! No schnorr verification in the module: the honest counterfactual is the
//! relay with its planned "skip verify for paid ephemeral kinds" fix
//! (TOON_DEV_MODE on the relay side of the bench), and a real deployment would
//! verify in a protocol shim in front, exactly like the connector does today.

use spacetimedb::{reducer, table, ReducerContext, Table};

/// Persistent Nostr-shaped event row (regular kinds).
#[table(accessor = events, public)]
pub struct Event {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    #[index(btree)]
    pub kind: u32,
    #[index(btree)]
    pub author: String,
    pub created_at: u64,
    pub content: String,
    /// Writer-side CLOCK_REALTIME micros, for end-to-end latency measurement.
    pub sent_at: u64,
}

/// Ephemeral huddle-frame row (event table: broadcast-only, empty between txs).
#[table(accessor = frames, public, event)]
pub struct Frame {
    pub session: u32,
    pub seq: u64,
    pub sent_at: u64,
    pub payload: String,
}

/// Persistent write path (relay: POST /write with a regular kind).
#[reducer]
pub fn post_event(
    ctx: &ReducerContext,
    kind: u32,
    author: String,
    created_at: u64,
    content: String,
    sent_at: u64,
) {
    ctx.db.events().insert(Event {
        id: 0,
        kind,
        author,
        created_at,
        content,
        sent_at,
    });
}

/// Ephemeral write path (relay: POST /write with kind 20000..30000).
#[reducer]
pub fn post_frame(ctx: &ReducerContext, session: u32, seq: u64, sent_at: u64, payload: String) {
    ctx.db.frames().insert(Frame {
        session,
        seq,
        sent_at,
        payload,
    });
}
