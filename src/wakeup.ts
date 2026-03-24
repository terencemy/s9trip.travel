
/**
 * Wake-up script for Render.com cold starts
 * This script pings the /health endpoint on load to wake up the free tier server.
 */

async function wakeUpServer() {
  const overlay = document.createElement('div');
  overlay.id = 'server-wakeup-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(10, 29, 55, 0.95);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    color: white;
    font-family: sans-serif;
    transition: opacity 0.5s ease;
  `;

  const isChinese = document.documentElement.lang === 'zh-Hans';
  
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
  const progress = document.getElementById('wakeup-progress');

  const maxRetries = 3;
  const delayBetweenRetries = 5000; // 5 seconds

  for (let i = 0; i < maxRetries; i++) {
    try {
      if (progress) progress.style.width = `${((i + 1) / maxRetries) * 100}%`;
      
      const response = await fetch('/api/health', { 
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' }
      });

      if (response.ok) {
        console.log('Server is awake!');
        break; 
      }
    } catch (error) {
      console.warn(`Wake-up attempt ${i + 1} failed. Retrying...`);
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenRetries));
      }
    }
  }

  // Hide overlay regardless of success/fail to not block user
  overlay.style.opacity = '0';
  setTimeout(() => {
    overlay.remove();
  }, 500);
}

// Start wake up process when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', wakeUpServer);
} else {
  wakeUpServer();
}
