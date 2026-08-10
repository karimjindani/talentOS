import type { ReactNode } from "react";

// Shared card shell — replaces the `rounded-2xl border border-slate-200 bg-white p-6 shadow-sm`
// string that was duplicated across every applicant/admin surface.
const BASE_CARD = "rounded-2xl border border-slate-200 bg-white shadow-sm";

type CardProps = {
  children: ReactNode;
  /** Extra classes appended after the base shell (e.g. padding overrides, hover states). */
  className?: string;
  /** Padding preset. Defaults to the standard `p-6`; use "none" when the card manages its own padding. */
  padding?: "none" | "sm" | "md" | "lg";
  id?: string;
  "aria-labelledby"?: string;
};

const PADDING: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8"
};

export function Card({ children, className = "", padding = "md", id, ...aria }: CardProps) {
  return (
    <section id={id} className={`${BASE_CARD} ${PADDING[padding]} ${className}`.trim()} {...aria}>
      {children}
    </section>
  );
}

type SectionCardProps = {
  title: string;
  /** Small supporting copy rendered under the title. */
  description?: string;
  /** Optional right-aligned header slot (e.g. a "View all →" link or a status badge). */
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  padding?: CardProps["padding"];
  id?: string;
  /** Heading level for the card title. Defaults to h2. */
  headingLevel?: 2 | 3;
  headingId?: string;
};

// A card with a standard header (title + optional description + optional action slot). Replaces the
// per-page `Section` / dashboard card-header patterns.
export function SectionCard({
  title,
  description,
  action,
  children,
  className = "",
  padding = "md",
  id,
  headingLevel = 2,
  headingId
}: SectionCardProps) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <Card className={className} padding={padding} id={id}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Heading id={headingId} className="text-lg font-semibold text-brand-navy">
            {title}
          </Heading>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children ? <div className={description || action ? "mt-4" : "mt-3"}>{children}</div> : null}
    </Card>
  );
}

// Renders free-form body copy the way the old inline `Section` helper did, with a graceful fallback.
export function ProseText({ children }: { children: string | null | undefined }) {
  return (
    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
      {children && children.trim() ? children : "Not specified."}
    </p>
  );
}
