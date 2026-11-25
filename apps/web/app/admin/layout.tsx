import { Suspense } from "react";
import { WorkspaceShell } from "@/components/layout/workspace-shell";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <Suspense fallback={<div className="min-h-screen bg-[#f5f7fb]" aria-label="Loading admin workspace" />}><WorkspaceShell role="admin">{children}</WorkspaceShell></Suspense>;
}
