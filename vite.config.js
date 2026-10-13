import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],

  // GitHub Pages serves the site from /<repo>/, so assets need that prefix.
  // Local dev and `vite preview` stay at the root.
  base: process.env.GITHUB_ACTIONS ? '/my-dst-board-game-testing/' : '/',
})
