"use client";

import { ArrowRight, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { groupNumbers } from "@/lib/workshop";

interface Props { returning: { name: string; groupNumber: number } | null; }

export default function JoinForm({ returning }: Props) {
  const router = useRouter();
  const [accessCode, setAccessCode] = useState("");
  const [name, setName] = useState("");
  const [groupNumber, setGroupNumber] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (groupNumber === null) { setError("Choose your group number."); return; }
    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/session/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessCode, name, groupNumber, email }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not sign you in.");
      router.push("/studio");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not sign you in.");
      setIsSubmitting(false);
    }
  };

  const switchParticipant = async () => {
    await fetch("/api/session/logout", { method: "POST" });
    router.refresh();
  };

  if (returning) {
    return (
      <div className="join-card">
        <p className="eyebrow">Welcome back</p>
        <h2>{returning.name}</h2>
        <p className="join-hint">Group {returning.groupNumber}. Your saved design is waiting.</p>
        <button className="primary-button" onClick={() => router.push("/studio")}>Continue designing <ArrowRight size={16} /></button>
        <button className="link-button" onClick={switchParticipant}><LogOut size={14} /> Not you? Sign in as someone else</button>
      </div>
    );
  }

  return (
    <form className="join-card" onSubmit={submit} noValidate>
      <p className="eyebrow">Join the workshop</p>
      <h2>Sign in to your studio</h2>
      <label className="field">Workshop access code<input type="password" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} autoComplete="off" required /></label>
      <label className="field">Your name<input type="text" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={60} placeholder="First and last name" required /></label>
      <fieldset className="field group-field">
        <legend>Group number</legend>
        <div className="group-grid">{groupNumbers.map((number) => <label key={number} className={groupNumber === number ? "group-chip selected" : "group-chip"}><input type="radio" name="group" value={number} checked={groupNumber === number} onChange={() => setGroupNumber(number)} /><span>{number}</span></label>)}</div>
      </fieldset>
      <label className="field">Email <span className="optional">(optional)</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={120} placeholder="So the team can follow up" /></label>
      <p className="join-hint">Use the same name and group number each time to pick up where you left off.</p>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? "Signing in..." : "Enter the studio"} <ArrowRight size={16} /></button>
    </form>
  );
}
