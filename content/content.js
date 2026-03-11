/* ============================================================
   Screenshot Master – Content Script
   Injected into the active tab to handle scrolling, page
   measurements, the selection overlay, and capture overlay.
   ============================================================ */

(() => {
  // Guard against multiple injections
  if (window.__screenshotMasterInjected) return;
  window.__screenshotMasterInjected = true;

  let savedOverflow = '';
  let selectionOverlay = null;
  let captureOverlay = null;

  // ─── Message Listener ────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.action) {
      case 'getPageDimensions':
        sendResponse({
          scrollHeight: document.documentElement.scrollHeight,
          clientHeight: document.documentElement.clientHeight,
          clientWidth: document.documentElement.clientWidth,
          currentScrollY: window.scrollY
        });
        break;

      case 'scrollTo':
        window.scrollTo({ top: msg.y, behavior: 'instant' });
        // Wait a tick for paint
        setTimeout(() => sendResponse({ done: true }), 100);
        return true; // async response

      case 'hideScrollbars':
        savedOverflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = 'hidden';
        sendResponse({ done: true });
        break;

      case 'restoreScrollbars':
        document.documentElement.style.overflow = savedOverflow;
        sendResponse({ done: true });
        break;

      case 'startSelection':
        createSelectionOverlay();
        sendResponse({ done: true });
        break;

      case 'showCaptureOverlay':
        createCaptureOverlay(msg.current || 0, msg.total || 0);
        sendResponse({ done: true });
        break;

      case 'updateCaptureProgress':
        updateCaptureOverlay(msg.current, msg.total);
        sendResponse({ done: true });
        break;

      case 'hideCaptureOverlay':
        removeCaptureOverlay();
        sendResponse({ done: true });
        break;

      case 'pauseCaptureOverlay': {
        const el = document.getElementById('sm-capture-overlay');
        if (el) el.style.display = 'none';
        sendResponse({ done: true });
        break;
      }

      case 'resumeCaptureOverlay': {
        const el = document.getElementById('sm-capture-overlay');
        if (el) el.style.display = 'flex';
        sendResponse({ done: true });
        break;
      }
    }
    return true;
  });

  // ─── Capture Progress Overlay ────────────────────────────
  function createCaptureOverlay(current, total) {
    removeCaptureOverlay();

    captureOverlay = document.createElement('div');
    captureOverlay.id = 'sm-capture-overlay';
    Object.assign(captureOverlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      zIndex: '2147483647',
      background: 'rgba(10, 10, 20, 0.85)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '20px',
      margin: '0',
      padding: '0',
      backdropFilter: 'blur(6px)'
    });

    // Spinner
    const spinner = document.createElement('div');
    spinner.id = 'sm-capture-spinner';
    Object.assign(spinner.style, {
      width: '48px',
      height: '48px',
      border: '4px solid rgba(255,255,255,0.15)',
      borderTopColor: '#7c3aed',
      borderRadius: '50%',
      animation: 'sm-spin 0.8s linear infinite'
    });

    // Text
    const text = document.createElement('div');
    text.id = 'sm-capture-text';
    Object.assign(text.style, {
      color: '#f1f5f9',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '16px',
      fontWeight: '600'
    });
    text.textContent = 'Capturing full page…';

    // Progress
    const progress = document.createElement('div');
    progress.id = 'sm-capture-progress';
    Object.assign(progress.style, {
      color: '#94a3b8',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '13px'
    });
    progress.textContent = total > 0 ? `Section ${current} of ${total}` : 'Preparing…';

    // Progress bar container
    const barContainer = document.createElement('div');
    Object.assign(barContainer.style, {
      width: '240px',
      height: '4px',
      background: 'rgba(255,255,255,0.1)',
      borderRadius: '4px',
      overflow: 'hidden'
    });

    const barFill = document.createElement('div');
    barFill.id = 'sm-capture-bar';
    Object.assign(barFill.style, {
      width: total > 0 ? `${(current / total) * 100}%` : '0%',
      height: '100%',
      background: 'linear-gradient(90deg, #7c3aed, #06b6d4)',
      borderRadius: '4px',
      transition: 'width 0.3s ease'
    });
    barContainer.appendChild(barFill);

    // Inject keyframes
    const style = document.createElement('style');
    style.id = 'sm-capture-styles';
    style.textContent = '@keyframes sm-spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(style);

    captureOverlay.appendChild(spinner);
    captureOverlay.appendChild(text);
    captureOverlay.appendChild(progress);
    captureOverlay.appendChild(barContainer);
    document.body.appendChild(captureOverlay);
  }

  function updateCaptureOverlay(current, total) {
    const progress = document.getElementById('sm-capture-progress');
    const bar = document.getElementById('sm-capture-bar');
    if (progress) progress.textContent = `Section ${current} of ${total}`;
    if (bar) bar.style.width = `${(current / total) * 100}%`;
  }

  function removeCaptureOverlay() {
    const existing = document.getElementById('sm-capture-overlay');
    if (existing) existing.remove();
    const styles = document.getElementById('sm-capture-styles');
    if (styles) styles.remove();
    captureOverlay = null;
  }

  // ─── Selection Overlay ───────────────────────────────────
  function createSelectionOverlay() {
    removeSelectionOverlay();

    const dpr = window.devicePixelRatio || 1;

    // Full-screen overlay
    selectionOverlay = document.createElement('div');
    selectionOverlay.id = 'sm-selection-overlay';
    Object.assign(selectionOverlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      zIndex: '2147483647',
      cursor: 'crosshair',
      background: 'rgba(0, 0, 0, 0.35)',
      margin: '0',
      padding: '0'
    });

    // Instruction tooltip
    const tooltip = document.createElement('div');
    Object.assign(tooltip.style, {
      position: 'fixed',
      top: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(15,15,26,0.9)',
      color: '#f1f5f9',
      padding: '10px 20px',
      borderRadius: '10px',
      fontSize: '14px',
      fontFamily: 'Inter, system-ui, sans-serif',
      zIndex: '2147483647',
      pointerEvents: 'none',
      border: '1px solid rgba(124,58,237,0.4)',
      backdropFilter: 'blur(8px)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)'
    });
    tooltip.textContent = 'Drag to select area • Press Esc to cancel';
    selectionOverlay.appendChild(tooltip);

    // Selection box
    const selBox = document.createElement('div');
    selBox.id = 'sm-selection-box';
    Object.assign(selBox.style, {
      position: 'fixed',
      border: '2px solid #7c3aed',
      background: 'rgba(124, 58, 237, 0.12)',
      display: 'none',
      zIndex: '2147483647',
      pointerEvents: 'none',
      borderRadius: '2px',
      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.35)'
    });
    selectionOverlay.appendChild(selBox);

    let startX, startY, isDrawing = false;

    selectionOverlay.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startX = e.clientX;
      startY = e.clientY;
      isDrawing = true;
      selBox.style.display = 'block';
      selBox.style.left = startX + 'px';
      selBox.style.top = startY + 'px';
      selBox.style.width = '0px';
      selBox.style.height = '0px';
      // Switch overlay to transparent so selection box shadow does the dimming
      selectionOverlay.style.background = 'transparent';
    });

    selectionOverlay.addEventListener('mousemove', (e) => {
      if (!isDrawing) return;
      const x = Math.min(e.clientX, startX);
      const y = Math.min(e.clientY, startY);
      const w = Math.abs(e.clientX - startX);
      const h = Math.abs(e.clientY - startY);
      selBox.style.left = x + 'px';
      selBox.style.top = y + 'px';
      selBox.style.width = w + 'px';
      selBox.style.height = h + 'px';
    });

    selectionOverlay.addEventListener('mouseup', (e) => {
      if (!isDrawing) return;
      isDrawing = false;

      const x = Math.min(e.clientX, startX);
      const y = Math.min(e.clientY, startY);
      const w = Math.abs(e.clientX - startX);
      const h = Math.abs(e.clientY - startY);

      removeSelectionOverlay();

      if (w < 5 || h < 5) {
        chrome.runtime.sendMessage({ action: 'selectionCancelled' });
        return;
      }

      chrome.runtime.sendMessage({
        action: 'selectionComplete',
        bounds: { x, y, width: w, height: h, dpr }
      });
    });

    // Escape to cancel
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        removeSelectionOverlay();
        document.removeEventListener('keydown', escHandler);
        chrome.runtime.sendMessage({ action: 'selectionCancelled' });
      }
    };
    document.addEventListener('keydown', escHandler);

    document.body.appendChild(selectionOverlay);
  }

  function removeSelectionOverlay() {
    const existing = document.getElementById('sm-selection-overlay');
    if (existing) existing.remove();
    selectionOverlay = null;
  }
})();
