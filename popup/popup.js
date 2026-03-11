/* ============================================================
   Screenshot Master – Popup Logic
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const buttons = document.querySelectorAll('.capture-btn');
  const themeToggle = document.getElementById('theme-toggle');

  // ─── Theme ─────────────────────────────────────────────
  chrome.storage.local.get('theme', (result) => {
    if (result.theme === 'light') document.body.classList.add('light');
  });

  themeToggle.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light');
    chrome.storage.local.set({ theme: isLight ? 'light' : 'dark' });
  });

  // ─── Capture Buttons ──────────────────────────────────
  buttons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const mode = btn.dataset.mode; // 'visible' | 'fullpage' | 'selected'

      // Disable all buttons while processing
      buttons.forEach((b) => b.classList.add('loading'));

      try {
        // Send capture request to background service worker
        await chrome.runtime.sendMessage({ action: 'capture', mode });
      } catch (err) {
        console.error('Screenshot Master – capture error:', err);
      }

      // Close the popup after initiating capture
      window.close();
    });
  });
});
