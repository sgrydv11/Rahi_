import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: { '/api': {
        target: env.API_PROXY_TARGET || 'http://localhost:8080', changeOrigin: true,
        // Explicit opt-in for a loopback preview using the hosted API.
        // Production CORS and origin validation remain enforced on the API.
        ...(env.API_PROXY_HOSTED_PREVIEW === 'true' ? {
          configure(proxy) {
            proxy.on('proxyReq', (request, incoming) => {
              if (incoming.headers.origin && /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(incoming.headers.origin)) {
                request.setHeader('Origin', new URL(env.API_PROXY_TARGET).origin);
              }
            });
          },
        } : {}),
      } },
    },
  };
});
