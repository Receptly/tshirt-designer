import type { DesignConfiguration, GarmentArtworkSlot, GarmentType, ShirtSide, ShirtSize } from "@/lib/configuration";

export type SavedMeshArtwork = Record<ShirtSide, Partial<Record<GarmentArtworkSlot, { json?: string }>>>;

export interface SavedDesignPayload {
  configuration: DesignConfiguration;
  meshArtwork: SavedMeshArtwork;
}

export const MAX_DESIGN_BYTES = 4_000_000;
export const MAX_MOCKUP_BYTES = 700_000;

const garmentTypes: GarmentType[] = ["tshirt", "hoodie", "pants"];
const sizes: ShirtSize[] = ["S", "M", "L", "XL", "XXL"];
const slots: GarmentArtworkSlot[] = ["body", "hood", "leftArm", "rightArm"];
const sides: ShirtSide[] = ["front", "back"];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

// Canvas JSON is later opened in the admin's browser, so images must be inline data, never remote URLs.
function isSafeCanvasJson(json: string) {
  try {
    const parsed = JSON.parse(json) as { objects?: unknown };
    if (!Array.isArray(parsed.objects)) return false;
    return parsed.objects.every((object) => {
      if (!isRecord(object)) return false;
      if (object.src === undefined) return true;
      return typeof object.src === "string" && /^data:image\/(png|jpeg|webp|gif);base64,/.test(object.src);
    });
  } catch {
    return false;
  }
}

function canvasJson(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !isSafeCanvasJson(value)) return undefined;
  return value;
}

export function parseSavedDesign(body: unknown): { ok: true; value: SavedDesignPayload } | { ok: false; error: string } {
  if (!isRecord(body) || !isRecord(body.configuration) || !isRecord(body.meshArtwork)) return { ok: false, error: "That design couldn't be read." };
  const source = body.configuration;
  if (!garmentTypes.includes(source.garmentType as GarmentType) || !sizes.includes(source.size as ShirtSize) || !sides.includes(source.activeSide as ShirtSide)) return { ok: false, error: "That design has an invalid garment, size, or side." };
  if (typeof source.shirtColor !== "string" || !/^#[0-9a-fA-F]{6}$/.test(source.shirtColor)) return { ok: false, error: "That design has an invalid color." };
  const frontCanvasJson = canvasJson(source.frontCanvasJson);
  const backCanvasJson = canvasJson(source.backCanvasJson);
  if (frontCanvasJson === undefined || backCanvasJson === undefined) return { ok: false, error: "That design contains artwork that can't be saved." };

  const meshArtwork: SavedMeshArtwork = { front: {}, back: {} };
  for (const side of sides) {
    const savedSide = (body.meshArtwork as Record<string, unknown>)[side];
    if (!isRecord(savedSide)) continue;
    for (const slot of slots) {
      const entry = savedSide[slot];
      if (!isRecord(entry) || entry.json === undefined) continue;
      const json = canvasJson(entry.json);
      if (json === undefined) return { ok: false, error: "That design contains artwork that can't be saved." };
      if (json) meshArtwork[side][slot] = { json };
    }
  }

  const design = (value: unknown) => (isRecord(value) ? (value as unknown as DesignConfiguration["frontDesign"]) : null);
  const configuration: DesignConfiguration = {
    productId: typeof source.productId === "string" ? source.productId.slice(0, 60) : "classic-tshirt",
    garmentType: source.garmentType as GarmentType,
    shirtColor: source.shirtColor,
    size: source.size as ShirtSize,
    activeSide: source.activeSide as ShirtSide,
    frontDesign: design(source.frontDesign),
    backDesign: design(source.backDesign),
    frontCanvasJson,
    backCanvasJson,
  };
  return { ok: true, value: { configuration, meshArtwork } };
}

export function parseMockup(dataUrl: unknown): Buffer | null | undefined {
  if (dataUrl === null || dataUrl === undefined) return null;
  if (typeof dataUrl !== "string") return undefined;
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return undefined;
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length > MAX_MOCKUP_BYTES || bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;
  return bytes;
}
