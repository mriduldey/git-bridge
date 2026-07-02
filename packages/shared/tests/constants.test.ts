import { describe, expect, expectTypeOf, it } from "vitest";
import { EMPTY_ARRAY, EMPTY_OBJECT } from "../src/index.js";

describe("constants", () => {
  it("exports immutable empty sentinels", () => {
    expect(EMPTY_ARRAY).toEqual([]);
    expect(EMPTY_OBJECT).toEqual({});
    expect(Object.isFrozen(EMPTY_ARRAY)).toBe(true);
    expect(Object.isFrozen(EMPTY_OBJECT)).toBe(true);
    expectTypeOf(EMPTY_ARRAY).toEqualTypeOf<readonly never[]>();
    expectTypeOf(EMPTY_OBJECT).toEqualTypeOf<Readonly<Record<PropertyKey, never>>>();
  });
});
