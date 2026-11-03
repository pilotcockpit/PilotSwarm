// Importing this registers every `*.demo.ts` fixture file in the folder.
import.meta.glob("./*.demo.ts", { eager: true });
export { callDemoOp, registerDemoOps } from "./registry";
