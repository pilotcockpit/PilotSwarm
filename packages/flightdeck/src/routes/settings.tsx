import { getRouteApi } from "@tanstack/react-router";
import * as React from "react";
import { Database } from "lucide-react";
import { TopBar } from "@/shell/AppShell";
import { MyFeaturePreferences } from "@/components/settings/personal-flags";
import { useDensity, useTheme } from "@/shell/prefs";
import { ShortcutList } from "@/shell/shortcuts";
import { useProfile, useSource } from "@/data/source";
import { Panel } from "@/components/empty";
import { Segmented, SideNav, SideNavItem } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/misc";
import { notificationSupport, useNotifyPref } from "@/shell/notifications";
import { SETTINGS_TABS } from "@/router";

const route = getRouteApi("/settings");
const LABEL: Record<(typeof SETTINGS_TABS)[number], string> = { profile: "Profile", appearance: "Appearance", shortcuts: "Keyboard shortcuts", flags: "Feature preferences", notifications: "Notifications", data: "Data source" };
const NAV: Array<(typeof SETTINGS_TABS)[number]> = ["appearance", "notifications", "flags", "shortcuts", "profile", "data"];

export function SettingsPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const tab = search.tab || "appearance";
  return (
    <>
      <TopBar crumbs={[{ label: "Settings", to: "/settings" }, { label: LABEL[tab] }]} />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <SideNav label="Settings sections">
          {NAV.map((t) => (
            <SideNavItem key={t} active={t === tab} onClick={() => navigate({ search: { tab: t } })}>{LABEL[t]}</SideNavItem>
          ))}
        </SideNav>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="max-w-[880px] px-4 py-5 md:px-6">
            {tab === "profile" ? <Profile /> : null}
            {tab === "appearance" ? <Appearance /> : null}
            {tab === "shortcuts" ? <Panel className="px-4"><ShortcutList /></Panel> : null}
            {tab === "flags" ? <MyFeaturePreferences /> : null}
            {tab === "notifications" ? <Notifications /> : null}
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
      <Row title="Where Flight Deck reads from" note={mode === "live" ? `The PilotSwarm Web API at ${source.label}, the same server every PilotSwarm client uses.` : "Realistic fixtures, for judging the design when the deployment has little to show. Nothing is sent anywhere."}>
        <Segmented label="Data source" value={mode} onChange={setMode} options={[{ value: "live", label: "Live" }, { value: "demo", label: "Demo" }]} />
      </Row>
      <div className="flex items-start gap-2 border-t border-line px-4 py-3 text-xs text-muted"><Database className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Add <span className="font-mono">?data=demo</span> or <span className="font-mono">?data=live</span> to any Flight Deck link to switch.</div>
    </Panel>
  );
}

function Notifications() {
  const [pref, setPref] = useNotifyPref();
  const [support, setSupport] = React.useState(notificationSupport());
  const on = pref === "on" && support === "granted";
  const toggle = async (next: boolean) => {
    if (!next) return setPref("off");
    const result = support === "default" ? await Notification.requestPermission() : support;
    setSupport(result);
    if (result === "granted") setPref("on");
  };
  const note =
    support === "unsupported" ? "This browser does not support notifications."
    : support === "denied" ? "Blocked for this site. Allow notifications in your browser's site settings, then come back."
    : "A notification when a session asks you a question or fails, only while this tab is in the background.";
  return (
    <Panel>
      <Row title="Notify me when a session needs me" note={note}>
        <Switch aria-label="Notify me when a session needs me" checked={on} disabled={support === "unsupported" || support === "denied"} onCheckedChange={toggle} />
      </Row>
    </Panel>
  );
}
