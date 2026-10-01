"use client";

import { Canvas as FabricCanvas, FabricImage, IText, Line } from "fabric";
import { useEffect, useRef } from "react";
import type { ShirtSide } from "@/lib/configuration";

const BOARD_WIDTH = 512;
const BOARD_HEIGHT = 640;

export interface DesignCanvasActions {
  addImage: (imageUrl: string) => Promise<void>;
  replaceImage: (imageUrl: string) => Promise<void>;
  addText: () => void;
  addLine: () => void;
  removeSelected: () => void;
  clear: () => void;
}

interface Props {
  activeSide: ShirtSide;
  frontJson: string | null;
  backJson: string | null;
  onRegister: (side: ShirtSide, actions: DesignCanvasActions | null) => void;
  onChange: (side: ShirtSide, json: string, canvas: HTMLCanvasElement, revision: number) => void;
}

export default function DesignCanvasPair({ activeSide, frontJson, backJson, onRegister, onChange }: Props) {
  const frontElement = useRef<HTMLCanvasElement>(null);
  const backElement = useRef<HTMLCanvasElement>(null);
  const callbacks = useRef({ onRegister, onChange });
  const initialJson = useRef({ frontJson, backJson });

  useEffect(() => { callbacks.current = { onRegister, onChange }; }, [onChange, onRegister]);

  useEffect(() => {
    const instances: Partial<Record<ShirtSide, FabricCanvas>> = {};
    const timers: Partial<Record<ShirtSide, number>> = {};
    let revision = 0;
    let mounted = true;

    const initialize = async (side: ShirtSide, element: HTMLCanvasElement | null, initialJson: string | null) => {
      if (!element) return;
      const canvas = new FabricCanvas(element, {
        width: BOARD_WIDTH,
        height: BOARD_HEIGHT,
        preserveObjectStacking: true,
        selection: true,
        backgroundColor: "rgba(0,0,0,0)",
      });
      instances[side] = canvas;
      const notifyChange = () => {
        if (timers[side]) window.cancelAnimationFrame(timers[side]);
        timers[side] = window.requestAnimationFrame(() => {
          if (!mounted) return;
          revision += 1;
          const artworkOnlyCanvas = canvas.toCanvasElement(1);
          callbacks.current.onChange(side, JSON.stringify(canvas.toJSON()), artworkOnlyCanvas, revision);
        });
      };
      canvas.on("object:added", notifyChange);
      canvas.on("object:modified", notifyChange);
      canvas.on("object:removed", notifyChange);
      canvas.on("text:changed", notifyChange);
      if (initialJson) {
        try { await canvas.loadFromJSON(JSON.parse(initialJson)); } catch { /* Start with an empty editor if stored data is invalid. */ }
      }
      canvas.requestRenderAll();
      if (!mounted) return;
      callbacks.current.onRegister(side, {
        addImage: async (imageUrl) => {
          const image = await FabricImage.fromURL(imageUrl);
          const fitScale = Math.min(320 / image.width, 360 / image.height, 1);
          image.set({
            left: BOARD_WIDTH / 2,
            top: BOARD_HEIGHT / 2,
            originX: "center",
            originY: "center",
            scaleX: fitScale,
            scaleY: fitScale,
            cornerColor: "#d9663e",
            transparentCorners: false,
          });
          canvas.add(image);
          canvas.setActiveObject(image);
          canvas.requestRenderAll();
          notifyChange();
        },
        replaceImage: async (imageUrl) => {
          const image = await FabricImage.fromURL(imageUrl);
          const fitScale = Math.min(320 / image.width, 360 / image.height, 1);
          image.set({
            left: BOARD_WIDTH / 2,
            top: BOARD_HEIGHT / 2,
            originX: "center",
            originY: "center",
            scaleX: fitScale,
            scaleY: fitScale,
            cornerColor: "#d9663e",
            transparentCorners: false,
          });
          canvas.remove(...canvas.getObjects().filter((object) => object instanceof FabricImage));
          canvas.add(image);
          canvas.setActiveObject(image);
          canvas.requestRenderAll();
          notifyChange();
        },
        addText: () => {
          const text = new IText("Your text", { left: 90, top: 100, fontSize: 42, fill: "#202322", fontFamily: "Arial", editable: true });
          canvas.add(text);
          canvas.setActiveObject(text);
          canvas.requestRenderAll();
          notifyChange();
        },
        addLine: () => {
          const line = new Line([96, 160, 416, 160], { stroke: "#d9663e", strokeWidth: 6, strokeLineCap: "round" });
          canvas.add(line);
          canvas.setActiveObject(line);
          canvas.requestRenderAll();
          notifyChange();
        },
        removeSelected: () => {
          const selected = canvas.getActiveObjects();
          if (!selected.length) return;
          canvas.remove(...selected);
          canvas.discardActiveObject();
          canvas.requestRenderAll();
          notifyChange();
        },
        clear: () => {
          canvas.clear();
          canvas.backgroundColor = "rgba(0,0,0,0)";
          canvas.requestRenderAll();
          notifyChange();
        },
      });
      notifyChange();
    };

    void initialize("front", frontElement.current, initialJson.current.frontJson);
    void initialize("back", backElement.current, initialJson.current.backJson);

    return () => {
      mounted = false;
      for (const side of ["front", "back"] as const) {
        if (timers[side]) window.cancelAnimationFrame(timers[side]);
        callbacks.current.onRegister(side, null);
        void instances[side]?.dispose();
      }
    };
  }, []);

  return (
    <div className="design-editor">
      <div className={`design-stage ${activeSide === "front" ? "active" : "inactive"}`}><canvas ref={frontElement} aria-label="Front artwork editor" /></div>
      <div className={`design-stage ${activeSide === "back" ? "active" : "inactive"}`}><canvas ref={backElement} aria-label="Back artwork editor" /></div>
      <p className="canvas-hint">Select and drag artwork on the canvas to place it.</p>
    </div>
  );
}