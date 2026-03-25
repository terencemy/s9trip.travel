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

  console.log('API Key Status:', {
    MY_API_KEY: !!process.env.MY_API_KEY,
    GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
    AnyKey: !!(process.env.MY_API_KEY || process.env.GEMINI_API_KEY)
  });

  // API routes FIRST
  app.get('/api/health', (req, res) => {
    res.status(200).send('OK');
  });

  app.get('/api/admin/test-ai', (req, res) => {
    const apiKey = process.env.MY_API_KEY || process.env.GEMINI_API_KEY;
    res.json({
      status: 'success',
      message: 'AI API is live and responding!',
      timestamp: new Date().toISOString(),
      env: {
        hasApiKey: !!apiKey,
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
    // If running from dist/server.js, __dirname is dist/
    // If running from server.ts (dev/tsx), __dirname is root
    const distPath = __dirname.endsWith('dist') ? __dirname : path.resolve(__dirname, 'dist');
    
    console.log('Production mode: Serving static files from', distPath);
    
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
      const currentDir = process.cwd();
      console.error(`Dist directory not found at ${distPath}! Current working directory: ${currentDir}`);
      app.get('*', (req, res) => {
        res.status(500).send(`
          <h1>Application not built</h1>
          <p>The server is running in production mode, but the <code>dist</code> folder is missing.</p>
          <p><strong>Path checked:</strong> <code>${distPath}</code></p>
          <p><strong>Working directory:</strong> <code>${currentDir}</code></p>
          <hr>
          <h3>How to fix:</h3>
          <ol>
            <li>In AI Studio, click the <strong>"Deploy"</strong> button. This will run <code>npm run build</code> and push the files to the live site.</li>
            <li>If you are deploying manually, ensure <code>npm run build</code> is part of your build pipeline.</li>
          </ol>
        `);
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
