import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  NEEDS_HUMAN_LABEL,
  lastNeedsHumanApplier,
  shouldClearNeedsHuman,
} from "../../.sandcastle/needs-human-evaluator.mjs";

const BOT = "ALLiDoizCode";
const HUMAN = "some-maintainer";

const labeled = (actor, name = NEEDS_HUMAN_LABEL) => ({
  event: "labeled",
  label: { name },
  actor: { login: actor },
});
const unlabeled = (actor, name = NEEDS_HUMAN_LABEL) => ({
  event: "unlabeled",
  label: { name },
  actor: { login: actor },
});

describe("lastNeedsHumanApplier", () => {
  it("returns null for an empty or non-array timeline", () => {
    assert.equal(lastNeedsHumanApplier([]), null);
    assert.equal(lastNeedsHumanApplier(undefined), null);
    assert.equal(lastNeedsHumanApplier(null), null);
  });

  it("returns the actor that applied the label", () => {
    assert.equal(lastNeedsHumanApplier([labeled(BOT)]), BOT);
  });

  it("returns null once the label has been removed", () => {
    assert.equal(lastNeedsHumanApplier([labeled(BOT), unlabeled(BOT)]), null);
  });

  it("takes the LAST application when the label was cycled", () => {
    // The exact shape that broke: bot applies, human clears, human re-applies.
    const timeline = [labeled(BOT), unlabeled(HUMAN), labeled(HUMAN)];
    assert.equal(lastNeedsHumanApplier(timeline), HUMAN);
  });

  it("ignores events for other labels", () => {
    const timeline = [
      labeled(HUMAN, "agent:review"),
      labeled(BOT),
      labeled(HUMAN, "risk:high"),
      unlabeled(BOT, "agent:review"),
    ];
    assert.equal(lastNeedsHumanApplier(timeline), BOT);
  });

  it("ignores unrelated timeline events", () => {
    const timeline = [
      { event: "commented", actor: { login: HUMAN } },
      labeled(BOT),
      { event: "reviewed", actor: { login: HUMAN } },
    ];
    assert.equal(lastNeedsHumanApplier(timeline), BOT);
  });

  it("survives malformed entries without throwing", () => {
    const timeline = [null, {}, { event: "labeled" }, labeled(BOT)];
    assert.equal(lastNeedsHumanApplier(timeline), BOT);
  });

  it("reports null when the applying actor is missing", () => {
    assert.equal(
      lastNeedsHumanApplier([{ event: "labeled", label: { name: NEEDS_HUMAN_LABEL } }]),
      null,
    );
  });
});

describe("shouldClearNeedsHuman", () => {
  it("clears what the approver applied — the wedge this fixes", () => {
    assert.equal(shouldClearNeedsHuman([labeled(BOT)], BOT), true);
  });

  it("NEVER clears a label a human applied", () => {
    assert.equal(shouldClearNeedsHuman([labeled(HUMAN)], BOT), false);
  });

  it("does not clear when a human re-applied after the approver", () => {
    // A human deliberately re-gating a PR must survive a later clean verdict.
    const timeline = [labeled(BOT), unlabeled(BOT), labeled(HUMAN)];
    assert.equal(shouldClearNeedsHuman(timeline, BOT), false);
  });

  it("clears when the approver re-applied after a human removed it", () => {
    const timeline = [labeled(HUMAN), unlabeled(HUMAN), labeled(BOT)];
    assert.equal(shouldClearNeedsHuman(timeline, BOT), true);
  });

  it("is a no-op when the label is not applied", () => {
    assert.equal(shouldClearNeedsHuman([], BOT), false);
    assert.equal(shouldClearNeedsHuman([labeled(BOT), unlabeled(BOT)], BOT), false);
  });

  it("fails closed with no approver identity", () => {
    assert.equal(shouldClearNeedsHuman([labeled(BOT)], ""), false);
    assert.equal(shouldClearNeedsHuman([labeled(BOT)], undefined), false);
  });

  it("is case-sensitive on the login, matching GitHub's actor field", () => {
    assert.equal(shouldClearNeedsHuman([labeled("allidoizcode")], BOT), false);
  });
});
