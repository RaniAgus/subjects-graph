import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js']
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './public')
    }
  }
});
