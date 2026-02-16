import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'node:process';

export default defineConfig(({ mode }) => {
  // Load environment variables from the host (Vercel/Netlify) or local .env file.
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // This bridges the gap between Vercel/Netlify environment variables and the SDK's process.env requirement.
      // Vite replaces every occurrence of "process.env.API_KEY" in the source code with this value.
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.API_KEY || ""),
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'esbuild',
    },
    server: {
      port: 3000,
      strictPort: true,
    }
  };
});