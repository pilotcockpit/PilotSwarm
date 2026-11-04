import { test } from "node:test";
import assert from "node:assert/strict";
import { copilotChatLiveSettings } from "../local/copilot-chat-live-policy.js";

test("the shared live-model flag cannot enable Copilot chat inference", () => {
    assert.deepEqual(copilotChatLiveSettings({ PILOTSWARM_LIVE_MODEL_TESTS: "1" }), { enabled: false, model: "" });
});
test("the dedicated opt-in requires an explicit model", () => {
    assert.throws(() => copilotChatLiveSettings({ PILOTSWARM_LIVE_COPILOT_CHAT_TESTS: "1" }), /explicitly/);
});
test("the dedicated opt-in accepts an explicit non-Google model without making a request", () => {
    assert.deepEqual(copilotChatLiveSettings({ PILOTSWARM_LIVE_COPILOT_CHAT_TESTS: "1", PILOTSWARM_COPILOT_CHAT_MODEL: "gpt-5.6" }), { enabled: true, model: "gpt-5.6" });
});
for (const model of ["gemini-4-argon", "github-copilot:Gemini-preview", "google/model", "GEMINI_FLASH"]) {
    test(`the live gate refuses ${model} before inference setup`, () => {
        assert.throws(() => copilotChatLiveSettings({ PILOTSWARM_LIVE_COPILOT_CHAT_TESTS: "1", PILOTSWARM_COPILOT_CHAT_MODEL: model }), /prohibited/);
    });
}
