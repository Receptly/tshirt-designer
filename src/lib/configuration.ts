export type ShirtSide = "front" | "back";
export type ShirtSize = "S" | "M" | "L" | "XL" | "XXL";
export type GarmentType = "tshirt" | "hoodie" | "pants";
export type GarmentArtworkSlot = "body" | "hood" | "leftArm" | "rightArm";

export interface ShirtDesign {
  imageId?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  fileName?: string;
  imageWidth?: number;
  imageHeight?: number;
  position: [number, number];
  scale: number;
  rotation: number;
}

export interface DesignConfiguration {
  productId: string;
  garmentType: GarmentType;
  shirtColor: string;
  size: ShirtSize;
  activeSide: ShirtSide;
  frontDesign: ShirtDesign | null;
  backDesign: ShirtDesign | null;
  frontCanvasJson: string | null;
  backCanvasJson: string | null;
}

export const shirtColors = [
  { name: "Cloud", value: "#f4f1ea" },
  { name: "Ink", value: "#171a1f" },
  { name: "Navy", value: "#23344e" },
  { name: "Signal", value: "#b83b35" },
  { name: "Heather", value: "#9b9d9d" },
  { name: "Moss", value: "#607061" },
] as const;

export const defaultDesign: DesignConfiguration = {
  productId: "classic-tshirt",
  garmentType: "tshirt",
  shirtColor: shirtColors[0].value,
  size: "M",
  activeSide: "front",
  frontDesign: null,
  backDesign: null,
  frontCanvasJson: null,
  backCanvasJson: null,
};

export function activeDesign(configuration: DesignConfiguration) {
  return configuration.activeSide === "front" ? configuration.frontDesign : configuration.backDesign;
}

export function updateActiveDesign(configuration: DesignConfiguration, design: ShirtDesign | null): DesignConfiguration {
  return configuration.activeSide === "front" ? { ...configuration, frontDesign: design } : { ...configuration, backDesign: design };
}

export function updateCanvasJson(configuration: DesignConfiguration, side: ShirtSide, canvasJson: string): DesignConfiguration {
  return side === "front" ? { ...configuration, frontCanvasJson: canvasJson } : { ...configuration, backCanvasJson: canvasJson };
}

