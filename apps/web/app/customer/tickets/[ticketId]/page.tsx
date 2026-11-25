import { WorkspacePage } from "@/components/workspace/workspace-page";

export default async function TicketDetailsPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  return <WorkspacePage role="customer" section="tickets" ticketId={ticketId} />;
}
