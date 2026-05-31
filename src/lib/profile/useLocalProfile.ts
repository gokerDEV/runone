import { useCallback, useEffect, useState } from "react";

const USER_ID_KEY = "pwm:userId";
const NICKNAME_KEY = "pwm:nickname";

function readProfile(): { localUserId: string; nickname: string } {
  if (typeof window === "undefined") return { localUserId: "", nickname: "" };
  let id = window.localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`);
    window.localStorage.setItem(USER_ID_KEY, id);
  }
  return {
    localUserId: id,
    nickname: window.localStorage.getItem(NICKNAME_KEY) ?? "",
  };
}

export function useLocalProfile() {
  const [profile, setProfile] = useState({ localUserId: "", nickname: "" });

  useEffect(() => {
    setProfile(readProfile());
  }, []);

  const setNickname = useCallback((nickname: string) => {
    const trimmed = nickname.trim().slice(0, 24);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(NICKNAME_KEY, trimmed);
    }
    setProfile((p) => ({ ...p, nickname: trimmed }));
  }, []);

  return { ...profile, setNickname, ready: profile.localUserId !== "" };
}

export const getAvatarInitial = (nickname: string) =>
  (nickname.trim().charAt(0) || "?").toUpperCase();
