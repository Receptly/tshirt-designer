"use client";

import { Sparkles } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import type { GarmentArtworkSlot, GarmentType } from "@/lib/configuration";

const garmentTargets: Record<Exclude<GarmentType, "tshirt">, { id: GarmentArtworkSlot; label: string }[]> = {
  hoodie: [{ id: "body", label: "Body" }, { id: "hood", label: "Hood" }, { id: "leftArm", label: "Left arm" }, { id: "rightArm", label: "Right arm" }],
  pants: [{ id: "leftArm", label: "Left leg" }, { id: "rightArm", label: "Right leg" }],
};

interface Props {
  garmentType: GarmentType;
  onUseImage: (imageUrl: string, slot: GarmentArtworkSlot) => Promise<void>;
}

export default function ImageGeneratorPanel({ garmentType, onUseImage }: Props) {
  const [prompt, setPrompt] = useState("");
  const [targetSlot, setTargetSlot] = useState<GarmentArtworkSlot>("body");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState("");

  const generate = async () => {
    if (prompt.trim().length < 4) { setMessage("Describe the artwork you want to create."); return; }
    setIsGenerating(true);
    setImageUrl(null);
    setMessage("");
    try {
      const response = await fetch("/api/image-generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const result = await response.json() as { imageUrl?: string; error?: string };
      if (!response.ok || !result.imageUrl) throw new Error(result.error || "Image generation failed.");
      setImageUrl(result.imageUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Image generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const addToCanvas = async () => {
    if (!imageUrl) return;
    setIsAdding(true);
    setMessage("");
    try {
      await onUseImage(imageUrl, targetSlot);
      setMessage("Added to the design canvas.");
    } catch {
      setMessage("Could not add the image to the canvas.");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <section className="image-generator" aria-label="AI image generator">
      <div className="image-generator-heading"><Sparkles size={16} /><strong>Generate artwork</strong></div>
      <label className="generator-label" htmlFor="image-prompt">Image description</label>
      <textarea id="image-prompt" className="generator-prompt" value={prompt} maxLength={700} onChange={(event) => setPrompt(event.target.value)} placeholder="A bold botanical tiger illustration with curved leaves" />
      {garmentType !== "tshirt" ? <label className="generator-target">Apply to<select value={targetSlot} onChange={(event) => setTargetSlot(event.target.value as GarmentArtworkSlot)}>{garmentTargets[garmentType].map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}</select></label> : null}
      <p className="generator-note">Transparent PNG output · Uses OpenAI credits</p>
      <button className="canvas-tool generator-action" onClick={generate} disabled={isGenerating || isAdding}><Sparkles size={15} />{isGenerating ? "Generating..." : "Generate image"}</button>
      {imageUrl ? <div className="generated-result"><div className="generated-image-stage"><Image src={imageUrl} alt="AI-generated artwork preview" width={1024} height={1024} unoptimized /></div><button className="save-button" onClick={addToCanvas} disabled={isAdding}>{isAdding ? "Adding..." : "Add to canvas"}</button></div> : null}
      {message ? <p className="generator-message" role="status">{message}</p> : null}
    </section>
  );
}