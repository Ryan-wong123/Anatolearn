import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const target = process.env.BACKEND_URL || 'http://localhost:5000';
const proxy = Object.fromEntries(['/api', '/models', '^/videos/(?![0-9]+(?:$|[/?]))', '/resources', '/thumbnails'].map((prefix) => [prefix, { target, changeOrigin: true }]));
// Teaching assets are owned by the authenticated backend, never Vite's public directory.
export default defineConfig({ publicDir: false, plugins: [react()], server: { proxy, watch: { usePolling: true }, fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/public/**', '**/backend/**', '**/docker-compose.yml'] } }, preview: { proxy } });
