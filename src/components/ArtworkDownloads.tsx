"use client";

import { StaticCanvas } from "fabric";
import { Download } from "lucide-react";
import { useEffect, useState } from "react";

export interface ArtworkEntry { label: string; json: string; }
interface Rendered { label: string; png: string; svg: string; width: number; height: number; }

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function ArtworkDownloads({ entries, fileBase }: { entries: ArtworkEntry[]; fileBase: string }) {
  const [rendered, setRendered] = useState<Rendered[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results: Rendered[] = [];
      for (const entry of entries) {
        const canvas = new StaticCanvas(undefined, { width: 512, height: 640 });
        try {
          await canvas.loadFromJSON(JSON.parse(entry.json));
          const rectangles = canvas.getObjects().map((object) => object.getBoundingRect());
          if (!rectangles.length) continue;
          const padding = 8;
          const left = Math.max(0, Math.floor(Math.min(...rectangles.map((rect) => rect.left)) - padding));
          const top = Math.max(0, Math.floor(Math.min(...rectangles.map((rect) => rect.top)) - padding));
          const width = Math.min(512, Math.ceil(Math.max(...rectangles.map((rect) => rect.left + rect.width)) + padding)) - left;
          const height = Math.min(640, Math.ceil(Math.max(...rectangles.map((rect) => rect.top + rect.height)) + padding)) - top;
          results.push({
            label: entry.label,
            width,
            height,
            png: canvas.toDataURL({ format: "png", multiplier: 2, left, top, width, height }),
            svg: canvas.toSVG({ viewBox: { x: left, y: top, width, height }, width: String(width), height: String(height) }),
          });
        } finally {
          await canvas.dispose();
        }
      }
      if (!cancelled) setRendered(results);
    })().catch(() => { if (!cancelled) setRendered([]); });
    return () => { cancelled = true; };
  }, [entries]);

  const downloadSvg = (item: Rendered) => {
    const url = URL.createObjectURL(new Blob([item.svg], { type: "image/svg+xml;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileBase}-${slug(item.label)}.svg`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (rendered === null) return <p className="admin-empty">Preparing artwork files...</p>;
  if (!rendered.length) return <p className="admin-empty">No artwork has been placed yet.</p>;
  return (
    <div className="artwork-downloads">
      {rendered.map((item) => (
        <div className="artwork-row" key={item.label}>
          {/* eslint-disable-next-line @next/next/no-img-element -- inline data URL, nothing to optimize */}
          <img src={item.png} alt={`${item.label} artwork`} />
          <div><strong>{item.label}</strong><br /><span style={{ color: "#777b76" }}>{item.width * 2} x {item.height * 2} px PNG</span></div>
          <a className="canvas-tool" href={item.png} download={`${fileBase}-${slug(item.label)}.png`}><Download size={14} /> PNG</a>
          <button className="canvas-tool" onClick={() => downloadSvg(item)}><Download size={14} /> SVG</button>
        </div>
      ))}
    </div>
  );
}
