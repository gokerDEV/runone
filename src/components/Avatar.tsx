import { getAvatarInitial } from "@/lib/profile/useLocalProfile";

export type ConnStatus = "connected" | "disconnected" | "waiting";

export function Avatar({
  nickname,
  size = "md",
  tone = "host",
  status,
}: {
  nickname: string;
  size?: "sm" | "md" | "lg";
  tone?: "host" | "player";
  status?: ConnStatus;
}) {
  const sizeCls = size === "lg" ? "h-14 w-14 text-2xl" : size === "sm" ? "h-8 w-8 text-sm" : "h-12 w-12 text-xl";
  const bg = tone === "host" ? "bg-indigo-500" : "bg-rose-500";
  const ringCls =
    status === "connected"
      ? "ring-2 ring-green-500 ring-offset-2 ring-offset-background"
      : status === "disconnected"
      ? "ring-2 ring-red-500 ring-offset-2 ring-offset-background animate-pulse"
      : status === "waiting"
      ? "ring-2 ring-neutral-400 ring-offset-2 ring-offset-background"
      : "";
  const dotColor =
    status === "connected" ? "bg-green-500" : status === "disconnected" ? "bg-red-500" : status === "waiting" ? "bg-neutral-400" : "";
  return (
    <div className="relative inline-block">
      <div
        className={`${sizeCls} ${bg} ${ringCls} rounded-full flex items-center justify-center text-white font-bold shadow transition-all`}
      >
        {getAvatarInitial(nickname)}
      </div>
      {status && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${dotColor}`}
          aria-label={status}
        />
      )}
    </div>
  );
}
