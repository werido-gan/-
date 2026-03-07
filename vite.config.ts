import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'http://localhost:3001',
            changeOrigin: true,
            secure: false,
            logLevel: 'debug',
            timeout: 540000, // ✅ 修复：设置代理超时为9分钟（540秒）
            configure: (proxy, options) => {
              proxy.on('proxyReq', (proxyReq, req, res) => {
                console.log('Sending proxy request:', proxyReq.method, proxyReq.path);
              });
              proxy.on('proxyRes', (proxyRes, req, res) => {
                console.log('Received proxy response:', proxyRes.statusCode, req.url);
              });
              proxy.on('error', (err, req, res) => {
                console.error('Proxy error:', err);
              });
            }
          }
        }
      },
      plugins: [
        react()
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
