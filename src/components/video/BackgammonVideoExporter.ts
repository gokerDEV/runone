// 9:16 backgammon replay exporter — snapshot-driven.
import type { BgSession } from "@/lib/games/backgammon/types";
import type { BgState } from "@/lib/games/backgammon/types";

const W = 1080;
const H = 1920;

export type BgExportOptions = {
  session: BgSession;
  snapshots: BgState[];
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
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#1a0f04");
  g.addColorStop(1, "#3b1e09");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawHeader(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "bold 48px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("play.withme", 60, 60);
  ctx.fillStyle = "rgba(255,200,120,0.7)";
  ctx.font = "500 36px Inter, system-ui, sans-serif";
  ctx.fillText("· Backgammon", 360, 72);
}

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  letter: string,
  nickname: string,
  cx: number,
  cy: number,
  color: string,
  label: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, 64, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 56px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, cx, cy + 4);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "600 32px Inter, system-ui, sans-serif";
  ctx.fillText(nickname.slice(0, 14), cx, cy + 100);
  ctx.fillStyle = "rgba(255,200,120,0.7)";
  ctx.font = "500 22px Inter, system-ui, sans-serif";
  ctx.fillText(label, cx, cy + 140);
}

function drawPlayers(ctx: CanvasRenderingContext2D, session: BgSession) {
  drawAvatar(
    ctx,
    (session.host.nickname[0] ?? "?").toUpperCase(),
    session.host.nickname,
    230,
    270,
    "#e5e7eb",
    "WHITE",
  );
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "700 56px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("VS", W / 2, 270);
  drawAvatar(
    ctx,
    (session.player?.nickname[0] ?? "?").toUpperCase(),
    session.player?.nickname ?? "—",
    W - 230,
    270,
    "#1f2937",
    "BLACK",
  );
}

