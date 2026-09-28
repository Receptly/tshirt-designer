import { describe, expect, it } from "vitest";
import { activeDesign, defaultDesign, updateActiveDesign, updateCanvasJson, type ShirtDesign } from "./configuration";

const artwork: ShirtDesign = { imageId: "front-1", position: [0.1, 0.2], scale: 0.7, rotation: 0 };

describe("design configuration", () => {
  it("keeps front and back artwork independent when switching sides", () => {
    const withFront = updateActiveDesign(defaultDesign, artwork);
    const withBack = updateActiveDesign({ ...withFront, activeSide: "back" }, { ...artwork, imageId: "back-1" });
    expect(withBack.frontDesign?.imageId).toBe("front-1");
    expect(activeDesign(withBack)?.imageId).toBe("back-1");
  });

  it("keeps serialized front and back canvas data independent", () => {
    const frontSaved = updateCanvasJson(defaultDesign, "front", "front-json");
    const bothSaved = updateCanvasJson(frontSaved, "back", "back-json");
    expect(bothSaved.frontCanvasJson).toBe("front-json");
    expect(bothSaved.backCanvasJson).toBe("back-json");
  });
});