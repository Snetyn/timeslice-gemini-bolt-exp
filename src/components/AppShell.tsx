import type { ReactNode } from "react";

export type TimeSliceMode = "session" | "daily" | "single" | "flowmodoro";
export type AppDestination = TimeSliceMode | "manage" | "settings";

type AppShellProps = {
  active: AppDestination;
  onNavigate: (destination: AppDestination) => void;
  children: ReactNode;
};

const destinations: Array<{
  id: AppDestination;
  label: string;
  shortLabel?: string;
  icon: "session" | "daily" | "single" | "flow" | "manage" | "settings";
  primary: boolean;
}> = [
  { id: "session", label: "Session", icon: "session", primary: true },
  { id: "daily", label: "Daily", icon: "daily", primary: true },
  { id: "single", label: "Single", icon: "single", primary: true },
  {
    id: "flowmodoro",
    label: "Flowmodoro",
    shortLabel: "Flow",
    icon: "flow",
    primary: true,
  },
  { id: "manage", label: "Activities", icon: "manage", primary: false },
  { id: "settings", label: "Settings", icon: "settings", primary: false },
];

const NavIcon = ({ name }: { name: (typeof destinations)[number]["icon"] }) => {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const paths = {
    session: <path d="M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
    daily: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18M8 14h2M14 14h2M8 17h2" />
      </>
    ),
    single: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    flow: (
      <path d="m12 3 1.6 4.6L18 6l-1.6 4.4L21 12l-4.6 1.6L18 18l-4.4-1.6L12 21l-1.6-4.6L6 18l1.6-4.4L3 12l4.6-1.6L6 6l4.4 1.6L12 3Z" />
    ),
    manage: (
      <>
        <path d="M4 7h10M4 12h16M4 17h8" />
        <circle cx="17" cy="7" r="2" />
        <circle cx="15" cy="17" r="2" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63 1.7 1.7 0 0 0 10 3.08V3h4v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9 1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>
      {paths[name]}
    </svg>
  );
};

const Brand = () => (
  <div className="ts-brand" aria-label="TimeSlice">
    <span className="ts-brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
    <span className="ts-brand-copy">
      <strong>TimeSlice</strong>
      <small>Shape your time</small>
    </span>
  </div>
);

const DestinationButton = ({
  destination,
  active,
  onNavigate,
  compact = false,
}: {
  destination: (typeof destinations)[number];
  active: boolean;
  onNavigate: (destination: AppDestination) => void;
  compact?: boolean;
}) => (
  <button
    type="button"
    className={`ts-nav-item ${active ? "is-active" : ""}`}
    onClick={() => onNavigate(destination.id)}
    aria-current={active ? "page" : undefined}
    aria-label={destination.label}
  >
    <span className="ts-nav-icon">
      <NavIcon name={destination.icon} />
    </span>
    <span>
      {compact
        ? destination.shortLabel || destination.label
        : destination.label}
    </span>
  </button>
);

export function AppShell({ active, onNavigate, children }: AppShellProps) {
  const primary = destinations.filter((destination) => destination.primary);
  const secondary = destinations.filter((destination) => !destination.primary);
  const activeLabel = destinations.find((item) => item.id === active)?.label;

  return (
    <div className="ts-shell">
      <aside className="ts-sidebar">
        <Brand />
        <nav className="ts-sidebar-nav" aria-label="TimeSlice navigation">
          <div className="ts-nav-group">
            <span className="ts-nav-label">Timers</span>
            {primary.map((destination) => (
              <DestinationButton
                key={destination.id}
                destination={destination}
                active={active === destination.id}
                onNavigate={onNavigate}
              />
            ))}
          </div>
          <div className="ts-nav-group ts-nav-group-secondary">
            <span className="ts-nav-label">Workspace</span>
            {secondary.map((destination) => (
              <DestinationButton
                key={destination.id}
                destination={destination}
                active={active === destination.id}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </nav>
      </aside>

      <div className="ts-workspace">
        <header className="ts-mobile-header">
          <Brand />
          <div className="ts-mobile-actions">
            {secondary.map((destination) => (
              <DestinationButton
                key={destination.id}
                destination={destination}
                active={active === destination.id}
                onNavigate={onNavigate}
                compact
              />
            ))}
          </div>
        </header>
        <div className="ts-page-heading">
          <span>Workspace</span>
          <h1>{activeLabel}</h1>
        </div>
        <main className="ts-main" id="main-content">
          {children}
        </main>
      </div>

      <nav className="ts-bottom-nav" aria-label="Timer modes">
        {primary.map((destination) => (
          <DestinationButton
            key={destination.id}
            destination={destination}
            active={active === destination.id}
            onNavigate={onNavigate}
            compact
          />
        ))}
      </nav>
    </div>
  );
}
