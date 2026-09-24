import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

/** Centered eyebrow + heading + intro used at the top of each marketing section */
export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: {
  id?: string
  eyebrow?: string
  title: React.ReactNode
  description?: React.ReactNode
  align?: "center" | "left"
  className?: string
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && <p className="text-sm font-semibold text-primary">{eyebrow}</p>}
      <h2 id={id} className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">{description}</p>
      )}
    </div>
  )
}

/** Faint grid + primary glow used behind hero areas. Purely decorative. */
export function GridBackdrop({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:56px_56px] opacity-60 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black_30%,transparent_100%)]" />
      <div className="absolute left-1/2 top-0 h-[480px] w-[min(1100px,140%)] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/15 blur-3xl" />
    </div>
  )
}

export interface FaqItem {
  question: string
  answer: React.ReactNode
}

/** Accessible accordion built on <details>/<summary> — works without JavaScript */
export function FaqList({ items, className }: { items: FaqItem[]; className?: string }) {
  return (
    <div className={cn("divide-y rounded-xl border bg-card", className)}>
      {items.map((item) => (
        <details key={item.question} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-5 py-4 text-left font-medium transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6 [&::-webkit-details-marker]:hidden">
            {item.question}
            <ChevronDown
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
            />
          </summary>
          <div className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground sm:px-6 sm:text-base">{item.answer}</div>
        </details>
      ))}
    </div>
  )
}
