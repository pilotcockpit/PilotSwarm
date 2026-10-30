import * as React from "react";
import { Button } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useOpMutation, useOpQuery } from "@/data/ops/use-op";
import { nameProblem, useProviderRows } from "@/data/ops/providers";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Older deployments kept one system GitHub Copilot key outside the provider list. Admins are
 * offered a one-step move into a normal provider, which can then be limited, held and rotated
 * like any other. Shown only when there is something to move.
 */
export function LegacyKeyNotice({ isAdmin }: { isAdmin: boolean }) {
  const { data } = useOpQuery<{ systemKeyPresent?: boolean; systemKeyAdopted?: boolean }>(["providers", "legacy"], "getLegacyProviderMigrationStatus", undefined, { enabled: isAdmin, staleTime: 5 * 60_000 });
  const { data: rows } = useProviderRows();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("system-copilot");
  const adopt = useOpMutation("adoptLegacySystemGitHubCopilotKey", { params: (v: { name: string }) => v, invalidate: [["providers"]], failure: "Couldn't move the key" });
  if (!isAdmin || !data?.systemKeyPresent || data.systemKeyAdopted) return null;
  const problem = nameProblem(name, (rows || []).map((r) => r.name));
  return (
    <div className={cn(cardVariants({ tone: "accent", enter: true }), "mb-5 flex flex-col gap-3 p-3 sm:flex-row sm:items-center")}>
      <p className="min-w-0 flex-1 text-sm">A GitHub Copilot key from an older setup is still used by system sessions, outside this list. Move it into a provider so you can limit, hold and rotate it here.</p>
      <Button onClick={() => setOpen(true)}>Move it here…</Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Move the system key into a provider"
        description={<Field label="Provider name" hint={problem ? undefined : "Private to you, and allowed for system sessions."} error={problem}><Input value={name} onChange={(e) => setName(e.target.value)} spellCheck={false} /></Field>}
        consequences={["System sessions keep working on the same key.", "The provider is private to you and used by system sessions only."]}
        confirmLabel="Move key"
        onConfirm={async () => { if (problem || !name.trim()) throw new Error(problem || "Give the provider a name."); await adopt.mutateAsync({ name: name.trim() }); toast.success(`The system key is now the provider ${name.trim()}.`); }}
      />
    </div>
  );
}
