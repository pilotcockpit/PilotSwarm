// The portal server rebuilds sendAnswer's options field by field (the caller
// may not set `sender`). A strict answer is only strict if the server forwards
// `requireQuestionMatch` to the management client, and only when it is
// literally true, so a malformed value never turns the lenient path off.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RUNTIME = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "runtime.js"), "utf8");

test("the sendAnswer handler forwards requireQuestionMatch only when it is exactly true", () => {
    const start = RUNTIME.indexOf('case "sendAnswer":');
    assert.ok(start >= 0);
    const block = RUNTIME.slice(start, RUNTIME.indexOf('case "sendSessionEvent"', start));
    assert.match(block, /requireQuestionMatch === true \? \{ requireQuestionMatch: true \} : \{\}/);
    assert.match(block, /sender: this\._buildSender\(/, "the server still stamps the sender");
});
