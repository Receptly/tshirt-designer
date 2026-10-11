import { Point, type Canvas, type FabricObject } from "fabric";
import type { GarmentArtworkSlot, ShirtSide } from "@/lib/configuration";

export const ARTWORK_BOARD = { width: 512, height: 640 };

export type ArtworkDragKey = ShirtSide | GarmentArtworkSlot;
export type ArtworkDragPhase = "start" | "move" | "end";
export type ArtworkDragHandler = (phase: ArtworkDragPhase, key: ArtworkDragKey, x: number, y: number) => boolean;

export interface ArtworkDragActions {
  dragStart: (x: number, y: number) => boolean;
  dragMove: (x: number, y: number) => void;
  dragEnd: () => void;
}

export interface ArtworkDragSession { object: FabricObject; offsetX: number; offsetY: number; }

// Grabs the topmost object under a canvas-space point, or null when the point is empty.
export function beginArtworkDrag(canvas: Canvas, x: number, y: number): ArtworkDragSession | null {
  const point = new Point(x, y);
  const object = [...canvas.getObjects()].reverse().find((item) => item.containsPoint(point));
  if (!object) return null;
  canvas.setActiveObject(object);
  return { object, offsetX: object.left - x, offsetY: object.top - y };
}

export function moveArtworkDrag(canvas: Canvas, session: ArtworkDragSession, x: number, y: number) {
  session.object.set({ left: x + session.offsetX, top: y + session.offsetY });
  session.object.setCoords();
  canvas.requestRenderAll();
}

export function endArtworkDrag(canvas: Canvas, session: ArtworkDragSession) {
  canvas.fire("object:modified", { target: session.object });
}

// Reuses one canvas per surface so the 3D texture keeps a stable source while dragging.
export function drawPreviewSurface(surface: HTMLCanvasElement | null, source: HTMLCanvasElement) {
  const target = surface ?? document.createElement("canvas");
  if (target.width !== source.width || target.height !== source.height) { target.width = source.width; target.height = source.height; }
  const context = target.getContext("2d");
  context?.clearRect(0, 0, target.width, target.height);
  context?.drawImage(source, 0, 0);
  return target;
}
