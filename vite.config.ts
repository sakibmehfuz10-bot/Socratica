
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
// Import process explicitly to ensure Node.js types are available for Vite configuration
import process from 'node:process';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // This helps Vite see variables even if they don't have the VITE_ prefix during build time
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // We map the environment variable so the SDK's use of process.env.API_KEY works
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY),
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