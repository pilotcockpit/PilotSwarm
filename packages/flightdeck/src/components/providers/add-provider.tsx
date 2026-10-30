import * as React from "react";
import { Check, ChevronRight, KeyRound, Loader2, Server, ShieldCheck, User, Users } from "lucide-react";
import { toast } from "sonner";
import { Button, DisclosureButton } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/tabs";
import { Tag } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { nameProblem, suggestName, typeLabel, useCreateProvider, useProviderRows, useProviderTypes, useSetDefault, type ProviderType } from "@/data/ops/providers";
import { useProfile } from "@/data/source";

const BLURB: Record<string, string> = {
  github: "Use the models in your GitHub Copilot subscription.",
  openai: "Your own OpenAI API key.",
  "openai-proxy": "An OpenAI-compatible endpoint you run.",
  azure: "A deployment in your Azure OpenAI resource.",
  anthropic: "Your own Anthropic API key.",
  "anthropic-wif": "Anthropic through the cluster's workload identity. No key to paste.",
  "foundry-wif": "Azure AI Foundry through the cluster's workload identity. No key to paste.",
};

const KEY_LABEL = (type: string) => (/github/i.test(type) ? "GitHub token" : "API key");

/**
 * Add a provider in one sheet: pick what it is, give it a key, done. Only the fields that type
 * needs appear. A key is never shown again after saving; the sheet clears it the moment it is
 * sent. When it works the sheet offers the next useful step instead of closing silently.
 */
