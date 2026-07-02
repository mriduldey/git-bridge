import { describe, expect, expectTypeOf, it } from "vitest";
import { assert, assertDefined, assertNever, unreachable } from "../src/index.js";

describe("assertions", () => {
  it("asserts truthy conditions", () => {
    expect(() => assert(true)).not.toThrow();
    expect(() => assert(false, "nope")).toThrow("nope");
  });

  it("narrows defined values", () => {
    const value: string | undefined = "ready";

    assertDefined(value);

    expectTypeOf(value).toEqualTypeOf<string>();
  });

  it("throws for nullish values", () => {
    expect(() => assertDefined(null, "missing")).toThrow("missing");
    expect(() => assertDefined(undefined, "missing")).toThrow("missing");
  });

  it("marks exhaustive and unreachable paths", () => {
    expect(() => assertNever("x" as never, "bad branch")).toThrow("bad branch: x");
    expect(() => unreachable("not here")).toThrow("not here");
  });
});
