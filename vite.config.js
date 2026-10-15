import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],

  // GitHub Pages serves from /<repo>/; local dev and preview stay at the root.
  base: process.env.GITHUB_ACTIONS ? '/my-dst-board-game-testing/' : '/',

  test: {
    // prototype-v0 is a parked, unrelated app with its own suite. Running it
    // here would mix a different game's results into Alpha 1.0's.
    exclude: ['**/node_modules/**', '**/dist/**', 'prototype-v0/**'],
  },
})
