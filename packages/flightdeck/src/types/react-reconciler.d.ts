// Tests render real components with a tiny custom renderer (src/test/render.ts); the package ships no types.
declare module "react-reconciler" {
  const createReconciler: (config: any) => any;
  export default createReconciler;
}
declare module "react-reconciler/constants.js" {
  export const DefaultEventPriority: number;
  export const NoEventPriority: number;
  export const ConcurrentRoot: number;
}
