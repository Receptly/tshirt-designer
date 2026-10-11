"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Camera, Check, Download, RotateCcw, Save, Slash, Trash2, Type, Upload } from "lucide-react";
import { ChangeEvent, startTransition, useCallback, useEffect, useRef, useState } from "react";
import { activeDesign, defaultDesign, isLightColor, shirtColors, type GarmentArtworkSlot, type DesignConfiguration, type GarmentType, type ShirtDesign, type ShirtSize, type ShirtSide, updateActiveDesign, updateCanvasJson } from "@/lib/configuration";
import DesignCanvasPair, { type DesignCanvasActions } from "@/components/DesignCanvasPair";
import DesignCanvasTriple from "@/components/DesignCanvasTriple";
import ImageGeneratorPanel from "@/components/ImageGeneratorPanel";
import type { CanvasSource } from "@/components/TshirtViewer";
import type { ArtworkDragActions, ArtworkDragHandler } from "@/lib/artworkDrag";

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src; });

const GarmentViewer = dynamic(() => import("@/components/TshirtViewer"), { ssr: false, loading: () => <div className="viewer-loading"><div className="spinner" /><span>Preparing studio...</span></div> });
const artworkSlots: { id: GarmentArtworkSlot; label: string }[] = [{ id: "body", label: "Body" }, { id: "hood", label: "Hood" }, { id: "leftArm", label: "Left arm" }, { id: "rightArm", label: "Right arm" }];
const pantsArtworkSlots: { id: GarmentArtworkSlot; label: string }[] = [{ id: "leftArm", label: "Left leg" }, { id: "rightArm", label: "Right leg" }];
const emptyArtworkSlots = (): Record<GarmentArtworkSlot, CanvasSource> => ({ body: { element: null, revision: 0 }, hood: { element: null, revision: 0 }, leftArm: { element: null, revision: 0 }, rightArm: { element: null, revision: 0 } });
function preparePrintArtwork(image: HTMLImageElement) {
  const maxDimension = 1024;
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const source = document.createElement("canvas");
  source.width = Math.max(1, Math.round(image.width * scale));
  source.height = Math.max(1, Math.round(image.height * scale));
  const context = source.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, source.width, source.height);
  const pixels = context.getImageData(0, 0, source.width, source.height);
  let left = source.width;
  let top = source.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const index = (y * source.width + x) * 4;
      if (pixels.data[index] > 245 && pixels.data[index + 1] > 245 && pixels.data[index + 2] > 245) pixels.data[index + 3] = 0;
      if (pixels.data[index + 3] > 8) {
        left = Math.min(left, x); top = Math.min(top, y);
        right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
    }
  }
  if (right < left || bottom < top) return null;
  context.putImageData(pixels, 0, 0);
  const padding = Math.max(2, Math.round(Math.max(source.width, source.height) * 0.01));
  left = Math.max(0, left - padding); top = Math.max(0, top - padding);
  right = Math.min(source.width - 1, right + padding); bottom = Math.min(source.height - 1, bottom + padding);
  const cropped = document.createElement("canvas");
  cropped.width = right - left + 1; cropped.height = bottom - top + 1;
  cropped.getContext("2d")?.drawImage(source, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
  return cropped;
}

