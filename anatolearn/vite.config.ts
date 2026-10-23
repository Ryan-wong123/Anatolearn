import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
const target = process.env.BACKEND_URL || 'http://localhost:5000';
const proxy = Object.fromEntries(['/api', '/models', '^/videos/(?![0-9]+(?:$|[/?]))', '/resources', '/thumbnails', '/captions'].map((prefix) => [prefix, { target, changeOrigin: true }]));
// Teaching assets are owned by the authenticated backend, never Vite's public directory.
export default defineConfig({ publicDir: false, build: { chunkSizeWarningLimit: 900, rolldownOptions: { output: { codeSplitting: { groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]/ }] } } } }, plugins: [react(), tailwindcss()], server: { proxy, watch: { usePolling: true, ignored: ['**/.playwright-browsers/**', '**/.playwright/**', '**/test-results/**', '**/playwright-report/**'] }, fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/public/**', '**/backend/**', '**/backups/**', '**/docker-compose.yml', '**/.playwright/**', '**/.playwright-browsers/**', '**/test-results/**', '**/playwright-report/**'] } }, preview: { proxy } });
