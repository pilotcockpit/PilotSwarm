import type * as React from "react";

/**
 * The greeting, with what you can do first (start a session) beneath it and the paper-glider illustration beside it.
 * The illustration is decorative: empty alt text, explicit dimensions, no motion.
 */
export function OverviewWelcome({ name, firstVisit, unavailable, children }: {
  name: string; firstVisit: boolean; unavailable: boolean; children?: React.ReactNode;
}) {
  // Phone: the greeting and the illustration share a row and the start box runs the full width beneath them.
  // Wider: the illustration sits to the right of both the greeting and the box.
  return <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-4 py-2 sm:gap-x-8 md:py-4">
    <div className="min-w-0">
      <h1 className="text-display font-semibold tracking-tight text-balance">{firstVisit ? `Welcome to PilotSwarm${name ? `, ${name}` : ""}.` : `Welcome back${name ? `, ${name}` : ""}.`}</h1>
      <p className="mt-2 max-w-prose text-base text-muted">{unavailable ? "Your work will appear here when the connection is restored." : firstVisit ? "Describe the outcome you want. Follow its progress here, answer when it needs you, and find the finished work in Outputs." : "Your next decision. Your work in progress. Everything to pick up from here."}</p>
    </div>
    <img src="/assets/welcome-paper-flight.webp" alt="" aria-hidden="true" width={624} height={416} decoding="async" draggable={false} className="pointer-events-none h-auto w-20 shrink-0 select-none sm:row-span-2 sm:w-44 lg:w-52" />
    {unavailable || !children ? null : <div className="col-span-2 min-w-0 sm:col-span-1">{children}</div>}
  </header>;
}
