import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ArtworkDownloads, { type ArtworkEntry } from "@/components/ArtworkDownloads";
import LocalTime from "@/components/LocalTime";
import type { SavedDesignPayload } from "@/lib/designPayload";
import { getDesign, getDesignMeta, getParticipant } from "@/lib/repository";
import { isAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

const slotLabels = { body: "Body", hood: "Hood", leftArm: "Left arm", rightArm: "Right arm" } as const;

function artworkEntries(payload: SavedDesignPayload): ArtworkEntry[] {
  const { configuration, meshArtwork } = payload;
  if (configuration.garmentType === "tshirt") {
    return [
      ...(configuration.frontCanvasJson ? [{ label: "Front", json: configuration.frontCanvasJson }] : []),
      ...(configuration.backCanvasJson ? [{ label: "Back", json: configuration.backCanvasJson }] : []),
    ];
  }
  return (["front", "back"] as const).flatMap((side) => (Object.keys(slotLabels) as (keyof typeof slotLabels)[]).flatMap((slot) => {
    const json = meshArtwork[side]?.[slot]?.json;
    return json ? [{ label: `${side === "front" ? "Front" : "Back"} ${slotLabels[slot]}`, json }] : [];
  }));
}

export default async function ParticipantPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) redirect("/admin");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const participant = await getParticipant(id);
  if (!participant) notFound();
  const [meta, design] = await Promise.all([getDesignMeta(id), getDesign(id)]);
  const entries = design ? artworkEntries(design.payload) : [];
  const fileBase = `group-${participant.groupNumber}-${participant.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

  return (
    <main className="app-shell">
      <header className="topbar"><span className="brand"><span className="brand-mark">G</span><span>Garment Designer / Admin</span></span><div className="topbar-actions"><Link className="text-button" href="/admin"><ArrowLeft size={15} /> All participants</Link></div></header>
      <section className="admin-main">
        <p className="eyebrow">Group {participant.groupNumber}</p>
        <h1 style={{ fontSize: 44, fontWeight: 400, margin: "10px 0 0" }}>{participant.name}</h1>
        <div className="participant-detail">
          <div>
            {meta?.hasMockup ? (
              <div className="mockup-frame">
                {/* eslint-disable-next-line @next/next/no-img-element -- served from an authenticated route */}
                <img src={`/api/admin/participants/${id}/mockup?v=${encodeURIComponent(meta.savedAt)}`} alt={`${participant.name}'s design on the garment`} />
              </div>
            ) : <p className="admin-empty">{meta ? "This design was saved without a garment preview." : "This participant hasn't saved a design yet."}</p>}
            <h2 style={{ fontSize: 22, fontWeight: 400, margin: "28px 0 0" }}>Print files</h2>
            <ArtworkDownloads entries={entries} fileBase={fileBase} />
          </div>
          <dl className="detail-list">
            <div><dt>Name</dt><dd>{participant.name}</dd></div>
            <div><dt>Group</dt><dd>{participant.groupNumber}</dd></div>
            <div><dt>Email</dt><dd>{participant.email ? <a href={`mailto:${participant.email}?subject=${encodeURIComponent("Your workshop design")}`}>{participant.email}</a> : "Not provided"}</dd></div>
            <div><dt>Garment</dt><dd>{meta ? (meta.garmentType === "hoodie" ? "Hoodie" : "T-shirt") : "-"}</dd></div>
            <div><dt>Garment color</dt><dd>{meta ? <><span className="color-dot" style={{ backgroundColor: meta.shirtColor }} />{meta.shirtColor.toUpperCase()}</> : "-"}</dd></div>
            <div><dt>Size</dt><dd>{design?.payload.configuration.size ?? "-"}</dd></div>
            <div><dt>Last saved</dt><dd>{meta ? <LocalTime iso={meta.savedAt} /> : "Never"}</dd></div>
            <div><dt>Last signed in</dt><dd><LocalTime iso={participant.lastSeenAt} /></dd></div>
          </dl>
        </div>
      </section>
    </main>
  );
}
