import { Suspense } from "react";
import { WorkspaceShell } from "@/components/layout/workspace-shell";

export default function CustomerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <Suspense fallback={<div className="min-h-screen bg-[#f5f7fb]" aria-label="Loading customer workspace" />}><WorkspaceShell role="customer">{children}</WorkspaceShell></Suspense>;
}
