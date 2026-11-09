import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/landing/',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: { main: 'index.html', frame: 'frame.html' },
    },
  },
});
