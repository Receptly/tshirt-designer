import Link from "next/link";
import JoinForm from "@/components/JoinForm";
import { getParticipant } from "@/lib/repository";
import { getParticipantId } from "@/lib/session";

export const dynamic = "force-dynamic";

async function currentParticipant() {
  const id = await getParticipantId();
  if (!id) return null;
  try { return await getParticipant(id); } catch { return null; }
}

export default async function Home() {
  const participant = await currentParticipant();
  return (
    <main className="app-shell landing-shell">
      <header className="topbar"><span className="brand"><span className="brand-mark">G</span><span>Garment Designer</span></span></header>
      <section className="landing-main">
        <div className="landing-copy">
          <p className="eyebrow">Workshop studio</p>
          <h1>Design it. Save it. Pick it up tomorrow.</h1>
          <p className="lede">Sign in with the workshop code, your name, and your group number. Your designs are saved to your name, so you can leave and continue on any day.</p>
          <ol className="landing-steps">
            <li><strong>1</strong><span>Enter the access code from your workshop invitation.</span></li>
            <li><strong>2</strong><span>Add your name and choose your group number.</span></li>
            <li><strong>3</strong><span>Design your garment and press Save. Come back any time.</span></li>
          </ol>
        </div>
        <JoinForm returning={participant ? { name: participant.name, groupNumber: participant.groupNumber } : null} />
      </section>
      <footer className="site-footer"><span>Threadline studio · Workshop access</span><Link href="/admin">Admin</Link></footer>
    </main>
  );
}
