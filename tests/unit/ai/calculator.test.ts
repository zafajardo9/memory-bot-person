import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CalculatorError,
  convertValue,
  evaluateMathExpression,
} from "@/ai/tools/calculator";

describe("evaluateMathExpression", () => {
  it("evaluates basic arithmetic", () => {
    expect(evaluateMathExpression("(12 + 4) * 3")).toBe(48);
    expect(evaluateMathExpression("1200 + 350")).toBe(1550);
    expect(evaluateMathExpression("10 / 4")).toBe(2.5);
  });

  it("supports exponents with right associativity", () => {
    expect(evaluateMathExpression("2^10")).toBe(1024);
    expect(evaluateMathExpression("2^3^2")).toBe(512);
  });

  it("handles unary minus", () => {
    expect(evaluateMathExpression("-5 + 3")).toBe(-2);
    expect(evaluateMathExpression("2 * -3")).toBe(-6);
  });

  it("treats attached % as a percent literal", () => {
    expect(evaluateMathExpression("50%")).toBe(0.5);
    expect(evaluateMathExpression("200 * 15%")).toBe(30);
  });

  it("supports the \"X% of Y\" phrase", () => {
    expect(evaluateMathExpression("15% of 250")).toBe(37.5);
  });

  it("uses spaced % as modulo", () => {
    expect(evaluateMathExpression("17 % 5")).toBe(2);
  });

  it("supports whitelisted functions and constants", () => {
    expect(evaluateMathExpression("sqrt(144)")).toBe(12);
    expect(evaluateMathExpression("max(3, 7, 5)")).toBe(7);
    expect(evaluateMathExpression("round(2.5)")).toBe(3);
    expect(evaluateMathExpression("pow(2, 8)")).toBe(256);
    expect(Math.abs(evaluateMathExpression("2 * pi") - Math.PI * 2)).toBeLessThan(1e-9);
  });

  it("rejects division by zero", () => {
    expect(() => evaluateMathExpression("1 / 0")).toThrow(CalculatorError);
  });

  it("rejects code injection attempts", () => {
    expect(() => evaluateMathExpression("constructor.constructor('return 1')()")).toThrow(
      CalculatorError,
    );
    expect(() => evaluateMathExpression("alert(1)")).toThrow(CalculatorError);
    expect(() => evaluateMathExpression("process.exit()")).toThrow(CalculatorError);
  });

  it("rejects malformed expressions", () => {
    expect(() => evaluateMathExpression("(1 + 2")).toThrow(CalculatorError);
    expect(() => evaluateMathExpression("")).toThrow(CalculatorError);
    expect(() => evaluateMathExpression("1 +")).toThrow(CalculatorError);
  });
});

describe("convertValue (units)", () => {
  it("converts length", async () => {
    const { result } = await convertValue(5, "km", "mi");
    expect(result).toBeCloseTo(3.10686, 4);
  });

  it("resolves common aliases and plurals", async () => {
    const { result } = await convertValue(5, "kilometers", "miles");
    expect(result).toBeCloseTo(3.10686, 4);
  });

  it("converts mass", async () => {
    const { result } = await convertValue(1, "kg", "lb");
    expect(result).toBeCloseTo(2.20462, 4);
  });

  it("converts data with binary multiples", async () => {
    const { result } = await convertValue(1, "gb", "mb");
    expect(result).toBe(1024);
  });

  it("converts temperature through Celsius", async () => {
    expect((await convertValue(100, "c", "f")).result).toBeCloseTo(212, 6);
    expect((await convertValue(32, "f", "c")).result).toBeCloseTo(0, 6);
    expect((await convertValue(0, "c", "k")).result).toBeCloseTo(273.15, 6);
  });

  it("prefers units over lookalike currency codes (km/ft)", async () => {
    const { result } = await convertValue(10, "km", "ft");
    expect(result).toBeCloseTo(32808.4, 1);
  });
});

describe("convertValue (currency)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("converts with cached live rates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          result: "success",
          rates: { EUR: 0.92, JPY: 150 },
        }),
      ),
    );

    const { result, from, to } = await convertValue(100, "USD", "EUR");
    expect(result).toBe(92);
    expect(from).toBe("USD");
    expect(to).toBe("EUR");
  });

  it("rejects unknown currency codes without leaking secrets", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({ result: "error", "error-type": "unsupported-code" }),
      ),
    );
    await expect(convertValue(1, "USD", "ZZZ")).rejects.toThrow(CalculatorError);
  });
});
