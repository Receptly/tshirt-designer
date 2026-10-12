import { redirect } from "next/navigation";
import Configurator from "@/components/Configurator";
import { getDesign, getParticipant } from "@/lib/repository";
import { getParticipantId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const participantId = await getParticipantId();
  if (!participantId) redirect("/");
  const participant = await getParticipant(participantId);
  if (!participant) redirect("/");
  const saved = await getDesign(participantId);
  return <Configurator participant={{ name: participant.name, groupNumber: participant.groupNumber }} initialDesign={saved?.payload ?? null} />;
}
