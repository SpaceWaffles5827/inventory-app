"use client"

import { useEffect, useMemo, useState } from "react"
import { Building2, KeyRound, Palette, TriangleAlert, UserRound, type LucideIcon } from "lucide-react"
import { PageContainer, PageHeader } from "@/components/common/page"
import { ProfileSettings } from "@/components/workspace/settings/profile-settings"
import { PasswordSettings } from "@/components/workspace/settings/password-settings"
import { AppearanceSettings } from "@/components/workspace/settings/appearance-settings"
import { WorkspaceSettings } from "@/components/workspace/settings/workspace-settings"
import { DangerZone } from "@/components/workspace/settings/danger-zone"
import { useWorkspace } from "@/lib/workspace-context"
import { cn } from "@/lib/utils"

interface NavEntry {
  id: string
  label: string
  icon: LucideIcon
  group: "Account" | "Workspace"
}

export default function SettingsPage() {
  const { isOwner } = useWorkspace()

  const sections = useMemo<NavEntry[]>(
    () => [
      { id: "profile", label: "Profile", icon: UserRound, group: "Account" },
      { id: "password", label: "Password", icon: KeyRound, group: "Account" },
      { id: "appearance", label: "Appearance", icon: Palette, group: "Account" },
      { id: "workspace", label: "General", icon: Building2, group: "Workspace" },
      ...(isOwner ? [{ id: "danger", label: "Danger zone", icon: TriangleAlert, group: "Workspace" as const }] : []),
    ],
    [isOwner]
  )

  const [active, setActive] = useState("profile")

  // Scroll-spy: highlight the section nearest the top of the viewport
  useEffect(() => {
    const elements = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null)
    if (elements.length === 0 || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: "-15% 0px -65% 0px", threshold: 0 }
    )
    elements.forEach((el) => observer.observe(el))

    // The last section can be too short to reach the top band — treat "scrolled to the bottom" as it
    const onScroll = () => {
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8
      if (atBottom && window.scrollY > 0) setActive(elements[elements.length - 1].id)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      observer.disconnect()
      window.removeEventListener("scroll", onScroll)
    }
  }, [sections])

  const jumpTo = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" })
    setActive(id)
    // Move focus for keyboard / screen reader users without scrolling again
    el.setAttribute("tabindex", "-1")
    el.focus({ preventScroll: true })
  }

  const groups = (["Account", "Workspace"] as const).map((group) => ({
    group,
    items: sections.filter((s) => s.group === group),
  }))

  return (
    <PageContainer>
      <PageHeader title="Settings" description="Manage your account and this workspace." />

      <div className="lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-10">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <div className="sticky top-8 space-y-5">
            {groups.map(({ group, items }) => (
              <div key={group} className="space-y-1">
                <p className="px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{group}</p>
                <ul className="space-y-0.5">
                  {items.map(({ id, label, icon: Icon }) => (
                    <li key={id}>
                      <a
                        href={`#${id}`}
                        onClick={(e) => {
                          e.preventDefault()
                          jumpTo(id)
                        }}
                        aria-current={active === id ? "true" : undefined}
                        className={cn(
                          "flex h-9 items-center gap-2.5 rounded-md px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                          active === id ? "bg-accent font-medium text-foreground" : "text-muted-foreground",
                          id === "danger" && active !== id && "hover:text-destructive"
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className="min-w-0 max-w-3xl space-y-6">
          <h2 className="sr-only">Account</h2>
          <ProfileSettings />
          <PasswordSettings />
          <AppearanceSettings />

          <div className="flex items-center gap-3 pt-4">
            <h2 className="text-sm font-medium text-muted-foreground">Workspace</h2>
            <div className="h-px flex-1 bg-border" />
          </div>
          <WorkspaceSettings />
          {isOwner && <DangerZone />}
        </div>
      </div>
    </PageContainer>
  )
}
