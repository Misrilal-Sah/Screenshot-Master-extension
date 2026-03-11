/* ============================================================
   Screenshot Master – Background Service Worker
   ============================================================ */

// Listen for messages from popup or keyboard shortcuts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'capture') {
    handleCapture(msg.mode);
    sendResponse({ ok: true });
  }
  return true; // async
});

// Keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  if (command === 'capture-visible') handleCapture('visible');
  if (command === 'capture-full-page') handleCapture('fullpage');
  if (command === 'capture-selected') handleCapture('selected');
});

// ─── Main Capture Router ─────────────────────────────────────
async function handleCapture(mode) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    if (mode === 'visible') {
      await captureVisible(tab);
    } else if (mode === 'fullpage') {
      await captureFullPage(tab);
    } else if (mode === 'selected') {
      await captureSelected(tab);
    }
  } catch (err) {
    console.error('Screenshot Master – handleCapture error:', err);
  }
}

// ─── Visible Area ────────────────────────────────────────────
async function captureVisible(tab) {
  const dataUrl = await captureTab();
  openPreview(tab.url, [dataUrl], 'visible', null);
}

// ─── Full Page ───────────────────────────────────────────────
async function captureFullPage(tab) {
  // Inject content script
  await injectContentScript(tab.id);

  // Small delay to let content script initialize
  await sleep(150);

  // Get page dimensions
  const dims = await sendToContent(tab.id, { action: 'getPageDimensions' });
  if (!dims) return;

  const { scrollHeight, clientHeight, clientWidth, currentScrollY } = dims;
  const totalSlices = Math.ceil(scrollHeight / clientHeight);
  const slices = [];

  // Hide scrollbars and show capture overlay
  await sendToContent(tab.id, { action: 'hideScrollbars' });
  await sendToContent(tab.id, { action: 'showCaptureOverlay', current: 0, total: totalSlices });

  for (let i = 0; i < totalSlices; i++) {
    // Update progress overlay
    await sendToContent(tab.id, { action: 'updateCaptureProgress', current: i + 1, total: totalSlices });

    const scrollY = i * clientHeight;
    await sendToContent(tab.id, { action: 'scrollTo', y: scrollY });
    // Wait for rendering + respect Chrome's rate limit (max 2 captures/sec)
    await sleep(500);

    // Temporarily hide overlay so it's not captured in the screenshot
    await sendToContent(tab.id, { action: 'pauseCaptureOverlay' });
    await sleep(80); // brief wait for repaint

    try {
      const dataUrl = await captureTab();
      slices.push(dataUrl);
    } catch (err) {
      console.warn(`Slice ${i} capture failed, retrying...`, err.message);
      await sleep(1000);
      const dataUrl = await captureTab();
      slices.push(dataUrl);
    }

    // Restore overlay visibility
    await sendToContent(tab.id, { action: 'resumeCaptureOverlay' });
  }

  // Remove capture overlay, restore scrollbars & original scroll position
  await sendToContent(tab.id, { action: 'hideCaptureOverlay' });
  await sendToContent(tab.id, { action: 'restoreScrollbars' });
  await sendToContent(tab.id, { action: 'scrollTo', y: currentScrollY });

  openPreview(tab.url, slices, 'fullpage', {
    scrollHeight,
    clientHeight,
    clientWidth,
    totalSlices
  });
}

// ─── Selected Area ───────────────────────────────────────────
async function captureSelected(tab) {
  await injectContentScript(tab.id);
  await sleep(150);
  // Tell content script to show selection overlay
  await sendToContent(tab.id, { action: 'startSelection' });
  // The content script will message back with the selection bounds
}

// Listen for selection result from content script
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action === 'selectionComplete') {
    handleSelectionResult(sender.tab, msg.bounds);
  }
  if (msg.action === 'selectionCancelled') {
    // No-op, user cancelled
  }
});

async function handleSelectionResult(tab, bounds) {
  const { x, y, width, height, dpr } = bounds;
  // Small delay before capture
  await sleep(100);
  // Capture the visible tab
  const dataUrl = await captureTab();
  openPreview(tab.url, [dataUrl], 'selected', { crop: { x, y, width, height, dpr } });
}

// ─── Preview ─────────────────────────────────────────────────
function openPreview(pageUrl, images, mode, meta) {
  // Store data temporarily so preview page can retrieve it
  chrome.storage.local.set({
    screenshotData: {
      pageUrl,
      images,
      mode,
      meta,
      timestamp: Date.now()
    }
  }, () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('preview/preview.html') });
  });
}

// ─── Tab Capture Helper ──────────────────────────────────────
// Wraps captureVisibleTab to handle the windowId properly
async function captureTab() {
  const win = await chrome.windows.getCurrent();
  return await chrome.tabs.captureVisibleTab(win.id, { format: 'png' });
}

// ─── Helpers ─────────────────────────────────────────────────
async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/content.js']
    });
  } catch (err) {
    console.warn('Content script injection skipped:', err.message);
  }
}

function sendToContent(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('sendToContent error:', chrome.runtime.lastError.message);
        resolve(null);
        return;
      }
      resolve(response);
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
