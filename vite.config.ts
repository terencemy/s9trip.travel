import { defineConfig, loadEnv } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to find all HTML files in the root and subdirectories
function getHtmlEntries() {
  const entries: Record<string, string> = {};
  
  // Root HTML files
  const rootFiles = fs.readdirSync(__dirname).filter(file => file.endsWith('.html'));
  rootFiles.forEach(file => {
    const name = file.replace('.html', '');
    entries[name] = path.resolve(__dirname, file);
  });

  // Articles directory
  const articlesDir = path.resolve(__dirname, 'articles');
  if (fs.existsSync(articlesDir)) {
    const articleFiles = fs.readdirSync(articlesDir).filter(file => file.endsWith('.html'));
    articleFiles.forEach(file => {
      const name = `articles/${file.replace('.html', '')}`;
      entries[name] = path.resolve(articlesDir, file);
    });
  }

  return entries;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.MY_API_KEY || env.GEMINI_API_KEY || process.env.MY_API_KEY || process.env.GEMINI_API_KEY;
  console.log('Vite build: API Key present:', !!apiKey);
  
  return {
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(apiKey),
      'process.env.MY_API_KEY': JSON.stringify(apiKey),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(apiKey),
      'import.meta.env.VITE_MY_API_KEY': JSON.stringify(apiKey),
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        input: getHtmlEntries(),
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('jspdf') || id.includes('html2canvas')) {
                return 'pdf-vendor';
              }
              return 'vendor';
            }
          }
        }
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
  };
});
