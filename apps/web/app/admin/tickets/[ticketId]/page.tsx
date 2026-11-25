import { WorkspacePage } from "@/components/workspace/workspace-page";

export default async function AdminTicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  return <WorkspacePage role="admin" section="tickets" ticketId={ticketId} />;
}
