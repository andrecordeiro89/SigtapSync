import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Força uso de esbuild em vez de SWC
      jsxRuntime: 'automatic'
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Força minificação com esbuild
    minify: 'esbuild',
    // Configurações seguras para Netlify
    target: 'es2015',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js']
        }
      }
    },
    // Desabilita otimizações que podem causar problemas
    cssMinify: 'esbuild',
    // Configurações de memória
    chunkSizeWarningLimit: 1000
  },
  optimizeDeps: {
    // Força pré-bundling com esbuild
    esbuildOptions: {
      target: 'es2015'
    }
  },
  // Configurações específicas para ambiente de produção
  define: {
    'process.env.NODE_ENV': '"production"'
  }
}) 