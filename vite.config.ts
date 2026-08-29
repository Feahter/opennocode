import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // 框架独立 chunk（首屏必载）
          'vendor-react': ['react', 'react-dom'],
          // sql.js wasm 引擎独立 chunk（初始化时才用，可缓存）
          'vendor-sql': ['sql.js'],
          // zod schema 校验独立 chunk（agent 层用）
          'vendor-zod': ['zod'],
          // dnd-kit 拖拽独立 chunk（仅看板用，懒加载后按需）
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/utilities'],
        },
      },
    },
  },
});
