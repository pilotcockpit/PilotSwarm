import * as React from "react";
import { FileArchive, FolderUp, Loader2, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/tabs";
import { Tag } from "@/components/ui/misc";
import { cardVariants } from "@/components/ui/card";
import { type PackageSummary, useUploadPackage } from "@/data/ops/packages";
import { analyzePackage, readDropped, readFileList, readZip, toUploadFiles, type ReadResult } from "./package-source";
import { bytes, cn, plural } from "@/lib/utils";

/**
 * Publish a package in one pass: drop a folder or .zip, read what is in it, see exactly what will
 * be published and what is wrong, choose who can use it, publish. The preview is computed from the
 * files in the browser, so a missing plugin.json or an oversize upload shows before anything is sent.
 */
export function AddPackageDialog({ open, onOpenChange, initial, existing, onPublished }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Files already read, from a drop on the Packages list. */
  initial?: ReadResult | null;
  existing: PackageSummary[];
  onPublished: (packageId?: string) => void;
}) {
  const [result, setResult] = React.useState<ReadResult | null>(null);
  const [reading, setReading] = React.useState(false);
  const [readError, setReadError] = React.useState<string | null>(null);
  const [scope, setScope] = React.useState<"user" | "shared">("user");
  const [over, setOver] = React.useState(false);
  const [serverErrors, setServerErrors] = React.useState<string[]>([]);
  const upload = useUploadPackage();
  const folderRef = React.useRef<HTMLInputElement>(null);
  const zipRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) { setResult(initial ?? null); setReadError(null); setServerErrors([]); setScope("user"); }
  }, [open, initial]);

  const take = async (read: () => Promise<ReadResult>) => {
    setReading(true);
    setReadError(null);
    setServerErrors([]);
    try { setResult(await read()); } catch (e: any) { setReadError(e?.message || "That could not be read."); } finally { setReading(false); }
  };
  const analysis = React.useMemo(() => (result ? analyzePackage(result.files) : null), [result]);
  const errors = analysis?.issues.filter((i) => i.level === "error") ?? [];
  const warnings = analysis?.issues.filter((i) => i.level === "warning") ?? [];

  const sameName = analysis?.name ? existing.filter((p) => p.name === analysis.name) : [];
  const target = sameName.find((p) => p.scope === scope && (scope === "shared" || p.canEdit));
  const sharedElsewhere = scope === "user" ? sameName.find((p) => p.scope === "shared") : undefined;
  const outcome = !analysis?.name ? null
    : target ? (target.active?.semver === analysis.version
      ? { tone: "waiting" as const, text: `${target.name} ${analysis.version} is already published. Raise the version in plugin.json to publish changes.` }
      : { tone: "neutral" as const, text: `This adds ${analysis.version} to your existing ${scope === "shared" ? "shared " : ""}package (now ${target.active?.semver ?? "unversioned"}) and makes it the active version.` })
      : sharedElsewhere ? { tone: "neutral" as const, text: `A shared package named ${analysis.name} exists. Your private copy takes over that name for you only.` }
      : { tone: "neutral" as const, text: scope === "shared" ? "This creates a new shared package." : "This creates a new private package." };

  const publish = async () => {
    if (!result || !analysis) return;
    setServerErrors([]);
    try {
      const r = await upload.mutateAsync({ files: toUploadFiles(result.files), scope, name: analysis.name, semver: analysis.version });
      toast.success(r?.status === "noop" ? "Nothing changed: these files were already published." : `Published ${analysis.name} ${analysis.version}`, { description: r?.status === "noop" ? undefined : "Workers pick it up in about 20 seconds." });
      onPublished(r?.packageId);
      onOpenChange(false);
    } catch (e: any) {
      setServerErrors(String(e?.message || "The server refused the package.").split(/\n|;\s+/).map((l) => l.trim()).filter(Boolean));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !upload.isPending && onOpenChange(v)}>
      <DialogContent title="Add a package" description="Give agents new skills, tools and workflows. Workers install it within about 20 seconds." side="right">
        <DialogBody className="flex flex-col gap-4">
          {!result ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setOver(true); }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => { e.preventDefault(); setOver(false); void take(() => readDropped(e.dataTransfer.items, e.dataTransfer.files)); }}
              className={cn("flex flex-col items-center gap-3 rounded-pane px-6 py-10 text-center transition-colors duration-(--duration-fast)", over ? "bg-accent-tint" : "bg-raised")}
            >
              {reading ? <Loader2 className="size-6 animate-spin text-muted" aria-hidden /> : <Upload className="size-6 text-muted" aria-hidden />}
              <div>
                <p className="text-base font-semibold">{reading ? "Reading the package" : "Drop a package folder or .zip here"}</p>
                <p className="mt-1 text-sm text-muted">It needs a plugin.json at the top that names it and gives its version. Up to 2 MB.</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => folderRef.current?.click()} disabled={reading}><FolderUp /> Choose folder</Button>
                <Button onClick={() => zipRef.current?.click()} disabled={reading}><FileArchive /> Choose .zip</Button>
              </div>
              <input ref={folderRef} type="file" className="sr-only" tabIndex={-1} aria-label="Choose a package folder" {...({ webkitdirectory: "", directory: "" } as any)} onChange={(e) => { const l = e.target.files; if (l?.length) void take(() => readFileList(l)); e.target.value = ""; }} />
              <input ref={zipRef} type="file" accept=".zip,application/zip" className="sr-only" tabIndex={-1} aria-label="Choose a package .zip" onChange={(e) => { const f = e.target.files?.[0]; if (f) void take(() => readZip(f)); e.target.value = ""; }} />
              {readError ? <p role="alert" className="text-sm text-failed">{readError}</p> : null}
            </div>
          ) : analysis ? (
            <>
              <div>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <h3 className="text-lg font-semibold">{analysis.name ?? "Unnamed package"}</h3>
                  {analysis.version ? <span className="font-mono text-sm text-muted">{analysis.version}</span> : null}
                </div>
                {analysis.description ? <p className="mt-0.5 text-sm text-muted">{analysis.description}</p> : null}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {analysis.agents.length ? <Tag>{plural(analysis.agents.length, "agent")}</Tag> : null}
                  {analysis.skills.length ? <Tag>{plural(analysis.skills.length, "skill")}</Tag> : null}
                  {analysis.tools ? <Tag>Worker tools</Tag> : null}
                  {analysis.mcp ? <Tag>MCP servers</Tag> : null}
                </div>
                {analysis.agents.length ? <p className="mt-2 text-sm text-muted">Agents: {analysis.agents.join(", ")}</p> : null}
                <p className="mt-2 text-xs text-muted">{plural(analysis.fileCount, "file")} · {bytes(analysis.totalBytes)}{result.skipped ? ` · left out ${plural(result.skipped, "file")} that never belong in a package (.git, node_modules)` : ""}</p>
              </div>

              {errors.length ? (
                <div role="alert" className={cn(cardVariants({ tone: "failed" }), "p-3 text-sm")}>
                  <p className="flex items-center gap-1.5 font-semibold"><TriangleAlert className="size-4 text-failed" aria-hidden /> Fix this before publishing</p>
                  <ul className="mt-1.5 list-disc pl-5">{errors.map((i, n) => <li key={n}>{i.file ? <span className="font-mono text-xs">{i.file}: </span> : null}{i.message}</li>)}</ul>
                </div>
              ) : null}
              {warnings.length ? <ul className="list-disc pl-5 text-sm text-muted">{warnings.map((i, n) => <li key={n}>{i.message}</li>)}</ul> : null}

              <div>
                <p className="mb-1.5 text-sm font-medium">Who can use it</p>
                <Segmented label="Who can use this package" value={scope} onChange={setScope} options={[{ value: "user", label: "Only me" }, { value: "shared", label: "Everyone" }]} />
                <p className="mt-1.5 text-sm text-muted">{scope === "user" ? "Only your sessions see these agents. You can share it later." : "Everyone in this deployment can start its agents and read its files."}</p>
                {outcome ? <p className={cn("mt-2 text-sm", outcome.tone === "waiting" ? "text-waiting" : "text-fg")}>{outcome.text}</p> : null}
              </div>

              {serverErrors.length ? (
                <div role="alert" className={cn(cardVariants({ tone: "failed" }), "p-3 text-sm")}>
                  <p className="font-semibold">The server did not publish it</p>
                  <ul className="mt-1.5 list-disc pl-5">{serverErrors.map((l, n) => <li key={n}>{l}</li>)}</ul>
                </div>
              ) : null}
            </>
          ) : null}
        </DialogBody>
        <DialogFooter>
          {result ? <Button variant="quiet" className="mr-auto" onClick={() => { setResult(null); setServerErrors([]); }} disabled={upload.isPending}>Choose a different package</Button> : null}
          <Button onClick={() => onOpenChange(false)} disabled={upload.isPending}>Cancel</Button>
          {result && analysis ? (
            <Button variant="primary" onClick={publish} disabled={errors.length > 0 || upload.isPending}>
              {upload.isPending ? <Loader2 className="animate-spin" /> : null} Publish{analysis.name && analysis.version ? ` ${analysis.name} ${analysis.version}` : ""}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
