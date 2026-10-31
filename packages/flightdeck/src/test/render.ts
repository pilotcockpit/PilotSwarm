import * as React from "react";
import createReconciler from "react-reconciler";
import { ConcurrentRoot, DefaultEventPriority, NoEventPriority } from "react-reconciler/constants.js";

// A small renderer for tests: real React, real hooks and effects, real components, with the host tree
// kept as plain objects instead of a DOM. No browser is needed, and nothing is mocked on the React side.
// Components are found by their host element (button, input, ...) and their props, and "events" are the
// handlers the component passed down, called the way React would.

export interface HostNode { type: string; props: Record<string, any>; children: Array<HostNode | HostText>; parent: HostNode | null }
export interface HostText { type: "#text"; text: string; parent: HostNode | null }
type Child = HostNode | HostText;

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const remove = (parent: HostNode, child: Child) => { parent.children = parent.children.filter((c) => c !== child); child.parent = null; };
const append = (parent: HostNode, child: Child) => { remove(parent, child); parent.children.push(child); child.parent = parent; };
const insertBefore = (parent: HostNode, child: Child, before: Child) => { remove(parent, child); const i = parent.children.indexOf(before); parent.children.splice(i < 0 ? parent.children.length : i, 0, child); child.parent = parent; };

let priority = NoEventPriority;
const reconciler = createReconciler({
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  isPrimaryRenderer: true,
  getRootHostContext: () => ({}),
  getChildHostContext: (ctx: any) => ctx,
  prepareForCommit: () => null,
  resetAfterCommit() {},
  preparePortalMount() {},
  clearContainer(root: HostNode) { root.children = []; },
  shouldSetTextContent: () => false,
  createInstance: (type: string, props: Record<string, any>): HostNode => ({ type, props, children: [], parent: null }),
  createTextInstance: (text: string): HostText => ({ type: "#text", text, parent: null }),
  appendInitialChild: append,
  appendChild: append,
  appendChildToContainer: append,
  insertBefore,
  insertInContainerBefore: insertBefore,
  removeChild: remove,
  removeChildFromContainer: remove,
  finalizeInitialChildren: () => false,
  commitUpdate(node: HostNode, _type: string, _old: any, next: Record<string, any>) { node.props = next; },
  commitTextUpdate(node: HostText, _old: string, text: string) { node.text = text; },
  hideInstance() {}, unhideInstance() {}, hideTextInstance() {}, unhideTextInstance() {},
  getPublicInstance: (i: unknown) => i,
  detachDeletedInstance() {},
  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,
  noTimeout: -1,
  supportsMicrotasks: true,
  scheduleMicrotask: queueMicrotask,
  setCurrentUpdatePriority(p: number) { priority = p; },
  getCurrentUpdatePriority: () => priority,
  resolveUpdatePriority: () => (priority !== NoEventPriority ? priority : DefaultEventPriority),
  maySuspendCommit: () => false,
  NotPendingTransition: null,
  HostTransitionContext: React.createContext(null),
  resetFormInstance() {},
  requestPostPaintCallback() {},
  shouldAttemptEagerTransition: () => false,
  trackSchedulerEvent() {},
  resolveEventType: () => null,
  resolveEventTimeStamp: () => -1.1,
  preloadInstance: () => true,
  startSuspendingCommit() {},
  suspendInstance() {},
  waitForCommitToBeReady: () => null,
});

const textOf = (n: Child): string => (n.type === "#text" ? (n as HostText).text : (n as HostNode).children.map(textOf).join(""));
const walk = (n: Child, visit: (n: HostNode) => void) => { if (n.type === "#text") return; visit(n as HostNode); (n as HostNode).children.forEach((c) => walk(c, visit)); };

export interface Rendered {
  root: HostNode;
  /** All host elements matching, in document order. */
  findAll(match: (n: HostNode) => boolean): HostNode[];
  find(match: (n: HostNode) => boolean): HostNode;
  text(node?: HostNode): string;
  /** Call a handler the component passed to a host element, inside act. */
  fire(node: HostNode, handler: string, event?: unknown): Promise<void>;
  /** Let queued work (effects, promises, timers) settle. */
  flush(times?: number): Promise<void>;
  rerender(element: React.ReactElement): Promise<void>;
  unmount(): Promise<void>;
}

export async function act<T>(fn: () => T | Promise<T>): Promise<void> { await (React as any).act(async () => { await fn(); }); }

export async function render(element: React.ReactElement): Promise<Rendered> {
  const root: HostNode = { type: "#root", props: {}, children: [], parent: null };
  const fail = (e: unknown) => { throw e; };
  const container = reconciler.createContainer(root, ConcurrentRoot, null, false, null, "", fail, fail, fail, null, null);
  await act(() => reconciler.updateContainer(element, container, null, null));
  const api: Rendered = {
    root,
    findAll: (match) => { const out: HostNode[] = []; walk(root, (n) => { if (match(n)) out.push(n); }); return out; },
    find(match) { const all = api.findAll(match); if (!all.length) throw new Error("No matching element in the rendered tree:\n" + api.text()); return all[0]; },
    text: (node) => textOf(node ?? root),
    async fire(node, handler, event = { preventDefault() {}, stopPropagation() {} }) {
      const fn = node.props[handler];
      if (typeof fn !== "function") throw new Error(`<${node.type}> has no ${handler} handler`);
      await act(() => fn(event));
    },
    async flush(times = 6) { for (let i = 0; i < times; i++) await act(() => new Promise<void>((r) => setTimeout(r, 0))); },
    async rerender(el) { await act(() => reconciler.updateContainer(el, container, null, null)); },
    async unmount() { await act(() => reconciler.updateContainer(null, container, null, null)); },
  };
  return api;
}
