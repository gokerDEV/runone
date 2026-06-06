# RunOne - Backgammon

RunOne is a real-time web-based platform featuring a Backgammon game implementation. The game is built using modern web technologies including React (TanStack Start), TailwindCSS, and Pusher for real-time multiplayer capabilities.

## Design Development Methodology

The UI design and development workflow for the Backgammon board involves a collaborative hand-off process using standalone SVG assets. This ensures that the visual elements can be refined efficiently in external vector design tools (like Figma or Illustrator) before being integrated back into the React codebase.

### Workflow

1. **Exporting Assets:**
   All inline SVGs used in the `<BackgammonBoard />` component (such as board slots, checkers, dice, and the doubling cube) have been exported as raw `.svg` files into the `src/assets/backgammon/` directory.

   Available files:
   - `board-layout.svg`
   - `point-slot-top.svg`
   - `point-slot-bottom.svg`
   - `checker-white.svg` & `checker-black.svg`
   - `mini-checker-white.svg` & `mini-checker-black.svg`
   - `die-face.svg`
   - `doubling-cube.svg`

2. **Design Iteration:**
   Designers or developers can open these `.svg` files in their preferred vector graphics editor to modify shapes, colors, drop shadows, and general aesthetics.

3. **Code Integration (AI Assisted):**
   Once the `.svg` files are updated and finalized in the `src/assets/backgammon/` folder, the developer prompts the AI agent:

   > _"I have updated the SVGs in `src/assets/backgammon/`. Please apply these design updates to `src/components/board/BackgammonBoard.tsx`."_

   The AI will then read the modified SVG paths, colors, and definitions, and appropriately inject them back into the inline React components (`PointSlot`, `Checker`, `Die`, etc.) within `BackgammonBoard.tsx`. This avoids the hassle of manual JSX conversion and ensures seamless synchronization between the design files and the production codebase.

## Vercel Deployment

Since this project uses `@lovable.dev/vite-tanstack-config`, the build engine (Nitro) defaults to targeting **Cloudflare** by default. To successfully deploy this application to **Vercel** as a TanStack Start project, you **must** configure the following settings in your Vercel project dashboard:

1. **Framework Preset:** Select `TanStack Start` (or `Vite` if TanStack Start is missing, though Vercel usually auto-detects it).
2. **Build Command:** `npm run build` (veya `bun run build`)
3. **Output Directory:** Leave as default, or set to `.vercel/output` (Nitro automatically builds into the Vercel Build Output API format when the vercel preset is active).
4. **Environment Variables (CRITICAL):**
   You **must** add the following environment variable in your Vercel Project Settings -> Environment Variables:
   - Key: `NITRO_PRESET`
   - Value: `vercel`

Setting `NITRO_PRESET=vercel` forces the underlying Nitro engine to compile the server code for Vercel Serverless/Edge functions instead of Cloudflare Pages, resolving any "Not Found" or 404 deployment errors.
