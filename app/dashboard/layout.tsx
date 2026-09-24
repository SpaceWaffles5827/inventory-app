"use client"

import type React from "react"
import { Loader2 } from "lucide-react"
import { WorkspaceProvider, useWorkspace } from "@/lib/workspace-context"
import { ScanProvider } from "@/components/app-shell/scan-provider"
import { CommandPaletteProvider } from "@/components/app-shell/command-palette"
import { AppSidebar } from "@/components/app-shell/app-sidebar"
import { MobileTabBar, MobileTopBar } from "@/components/app-shell/mobile-nav"
import { ConfirmProvider } from "@/components/common/confirm-provider"
import { ErrorState } from "@/components/common/states"
import { NoWorkspace } from "@/components/app-shell/no-workspace"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <ConfirmProvider>
        <ScanProvider>
          <CommandPaletteProvider>
            <div className="min-h-dvh bg-background">
              <AppSidebar />
              <div className="flex min-h-dvh flex-col lg:pl-64">
                <MobileTopBar />
                <main className="flex-1 pb-24 lg:pb-0">
                  <DashboardContent>{children}</DashboardContent>
                </main>
              </div>
              <MobileTabBar />
            </div>
          </CommandPaletteProvider>
        </ScanProvider>
      </ConfirmProvider>
    </WorkspaceProvider>
  )
}

/** Blocks page rendering until the session + workspace are known; remounts pages on workspace switch. */
function DashboardContent({ children }: { children: React.ReactNode }) {
  const { ready, user, workspaceId, error, refresh } = useWorkspace()

  if (!ready || (!user && !error)) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <ErrorState title="Couldn't load your workspace" message={error} onRetry={refresh} />
      </div>
    )
  }

  if (!workspaceId) return <NoWorkspace />

  // Keying by workspace remounts the page so it refetches data for the newly selected workspace.
  return <div key={workspaceId}>{children}</div>
}
