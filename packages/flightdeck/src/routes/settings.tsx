import { getRouteApi } from "@tanstack/react-router";
import { Bell, Database } from "lucide-react";
import { TopBar, ClassicLink } from "@/shell/AppShell";
import { useDensity, useTheme } from "@/shell/prefs";
import { ShortcutList } from "@/shell/shortcuts";
import { useProfile, useSource } from "@/data/source";
import { EmptyState, Panel } from "@/components/empty";
import { Segmented } from "@/components/ui/tabs";
import { SETTINGS_TABS } from "@/router";
import { cn } from "@/lib/utils";

const route = getRouteApi("/settings");
const LABEL: Record<(typeof SETTINGS_TABS)[number], string> = { profile: "Profile", appearance: "Appearance", shortcuts: "Keyboard shortcuts", flags: "My feature flags", notifications: "Notifications", data: "Data source" };

export function SettingsPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const tab = search.tab || "appearance";
  return (
    <>
      <TopBar crumbs={[{ label: "Settings", to: "/settings" }, { label: LABEL[tab] }]} />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav aria-label="Settings sections" className="flex shrink-0 gap-1 overflow-x-auto border-b border-line px-3 py-2 md:w-[200px] md:flex-col md:border-b-0 md:border-r md:py-4">
          {SETTINGS_TABS.map((t) => (
            <button key={t} type="button" aria-current={t === tab ? "page" : undefined} onClick={() => navigate({ search: { tab: t } })} className={cn("h-8 shrink-0 rounded-control px-2.5 text-left text-sm font-medium pointer-coarse:h-11", t === tab ? "bg-raised text-fg" : "text-muted hover:text-fg")}>{LABEL[t]}</button>
          ))}
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="max-w-[880px] px-4 py-5 md:px-6">
            {tab === "profile" ? <Profile /> : null}
            {tab === "appearance" ? <Appearance /> : null}
            {tab === "shortcuts" ? <Panel className="px-4"><ShortcutList /></Panel> : null}
            {tab === "flags" ? <Panel><EmptyState title="My feature flags" action={<ClassicLink>Open in classic portal</ClassicLink>}>Per-person overrides of cluster flags. Not ported yet.</EmptyState></Panel> : null}
            {tab === "notifications" ? <Panel><EmptyState icon={<Bell />} title="Browser notifications for “Needs you”">Get a notification when a session asks a question, fails, or hits a hold. Coming with the push-based session list.</EmptyState></Panel> : null}
            {tab === "data" ? <DataSourceSettings /> : null}
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line-subtle px-4 py-3.5 first:border-t-0">
      <div className="min-w-0 flex-1"><div className="text-sm font-medium">{title}</div>{note ? <div className="text-xs text-muted">{note}</div> : null}</div>
      {children}
    </div>
  );
}

function Appearance() {
  const [theme, setTheme] = useTheme();
  const [density, setDensity] = useDensity();
  return (
    <Panel>
      <Row title="Theme" note="System follows your computer's setting.">
        <Segmented label="Theme" value={theme} onChange={setTheme} options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
      </Row>
      <Row title="Density" note="Compact fits more rows; Comfortable is easier to read for long chats.">
        <Segmented label="Density" value={density} onChange={setDensity} options={[{ value: "compact", label: "Compact" }, { value: "comfortable", label: "Comfortable" }]} />
      </Row>
      <Row title="Classic terminal themes" note="The 18 classic themes map onto Flight Deck's tokens with a contrast check. Not in this preview.">
        <span className="text-xs text-faint">Coming later</span>
      </Row>
    </Panel>
  );
}

function Profile() {
  const { data } = useProfile();
  return (
    <Panel>
      <Row title="Name"><span className="text-sm">{data?.displayName || "—"}</span></Row>
      <Row title="Email"><span className="text-sm">{data?.email || "—"}</span></Row>
      <Row title="Role"><span className="text-sm">{data?.isAdmin ? "Admin" : "Member"}</span></Row>
    </Panel>
  );
}

function DataSourceSettings() {
  const { mode, setMode, source } = useSource();
  return (
    <Panel>
      <Row title="Where Flight Deck reads from" note={mode === "live" ? `The PilotSwarm Web API at ${source.label}, the same server as the classic portal.` : "Realistic fixtures, for judging the design when the deployment has little to show. Nothing is sent anywhere."}>
        <Segmented label="Data source" value={mode} onChange={setMode} options={[{ value: "live", label: "Live" }, { value: "demo", label: "Demo" }]} />
      </Row>
      <div className="flex items-start gap-2 border-t border-line px-4 py-3 text-xs text-muted"><Database className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Add <span className="font-mono">?data=demo</span> or <span className="font-mono">?data=live</span> to any Flight Deck link to switch.</div>
    </Panel>
  );
}
