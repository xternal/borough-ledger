import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { countTestMarkers, scanDir } from "./check-test-values.mjs";

describe("post-build test value scan", () => {
  it("finds marks in HTML and in escaped RSC payloads", () => {
    expect(countTestMarkers('<span class="num" data-q="test">£1</span>')).toBe(1);
    expect(countTestMarkers('self.__next_f.push([1,"{\\"quality\\":\\"test\\",\\"value\\":3}"])')).toBe(1);
    expect(countTestMarkers('{"data-q":"test"}')).toBe(1);
    expect(countTestMarkers('<span data-q="approx">£1</span> {"quality":"sourced"}')).toBe(0);
  });

  it("scans only page output and totals the marks", () => {
    const dir = mkdtempSync(join(tmpdir(), "bl-scan-"));
    mkdirSync(join(dir, "index.segments"));
    writeFileSync(join(dir, "index.html"), '<b data-q="test">1</b><b data-q="test">2</b>');
    writeFileSync(join(dir, "index.segments", "_full.segment.rsc"), '{"quality":"test"}');
    writeFileSync(join(dir, "page.js"), '"quality":"test"');
    const r = scanDir(dir);
    expect(r.scanned).toBe(2);
    expect(r.total).toBe(3);
  });

  it("passes clean output", () => {
    const dir = mkdtempSync(join(tmpdir(), "bl-scan-"));
    writeFileSync(join(dir, "index.html"), '<b data-q="sourced">1</b>');
    expect(scanDir(dir).total).toBe(0);
  });
});