function drawChecker(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: "white" | "black",
) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = color === "white" ? "#f5f5f4" : "#0c0a09";
  ctx.fill();
  ctx.strokeStyle = color === "white" ? "#a8a29e" : "#44403c";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawBoard(ctx: CanvasRenderingContext2D, state: BgState) {
  const x0 = 60;
  const y0 = 560;
  const boardW = W - 120;
  const boardH = 900;
  const barW = 50;
  const sideW = (boardW - barW) / 2;
  const pointW = sideW / 6;
  const pointH = 380;

  // Frame
  ctx.fillStyle = "#3b1e09";
  ctx.fillRect(x0, y0, boardW, boardH);
  ctx.strokeStyle = "#78350f";
  ctx.lineWidth = 6;
  ctx.strokeRect(x0, y0, boardW, boardH);

  // Center bar
  const barX = x0 + sideW;
  ctx.fillStyle = "#1c0a02";
  ctx.fillRect(barX, y0, barW, boardH);

  // Helper to get point coordinates given index 0..23
  // Top row: indices 12..23 (left -> right). Bottom row: indices 11..0 (left -> right).
  function pointRect(idx: number) {
    const top = idx >= 12;
    let col: number;
    if (top)
      col = idx - 12; // 0..11
    else col = 11 - idx; // 0..11
    const leftHalf = col < 6;
    const colInHalf = leftHalf ? col : col - 6;
    const px = x0 + colInHalf * pointW + (leftHalf ? 0 : sideW + barW);
    const py = top ? y0 : y0 + boardH - pointH;
    return { px, py, top };
  }

  // Draw triangle points
  for (let idx = 0; idx < 24; idx++) {
    const { px, py, top } = pointRect(idx);
    const dark = idx % 2 === 0;
    ctx.fillStyle = dark ? "#92400e" : "#451a03";
    ctx.beginPath();
    if (top) {
      ctx.moveTo(px, py);
      ctx.lineTo(px + pointW, py);
      ctx.lineTo(px + pointW / 2, py + pointH);
    } else {
      ctx.moveTo(px, py + pointH);
      ctx.lineTo(px + pointW, py + pointH);
      ctx.lineTo(px + pointW / 2, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Draw checkers per point
  const cr = pointW / 2 - 4;
  for (let idx = 0; idx < 24; idx++) {
    const p = state.points[idx];
    if (!p.color || p.count === 0) continue;
    const { px, py, top } = pointRect(idx);
    const max = Math.min(p.count, 5);
    for (let i = 0; i < max; i++) {
      const cy = top ? py + cr + i * (cr * 2 + 2) : py + pointH - cr - i * (cr * 2 + 2);
      drawChecker(ctx, px + pointW / 2, cy, cr, p.color);
    }
    if (p.count > 5) {
      ctx.fillStyle = "#fff";
      ctx.font = "bold 26px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const cy = top ? py + cr + 4 * (cr * 2 + 2) : py + pointH - cr - 4 * (cr * 2 + 2);
      ctx.fillText(String(p.count), px + pointW / 2, cy);
    }
  }

  // Bar checkers
  const barCx = barX + barW / 2;
  for (let i = 0; i < Math.min(state.bar.white, 4); i++) {
    drawChecker(ctx, barCx, y0 + boardH - 40 - i * (cr * 2 + 2), cr - 2, "white");
  }
  for (let i = 0; i < Math.min(state.bar.black, 4); i++) {
    drawChecker(ctx, barCx, y0 + 40 + i * (cr * 2 + 2), cr - 2, "black");
  }
  if (state.bar.white > 4) {
    ctx.fillStyle = "#0c0a09";
    ctx.font = "bold 22px Inter";
    ctx.textAlign = "center";
    ctx.fillText(`x${state.bar.white}`, barCx, y0 + boardH - 20);
  }
  if (state.bar.black > 4) {
    ctx.fillStyle = "#fff";
    ctx.font = "bold 22px Inter";
    ctx.textAlign = "center";
    ctx.fillText(`x${state.bar.black}`, barCx, y0 + 20);
  }

  // Dice
  if (state.dice.length > 0) {
    const dx = W / 2 - (state.dice.length * 70) / 2;
    state.dice.forEach((d, i) => {
      const x = dx + i * 70;
      const y = y0 + boardH / 2 - 30;
      ctx.fillStyle = "#fff";
      ctx.fillRect(x, y, 60, 60);
      ctx.strokeStyle = "#0c0a09";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, 60, 60);
      ctx.fillStyle = "#0c0a09";
      ctx.font = "bold 40px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(d), x + 30, y + 32);
    });
  }

  // Off / cube info
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "600 26px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`Off W: ${state.off.white}   Off B: ${state.off.black}`, x0, y0 + boardH + 16);
  ctx.textAlign = "right";
  ctx.fillText(
    `Cube ${state.cube.value}×   Turn: ${state.turn.toUpperCase()}`,
    x0 + boardW,
    y0 + boardH + 16,
  );
}

function drawMessage(ctx: CanvasRenderingContext2D, message: string, color: string) {
  if (!message) return;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(40, 1700, W - 80, 160);
  ctx.fillStyle = color;
  ctx.font = "bold 52px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`"${message}"`, W / 2, 1780);
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
    ctx.fillStyle = "rgba(255,200,120,0.85)";
    ctx.fillText("Play with ME", W / 2, H / 2 + 40);
  }
}

export async function exportBackgammonVideo(
  opts: BgExportOptions,
): Promise<{ blob: Blob; ext: string }> {
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

  const SCENE_OPEN = 2200;
  const snaps = opts.snapshots.length > 0 ? opts.snapshots : [opts.session.state];
  const PER_SNAP = Math.max(220, Math.min(600, Math.floor(10_000 / snaps.length)));
  const REPLAY = snaps.length * PER_SNAP;
  const SCENE_LOSER = 2200;
  const SCENE_END = 1800;
  const total = SCENE_OPEN + REPLAY + SCENE_LOSER + SCENE_END;
  const start = performance.now();

  await new Promise<void>((resolve) => {
    const loop = () => {
      const t = performance.now() - start;
      drawBg(ctx);
      drawHeader(ctx);
      drawPlayers(ctx, opts.session);

      let idx = 0;
      if (t > SCENE_OPEN) {
        idx = Math.min(snaps.length - 1, Math.floor((t - SCENE_OPEN) / PER_SNAP));
      }
      drawBoard(ctx, snaps[idx]);

      if (t < SCENE_OPEN) {
        drawMessage(ctx, opts.winnerMessage, "#fde68a");
      } else if (t < SCENE_OPEN + REPLAY) {
        // mid-game: no message
      } else if (t < SCENE_OPEN + REPLAY + SCENE_LOSER) {
        drawMessage(ctx, opts.loserMessage, "#fda4af");
      } else {
        const endT = t - (SCENE_OPEN + REPLAY + SCENE_LOSER);
        const alpha = Math.min(1, endT / 700);
        drawEndScreen(ctx, alpha);
      }

      if (t < total) requestAnimationFrame(loop);
      else resolve();
    };
    requestAnimationFrame(loop);
  });

  recorder.stop();
  await done;
  const blob = new Blob(chunks, { type: mime });
  return { blob, ext };
}
