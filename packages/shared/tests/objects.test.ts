import { describe, expect, expectTypeOf, it } from "vitest";
import { deepFreeze, hasOwn, isEmptyObject, mergeDefined } from "../src/index.js";

describe("objects", () => {
  it("deep freezes object graphs", () => {
    const value = {
      nested: {
        count: 1
      },
      list: [{ name: "a" }]
    };

    const frozen = deepFreeze(value);

    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.nested)).toBe(true);
    expect(Object.isFrozen(frozen.list)).toBe(true);
    expect(Object.isFrozen(frozen.list[0])).toBe(true);
    expectTypeOf(frozen).toEqualTypeOf<{
      readonly nested: {
        readonly count: number;
      };
      readonly list: readonly {
        readonly name: string;
      }[];
    }>();
  });

  it("checks own properties", () => {
    const object: { readonly own?: string } = { own: "yes" };

    expect(hasOwn(object, "own")).toBe(true);
    expect(hasOwn(object, "missing")).toBe(false);
  });

  it("checks empty objects including symbols", () => {
    const key = Symbol("key");

    expect(isEmptyObject({})).toBe(true);
    expect(isEmptyObject({ [key]: true })).toBe(false);
  });

  it("merges only defined values without mutating the target", () => {
    const target = { a: 1, b: 2, c: 3 };
    const merged = mergeDefined(target, { a: 4, b: undefined });

    expect(merged).toEqual({ a: 4, b: 2, c: 3 });
    expect(target).toEqual({ a: 1, b: 2, c: 3 });
  });
});
