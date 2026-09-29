import test from "node:test";
import assert from "node:assert/strict";
import {
  FULL_ATTACK_UNIT,
  HALLWAY_BASE_EXPANSION,
  HALLWAY_RANDOM_MAX,
  reciprocalDefenseStep,
  verifyReciprocalDefenseReceipt,
} from "../security/reciprocal-defense.mjs";

test("every meaningful probe activates the full unit and expands 48k plus bounded entropy", () => {
  const step = reciprocalDefenseStep({
    actor: "unknown-crawler",
    sourceIp: "203.0.113.7",
    route: "/probe",
    method: "GET",
    timestamp: "2026-09-27T21:00:00.000Z",
  }, "test-only-secret");

  assert.deepEqual(step.attackUnit, [...FULL_ATTACK_UNIT]);
  assert.equal(step.attackUnitMode, "all-applicable-every-meaningful-step");
  assert.equal(step.hallway.baseExpansion, HALLWAY_BASE_EXPANSION);
  assert.ok(step.hallway.randomExpansion >= 0);
  assert.ok(step.hallway.randomExpansion <= HALLWAY_RANDOM_MAX);
  assert.equal(step.hallway.logicalExpansion, HALLWAY_BASE_EXPANSION + step.hallway.randomExpansion);
  assert.equal(step.hallway.productionExposure, 0);
  assert.equal(step.hallway.realCustomerData, false);
  assert.equal(step.hallway.realCredentials, false);
  assert.equal(step.boundaries.ownedOrAuthorizedSurfacesOnly, true);
  assert.equal(step.boundaries.externalCompromise, false);
  assert.equal(verifyReciprocalDefenseReceipt(step), true);
});

test("same event and secret are reconstructable; changed event changes the receipt", () => {
  const a = reciprocalDefenseStep({ actor: "bot", route: "/a", timestamp: "2026-09-27T21:00:00.000Z" }, "secret");
  const b = reciprocalDefenseStep({ actor: "bot", route: "/a", timestamp: "2026-09-27T21:00:00.000Z" }, "secret");
  const c = reciprocalDefenseStep({ actor: "bot", route: "/b", timestamp: "2026-09-27T21:00:00.000Z" }, "secret");
  assert.equal(a.receipt, b.receipt);
  assert.notEqual(a.receipt, c.receipt);
});
