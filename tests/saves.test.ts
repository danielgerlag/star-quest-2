import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { readSave, writeSave } from "../src/platform/saves";

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("local save boundary", () => {
  it("round-trips a snapshot and keeps manual slots separate", () => {
    const resume = { world: { progress: "sample-stage" }, checkpoint: { progress: "earlier-stage" } };
    writeSave("1", "test-campaign", resume, "Manual checkpoint");
    expect(readSave("1", "test-campaign")?.resume).toEqual(resume);
    expect(readSave("auto", "test-campaign")).toBeNull();
  });

  it("leaves corrupt and unsupported data intact", () => {
    storage.set("star-quest-2.save.auto", "{not-json");
    expect(() => readSave("auto", "test-campaign")).toThrow();
    expect(storage.get("star-quest-2.save.auto")).toBe("{not-json");
    storage.set("star-quest-2.save.2", JSON.stringify({ format: 9 }));
    expect(() => readSave("2", "test-campaign")).toThrow("unsupported");
  });

  it("does not report a successful save when storage rejects a write", () => {
    vi.stubGlobal("localStorage", { setItem: () => { throw new Error("Storage denied"); } });
    expect(() => writeSave("auto", "test-campaign", {}, "Checkpoint")).toThrow("Storage denied");
  });
});
