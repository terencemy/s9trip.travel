import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Main server entry point - Updated to handle production build serving
async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  console.log('GEMINI_API_KEY is present in environment:', !!process.env.GEMINI_API_KEY);

  // API routes FIRST
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/admin/test-ai', (req, res) => {
    res.json({
      status: 'success',
      message: 'AI API is live and responding!',
      timestamp: new Date().toISOString(),
      env: {
        hasApiKey: !!process.env.GEMINI_API_KEY,
        nodeEnv: process.env.NODE_ENV
      }
    });
  });

  app.get('/api/debug/env', (req, res) => {
    res.json({
      hasApiKey: !!process.env.GEMINI_API_KEY,
      nodeEnv: process.env.NODE_ENV,
      apiKeyPrefix: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 4) : 'none'
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve from dist
    const distPath = path.resolve(__dirname, 'dist');
    
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath, {
        extensions: ['html'], // Allow /zh to serve /zh.html
      }));
      
      // Fallback for SPA-like behavior if needed, but prioritize index.html
      app.get('*', (req, res) => {
        const indexPath = path.join(distPath, 'index.html');
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(404).send('Not Found');
        }
      });
    } else {
      console.error('Dist directory not found! Please run npm run build.');
      app.get('*', (req, res) => {
        res.status(500).send('Application not built. Please run npm run build.');
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
