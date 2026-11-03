import { ModelPicker } from "@/components/model-picker";
import { Dialog, DialogBody, DialogContent } from "@/components/ui/dialog";
import type { Session } from "@/data/types";

/**
 * The Change model dialog: the title menu's item and the failed-turn Switch model action open it. It is
 * the same picker the composer chip shows, so there is one model picker in the app.
 */
export function ChangeModelDialog({ open, onOpenChange, session }: { open: boolean; onOpenChange: (v: boolean) => void; session: Session }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Change model" description="The next turn uses what you pick. Models the workers can't run are shown but can't be chosen.">
        <DialogBody>
          {open ? <ModelPicker session={session} onApplied={() => onOpenChange(false)} /> : null}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