function createSvgSheet(artboards: { svg: string; bounds: NonNullable<CanvasSource["bounds"]> }[]) {
  const namespace = "http://www.w3.org/2000/svg";
  const gap = 24;
  const tileWidth = Math.max(...artboards.map(({ bounds }) => bounds.width));
  const tileHeight = Math.max(...artboards.map(({ bounds }) => bounds.height));
  const columns = Math.min(3, artboards.length);
  const rows = Math.ceil(artboards.length / columns);
  const outerGap = artboards.length === 1 ? 0 : gap;
  const sheetWidth = columns * tileWidth + (columns - 1) * gap + outerGap * 2;
  const sheetHeight = rows * tileHeight + (rows - 1) * gap + outerGap * 2;
  const root = document.createElementNS(namespace, "svg");
  root.setAttribute("xmlns", namespace);
  root.setAttribute("width", String(sheetWidth));
  root.setAttribute("height", String(sheetHeight));
  root.setAttribute("viewBox", `0 0 ${sheetWidth} ${sheetHeight}`);

  artboards.forEach(({ svg, bounds }, index) => {
    const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
    if (parsed.querySelector("parsererror")) throw new Error("Could not prepare an artwork SVG for export.");
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = outerGap + column * (tileWidth + gap) + (tileWidth - bounds.width) / 2;
    const y = outerGap + row * (tileHeight + gap) + (tileHeight - bounds.height) / 2;
    const artwork = parsed.documentElement.cloneNode(true) as SVGSVGElement;
    artwork.setAttribute("x", String(x)); artwork.setAttribute("y", String(y));
    artwork.setAttribute("width", String(bounds.width)); artwork.setAttribute("height", String(bounds.height));
    artwork.setAttribute("viewBox", `${bounds.left} ${bounds.top} ${bounds.width} ${bounds.height}`);
    const prefix = `artboard-${index}-`;
    const elements = [artwork, ...Array.from(artwork.querySelectorAll("*"))];
    const idMap = new Map<string, string>();
    elements.forEach((element) => { const id = element.getAttribute("id"); if (id) { idMap.set(id, `${prefix}${id}`); element.setAttribute("id", `${prefix}${id}`); } });
    elements.forEach((element) => Array.from(element.attributes).forEach((attribute) => {
      let value = attribute.value.replace(/url\(#([^\)]+)\)/g, (_match, id: string) => `url(#${idMap.get(id) ?? id})`);
      if ((attribute.name === "href" || attribute.name === "xlink:href") && value.startsWith("#")) value = `#${idMap.get(value.slice(1)) ?? value.slice(1)}`;
      element.setAttribute(attribute.name, value);
    }));
    root.append(artwork);
  });
  return new XMLSerializer().serializeToString(root);
}

export default function Configurator() {
  const [configuration, setConfiguration] = useState<DesignConfiguration>(defaultDesign);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const canvasActions = useRef<Partial<Record<ShirtSide, DesignCanvasActions>>>({});
  const [frontArtwork, setFrontArtwork] = useState<CanvasSource>({ element: null, revision: 0 });
  const [backArtwork, setBackArtwork] = useState<CanvasSource>({ element: null, revision: 0 });
  const [meshArtwork, setMeshArtwork] = useState<Record<ShirtSide, Record<GarmentArtworkSlot, CanvasSource>>>(() => ({ front: emptyArtworkSlots(), back: emptyArtworkSlots() }));
  const meshCanvasActions = useRef<Partial<Record<GarmentArtworkSlot, ArtworkDragActions & { addImage: (imageUrl: string) => Promise<void>; replaceImage: (imageUrl: string) => Promise<void>; clear: () => void }>>>({});
  const captureView = useRef<((scale: number) => string | null) | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const registerCapture = useCallback((capture: ((scale: number) => string | null) | null) => { captureView.current = capture; }, []);
  useEffect(() => {
    let restored = defaultDesign;
    const saved = window.localStorage.getItem("threadline-design");
    if (saved) {
      try {
        restored = JSON.parse(saved) as DesignConfiguration;
        if (restored.frontDesign?.imageUrl?.startsWith("blob:")) restored.frontDesign = null;
        if (restored.backDesign?.imageUrl?.startsWith("blob:")) restored.backDesign = null;
        restored.frontCanvasJson ??= null;
        restored.backCanvasJson ??= null;
        restored.garmentType ??= "tshirt";
        if (restored.garmentType === "pants") restored.garmentType = "tshirt";
      } catch { window.localStorage.removeItem("threadline-design"); }
    }
    startTransition(() => { setConfiguration(restored); setHasHydrated(true); });
  }, []);
  const design = activeDesign(configuration);
  const registerCanvas = (side: ShirtSide, actions: DesignCanvasActions | null) => {
    canvasActions.current[side] = actions ?? undefined;
    if (!actions) return;
    const savedCanvas = side === "front" ? configuration.frontCanvasJson : configuration.backCanvasJson;
    const legacyDesign = side === "front" ? configuration.frontDesign : configuration.backDesign;
    if (!savedCanvas && legacyDesign?.imageUrl) void actions.addImage(legacyDesign.imageUrl);
  };
  const updateCanvas = (side: ShirtSide, json: string, element: HTMLCanvasElement, revision: number, svg?: string, bounds?: CanvasSource["bounds"]) => {
    setConfiguration((current) => (side === "front" ? current.frontCanvasJson : current.backCanvasJson) === json ? current : updateCanvasJson(current, side, json));
    const source = { element, revision, svg, bounds };
    if (side === "front") setFrontArtwork((current) => current.element === element && current.revision === revision ? current : source);
    else setBackArtwork((current) => current.element === element && current.revision === revision ? current : source);
  };
  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    const uploadSide = configuration.activeSide;
    if (!["image/png", "image/jpeg"].includes(file.type)) { setMessage("Please choose a PNG or JPEG image."); return; }
    if (file.size > 10 * 1024 * 1024) { setMessage("Images must be under 10 MB."); return; }
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if (image.width < 80 || image.height < 80) { setMessage("Choose an image at least 80 × 80 pixels."); return; }
      const canvas = preparePrintArtwork(image);
      if (!canvas) { setMessage("No printable artwork remained after removing the white background."); return; }
      const previewUrl = canvas.toDataURL("image/png");
      const thumbnail = document.createElement("canvas");
      thumbnail.width = 96; thumbnail.height = 96;
      const thumbnailContext = thumbnail.getContext("2d");
      const thumbScale = Math.min(96 / canvas.width, 96 / canvas.height);
      thumbnailContext?.drawImage(canvas, (96 - canvas.width * thumbScale) / 2, (96 - canvas.height * thumbScale) / 2, canvas.width * thumbScale, canvas.height * thumbScale);
      const uploaded: ShirtDesign = { thumbnailUrl: thumbnail.toDataURL("image/png"), fileName: file.name, imageWidth: image.width, imageHeight: image.height, position: [0, 0.25], scale: 0.72, rotation: 0 };
      setConfiguration((current) => uploadSide === "front" ? { ...current, frontDesign: uploaded } : { ...current, backDesign: uploaded });
      void canvasActions.current[uploadSide]?.replaceImage(previewUrl);
      setMessage("Artwork added to the canvas.");
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); setMessage("That image could not be decoded."); };
    image.src = objectUrl;
    event.target.value = "";
  };
  const handleMeshUpload = (event: ChangeEvent<HTMLInputElement>, slot: GarmentArtworkSlot) => {
    const file = event.target.files?.[0]; if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) { setMessage("Please choose a PNG or JPEG image."); return; }
    if (file.size > 10 * 1024 * 1024) { setMessage("Images must be under 10 MB."); return; }
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if (image.width < 80 || image.height < 80) { setMessage("Choose an image at least 80 × 80 pixels."); return; }
      const canvas = preparePrintArtwork(image);
      if (!canvas) { setMessage("No printable artwork remained after removing the white background."); return; }
      const previewUrl = canvas.toDataURL("image/png");
      void meshCanvasActions.current[slot]?.replaceImage(previewUrl);
      const slotLabel = slot === "leftArm" ? "Left arm" : slot === "rightArm" ? "Right arm" : slot === "hood" ? "Hood" : "Body";
      setMessage(`${slotLabel} artwork added.`);
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); setMessage("That image could not be decoded."); };
    image.src = objectUrl;
    event.target.value = "";
  };
  const updateMeshCanvas = (slot: GarmentArtworkSlot, source: CanvasSource) => {
    setMeshArtwork((current) => {
      const side = configuration.activeSide;
      const previous = current[side][slot];
      if (source.revision === 1 && previous.element && source.json && !JSON.parse(source.json).objects?.length) return current;
      return { ...current, [side]: { ...current[side], [slot]: source } };
    });
  };
  const useGeneratedArtwork = async (imageUrl: string, slot: GarmentArtworkSlot) => {
    const side = configuration.activeSide;
    if (configuration.garmentType === "tshirt") {
      const actions = canvasActions.current[side];
      if (!actions) throw new Error("The artwork canvas is not ready.");
      await actions.replaceImage(imageUrl);
      const generatedDesign: ShirtDesign = { thumbnailUrl: imageUrl, fileName: "AI-generated artwork", imageWidth: 1024, imageHeight: 1024, position: [0, 0.25], scale: 0.72, rotation: 0 };
      setConfiguration((current) => side === "front" ? { ...current, frontDesign: generatedDesign } : { ...current, backDesign: generatedDesign });
      return;
    }
    const actions = meshCanvasActions.current[slot];
    if (!actions) throw new Error("The artwork canvas is not ready.");
    await actions.replaceImage(imageUrl);
  };
  const handleArtworkDrag: ArtworkDragHandler = (phase, key, x, y) => {
    const actions = key === "front" || key === "back" ? canvasActions.current[key] : meshCanvasActions.current[key];
    if (!actions) return false;
    if (phase === "start") return actions.dragStart(x, y);
    if (phase === "move") actions.dragMove(x, y); else actions.dragEnd();
    return true;
  };
  const previewCanvas = (side: ShirtSide, element: HTMLCanvasElement, revision: number) => {
    const update = (current: CanvasSource): CanvasSource => ({ ...current, element, revision });
    if (side === "front") setFrontArtwork(update); else setBackArtwork(update);
  };
  const previewMeshCanvas = (slot: GarmentArtworkSlot, source: CanvasSource) => {
    const side = configuration.activeSide;
    setMeshArtwork((current) => ({ ...current, [side]: { ...current[side], [slot]: { ...current[side][slot], element: source.element, revision: source.revision } } }));
  };
  const exportPreview = async () => {
    if (!captureView.current) { setMessage("The 3D preview is still loading."); return; }
    const originalSide = configuration.activeSide;
    setIsExporting(true);
    setMessage("Rendering front and back previews...");
    try {
      const shots: { label: string; image: HTMLImageElement }[] = [];
      for (const side of ["front", "back"] as const) {
        setConfiguration((current) => ({ ...current, activeSide: side }));
        await new Promise((resolve) => window.setTimeout(resolve, side === originalSide && !shots.length ? 300 : 1600));
        const url = captureView.current?.(3);
        if (!url) throw new Error("The 3D preview could not be captured.");
        shots.push({ label: side === "front" ? "Front" : "Back", image: await loadImage(url) });
      }
      const padding = 48;
      const top = 150;
      const sheet = document.createElement("canvas");
      sheet.width = shots[0].image.width * 2 + padding * 3;
      sheet.height = top + shots[0].image.height + padding;
      const context = sheet.getContext("2d");
      if (!context) throw new Error("This browser cannot compose the preview image.");
      const colorName = shirtColors.find((color) => color.value === configuration.shirtColor)?.name ?? configuration.shirtColor.toUpperCase();
      context.fillStyle = "#f7f6f2";
      context.fillRect(0, 0, sheet.width, sheet.height);
      context.fillStyle = "#202322";
      context.font = "700 44px Arial, sans-serif";
      context.fillText(`${configuration.garmentType === "hoodie" ? "Hoodie" : "T-shirt"} \u00b7 ${colorName} \u00b7 Size ${configuration.size}`, padding, 84);
      context.font = "600 28px Arial, sans-serif";
      shots.forEach((shot, index) => {
        const x = padding + index * (shot.image.width + padding);
        context.fillText(shot.label, x, top - 18);
        context.drawImage(shot.image, x, top);
      });
      const blob = await new Promise<Blob | null>((resolve) => sheet.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("The preview image could not be created.");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${configuration.garmentType}-design-preview.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Design preview exported.");
    } catch (error) {
      console.error("Could not export the design preview", error);
      setMessage("Could not export the design preview.");
    } finally {
      setConfiguration((current) => ({ ...current, activeSide: originalSide }));
      setIsExporting(false);
    }
  };
  const saveDesign = () => { setIsSaving(true); window.localStorage.setItem("threadline-design", JSON.stringify(configuration)); window.setTimeout(() => { setIsSaving(false); setMessage("Design saved to this browser."); }, 450); };
  const exportArtwork = () => {
    const artboards: { svg: string; bounds: NonNullable<CanvasSource["bounds"]> }[] = [];
    if (configuration.garmentType === "tshirt") {
      for (const side of ["front", "back"] as const) {
        const svg = side === "front" ? frontArtwork.svg : backArtwork.svg;
        const bounds = side === "front" ? frontArtwork.bounds : backArtwork.bounds;
        if (svg && bounds) artboards.push({ svg, bounds });
      }
    } else {
      const slots = configuration.garmentType === "hoodie" ? artworkSlots : pantsArtworkSlots;
      for (const side of ["front", "back"] as const) {
        for (const { id } of slots) {
          const svg = meshArtwork[side][id].svg;
          const bounds = meshArtwork[side][id].bounds;
          if (svg && bounds) artboards.push({ svg, bounds });
        }
      }
    }
    if (!artboards.length) { setMessage("Add artwork before exporting an SVG."); return; }
    try {
      const sheet = createSvgSheet(artboards);
      const url = URL.createObjectURL(new Blob([sheet], { type: "image/svg+xml;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${configuration.garmentType}-artwork.svg`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("SVG artwork exported.");
    } catch (error) {
      console.error("Could not export SVG artwork", error);
      setMessage("Could not export SVG artwork.");
    }
  };
  useEffect(() => {
    if (!hasHydrated) return;
    try { window.localStorage.setItem("threadline-design", JSON.stringify(configuration)); }
    catch (error) { console.warn("Could not autosave the current design", error); }
  }, [configuration, hasHydrated]);
  return (
    <main className="app-shell">
      <header className="topbar"><Link className="brand" href="/" aria-label="Garment Designer home"><span className="brand-mark">G</span><span>Garment Designer</span></Link><div className="topbar-actions"><span className="save-state">{message || "Your design is private to this browser"}</span><button className="text-button" onClick={() => { canvasActions.current.front?.clear(); canvasActions.current.back?.clear(); Object.values(meshCanvasActions.current).forEach((actions) => actions?.clear()); setFrontArtwork({ element: null, revision: 0 }); setBackArtwork({ element: null, revision: 0 }); setMeshArtwork({ front: emptyArtworkSlots(), back: emptyArtworkSlots() }); setConfiguration(defaultDesign); window.localStorage.removeItem("threadline-design"); setMessage("Started a fresh design."); }}><RotateCcw size={15} /> Reset</button><button className="text-button" onClick={exportArtwork} title="Export artwork as SVG"><Download size={15} /><span>Export SVG</span></button><button className="text-button" onClick={exportPreview} disabled={isExporting} title="Export a front and back preview image of the finished design"><Camera size={15} /><span>{isExporting ? "Rendering..." : "Export preview"}</span></button><button className="save-button" onClick={saveDesign}><Save size={16} /> {isSaving ? "Saving..." : "Save design"}</button></div></header>
      <section className="workspace"><div className="intro"><p className="eyebrow">Workshop / Garment configurator</p><h1>Make it unmistakably yours.</h1><p className="lede">Customize garments, place artwork on each side, and save the editable design for production.</p></div>
        <div className="garment-selector" role="group" aria-label="Garment type">{([{ id: "tshirt", label: "T-shirt" }, { id: "hoodie", label: "Hoodie" }] as const).map((garment) => <button key={garment.id} className={configuration.garmentType === garment.id ? "garment-option selected" : "garment-option"} onClick={() => setConfiguration((current) => ({ ...current, garmentType: garment.id }))} aria-pressed={configuration.garmentType === garment.id}>{garment.label}</button>)}</div>
        <div className="builder-grid"><section className="preview-panel"><div className="preview-topline"><span className="preview-label">Live 3D preview</span><span className="preview-side"><span className="live-dot" /> {configuration.activeSide} view</span></div><GarmentViewer key={configuration.garmentType} garmentType={configuration.garmentType} color={configuration.shirtColor} side={configuration.activeSide} frontArtwork={frontArtwork} backArtwork={backArtwork} frontMeshArtwork={meshArtwork.front} backMeshArtwork={meshArtwork.back} onArtworkDrag={handleArtworkDrag} onCaptureReady={registerCapture} /><div className="side-switcher" role="tablist" aria-label="Artwork side">{(["front", "back"] as ShirtSide[]).map((side) => <button key={side} className={configuration.activeSide === side ? "side-tab active" : "side-tab"} onClick={() => setConfiguration((current) => ({ ...current, activeSide: side }))} role="tab" aria-selected={configuration.activeSide === side}>{side}<span className={side === "front" ? "shirt-outline front-outline" : "shirt-outline back-outline"} /></button>)}</div></section>
          <aside className="controls-panel"><div className="control-section upload-section"><div className="section-heading"><div><span className="section-kicker">01 / Artwork</span><h2>Add your design</h2></div><span className="format-note">PNG / JPG · 10 MB</span></div>{configuration.garmentType === "hoodie" || configuration.garmentType === "pants" ? <div className="mesh-upload-grid">{(configuration.garmentType === "hoodie" ? artworkSlots : pantsArtworkSlots).map((slot) => { const uploaded = meshArtwork[configuration.activeSide][slot.id].element; return <label className="mesh-upload" key={slot.id}><Upload size={16} /><strong>{slot.label}</strong><span>{uploaded ? "Replace artwork" : "Upload artwork"}</span><input type="file" accept="image/png,image/jpeg" onChange={(event) => handleMeshUpload(event, slot.id)} /></label>; })}</div> : <><label className="upload-zone"><Upload size={20} /><span>{design ? "Replace canvas artwork" : "Choose canvas artwork"}</span><small>Use the editor below for text, lines, and placement</small><input type="file" accept="image/png,image/jpeg" onChange={handleUpload} /></label>{design ? <div className="asset-row"><div className="asset-thumb" style={{ backgroundImage: `url(${design.thumbnailUrl ?? design.imageUrl})` }} /><div className="asset-meta"><strong>{design.fileName}</strong><span>{design.imageWidth} × {design.imageHeight} px</span></div><button className="icon-button" onClick={() => { canvasActions.current[configuration.activeSide]?.clear(); setConfiguration((current) => updateActiveDesign(current, null)); }} aria-label="Clear artwork from this side"><Trash2 size={16} /></button></div> : null}</>}</div><ImageGeneratorPanel garmentType={configuration.garmentType as GarmentType} onUseImage={useGeneratedArtwork} />
            <div className="control-section"><div className="section-heading"><div><span className="section-kicker">02 / Design canvas</span><h2>{configuration.garmentType === "hoodie" ? "Hoodie artwork" : configuration.garmentType === "pants" ? "Pants artwork" : `${configuration.activeSide} artwork`}</h2></div><span className="format-note">Drag · Resize · Rotate</span></div>{hasHydrated ? <><div style={{ display: configuration.garmentType === "hoodie" ? "block" : "none" }}><DesignCanvasTriple initialSources={meshArtwork[configuration.activeSide]} onChange={updateMeshCanvas} onPreview={previewMeshCanvas} onRegister={(slot, actions) => { meshCanvasActions.current[slot] = actions ?? undefined; }} /></div>{configuration.garmentType === "hoodie" ? null : configuration.garmentType === "pants" ? <DesignCanvasTriple initialSources={meshArtwork[configuration.activeSide]} slots={pantsArtworkSlots} onChange={updateMeshCanvas} onPreview={previewMeshCanvas} onRegister={(slot, actions) => { meshCanvasActions.current[slot] = actions ?? undefined; }} /> : <><div className="canvas-tools"><button className="canvas-tool" onClick={() => canvasActions.current[configuration.activeSide]?.addText()}><Type size={15} /> Text</button><button className="canvas-tool" onClick={() => canvasActions.current[configuration.activeSide]?.addLine()}><Slash size={15} /> Line</button><button className="canvas-tool" onClick={() => canvasActions.current[configuration.activeSide]?.removeSelected()}><Trash2 size={15} /> Delete</button></div><DesignCanvasPair activeSide={configuration.activeSide} frontJson={configuration.frontCanvasJson} backJson={configuration.backCanvasJson} onRegister={registerCanvas} onChange={updateCanvas} onPreview={previewCanvas} /></> }</> : <div className="empty-control">Restoring saved artwork...</div>}</div>
            <div className="control-section color-section"><div className="section-heading"><div><span className="section-kicker">03 / Garment</span><h2>Garment color</h2></div><span className="color-name">{shirtColors.find((color) => color.value === configuration.shirtColor)?.name ?? configuration.shirtColor.toUpperCase()}</span></div><div className="swatches" role="group" aria-label="Garment color palette">{shirtColors.map((color) => <button key={color.value} className={configuration.shirtColor === color.value ? "swatch selected" : "swatch"} style={{ backgroundColor: color.value, color: isLightColor(color.value) ? "#202322" : "#ffffff" }} onClick={() => setConfiguration((current) => ({ ...current, shirtColor: color.value }))} aria-label={`Select ${color.name} garment`} title={color.name} aria-pressed={configuration.shirtColor === color.value}>{configuration.shirtColor === color.value ? <Check size={14} /> : null}</button>)}</div><label className="custom-color"><span>Custom color</span><input type="color" value={configuration.shirtColor} onChange={(event) => setConfiguration((current) => ({ ...current, shirtColor: event.target.value }))} aria-label="Choose a custom garment color" /><output>{configuration.shirtColor.toUpperCase()}</output></label></div>
            <div className="control-section options-section"><span className="section-kicker">Garment size</span><div className="size-options">{(["S", "M", "L", "XL", "XXL"] as ShirtSize[]).map((size) => <button key={size} className={configuration.size === size ? "size-option selected" : "size-option"} onClick={() => setConfiguration((current) => ({ ...current, size }))}>{size}</button>)}</div></div>
          </aside></div>
      </section><footer className="site-footer"><span>Threadline studio · Made for small-batch makers</span><span>Original artwork stays yours · Production-ready files preserved</span></footer>
    </main>
  );
}