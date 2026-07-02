import { describe, expect, it } from "vitest";
import { basename, dirname, joinPath, normalizePath, splitPath } from "../src/index.js";

describe("paths", () => {
  it("normalizes slash-delimited paths", () => {
    expect(normalizePath("a\\\\b//./c/../d")).toBe("a/b/d");
    expect(normalizePath("/a/../../b")).toBe("/b");
    expect(normalizePath("../a")).toBe("../a");
    expect(normalizePath("")).toBe("");
  });

  it("joins path segments", () => {
    expect(joinPath("a/", "/b", "c")).toBe("a/b/c");
    expect(joinPath("", "a", "", "b")).toBe("a/b");
  });

  it("splits paths into non-empty normalized segments", () => {
    expect(splitPath("/a//b/c/")).toEqual(["a", "b", "c"]);
    expect(splitPath("/")).toEqual([]);
  });

  it("returns basename and dirname", () => {
    expect(basename("/a/b/c.txt")).toBe("c.txt");
    expect(basename("/")).toBe("");
    expect(dirname("/a/b/c.txt")).toBe("/a/b");
    expect(dirname("a.txt")).toBe("");
    expect(dirname("/a.txt")).toBe("/");
  });
});
