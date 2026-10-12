import AdminDashboard from "@/components/AdminDashboard";
import AdminLogin from "@/components/AdminLogin";
import { listParticipants } from "@/lib/repository";
import { isAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdmin())) return <AdminLogin />;
  return <AdminDashboard participants={await listParticipants()} />;
}
