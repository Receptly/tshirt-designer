"use client";

import { Canvas as FabricCanvas, FabricImage, IText, Line } from "fabric";
import { Slash, Trash2, Type } from "lucide-react";
import { useEffect, useRef } from "react";
import type { CanvasBounds, CanvasSource } from "@/components/TshirtViewer";
import type { GarmentArtworkSlot } from "@/lib/configuration";

const BOARD_WIDTH = 512;
const BOARD_HEIGHT = 640;
const slots: { id: GarmentArtworkSlot; label: string }[] = [
  { id: "body", label: "Body" },
  { id: "hood", label: "Hood" },
  { id: "leftArm", label: "Left arm" },
  { id: "rightArm", label: "Right arm" },
];

interface Props {
  onChange: (slot: GarmentArtworkSlot, source: CanvasSource) => void;
  onRegister: (slot: GarmentArtworkSlot, actions: { addImage: (imageUrl: string) => Promise<void>; replaceImage: (imageUrl: string) => Promise<void>; clear: () => void } | null) => void;
  slots?: { id: GarmentArtworkSlot; label: string }[];
  initialSources?: Partial<Record<GarmentArtworkSlot, CanvasSource>>;
}

export default function DesignCanvasTriple({ onChange, onRegister, slots: configuredSlots = slots, initialSources }: Props) {
  const elements = useRef<Record<GarmentArtworkSlot, HTMLCanvasElement | null>>({ body: null, hood: null, leftArm: null, rightArm: null });
  const instances = useRef(new Map<GarmentArtworkSlot, FabricCanvas>());
  const revisions = useRef<Record<GarmentArtworkSlot, number>>({ body: 0, hood: 0, leftArm: 0, rightArm: 0 });
  const restoredJson = useRef<Partial<Record<GarmentArtworkSlot, string>>>({});
  const callbacks = useRef({ onChange, onRegister });
  const emit = (slot: GarmentArtworkSlot, canvas: FabricCanvas) => {
    revisions.current[slot] += 1;
    const objects = canvas.getObjects();
    const rectangles = objects.map((object) => object.getBoundingRect());
    const bounds: CanvasBounds | undefined = rectangles.length ? (() => {
      const padding = 8;
      const left = Math.max(0, Math.floor(Math.min(...rectangles.map((rect) => rect.left)) - padding));
      const top = Math.max(0, Math.floor(Math.min(...rectangles.map((rect) => rect.top)) - padding));
      const right = Math.min(BOARD_WIDTH, Math.ceil(Math.max(...rectangles.map((rect) => rect.left + rect.width)) + padding));
      const bottom = Math.min(BOARD_HEIGHT, Math.ceil(Math.max(...rectangles.map((rect) => rect.top + rect.height)) + padding));
      return { left, top, width: right - left, height: bottom - top };
    })() : undefined;
    callbacks.current.onChange(slot, { element: canvas.toCanvasElement(1), revision: revisions.current[slot], json: JSON.stringify(canvas.toJSON()), svg: objects.length ? canvas.toSVG() : undefined, bounds });
  };

  useEffect(() => { callbacks.current = { onChange, onRegister }; }, [onChange, onRegister]);

  useEffect(() => {
    configuredSlots.forEach(({ id }) => {
      const json = initialSources?.[id]?.json;
      const canvas = instances.current.get(id);
      if (!json || !canvas || restoredJson.current[id] === json) return;
      restoredJson.current[id] = json;
      void canvas.loadFromJSON(JSON.parse(json)).then(() => { canvas.requestRenderAll(); emit(id, canvas); }).catch(() => undefined);
    });
  }, [configuredSlots, initialSources]);

  useEffect(() => () => { instances.current.forEach((canvas, slot) => { callbacks.current.onRegister(slot, null); void canvas.dispose(); }); instances.current.clear(); }, []);

  const addText = (slot: GarmentArtworkSlot) => { const canvas = getCanvas(slot); if (!canvas) return; const text = new IText("Your text", { left: 90, top: 100, fontSize: 42, fill: "#202322", fontFamily: "Arial", editable: true }); canvas.add(text); canvas.setActiveObject(text); canvas.requestRenderAll(); emit(slot, canvas); };
  const addLine = (slot: GarmentArtworkSlot) => { const canvas = getCanvas(slot); if (!canvas) return; canvas.add(new Line([96, 160, 416, 160], { stroke: "#d9663e", strokeWidth: 6, strokeLineCap: "round" })); canvas.requestRenderAll(); emit(slot, canvas); };
  const clear = (slot: GarmentArtworkSlot) => { const canvas = getCanvas(slot); if (!canvas) return; canvas.clear(); canvas.backgroundColor = "rgba(0,0,0,0)"; canvas.requestRenderAll(); emit(slot, canvas); };
  const getCanvas = (slot: GarmentArtworkSlot) => instances.current.get(slot);
  return <div className="triple-design-editor">{configuredSlots.map(({ id, label }) => <section className="mesh-design-box" key={id}><div className="mesh-design-heading"><strong>{label}</strong><span>Drag · Resize · Rotate</span></div><div className="canvas-tools"><button className="canvas-tool" onClick={() => addText(id)}><Type size={15} /> Text</button><button className="canvas-tool" onClick={() => addLine(id)}><Slash size={15} /> Line</button><button className="canvas-tool" onClick={() => clear(id)}><Trash2 size={15} /> Clear</button></div><div className="design-stage"><canvas ref={(element) => { elements.current[id] = element; if (element && !instances.current.has(id)) { const canvas = new FabricCanvas(element, { width: BOARD_WIDTH, height: BOARD_HEIGHT, preserveObjectStacking: true, selection: true, backgroundColor: "rgba(0,0,0,0)" }); instances.current.set(id, canvas); const notify = () => emit(id, canvas); canvas.on("object:added", notify); canvas.on("object:modified", notify); canvas.on("object:removed", notify); canvas.on("text:changed", notify); callbacks.current.onRegister(id, { addImage: async (imageUrl) => { const image = await FabricImage.fromURL(imageUrl); const fitScale = Math.min(320 / image.width, 360 / image.height, 1); image.set({ left: BOARD_WIDTH / 2, top: BOARD_HEIGHT / 2, originX: "center", originY: "center", scaleX: fitScale, scaleY: fitScale, cornerColor: "#d9663e", transparentCorners: false }); canvas.add(image); canvas.setActiveObject(image); canvas.requestRenderAll(); notify(); }, replaceImage: async (imageUrl) => { const image = await FabricImage.fromURL(imageUrl); const fitScale = Math.min(320 / image.width, 360 / image.height, 1); image.set({ left: BOARD_WIDTH / 2, top: BOARD_HEIGHT / 2, originX: "center", originY: "center", scaleX: fitScale, scaleY: fitScale, cornerColor: "#d9663e", transparentCorners: false }); canvas.remove(...canvas.getObjects().filter((object) => object instanceof FabricImage)); canvas.add(image); canvas.setActiveObject(image); canvas.requestRenderAll(); notify(); }, clear: () => clear(id) }); notify(); } }} aria-label={`${label} artwork editor`} /></div></section>)}</div>;
}
