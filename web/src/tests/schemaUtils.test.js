import { describe, it, expect } from "vitest";
import { buildDefaults, validateLocal } from "../schemaUtils";

describe("schema utils", () => {
  it("validates exposure limit by amounts", () => {
    const schema = {
      groups: [
        {
          fields: [
            { key: "funds.depositAmount", type: "number", default: 100, validation: { required: true } },
            { key: "funds.nasdaqExposureLimitPercent", type: "number", default: 60, validation: { required: true } }
          ]
        },
        {
          fields: [
            { key: "portfolio.investedNasdaqCny", type: "number", default: 0, validation: { required: true } },
            { key: "portfolio.reserveCashNasdaqCny", type: "number", default: 0, validation: { required: true } }
          ]
        }
      ]
    };
    const s = buildDefaults(schema);
    s.funds.depositAmount = 100;
    s.funds.nasdaqExposureLimitPercent = 60;
    s.portfolio.investedNasdaqCny = 50;
    s.portfolio.reserveCashNasdaqCny = 20;
    const v = validateLocal(schema, s);
    expect(v.ok).toBe(false);
    expect(v.fieldErrors["portfolio.investedNasdaqCny"]).toBeTruthy();
  });
});

