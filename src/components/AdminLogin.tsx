"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function AdminLogin() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not sign in.");
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not sign in.");
      setIsSubmitting(false);
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar"><span className="brand"><span className="brand-mark">G</span><span>Garment Designer / Admin</span></span></header>
      <form className="join-card admin-login" onSubmit={submit}>
        <p className="eyebrow">Admin only</p>
        <h2>Enter the admin code</h2>
        <label className="field">Admin access code<input type="password" value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" required /></label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? "Checking..." : "Open admin"} <ArrowRight size={16} /></button>
      </form>
    </main>
  );
}
