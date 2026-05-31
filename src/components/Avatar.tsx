import { getAvatarInitial } from "@/lib/profile/useLocalProfile";

export function Avatar({
  nickname,
  size = "md",
  tone = "host",
}: {
  nickname: string;
  size?: "sm" | "md" | "lg";
  tone?: "host" | "player";
}) {
  const sizeCls = size === "lg" ? "h-14 w-14 text-2xl" : size === "sm" ? "h-8 w-8 text-sm" : "h-12 w-12 text-xl";
  const bg = tone === "host" ? "bg-indigo-500" : "bg-rose-500";
  return (
    <div className={`${sizeCls} ${bg} rounded-full flex items-center justify-center text-white font-bold shadow`}>
      {getAvatarInitial(nickname)}
    </div>
  );
}
