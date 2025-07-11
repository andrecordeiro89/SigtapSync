import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    // componentTagger desabilitado para evitar warnings com React.Fragment
    // mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ['pdfjs-dist'],
    exclude: ['@rollup/rollup-linux-x64-gnu']
  },
  build: {
    commonjsOptions: {
      include: [/pdfjs-dist/, /node_modules/],
      transformMixedEsModules: true
    },
    rollupOptions: {
      external: [],
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          pdf: ['pdfjs-dist'],
          ui: ['lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu']
        },
        // Configurações específicas para resolver problemas do Rollup
        inlineDynamicImports: false,
        format: 'es'
      },
      // Configurações para evitar problemas com dependências nativas
      treeshake: {
        moduleSideEffects: false
      }
    },
    target: 'esnext',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    // Configurações específicas para ambientes de CI/CD
    emptyOutDir: true,
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1000
  },
  worker: {
    format: 'es'
  },
  // Configurações para melhorar compatibilidade com Node.js em ambientes de build
  define: {
    global: 'globalThis'
  }
}));
