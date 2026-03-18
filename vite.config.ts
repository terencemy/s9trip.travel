import { defineConfig } from 'vite';
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

export default defineConfig({
  build: {
    rollupOptions: {
      input: getHtmlEntries(),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
});
