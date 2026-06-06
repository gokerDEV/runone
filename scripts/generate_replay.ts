import {
  startingState,
  rollDice,
  legalMoves,
  applyMove,
  endTurn,
} from "../src/lib/games/backgammon/engine";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let state = startingState();
const events: Record<string, unknown>[] = [];

while (!state.winner) {
  // Roll dice
  state = rollDice(state);
  events.push({ type: "roll", color: state.turn, dice: state.dice });

  while (!state.winner && state.dice.length > 0) {
    const moves = legalMoves(state, state.turn);
    if (moves.length === 0) break;

    // Pick a random move
    const mv = moves[Math.floor(Math.random() * moves.length)];
    state = applyMove(state, state.turn, mv);
    events.push({ type: "move", color: state.turn, move: mv });
  }

  if (!state.winner) {
    events.push({ type: "endTurn", color: state.turn });
    state = endTurn(state);
  }
}

const record = {
  metadata: {
    matchId: "sample-match-1",
    whitePlayer: "Alice",
    whiteMessage: "I will crush you!",
    whiteGif:
      "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExODF3bG5zcG13cG84MWxobHBvODFwanJtY2ZibDhhbW90eDF4NHF4ciZlcD12MV9naWZzX3RyZW5kaW5nJmN0PWc/89x4osEodHEoo/giphy.gif",
    blackPlayer: "Bob",
    blackMessage: "You have no chance!",
    blackGif:
      "https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3czVidjZjNWhudnB3dXBjdXdvOG5jNTZkeGZia2dqdm04Z3k5djk4OSZlcD12MV9naWZzX3RyZW5kaW5nJmN0PWc/3NjABnBOieYQE4BpkP/giphy.gif",
    winner: state.winner,
  },
  events,
};

const outputPath = path.resolve(__dirname, "../src/assets/backgammon/sample_record.json");
fs.writeFileSync(outputPath, JSON.stringify(record, null, 2));
console.log(`Generated full replay with ${events.length} events. Winner: ${state.winner}`);
