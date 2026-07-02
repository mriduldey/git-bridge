import { describe, expect, expectTypeOf, it } from "vitest";
import {
  isBoolean,
  isDefined,
  isError,
  isNumber,
  isObject,
  isPlainObject,
  isRecord,
  isString
} from "../src/index.js";

describe("guards", () => {
  it("checks defined values", () => {
    const values = [0, null, "x", undefined].filter(isDefined);

    expect(values).toEqual([0, "x"]);
    expectTypeOf(values).toEqualTypeOf<Array<string | number>>();
  });

  it("checks primitive values", () => {
    expect(isString("x")).toBe(true);
    expect(isString(1)).toBe(false);
    expect(isNumber(1)).toBe(true);
    expect(isNumber(Number.NaN)).toBe(false);
    expect(isBoolean(false)).toBe(true);
    expect(isBoolean("false")).toBe(false);
  });

  it("checks object-like values", () => {
    expect(isObject({})).toBe(true);
    expect(isObject(null)).toBe(false);
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject(Object.create(null))).toBe(true);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(new Date())).toBe(false);
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(new Date())).toBe(true);
  });

  it("checks errors", () => {
    expect(isError(new Error("x"))).toBe(true);
    expect(isError({ message: "x" })).toBe(false);
  });
});
