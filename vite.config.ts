import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { mentorPlugin } from './server/mentor-plugin';

export default defineConfig({
  plugins: [react(), mentorPlugin()],
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
  build: { chunkSizeWarningLimit: 1500 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'content/**/*.test.ts', 'server/**/*.test.ts'],
  },
});
