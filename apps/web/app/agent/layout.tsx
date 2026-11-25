import { Suspense } from "react";
import { WorkspaceShell } from "@/components/layout/workspace-shell";

export default function AgentLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <Suspense fallback={<div className="min-h-screen bg-[#f5f7fb]" aria-label="Loading agent workspace" />}><WorkspaceShell role="agent">{children}</WorkspaceShell></Suspense>;
}
