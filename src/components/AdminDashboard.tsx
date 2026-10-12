"use client";

import { LogOut, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";
import LocalTime from "@/components/LocalTime";
import type { ParticipantSummary } from "@/lib/repository";
import { groupNumbers } from "@/lib/workshop";

const DAY = 24 * 60 * 60 * 1000;

function statusOf(participant: ParticipantSummary, now: number | null) {
  if (!participant.savedAt) return { key: "not-started", label: "Not started", attention: true };
  const age = now === null ? 0 : now - new Date(participant.savedAt).getTime();
  if (age > DAY) return { key: "stale", label: `Idle ${Math.floor(age / DAY)}d`, attention: true };
  return { key: "saved", label: "Saved", attention: false };
}

export default function AdminDashboard({ participants }: { participants: ParticipantSummary[] }) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [attentionOnly, setAttentionOnly] = useState(false);
  useEffect(() => { startTransition(() => setNow(Date.now())); }, []);

  const visible = useMemo(() => participants.filter((participant) => {
    if (group !== "all" && participant.groupNumber !== Number(group)) return false;
    if (query && !`${participant.name} ${participant.email ?? ""}`.toLowerCase().includes(query.toLowerCase())) return false;
    return !attentionOnly || statusOf(participant, now).attention;
  }), [attentionOnly, group, now, participants, query]);

  const saved = participants.filter((participant) => participant.savedAt).length;
  const groupsActive = new Set(participants.map((participant) => participant.groupNumber)).size;

  const signOut = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  };

  return (
    <main className="app-shell">
      <header className="topbar"><span className="brand"><span className="brand-mark">G</span><span>Garment Designer / Admin</span></span><div className="topbar-actions"><button className="text-button" onClick={signOut}><LogOut size={15} /> Sign out</button></div></header>
      <section className="admin-main">
        <p className="eyebrow">Workshop admin</p>
        <h1 style={{ fontSize: 44, fontWeight: 400, margin: "10px 0 0" }}>Participant designs</h1>
        <div className="admin-stats">
          <div className="admin-stat"><strong>{participants.length}</strong><span>participants</span></div>
          <div className="admin-stat"><strong>{saved}</strong><span>with a saved design</span></div>
          <div className="admin-stat"><strong>{participants.length - saved}</strong><span>not started</span></div>
          <div className="admin-stat"><strong>{groupsActive}</strong><span>groups active</span></div>
        </div>
        <div className="admin-toolbar">
          <label><Search size={14} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" aria-label="Search participants" /></label>
          <label>Group<select value={group} onChange={(event) => setGroup(event.target.value)}><option value="all">All groups</option>{groupNumbers.map((number) => <option key={number} value={number}>Group {number}</option>)}</select></label>
          <label><input type="checkbox" checked={attentionOnly} onChange={(event) => setAttentionOnly(event.target.checked)} /> Needs attention (not started, or not saved in 24h)</label>
        </div>
        {visible.length ? (
          <table className="admin-table">
            <thead><tr><th>Group</th><th>Name</th><th>Email</th><th>Garment</th><th>Last saved</th><th>Status</th><th /></tr></thead>
            <tbody>{visible.map((participant) => {
              const status = statusOf(participant, now);
              return (
                <tr key={participant.id}>
                  <td>{participant.groupNumber}</td>
                  <td><Link href={`/admin/participants/${participant.id}`}>{participant.name}</Link></td>
                  <td>{participant.email ? <a href={`mailto:${participant.email}`}>{participant.email}</a> : <span style={{ color: "#a0a39d" }}>-</span>}</td>
                  <td>{participant.garmentType ? <><span className="color-dot" style={{ backgroundColor: participant.shirtColor ?? undefined }} />{participant.garmentType === "hoodie" ? "Hoodie" : "T-shirt"}</> : <span style={{ color: "#a0a39d" }}>-</span>}</td>
                  <td>{participant.savedAt ? <LocalTime iso={participant.savedAt} /> : <span style={{ color: "#a0a39d" }}>Never</span>}</td>
                  <td><span className={`status-chip ${status.key === "saved" ? "saved" : "stale"}`}>{status.label}</span></td>
                  <td><Link href={`/admin/participants/${participant.id}`}>{participant.savedAt ? "View design" : "View"}</Link></td>
                </tr>
              );
            })}</tbody>
          </table>
        ) : <p className="admin-empty">{participants.length ? "No participants match these filters." : "No one has joined yet. Share the studio link and workshop code."}</p>}
      </section>
    </main>
  );
}
