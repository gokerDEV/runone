import { useCallback, useEffect, useState } from "react";

const USER_ID_KEY = "pwm:userId";
const NICKNAME_KEY = "pwm:nickname";
const CHALLENGE_MSG_KEY = "pwm:challengeMsg";
const GIPHY_URL_KEY = "pwm:giphyUrl";

const DEFAULT_MESSAGES = [
  "You have no chance!",
  "Prepare to be crushed!",
  "Better luck next time!",
  "I'm unstoppable!",
  "Read 'em and weep!",
];

const DEFAULT_GIPHYS = [
  "https://media.giphy.com/media/l41JRsph73VokN6ik/giphy.gif",
  "https://media.giphy.com/media/26FPqAHtgCBzKG9mo/giphy.gif",
  "https://media.giphy.com/media/3o7TKSHA51OjmTGo2Q/giphy.gif",
  "https://media.giphy.com/media/l0HlHFRbmaZtBRhXG/giphy.gif",
];

function randomChoice(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function readProfile(): {
  localUserId: string;
  nickname: string;
  challengeMsg: string;
  giphyUrl: string;
} {
  if (typeof window === "undefined")
    return { localUserId: "", nickname: "", challengeMsg: "", giphyUrl: "" };
  let id = window.localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(USER_ID_KEY, id);
  }

  let challengeMsg = window.localStorage.getItem(CHALLENGE_MSG_KEY);
  if (!challengeMsg) {
    challengeMsg = randomChoice(DEFAULT_MESSAGES);
    window.localStorage.setItem(CHALLENGE_MSG_KEY, challengeMsg);
  }

  let giphyUrl = window.localStorage.getItem(GIPHY_URL_KEY);
  if (!giphyUrl) {
    giphyUrl = randomChoice(DEFAULT_GIPHYS);
    window.localStorage.setItem(GIPHY_URL_KEY, giphyUrl);
  }

  return {
    localUserId: id,
    nickname: window.localStorage.getItem(NICKNAME_KEY) ?? "",
    challengeMsg,
    giphyUrl,
  };
}

export function useLocalProfile() {
  const [profile, setProfile] = useState({
    localUserId: "",
    nickname: "",
    challengeMsg: "",
    giphyUrl: "",
  });

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

  const setChallengeMsg = useCallback((msg: string) => {
    const trimmed = msg.trim().slice(0, 100);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CHALLENGE_MSG_KEY, trimmed);
    }
    setProfile((p) => ({ ...p, challengeMsg: trimmed }));
  }, []);

  const setGiphyUrl = useCallback((url: string) => {
    const trimmed = url.trim();
    if (typeof window !== "undefined") {
      window.localStorage.setItem(GIPHY_URL_KEY, trimmed);
    }
    setProfile((p) => ({ ...p, giphyUrl: trimmed }));
  }, []);

  return {
    ...profile,
    setNickname,
    setChallengeMsg,
    setGiphyUrl,
    ready: profile.localUserId !== "",
  };
}

export const getAvatarInitial = (nickname: string) =>
  (nickname.trim().charAt(0) || "?").toUpperCase();
