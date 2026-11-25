import { WorkspacePage } from "@/components/workspace/workspace-page";

export default async function AgentTicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  return <WorkspacePage role="agent" section="tickets" ticketId={ticketId} />;
}
