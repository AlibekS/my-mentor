import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { mentorPlugin } from './server/mentor-plugin';

export default defineConfig({
  plugins: [react(), mentorPlugin()],
  // strictPort: прогресс хранится в localStorage конкретного адреса (127.0.0.1:5173). Если порт занят,
  // лучше явная ошибка, чем тихий переход на 5174, где прогресс «пропал бы»
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: { chunkSizeWarningLimit: 1500 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'content/**/*.test.ts', 'server/**/*.test.ts'],
  },
});