export function AddProviderSheet({ open, onOpenChange, initialType, onOpenProvider }: { open: boolean; onOpenChange: (open: boolean) => void; initialType?: string; onOpenProvider?: (name: string) => void }) {
  const { data: types, isLoading } = useProviderTypes();
  const { data: rows } = useProviderRows();
  const { data: profile } = useProfile();
  const isAdmin = Boolean(profile?.isAdmin);
  const existing = React.useMemo(() => (rows || []).map((r) => r.name), [rows]);
  const create = useCreateProvider();
  const setDefault = useSetDefault();

  const [typeId, setTypeId] = React.useState<string>("");
  const [name, setName] = React.useState("");
  const [nameEdited, setNameEdited] = React.useState(false);
  const [apiKey, setApiKey] = React.useState("");
  const [baseUrl, setBaseUrl] = React.useState("");
  const [custom, setCustom] = React.useState(false);
  const [shared, setShared] = React.useState(false);
  const [done, setDone] = React.useState<{ name: string; type: ProviderType } | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setDone(null); setApiKey(""); setBaseUrl(""); setCustom(false); setNameEdited(false); setShared(false); setName(""); setTypeId(initialType || "");
  }, [open, initialType]);

  const type = types?.find((t) => t.id === typeId);
  const wi = Boolean(type?.usesWorkloadIdentity);
  const effectiveShared = wi ? true : shared;
  React.useEffect(() => { if (type && !nameEdited) setName(suggestName(type.id, existing)); }, [type, existing, nameEdited]);

  const problem = nameProblem(name, existing);
  const blockedByRole = wi && !isAdmin;
  const valid = Boolean(type) && name.trim() !== "" && !problem && (wi || apiKey.trim() !== "") && !blockedByRole;

  const submit = async () => {
    if (!type || !valid) return;
    const key = apiKey;
    setApiKey("");
    try {
      await create.mutateAsync({ name: name.trim(), type: type.id, apiKey: key, baseUrl: custom ? baseUrl.trim() : null, shared: effectiveShared });
      setDone({ name: name.trim(), type });
    } catch { /* the mutation already toasted the server's reason; the form stays so the name or key can be fixed */ }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !create.isPending && onOpenChange(v)}>
      <DialogContent side="right" title={done ? "Provider added" : "Add a provider"} description={done ? undefined : "A provider is a place models come from, and the key that pays for them."}>
        {done ? (
          <>
            <DialogBody className="flex flex-col gap-4">
              <div className="flex items-start gap-3 rounded-pane bg-ok-tint p-3 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
                <p><span className="font-semibold">{done.name}</span> is ready with {done.type.models.length} {done.type.models.length === 1 ? "model" : "models"}. {effectiveShared ? "Everyone on this deployment can use it." : "Only you can use it."}</p>
              </div>
              <ul className="text-sm text-muted">{done.type.models.slice(0, 5).map((m) => <li key={m.qualifiedName} className="py-0.5"><span className="font-medium text-fg">{m.modelName}</span>{m.description ? ` · ${m.description}` : ""}</li>)}</ul>
            </DialogBody>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
              {effectiveShared ? <Button onClick={() => { onOpenChange(false); onOpenProvider?.(done.name); }}>Set a limit</Button> : null}
              <Button
                variant="primary"
                disabled={setDefault.isPending || !done.type.models[0]}
                onClick={async () => {
                  const m = done.type.models[0];
                  try { await setDefault.mutateAsync({ scope: "user", provider: done.name, model: `${done.name}:${m.modelName}` }); toast.success(`New sessions will start on ${m.modelName}.`); onOpenChange(false); } catch { /* toasted */ }
                }}
              >
                {setDefault.isPending ? <Loader2 className="animate-spin" /> : null} Use for my new sessions
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogBody className="flex flex-col gap-5">
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">What are you connecting?</legend>
                {isLoading ? <p className="text-sm text-muted">Loading provider types…</p> : !types?.length ? <p className="text-sm text-muted">This deployment lists no provider types.</p> : (
                  <div role="radiogroup" aria-label="Provider type" className="grid gap-2 sm:grid-cols-2">
                    {types.map((t) => {
                      const selected = t.id === typeId;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          aria-label={`${typeLabel(t.id)}. ${BLURB[t.id] || `${t.models.length} models`}`}
                          onClick={() => { setTypeId(t.id); setApiKey(""); }}
                          className={cn("flex min-h-16 flex-col items-start gap-0.5 rounded-pane border p-2.5 text-left transition-colors duration-(--duration-fast) pointer-coarse:min-h-14", selected ? "border-accent bg-accent-tint" : "border-line hover:border-line-strong hover:bg-raised/60")}
                        >
                          <span className="flex w-full items-center gap-1.5 text-sm font-medium">
                            {t.usesWorkloadIdentity ? <ShieldCheck className="size-3.5 text-muted" aria-hidden /> : <KeyRound className="size-3.5 text-muted" aria-hidden />}
                            {typeLabel(t.id)}
                            {selected ? <Check className="ml-auto size-3.5 text-accent" aria-hidden /> : null}
                          </span>
                          <span className="text-xs text-muted">{BLURB[t.id] || `${t.models.length} models`}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </fieldset>

              {type ? (
                <div className="flex flex-col gap-4 animate-enter">
                  {wi ? (
                    <div className="flex items-start gap-2.5 rounded-pane bg-raised p-3 text-sm text-muted">
                      <Server className="mt-0.5 size-4 shrink-0" aria-hidden />
                      <p>This type signs in as the cluster itself, so there is nothing to paste and it is always shared. {blockedByRole ? <span className="font-medium text-fg">Ask an administrator to add it.</span> : null}</p>
                    </div>
                  ) : (
                    <Field label={KEY_LABEL(type.id)} hint="Stored encrypted and never shown again. You can replace it later without losing history.">
                      <Input type="password" autoComplete="off" spellCheck={false} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={/github/i.test(type.id) ? "ghp_…" : "sk-…"} />
                    </Field>
                  )}

                  {isAdmin && !wi ? (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium">Who can use it?</span>
                      <Segmented label="Who can use it" value={shared ? "shared" : "me"} onChange={(v) => setShared(v === "shared")} options={[{ value: "me", label: <><User /> Just me</> }, { value: "shared", label: <><Users /> Everyone</> }]} />
                      <p className="text-xs text-muted">{shared ? "Anyone here can spend from it. You can set limits, a per-person allowance and holds." : "Billed to this key. Nobody else sees it."}</p>
                    </div>
                  ) : !wi ? <p className="text-xs text-muted">This is a personal provider: only you can see and use it.</p> : null}

                  <Field label="Name" hint={problem ? undefined : "Permanent. Sessions refer to models as name:model."} error={problem}>
                    <Input value={name} onChange={(e) => { setName(e.target.value); setNameEdited(true); }} spellCheck={false} />
                  </Field>

                  {!wi ? (
                    <div>
                      <DisclosureButton aria-expanded={custom} onClick={() => setCustom((v) => !v)} className="text-sm text-muted">
                        <ChevronRight className={cn("size-4 transition-transform duration-(--duration-fast)", custom && "rotate-90")} aria-hidden /> Use a custom endpoint
                      </DisclosureButton>
                      {custom ? <Field label="Endpoint URL" hint="Leave the usual address unless you run a gateway or a regional endpoint." className="mt-2"><Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://" inputMode="url" /></Field> : null}
                    </div>
                  ) : null}

                  <div>
                    <div className="mb-1 text-sm font-medium">Models it adds <Tag>{type.models.length}</Tag></div>
                    <ul className="text-sm text-muted">{type.models.slice(0, 4).map((m) => <li key={m.qualifiedName} className="py-0.5"><span className="text-fg">{m.modelName}</span>{m.description ? ` · ${m.description}` : ""}</li>)}</ul>
                  </div>
                </div>
              ) : null}
            </DialogBody>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
              <Button variant="primary" onClick={submit} disabled={!valid || create.isPending}>{create.isPending ? <Loader2 className="animate-spin" /> : null} Add provider</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
