/* ============================================================
   Screenshot Master – Preview Logic
   Image stitching, annotation engine, and export.
   ============================================================ */

(() => {
  // ─── DOM Elements ────────────────────────────────────────
  const screenshotCanvas = document.getElementById('screenshot-canvas');
  const annotationCanvas = document.getElementById('annotation-canvas');
  const sCtx = screenshotCanvas.getContext('2d');
  const aCtx = annotationCanvas.getContext('2d');
  const loadingIndicator = document.getElementById('loading-indicator');
  const modeBadge = document.getElementById('mode-badge');
  const canvasWrapper = document.getElementById('canvas-wrapper');
  const annoTools = document.getElementById('annotation-tools');

  // Buttons
  const btnDownload = document.getElementById('btn-download');
  const btnCopy = document.getElementById('btn-copy');
  const btnDiscard = document.getElementById('btn-discard');
  const btnAnnotate = document.getElementById('btn-annotate');
  const btnTheme = document.getElementById('btn-theme');
  const formatSelect = document.getElementById('format-select');
  const annoColor = document.getElementById('anno-color');
  const annoStroke = document.getElementById('anno-stroke');

  // Text modal elements
  const textModal = document.getElementById('text-modal');
  const textModalInput = document.getElementById('text-modal-input');
  const textModalOk = document.getElementById('text-modal-ok');
  const textModalCancel = document.getElementById('text-modal-cancel');

  // ─── State ───────────────────────────────────────────────
  let screenshotData = null;
  let annotations = []; // stack of annotation objects
  let currentTool = null;
  let isAnnotating = false;
  let isDrawing = false;
  let drawStart = null;
  let pageUrl = '';
  let pendingTextPos = null; // for custom text modal
  let currentPenPoints = []; // for freehand pen tool

  // Display dimensions (CSS size of the screenshot canvas)
  let displayWidth = 0;
  let displayHeight = 0;
  // Full-resolution dimensions (actual pixel data size)
  let fullWidth = 0;
  let fullHeight = 0;

  // ─── Theme ───────────────────────────────────────────────
  chrome.storage.local.get('theme', (result) => {
    if (result.theme === 'light') document.body.classList.add('light');
  });

  btnTheme.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light');
    chrome.storage.local.set({ theme: isLight ? 'light' : 'dark' });
  });

  // ─── Init ────────────────────────────────────────────────
  init();

  async function init() {
    const result = await chrome.storage.local.get('screenshotData');
    screenshotData = result.screenshotData;
    if (!screenshotData) {
      loadingIndicator.innerHTML = '<p style="color:#ef4444;">No screenshot data found.</p>';
      return;
    }

    pageUrl = screenshotData.pageUrl || '';
    modeBadge.textContent = screenshotData.mode;

    if (screenshotData.mode === 'fullpage') {
      await assembleFullPage(screenshotData.images, screenshotData.meta);
    } else if (screenshotData.mode === 'selected') {
      await assembleSelected(screenshotData.images[0], screenshotData.meta);
    } else {
      await assembleVisible(screenshotData.images[0]);
    }

    loadingIndicator.classList.add('hidden');
    // Clean up storage
    chrome.storage.local.remove('screenshotData');
  }

  // ─── Assemble: Visible ───────────────────────────────────
  async function assembleVisible(dataUrl) {
    const img = await loadImage(dataUrl);
    fullWidth = img.width;
    fullHeight = img.height;
    screenshotCanvas.width = fullWidth;
    screenshotCanvas.height = fullHeight;
    sCtx.drawImage(img, 0, 0);
    fitCanvas();
  }

  // ─── Assemble: Full Page ─────────────────────────────────
  async function assembleFullPage(slices, meta) {
    if (!slices || slices.length === 0) return;

    const images = await Promise.all(slices.map(loadImage));
    const sliceW = images[0].width;
    const sliceH = images[0].height;

    // Total page height in device pixels: meta.scrollHeight * dpr
    // dpr can be inferred from first image vs clientHeight
    const dpr = sliceH / meta.clientHeight;
    const totalH = Math.round(meta.scrollHeight * dpr);
    const totalW = sliceW;

    fullWidth = totalW;
    fullHeight = totalH;
    screenshotCanvas.width = totalW;
    screenshotCanvas.height = totalH;

    let yOffset = 0;
    for (let i = 0; i < images.length; i++) {
      const drawH = Math.min(sliceH, totalH - yOffset);
      sCtx.drawImage(images[i], 0, 0, sliceW, drawH, 0, yOffset, sliceW, drawH);
      yOffset += sliceH;
    }

    fitCanvas();
  }

  // ─── Assemble: Selected ──────────────────────────────────
  async function assembleSelected(dataUrl, meta) {
    const img = await loadImage(dataUrl);
    const { crop } = meta;
    const dpr = crop.dpr || 1;

    const sx = crop.x * dpr;
    const sy = crop.y * dpr;
    const sw = crop.width * dpr;
    const sh = crop.height * dpr;

    fullWidth = Math.round(sw);
    fullHeight = Math.round(sh);
    screenshotCanvas.width = fullWidth;
    screenshotCanvas.height = fullHeight;
    sCtx.drawImage(img, sx, sy, sw, sh, 0, 0, fullWidth, fullHeight);
    fitCanvas();
  }

  // ─── Fit Canvas To Viewport ──────────────────────────────
  function fitCanvas() {
    const maxW = window.innerWidth * 0.9;
    const maxH = window.innerHeight - 120;
    const ratio = Math.min(maxW / fullWidth, maxH / fullHeight, 1);
    displayWidth = Math.round(fullWidth * ratio);
    displayHeight = Math.round(fullHeight * ratio);
    screenshotCanvas.style.width = displayWidth + 'px';
    screenshotCanvas.style.height = displayHeight + 'px';
    annotationCanvas.style.width = displayWidth + 'px';
    annotationCanvas.style.height = displayHeight + 'px';
    annotationCanvas.width = fullWidth;
    annotationCanvas.height = fullHeight;
  }

  // ─── Annotation Toggle ──────────────────────────────────
  btnAnnotate.addEventListener('click', () => {
    isAnnotating = !isAnnotating;
    btnAnnotate.classList.toggle('active', isAnnotating);
    annoTools.style.display = isAnnotating ? 'flex' : 'none';
    annotationCanvas.style.display = isAnnotating ? 'block' : 'none';
    annotationCanvas.style.cursor = isAnnotating ? 'crosshair' : 'default';
    if (isAnnotating && !currentTool) {
      selectTool('rectangle');
    }
    redrawAnnotations();
  });

  // ─── Tool Selection ──────────────────────────────────────
  document.querySelectorAll('.tool-btn[data-tool]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      if (tool === 'undo') {
        annotations.pop();
        redrawAnnotations();
        return;
      }
      selectTool(tool);
    });
  });

  function selectTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn[data-tool]').forEach((b) => {
      b.classList.toggle('active', b.dataset.tool === tool);
    });
    annotationCanvas.style.cursor = tool === 'text' ? 'text' : 'crosshair';
  }

  // ─── Canvas Coordinate Helpers ───────────────────────────
  function canvasCoords(e) {
    const rect = annotationCanvas.getBoundingClientRect();
    const scaleX = fullWidth / displayWidth;
    const scaleY = fullHeight / displayHeight;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  // ─── Custom Text Modal ───────────────────────────────────
  function showTextModal(pos) {
    pendingTextPos = pos;
    textModalInput.value = '';
    textModal.classList.remove('hidden');
    setTimeout(() => textModalInput.focus(), 50);
  }

  function hideTextModal() {
    textModal.classList.add('hidden');
    pendingTextPos = null;
  }

  textModalOk.addEventListener('click', () => {
    const label = textModalInput.value.trim();
    if (label && pendingTextPos) {
      annotations.push({
        type: 'text',
        x: pendingTextPos.x,
        y: pendingTextPos.y,
        text: label,
        color: annoColor.value,
        size: parseInt(annoStroke.value) * 6 + 8
      });
      redrawAnnotations();
    }
    hideTextModal();
  });

  textModalCancel.addEventListener('click', hideTextModal);

  textModalInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') textModalOk.click();
    if (e.key === 'Escape') hideTextModal();
  });

  // Close modal on overlay click
  textModal.addEventListener('click', (e) => {
    if (e.target === textModal) hideTextModal();
  });

  // ─── Annotation Drawing ──────────────────────────────────
  annotationCanvas.addEventListener('mousedown', (e) => {
    if (!isAnnotating || !currentTool) return;

    if (currentTool === 'text') {
      const pos = canvasCoords(e);
      showTextModal(pos);
      return;
    }

    isDrawing = true;
    drawStart = canvasCoords(e);

    // Start collecting points for pen tool
    if (currentTool === 'pen') {
      currentPenPoints = [drawStart];
    }
  });

  annotationCanvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    const pos = canvasCoords(e);

    if (currentTool === 'pen') {
      currentPenPoints.push(pos);
      redrawAnnotations();
      // Draw the in-progress pen stroke
      drawPenPath(aCtx, currentPenPoints, annoColor.value, parseInt(annoStroke.value));
      return;
    }

    redrawAnnotations();
    drawPreview(drawStart, pos);
  });

  annotationCanvas.addEventListener('mouseup', (e) => {
    if (!isDrawing) return;
    isDrawing = false;
    const pos = canvasCoords(e);
    const color = annoColor.value;
    const stroke = parseInt(annoStroke.value);

    if (currentTool === 'pen') {
      currentPenPoints.push(pos);
      if (currentPenPoints.length >= 2) {
        annotations.push({
          type: 'pen',
          points: [...currentPenPoints],
          color,
          stroke
        });
      }
      currentPenPoints = [];
    } else if (currentTool === 'rectangle') {
      annotations.push({
        type: 'rectangle',
        x: Math.min(drawStart.x, pos.x),
        y: Math.min(drawStart.y, pos.y),
        w: Math.abs(pos.x - drawStart.x),
        h: Math.abs(pos.y - drawStart.y),
        color,
        stroke
      });
    } else if (currentTool === 'arrow') {
      annotations.push({
        type: 'arrow',
        x1: drawStart.x, y1: drawStart.y,
        x2: pos.x, y2: pos.y,
        color,
        stroke
      });
    } else if (currentTool === 'highlight') {
      annotations.push({
        type: 'highlight',
        x: Math.min(drawStart.x, pos.x),
        y: Math.min(drawStart.y, pos.y),
        w: Math.abs(pos.x - drawStart.x),
        h: Math.abs(pos.y - drawStart.y),
        color
      });
    }

    redrawAnnotations();
  });

  // ─── Draw Preview (while dragging) ──────────────────────
  function drawPreview(start, end) {
    const color = annoColor.value;
    const stroke = parseInt(annoStroke.value);

    aCtx.save();
    if (currentTool === 'rectangle') {
      aCtx.strokeStyle = color;
      aCtx.lineWidth = stroke;
      aCtx.strokeRect(
        Math.min(start.x, end.x), Math.min(start.y, end.y),
        Math.abs(end.x - start.x), Math.abs(end.y - start.y)
      );
    } else if (currentTool === 'arrow') {
      drawArrow(aCtx, start.x, start.y, end.x, end.y, color, stroke);
    } else if (currentTool === 'highlight') {
      aCtx.fillStyle = hexToRgba(color, 0.3);
      aCtx.fillRect(
        Math.min(start.x, end.x), Math.min(start.y, end.y),
        Math.abs(end.x - start.x), Math.abs(end.y - start.y)
      );
    }
    aCtx.restore();
  }

  // ─── Redraw All Annotations ──────────────────────────────
  function redrawAnnotations() {
    aCtx.clearRect(0, 0, fullWidth, fullHeight);
    for (const a of annotations) {
      aCtx.save();
      switch (a.type) {
        case 'rectangle':
          aCtx.strokeStyle = a.color;
          aCtx.lineWidth = a.stroke;
          aCtx.strokeRect(a.x, a.y, a.w, a.h);
          break;
        case 'arrow':
          drawArrow(aCtx, a.x1, a.y1, a.x2, a.y2, a.color, a.stroke);
          break;
        case 'text':
          aCtx.fillStyle = a.color;
          aCtx.font = `bold ${a.size}px Inter, system-ui, sans-serif`;
          aCtx.fillText(a.text, a.x, a.y);
          break;
        case 'highlight':
          aCtx.fillStyle = hexToRgba(a.color, 0.3);
          aCtx.fillRect(a.x, a.y, a.w, a.h);
          break;
        case 'pen':
          drawPenPath(aCtx, a.points, a.color, a.stroke);
          break;
      }
      aCtx.restore();
    }
  }

  // ─── Pen Path Drawing Helper ─────────────────────────────
  function drawPenPath(ctx, points, color, stroke) {
    if (points.length < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = stroke;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      // Use quadratic curves for smoother lines
      const midX = (points[i - 1].x + points[i].x) / 2;
      const midY = (points[i - 1].y + points[i].y) / 2;
      ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, midX, midY);
    }
    // Draw to the last point
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }

  // ─── Arrow Drawing Helper ───────────────────────────────
  function drawArrow(ctx, x1, y1, x2, y2, color, stroke) {
    const headLen = Math.max(12, stroke * 5);
    const angle = Math.atan2(y2 - y1, x2 - x1);

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = stroke;
    ctx.lineCap = 'round';

    // Line
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - headLen * Math.cos(angle - Math.PI / 6),
      y2 - headLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      x2 - headLen * Math.cos(angle + Math.PI / 6),
      y2 - headLen * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
  }

  // ─── Export: Download ────────────────────────────────────
  btnDownload.addEventListener('click', () => {
    const format = formatSelect.value;
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';

    // Merge screenshot + annotations onto a temp canvas
    const merged = mergeCanvases();
    merged.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = generateFilename(pageUrl, format);
      a.click();
      URL.revokeObjectURL(url);
      showToast('Screenshot downloaded!', 'success');
    }, mimeType, 0.92);
  });

  // ─── Export: Copy to Clipboard ───────────────────────────
  btnCopy.addEventListener('click', async () => {
    try {
      const merged = mergeCanvases();
      const blob = await new Promise((r) => merged.toBlob(r, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      showToast('Copied to clipboard!', 'success');
    } catch (err) {
      showToast('Failed to copy: ' + err.message, 'error');
    }
  });

  // ─── Discard ─────────────────────────────────────────────
  btnDiscard.addEventListener('click', () => {
    window.close();
  });

  // ─── Undo shortcut ──────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      if (annotations.length > 0) {
        annotations.pop();
        redrawAnnotations();
      }
    }
  });

  // ─── Merge Canvases ──────────────────────────────────────
  function mergeCanvases() {
    const c = document.createElement('canvas');
    c.width = fullWidth;
    c.height = fullHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(screenshotCanvas, 0, 0);
    if (annotations.length > 0) {
      ctx.drawImage(annotationCanvas, 0, 0);
    }
    return c;
  }

  // ─── Filename Generator ──────────────────────────────────
  function generateFilename(url, format) {
    let domain = 'unknown';
    try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch (_) {}
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    return `screenshot_${domain}_${date}_${time}.${format}`;
  }

  // ─── Helpers ─────────────────────────────────────────────
  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + type;
    setTimeout(() => toast.classList.add('hidden'), 2500);
  }
})();
