import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

declare const process: { env: Record<string, string | undefined> }

// Served from https://elymaddox.github.io/taco-bell-reviewer/ on GitHub Pages.
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES ? '/taco-bell-reviewer/' : '/',
})
