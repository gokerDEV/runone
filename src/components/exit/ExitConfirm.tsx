import { Button } from "@/components/ui/button";

export function ExitConfirm({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-6">
      <div className="bg-background rounded-xl p-5 w-full max-w-xs text-center shadow-2xl">
        <h3 className="text-lg font-semibold">Leave match?</h3>
        <p className="text-sm text-muted-foreground mt-1">You will lose this game.</p>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Stay
          </Button>
          <Button variant="destructive" className="flex-1" onClick={onConfirm}>
            Leave and lose
          </Button>
        </div>
      </div>
    </div>
  );
}
