/** Explicit, suite-specific opt-in. Never inherit another live suite's flag. */
export function copilotChatLiveSettings(environment) {
    const enabled = environment.PILOTSWARM_LIVE_COPILOT_CHAT_TESTS === "1";
    if (!enabled) return { enabled: false, model: "" };
    const model = String(environment.PILOTSWARM_COPILOT_CHAT_MODEL || "").trim();
    if (!model) throw new Error("Set PILOTSWARM_COPILOT_CHAT_MODEL explicitly for the opted-in Copilot chat test");
    // Owner policy also covers a Gemini model reached through another
    // provider's endpoint. No credentials or requests are needed to reject it.
    if (/gemini|google/i.test(model)) throw new Error("Gemini/Google model calls are prohibited by owner policy");
    return { enabled: true, model };
}
