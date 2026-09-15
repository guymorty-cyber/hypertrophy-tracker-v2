import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/hypertrophy-tracker-v2/',
  plugins: [react()],
});
