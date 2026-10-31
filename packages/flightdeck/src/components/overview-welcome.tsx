import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OverviewWelcome({ name, firstVisit, unavailable, onNewSession }: {
  name: string; firstVisit: boolean; unavailable: boolean; onNewSession: () => void;
}) {
  return <header className="flex flex-wrap items-center justify-between gap-4 py-2 md:py-4">
    <div className="min-w-0">
      <h1 className="text-display font-semibold tracking-tight text-balance">{firstVisit ? `Welcome to PilotSwarm${name ? `, ${name}` : ""}.` : `Welcome back${name ? `, ${name}` : ""}.`}</h1>
      <p className="mt-2 max-w-prose text-base text-muted">{unavailable ? "Your work will appear here when the connection is restored." : "Your next decision. Your work in progress. Everything to pick up from here."}</p>
    </div>
    <Button className="h-auto min-h-10 gap-2 px-4 py-2 text-base pointer-coarse:min-h-11" onClick={onNewSession}><Plus /> New session</Button>
  </header>;
}
