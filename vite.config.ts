import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative base so the build can be served from any path, including offline
  // static hosting on a Raspberry Pi image.
  base: './',
  plugins: [react()],
});
