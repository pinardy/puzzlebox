import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Served from https://pinardy.github.io/puzzlebox/ — all asset, manifest,
// and service-worker URLs must live under this base path.
const BASE = "/puzzlebox/";

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "PuzzleBox — Puzzle Games",
        short_name: "PuzzleBox",
        description:
          "A word game, sudoku, picross and more. Works fully offline.",
        theme_color: "#1b2733",
        background_color: "#eef1f4",
        display: "standalone",
        orientation: "portrait",
        start_url: BASE,
        scope: BASE,
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        // Precache everything the app needs; puzzles are generated
        // locally from stored seeds, so no runtime network is required.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        navigateFallback: `${BASE}index.html`
      }
    })
  ]
});
