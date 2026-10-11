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
  { name: "White", value: "#ffffff" },
  { name: "Black", value: "#0b0b0c" },
  { name: "Charcoal", value: "#3a3d40" },
  { name: "Slate", value: "#5b6770" },
  { name: "Stone", value: "#c9c3b6" },
  { name: "Sand", value: "#d8c3a5" },
  { name: "Camel", value: "#b07d4f" },
  { name: "Chocolate", value: "#4a3428" },
  { name: "Rust", value: "#b5532f" },
  { name: "Orange", value: "#e8782a" },
  { name: "Mustard", value: "#d9a521" },
  { name: "Lemon", value: "#f1da4a" },
  { name: "Lime", value: "#a8c23a" },
  { name: "Olive", value: "#6b6b2f" },
  { name: "Forest", value: "#254a35" },
  { name: "Mint", value: "#a9d6c0" },
  { name: "Teal", value: "#1f7a7a" },
  { name: "Sky", value: "#7db7e0" },
  { name: "Royal", value: "#2457c5" },
  { name: "Indigo", value: "#36307a" },
  { name: "Lavender", value: "#b9a7e0" },
  { name: "Purple", value: "#6a3a8c" },
  { name: "Berry", value: "#8c2f5b" },
  { name: "Pink", value: "#e98fb3" },
  { name: "Blush", value: "#f2cfc6" },
  { name: "Red", value: "#c62828" },
  { name: "Burgundy", value: "#6e1f2b" },
] as const;

export function isLightColor(hex: string) {
  const value = hex.replace("#", "");
  const [red, green, blue] = [0, 2, 4].map((start) => parseInt(value.slice(start, start + 2), 16));
  return (red * 299 + green * 587 + blue * 114) / 1000 > 160;
}

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

