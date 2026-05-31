// Client-side 9:16 video exporter using offscreen canvas + MediaRecorder.
import type { GameSession, PlayerRole, SymbolMark } from "@/lib/games/tictactoe/types";

const W = 1080;
const H = 1920;

type ReplayMove = { role: PlayerRole; symbol: SymbolMark; cellIndex: number };

export type ExportOptions = {
  session: GameSession;
  moves: ReplayMove[];
  winnerMessage: string;
  loserMessage: string;
};

function pickMime(): { mime: string; ext: string } {
  const candidates: Array<[string, string]> = [
    ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "mp4"],
    ["video/mp4", "mp4"],
    ["video/webm;codecs=vp9,opus", "webm"],
    ["video/webm;codecs=vp8,opus", "webm"],
    ["video/webm", "webm"],
  ];
  for (const [mime, ext] of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) {
      return { mime, ext };
    }
  }
  return { mime: "video/webm", ext: "webm" };
}

function drawBg(ctx: CanvasRenderingContext2D) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#0f172a");
  grad.addColorStop(1, "#1e1b4b");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function drawHeader(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "bold 48px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("play.withme", 60, 60);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "500 36px Inter, system-ui, sans-serif";
  ctx.fillText("· Tic Tac Toe", 360, 72);
}

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  letter: string,
  nickname: string,
  cx: number,
  cy: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 64px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, cx, cy + 4);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "600 36px Inter, system-ui, sans-serif";
  ctx.fillText(nickname.slice(0, 14), cx, cy + 110);
}

function drawPlayers(ctx: CanvasRenderingContext2D, session: GameSession) {
  drawAvatar(ctx, (session.host.nickname[0] ?? "?").toUpperCase(), session.host.nickname, 260, 280, "#6366f1");
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "700 56px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("VS", W / 2, 280);
  drawAvatar(
    ctx,
    (session.player?.nickname[0] ?? "?").toUpperCase(),
    session.player?.nickname ?? "—",
    W - 260,
    280,
    "#f43f5e",
  );
}

function drawBoard(
  ctx: CanvasRenderingContext2D,
  board: Array<SymbolMark | null>,
  winningLine?: number[],
) {
  const size = 720;
  const x0 = (W - size) / 2;
  const y0 = 700;
  const cell = size / 3;
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(x0, y0, size, size);
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 6;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x0 + i * cell, y0);
    ctx.lineTo(x0 + i * cell, y0 + size);
    ctx.moveTo(x0, y0 + i * cell);
    ctx.lineTo(x0 + size, y0 + i * cell);
    ctx.stroke();
  }
  ctx.font = "bold 200px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < 9; i++) {
    const cx = x0 + (i % 3) * cell + cell / 2;
    const cy = y0 + Math.floor(i / 3) * cell + cell / 2;
    const v = board[i];
    if (!v) continue;
    ctx.fillStyle = v === "X" ? "#818cf8" : "#fb7185";
    ctx.fillText(v, cx, cy + 8);
  }
  if (winningLine && winningLine.length === 3) {
    const [a, , c] = winningLine;
    const ax = x0 + (a % 3) * cell + cell / 2;
    const ay = y0 + Math.floor(a / 3) * cell + cell / 2;
    const cx = x0 + (c % 3) * cell + cell / 2;
    const cy = y0 + Math.floor(c / 3) * cell + cell / 2;
    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = 16;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(cx, cy);
    ctx.stroke();
  }
}

function drawMessage(ctx: CanvasRenderingContext2D, message: string, color: string) {
  if (!message) return;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(40, 1500, W - 80, 220);
  ctx.fillStyle = color;
  ctx.font = "bold 56px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`"${message}"`, W / 2, 1610);
}

function drawEndScreen(ctx: CanvasRenderingContext2D, alpha: number) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.fillRect(0, 0, W, H);
  if (alpha > 0.85) {
    ctx.fillStyle = "#fff";
    ctx.font = "bold 120px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("play.withme", W / 2, H / 2 - 60);
    ctx.font = "500 48px Inter, system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText("Play with ME", W / 2, H / 2 + 40);
  }
}

export async function exportReplayVideo(opts: ExportOptions): Promise<{ blob: Blob; ext: string }> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");

  const { mime, ext } = pickMime();
  const stream = canvas.captureStream(30);
  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  const done = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });
  recorder.start();

  // Total duration ~14s
  const SCENE_OPEN = 2500;
  const PER_MOVE = Math.max(500, Math.min(1100, Math.floor(10_000 / Math.max(1, opts.moves.length))));
  const REPLAY = opts.moves.length * PER_MOVE;
  const SCENE_LOSER = 2500;
  const SCENE_END = 1800;
  const total = SCENE_OPEN + REPLAY + SCENE_LOSER + SCENE_END;
  const start = performance.now();

  await new Promise<void>((resolve) => {
    const loop = () => {
      const t = performance.now() - start;
      drawBg(ctx);
      drawHeader(ctx);
      drawPlayers(ctx, opts.session);

      // Board state derived from elapsed replay time
      let revealed = 0;
      let winLine: number[] | undefined;
      if (t > SCENE_OPEN) {
        revealed = Math.min(opts.moves.length, Math.floor((t - SCENE_OPEN) / PER_MOVE));
      }
      const board: Array<SymbolMark | null> = Array(9).fill(null);
      for (let i = 0; i < revealed; i++) {
        const m = opts.moves[i];
        board[m.cellIndex] = m.symbol;
      }
      if (revealed === opts.moves.length) winLine = opts.session.result?.winningLine;
      drawBoard(ctx, board, winLine);

      if (t < SCENE_OPEN) {
        drawMessage(ctx, opts.winnerMessage, "#a5b4fc");
      } else if (t < SCENE_OPEN + REPLAY) {
        // mid-game: no message
      } else if (t < SCENE_OPEN + REPLAY + SCENE_LOSER) {
        drawMessage(ctx, opts.loserMessage, "#fda4af");
      } else {
        const endT = t - (SCENE_OPEN + REPLAY + SCENE_LOSER);
        const alpha = Math.min(1, endT / 700);
        drawEndScreen(ctx, alpha);
      }

      if (t < total) {
        requestAnimationFrame(loop);
      } else {
        resolve();
      }
    };
    requestAnimationFrame(loop);
  });

  recorder.stop();
  await done;
  const blob = new Blob(chunks, { type: mime });
  return { blob, ext };
}
