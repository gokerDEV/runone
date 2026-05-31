import type { ReactNode } from "react";

/**
 * Fixed 9:16 vertical frame, centered on viewport. Used on desktop and mobile.
 */
export function GameFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center p-2 sm:p-4">
      <div
        className="bg-background text-foreground shadow-xl rounded-2xl overflow-hidden flex flex-col relative"
        style={{
          aspectRatio: "9 / 16",
          height: "min(100dvh - 16px, 900px)",
          maxWidth: "100vw",
        }}
      >
        {children}
      </div>
    </div>
  );
}
