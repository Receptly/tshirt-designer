"use client";

import { Canvas as FabricCanvas, IText, Line } from "fabric";
import { Slash, Trash2, Type } from "lucide-react";
import { useEffect, useRef } from "react";
import type { CanvasSource } from "@/components/TshirtViewer";
import type { GarmentArtworkSlot } from "@/lib/configuration";

const BOARD_WIDTH = 512;
const BOARD_HEIGHT = 640;
const slots: { id: GarmentArtworkSlot; label: string }[] = [
  { id: "body", label: "Body" },
  { id: "leftArm", label: "Left arm" },
  { id: "rightArm", label: "Right arm" },
];

interface Props {
  onChange: (slot: GarmentArtworkSlot, source: CanvasSource) => void;
}

export default function DesignCanvasTriple({ onChange }: Props) {
  const elements = useRef<Record<GarmentArtworkSlot, HTMLCanvasElement | null>>({ body: null, leftArm: null, rightArm: null });
  const instances = useRef(new Map<GarmentArtworkSlot, FabricCanvas>());
  const revisions = useRef<Record<GarmentArtworkSlot, number>>({ body: 0, leftArm: 0, rightArm: 0 });
  const callbacks = useRef(onChange);

  useEffect(() => { callbacks.current = onChange; }, [onChange]);

  useEffect(() => () => { instances.current.forEach((canvas) => { void canvas.dispose(); }); instances.current.clear(); }, []);

  const addText = (slot: GarmentArtworkSlot) => { const canvas = getCanvas(slot); if (!canvas) return; const text = new IText("Your text", { left: 90, top: 100, fontSize: 42, fill: "#202322", fontFamily: "Arial", editable: true }); canvas.add(text); canvas.setActiveObject(text); canvas.requestRenderAll(); emit(slot, canvas); };
  const addLine = (slot: GarmentArtworkSlot) => { const canvas = getCanvas(slot); if (!canvas) return; canvas.add(new Line([96, 160, 416, 160], { stroke: "#d9663e", strokeWidth: 6, strokeLineCap: "round" })); canvas.requestRenderAll(); emit(slot, canvas); };
  const clear = (slot: GarmentArtworkSlot) => { const canvas = getCanvas(slot); if (!canvas) return; canvas.clear(); canvas.backgroundColor = "rgba(0,0,0,0)"; canvas.requestRenderAll(); emit(slot, canvas); };
  const getCanvas = (slot: GarmentArtworkSlot) => instances.current.get(slot);
  const emit = (slot: GarmentArtworkSlot, canvas: FabricCanvas) => { revisions.current[slot] += 1; callbacks.current(slot, { element: canvas.toCanvasElement(1), revision: revisions.current[slot] }); };

  return <div className="triple-design-editor">{slots.map(({ id, label }) => <section className="mesh-design-box" key={id}><div className="mesh-design-heading"><strong>{label}</strong><span>Drag · Resize · Rotate</span></div><div className="canvas-tools"><button className="canvas-tool" onClick={() => addText(id)}><Type size={15} /> Text</button><button className="canvas-tool" onClick={() => addLine(id)}><Slash size={15} /> Line</button><button className="canvas-tool" onClick={() => clear(id)}><Trash2 size={15} /> Clear</button></div><div className="design-stage"><canvas ref={(element) => { elements.current[id] = element; if (element && !instances.current.has(id)) { const canvas = new FabricCanvas(element, { width: BOARD_WIDTH, height: BOARD_HEIGHT, preserveObjectStacking: true, selection: true, backgroundColor: "rgba(0,0,0,0)" }); instances.current.set(id, canvas); const notify = () => emit(id, canvas); canvas.on("object:added", notify); canvas.on("object:modified", notify); canvas.on("object:removed", notify); canvas.on("text:changed", notify); notify(); } }} aria-label={`${label} artwork editor`} /></div></section>)}</div>;
}
