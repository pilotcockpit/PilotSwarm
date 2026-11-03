export declare const SANDBOXED_FRAME_SANDBOX: string;
export declare const EXTERNAL_LINK_MESSAGE: string;
export declare const PORTAL_SHELL_HEADERS: Readonly<Record<string, string>>;
export declare function wrapSandboxedDocument(html: string, options?: { panelKeys?: boolean }): string;
/** The wrapper without any script, for frames that only read. */
export declare function wrapReadOnlyDocument(html: string): string;
export declare function normalizeExternalLink(href: unknown): string | null;
