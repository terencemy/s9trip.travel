
/**
 * Wake-up script for Render.com cold starts
 * This script pings the /api/health endpoint on load to wake up the free tier server.
 * It only shows the overlay if the server is actually sleeping.
 */

async function wakeUpServer() {
  // Check if we already have an overlay (to avoid duplicates)
  if (document.getElementById('server-wakeup-overlay')) return;

  const isChinese = document.documentElement.lang === 'zh-Hans';
  let overlay: HTMLDivElement | null = null;

  const createOverlay = () => {
    overlay = document.createElement('div');
    overlay.id = 'server-wakeup-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(10, 29, 55, 0.98);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      color: white;
      font-family: sans-serif;
      transition: opacity 0.5s ease;
    `;

    overlay.innerHTML = `
      <div style="text-align: center; padding: 20px;">
        <div style="font-size: 40px; margin-bottom: 20px;">🚀</div>
        <h2 style="margin-bottom: 10px;">${isChinese ? '正在唤醒服务器...' : 'Waking up server...'}</h2>
        <p style="opacity: 0.8;">${isChinese ? '请稍候 (30–60 秒)' : 'Please wait (30–60 seconds)'}</p>
        <div style="margin-top: 20px; width: 200px; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; overflow: hidden;">
          <div id="wakeup-progress" style="width: 0%; height: 100%; background: #c6a24b; transition: width 0.3s ease;"></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  };

  const maxRetries = 12; // 12 * 5s = 60s total
  const delayBetweenRetries = 5000; 

  for (let i = 0; i < maxRetries; i++) {
    const startTime = Date.now();
    try {
      // Use AbortController for a 4s timeout per ping
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch('/api/health', { 
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        console.log('Server is awake!');
        if (overlay) {
          (overlay as HTMLElement).style.opacity = '0';
          setTimeout(() => (overlay as HTMLElement)?.remove(), 500);
        }
        return; 
      }
    } catch (error) {
      console.warn(`Wake-up attempt ${i + 1} failed. Retrying...`);
      
      // If the first ping fails or takes too long, show the overlay
      if (!overlay && (Date.now() - startTime > 1000 || i > 0)) {
        createOverlay();
      }

      if (overlay) {
        const progress = document.getElementById('wakeup-progress');
        if (progress) progress.style.width = `${((i + 1) / maxRetries) * 100}%`;
      }

      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenRetries));
      }
    }
  }

  // If we get here, it failed after all retries, but we should still hide the overlay
  if (overlay) {
    (overlay as HTMLElement).style.opacity = '0';
    setTimeout(() => (overlay as HTMLElement)?.remove(), 500);
  }
  // Start background keep-alive to prevent sleeping while the tab is open
  startBackgroundKeepAlive();
}

/**
 * Background ping to /api/health every 5 minutes
 */
function startBackgroundKeepAlive() {
  const FIVE_MINUTES = 5 * 60 * 1000;
  setInterval(async () => {
    try {
      // Quiet ping to keep server active
      await fetch('/api/health', { 
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' }
      });
      console.log('Background server keep-alive successful');
    } catch (e) {
      // Intentionally ignore background errors to avoid user disruption
    }
  }, FIVE_MINUTES);
}

// Start wake up process when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', wakeUpServer);
} else {
  wakeUpServer();
}
