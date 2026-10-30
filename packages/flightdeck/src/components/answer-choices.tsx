import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isDestructiveChoice, questionKey, recommendedChoice } from "@/data/state";
import type { PendingQuestion } from "@/data/types";

/**
 * The one way to answer an agent's question from a list, a tile or the chat: its choices as
 * buttons, a single policy for choices that sound destructive (ask once more), and a "sent"
 * state while the agent catches up.
 *
 * The answer is sent together with the question it answers, captured when the buttons were
 * drawn, so a question that changes under the cursor can never receive the old choice. Local
 * state is keyed by session and question identity: a new question starts clean.
 *
 * Only a choice the agent marked as its default is styled primary.
 */
export function AnswerChoices({
  sessionId,
  question,
  onAnswer,
  size = "sm",
  busy,
  extra,
  className,
}: {
  sessionId: string;
  question: PendingQuestion;
  /** Sends the choice for exactly this question. Throw to report failure; the control resets. */
  onAnswer: (choice: string, question: PendingQuestion) => void | Promise<void>;
  size?: "sm" | "md";
  busy?: boolean;
  /** Buttons that sit after the choices, such as "Reply…". Hidden while confirming or sent. */
  extra?: React.ReactNode;
  className?: string;
}) {
  return <Inner key={questionKey(sessionId, question)} question={question} onAnswer={onAnswer} size={size} busy={busy} extra={extra} className={className} />;
}

function Inner({ question, onAnswer, size, busy, extra, className }: Omit<React.ComponentProps<typeof AnswerChoices>, "sessionId">) {
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState<string | null>(null);
  const choices = Array.isArray(question.choices) ? question.choices : [];
  const recommended = recommendedChoice(question, choices);
  const send = async (choice: string) => {
    setConfirming(null);
    setSent(choice);
    try {
      await onAnswer(choice, question);
    } catch (e: any) {
      setSent(null);
      toast.error("Couldn't send the answer", { description: e?.message });
    }
  };
  const row = `flex flex-wrap items-center gap-1.5 ${className || ""}`;
  if (confirming) {
    return (
      <div role="group" aria-label="Confirm your answer" className={row}>
        <span className="text-sm">Send “{confirming}”? The agent acts on it right away.</span>
        <Button size={size} variant="danger" disabled={busy} onClick={() => send(confirming)}>Send</Button>
        <Button size={size} variant="quiet" onClick={() => setConfirming(null)}>Back</Button>
      </div>
    );
  }
  if (sent) return <p role="status" className={`text-sm text-muted ${className || ""}`}>Sent “{sent}”. Waiting for the agent…</p>;
  return (
    <div className={row}>
      {choices.map((c) => (
        <Button key={c} size={size} variant={c === recommended ? "primary" : "default"} disabled={busy} onClick={() => (isDestructiveChoice(c) ? setConfirming(c) : send(c))}>
          {c}
          {c === recommended ? <span className="sr-only"> (recommended)</span> : null}
        </Button>
      ))}
      {extra}
    </div>
  );
}
