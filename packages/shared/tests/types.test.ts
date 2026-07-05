import { describe, expectTypeOf, it } from "vitest";
import type {
  Awaitable,
  DeepPartial,
  DeepReadonly,
  Maybe,
  MaybePromise,
  NonEmptyArray,
  Nullable,
  Prettify,
  Primitive,
  ValueOf
} from "../src/index.js";

describe("types", () => {
  it("models approved utility types", () => {
    type Model = {
      readonly id: string;
      readonly nested: {
        readonly count: number;
        readonly tags: readonly string[];
      };
    };

    expectTypeOf<Awaitable<string>>().toEqualTypeOf<string | Promise<string>>();
    expectTypeOf<Maybe<string>>().toEqualTypeOf<string | undefined>();
    expectTypeOf<MaybePromise<string>>().toEqualTypeOf<string | PromiseLike<string>>();
    expectTypeOf<Nullable<string>>().toEqualTypeOf<string | null>();
    expectTypeOf<Primitive>().toEqualTypeOf<
      string | number | boolean | bigint | symbol | null | undefined
    >();
    expectTypeOf<NonEmptyArray<string>>().toEqualTypeOf<readonly [string, ...string[]]>();
    expectTypeOf<ValueOf<{ readonly a: "a"; readonly b: "b" }>>().toEqualTypeOf<"a" | "b">();
    expectTypeOf<Prettify<{ readonly a: string } & { readonly b: number }>>().toEqualTypeOf<{
      readonly a: string;
      readonly b: number;
    }>();
    expectTypeOf<DeepPartial<Model>>().toEqualTypeOf<{
      readonly id?: string;
      readonly nested?: {
        readonly count?: number;
        readonly tags?: readonly string[];
      };
    }>();
    expectTypeOf<DeepReadonly<{ value: { count: number }; list: string[] }>>().toEqualTypeOf<{
      readonly value: {
        readonly count: number;
      };
      readonly list: readonly string[];
    }>();
  });
});
