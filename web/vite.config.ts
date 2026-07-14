import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { visualizer } from 'rollup-plugin-visualizer';

const path = require('path');

/**
 * Find a Supabase credential in process.env regardless of how the host
 * named it. The official Vercel ⇄ Supabase integration creates vars like
 * SUPABASE_URL / SUPABASE_ANON_KEY (and sometimes a project prefix such as
 * MYPROJECT_SUPABASE_URL, or a NEXT_PUBLIC_ variant) — none of which carry
 * the VITE_ prefix Vite needs to expose them to the browser. We bridge them
 * here at build time.
 *
 * SAFETY: we only ever pick the public Project URL and the public "anon"
 * key. Names containing SERVICE / JWT / SECRET / ROLE are excluded so a
 * service-role key or JWT secret can never leak into the client bundle.
 */
function findEnvBySuffix(suffix: string): string {
  const exclude = /(SERVICE|JWT|SECRET|ROLE|PASSWORD)/;
  const candidates = Object.keys(process.env)
    .filter(k => {
      const up = k.toUpperCase();
      return up.endsWith(suffix) && !exclude.test(up) && (process.env[k] || '').trim();
    })
    // Prefer VITE_ names, then the shortest (plain) name.
    .sort((a, b) => {
      const av = a.toUpperCase().startsWith('VITE_') ? 0 : 1;
      const bv = b.toUpperCase().startsWith('VITE_') ? 0 : 1;
      return av - bv || a.length - b.length;
    });
  return candidates.length ? (process.env[candidates[0]] || '').trim() : '';
}

const supabaseUrl = findEnvBySuffix('SUPABASE_URL');
const supabaseAnonKey = findEnvBySuffix('SUPABASE_ANON_KEY');

// https://vitejs.dev/config/
export default defineConfig({
  // Static Resource Base Path base: './' || '',
  base: process.env.NODE_ENV === 'production' ? './' : '/',
  define: {
    __STYLE_PRESET__: JSON.stringify(process.env.STYLE_PRESET || ''),
    __DEBUG_MODE__: JSON.stringify(process.env.DEBUG_MODE === 'true'),
    __SUPABASE_URL__: JSON.stringify(supabaseUrl),
    __SUPABASE_ANON_KEY__: JSON.stringify(supabaseAnonKey),
  },
  // Allow Vue CLI-style env names so Web and Electron can share upload config naming.
  envPrefix: ['VITE_', 'VUE_APP_'],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      pinia: path.resolve(__dirname, './node_modules/pinia'),
      '@TUILive': path.resolve(__dirname, 'src/TUILive'),
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        // Custom Split Strategy
        manualChunks: {
          roomEngine: ['@tencentcloud/tuiroom-engine-js'],
        },
      },
    },
  },
  plugins: [
    vue({
      // Explanation: Solved the problem of introducing the generation of userSig files.
      // reactivityTransform: true,
    }),
    visualizer({
      // open: true,
    }),
  ],
  server: {
    open: true,
    // Solve the problem of infinite page refresh after whistle proxy
    hmr: true,
    proxy: {
      '/api': {
        target: 'https://service.trtc.qcloud.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, ''),
      },
    },
  },
});
