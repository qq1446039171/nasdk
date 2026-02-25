import { describe, it, expect } from "vitest";
import { normalizeNsdkState, validateNsdkStateLocal } from "../nsdkStateUtils";

describe("nsdk state utils", () => {
  it("normalizes missing fields", () => {
    const s = normalizeNsdkState({});
    expect(s.freeze.active).toBe(false);
    expect(s.drawdownRound).toBe(null);
    expect(typeof s.lastRunKeys).toBe("object");
  });

  it("normalizes drawdownRound tiers", () => {
    const s = normalizeNsdkState({
      drawdownRound: {
        startedAt: "2026-01-01T00:00:00.000Z",
        snapshotReserveCny: 10000,
        table: [{ level: 10, amountCny: 1000 }],
        alerted: { "10": true },
        executed: { "10": false }
      }
    });
    expect(s.drawdownRound.executed["10"]).toBe(false);
    expect(s.drawdownRound.alerted["10"]).toBe(true);
    expect(s.drawdownRound.executed["15"]).toBe(false);
  });

  it("coerces tier flags to booleans", () => {
    const s = normalizeNsdkState({
      drawdownRound: {
        startedAt: "x",
        snapshotReserveCny: 0,
        table: [],
        alerted: { "10": "yes" },
        executed: { "10": "no" }
      }
    });
    expect(typeof s.drawdownRound.executed["10"]).toBe("boolean");
    expect(typeof s.drawdownRound.alerted["10"]).toBe("boolean");
    const v = validateNsdkStateLocal(s);
    expect(v.ok).toBe(true);
  });
});

