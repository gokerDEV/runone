export function AdSlot({
  label = "Your ad here",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border bg-muted/40 rounded-md ${className}`}
    >
      {label}
    </div>
  );
}
