import { describe, expect, it } from "vitest";
import { codesMatch, signToken, verifyToken } from "./tokens";
import { GROUP_COUNT, nameKey, parseJoin } from "./workshop";
import { parseMockup, parseSavedDesign } from "./designPayload";
import { createFailureLimiter } from "./rateLimit";

const imageJson = (src: string) => JSON.stringify({ version: "6", objects: [{ type: "Image", src }] });
const baseDesign = (overrides: Record<string, unknown> = {}) => ({
  configuration: { productId: "classic-tshirt", garmentType: "tshirt", shirtColor: "#23344e", size: "M", activeSide: "front", frontDesign: null, backDesign: null, frontCanvasJson: null, backCanvasJson: null, ...overrides },
  meshArtwork: { front: {}, back: {} },
});

describe("signed session tokens", () => {
  it("round-trips a valid token", () => {
    const token = signToken({ role: "participant", id: 7 }, "secret", 60);
    expect(verifyToken<{ id: number }>(token, "secret")?.id).toBe(7);
  });
  it("rejects a tampered, wrong-secret, or expired token", () => {
    const token = signToken({ role: "admin" }, "secret", 60, 1_000_000);
    const [body, signature] = token.split(".");
    expect(verifyToken(`${body}x.${signature}`, "secret", 1_000_000)).toBeNull();
    expect(verifyToken(token, "other", 1_000_000)).toBeNull();
    expect(verifyToken(token, "secret", 1_000_000 + 61_000)).toBeNull();
    expect(verifyToken(undefined, "secret")).toBeNull();
  });
  it("compares access codes exactly", () => {
    expect(codesMatch("abc", "abc")).toBe(true);
    expect(codesMatch("abc", "abd")).toBe(false);
    expect(codesMatch("", "abc")).toBe(false);
  });
});

describe("join validation", () => {
  const valid = { accessCode: " code ", name: "  Gary   Smith ", groupNumber: "2", email: "" };
  it("normalizes a valid join", () => {
    const result = parseJoin(valid);
    expect(result).toEqual({ ok: true, value: { accessCode: "code", name: "Gary Smith", groupNumber: 2, email: null } });
  });
  it("treats names case-insensitively", () => {
    expect(nameKey("  GARY   smith")).toBe(nameKey("gary smith"));
  });
  it("rejects bad groups, names, and emails", () => {
    expect(parseJoin({ ...valid, groupNumber: 0 }).ok).toBe(false);
    expect(parseJoin({ ...valid, groupNumber: GROUP_COUNT + 1 }).ok).toBe(false);
    expect(parseJoin({ ...valid, groupNumber: 1.5 }).ok).toBe(false);
    expect(parseJoin({ ...valid, name: "G" }).ok).toBe(false);
    expect(parseJoin({ ...valid, email: "not-an-email" }).ok).toBe(false);
    expect(parseJoin({ ...valid, accessCode: "  " }).ok).toBe(false);
    expect(parseJoin(null).ok).toBe(false);
  });
});

describe("saved design validation", () => {
  it("accepts a design with inline images", () => {
    const result = parseSavedDesign(baseDesign({ frontCanvasJson: imageJson("data:image/png;base64,AAAA") }));
    expect(result.ok).toBe(true);
  });
  it("rejects remote image URLs and unknown garments or colors", () => {
    expect(parseSavedDesign(baseDesign({ frontCanvasJson: imageJson("https://evil.example/x.png") })).ok).toBe(false);
    expect(parseSavedDesign(baseDesign({ garmentType: "cape" })).ok).toBe(false);
    expect(parseSavedDesign(baseDesign({ shirtColor: "red" })).ok).toBe(false);
    expect(parseSavedDesign({ configuration: {} }).ok).toBe(false);
  });
  it("only accepts real JPEG previews", () => {
    const jpeg = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0x00]).toString("base64")}`;
    expect(parseMockup(jpeg)).toBeInstanceOf(Buffer);
    expect(parseMockup(`data:image/jpeg;base64,${Buffer.from("not a jpeg").toString("base64")}`)).toBeUndefined();
    expect(parseMockup("data:image/png;base64,AAAA")).toBeUndefined();
    expect(parseMockup(null)).toBeNull();
  });
});

describe("failure limiter", () => {
  it("blocks only after repeated failures and resets", () => {
    const limiter = createFailureLimiter(2, 1000);
    expect(limiter.isBlocked("ip", 0)).toBe(false);
    limiter.recordFailure("ip", 0);
    limiter.recordFailure("ip", 0);
    expect(limiter.isBlocked("ip", 500)).toBe(true);
    expect(limiter.isBlocked("ip", 1500)).toBe(false);
    limiter.recordFailure("ip", 2000);
    limiter.reset("ip");
    expect(limiter.isBlocked("ip", 2000)).toBe(false);
  });
});
