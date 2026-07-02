import { describe, expect, it } from "vitest";
import {
  capitalize,
  isBlank,
  normalizeLineEndings,
  trimEndSlash,
  trimStartSlash
} from "../src/index.js";

describe("strings", () => {
  it("capitalizes the first character only", () => {
    expect(capitalize("gitBridge")).toBe("GitBridge");
    expect(capitalize("")).toBe("");
  });

  it("detects blank strings", () => {
    expect(isBlank(" \n\t")).toBe(true);
    expect(isBlank(" value ")).toBe(false);
  });

  it("trims leading and trailing slashes independently", () => {
    expect(trimStartSlash("///a/b/")).toBe("a/b/");
    expect(trimEndSlash("/a/b///")).toBe("/a/b");
  });

  it("normalizes line endings to LF", () => {
    expect(normalizeLineEndings("a\r\nb\rc\n")).toBe("a\nb\nc\n");
  });
});
