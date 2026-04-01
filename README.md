<div align="center">

<img src="https://capsule-render.vercel.app/api?type=slice&color=0:6366f1,50:8b5cf6,100:ec4899&height=200&section=header&text=Screenshot%20Master&fontSize=52&fontColor=ffffff&fontAlignY=65&desc=Capture%20%C2%B7%20Annotate%20%C2%B7%20Export%20%E2%80%94%20right%20from%20your%20browser&descAlignY=82&descSize=16&descFontColor=e2e8f0&rotate=-6" width="100%" alt="Screenshot Master"/>

<br/>

[![Version](https://img.shields.io/badge/version-2.1.2-6366f1?style=for-the-badge&logo=semanticrelease&logoColor=white)](manifest.json)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-0ea5e9?style=for-the-badge&logo=googlechrome&logoColor=white)](manifest.json)
[![License](https://img.shields.io/badge/license-MIT-22c55e?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/Chrome-Extension-f59e0b?style=for-the-badge&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-ec4899?style=for-the-badge)](https://github.com/)

<br/>

[![Typing SVG](https://readme-typing-svg.demolab.com?font=Inter&weight=600&size=18&pause=1000&color=8B5CF6&center=true&vCenter=true&width=600&lines=Capture+any+part+of+any+webpage;Annotate+with+shapes%2C+arrows+%26+text;Export+as+PNG+or+JPEG+instantly;100%25+local+%E2%80%94+no+servers%2C+no+tracking)](https://git.io/typing-svg)

<br/>

> A zero-dependency Chrome extension that captures **visible area**, **full page**, or **custom selected regions** — then lets you annotate, draw, and export in seconds. No server. No data collection. Just fast, local screenshots.

</div>

<br/>

---

## ⚡ What Makes It Different

<table>
<tr>
<td width="50%">

### 🖼️ Three Capture Modes
- **Visible Area** — one-click viewport snapshot  
- **Full Page** — auto-scrolls, slices, and pixel-perfectly stitches the entire page  
- **Selected Region** — drag a custom bounding box over any part of the page  

</td>
<td width="50%">

### 🎨 Built-in Annotation Engine
- Rectangles, arrows, text labels, and highlights  
- Freehand pen / pencil drawing  
- Adjustable **color** and **stroke width** per tool  
- Per-step **Undo** (`Ctrl+Z`)  

</td>
</tr>
<tr>
<td width="50%">

### 💾 Flexible Export
- Download as **PNG** or **JPEG**  
- **Copy to clipboard** — paste anywhere instantly  
- Smart auto-filename: `screenshot_domain_YYYY-MM-DD_HH-MM-SS.ext`  

</td>
<td width="50%">

### ⌨️ Keyboard-First Workflow
- Trigger any capture mode **without opening the popup**  
- All shortcuts fully customisable via `chrome://extensions/shortcuts`  
- Dark / Light theme that persists across sessions  

</td>
</tr>
</table>

---

## 🚀 Installation

> **No Chrome Web Store needed** — load it directly from source in under a minute.

```bash
# 1. Clone or download the repository
git clone https://github.com/your-username/screenshot-master.git
```

| Step | Action |
|------|--------|
| **1** | Open Chrome and navigate to `chrome://extensions` |
| **2** | Enable **Developer mode** using the toggle in the top-right |
| **3** | Click **Load unpacked** and select the `Screenshot Master` folder |
| **4** | Pin the extension icon to your toolbar for quick access |

---

## 🎯 Usage

### One-Click Captures via Popup

Click the extension icon — three capture buttons are immediately available:

| Button | Shortcut | What It Does |
|--------|----------|-------------|
| **Visible Area** | `Alt+Shift+V` | Captures exactly what's visible in the viewport |
| **Full Page** | `Alt+Shift+F` | Scrolls the page, takes sliced screenshots, and stitches them into a single full-height image |
| **Selected Area** | `Alt+Shift+S` | Overlays a drag-to-select box — release to capture the chosen region |

> Shortcuts can be reassigned at `chrome://extensions/shortcuts`

---

### Preview & Annotation Workspace

After every capture, a **full-screen preview tab** opens automatically.

```
┌─────────────────────────────────────────────────────┐
│  [ Visible / Full Page / Selected ]  · dark ☾       │
├─────────────────────────────────────────────────────┤
│                                                     │
│           screenshot canvas (zoomable)              │
│         + annotation canvas (overlay)               │
│                                                     │
├─────────────────────────────────────────────────────┤
│  🟥 Rect  ➡ Arrow  T Text  🖊 Pen  🔦 Highlight  ↩ Undo │
│  Color ●  Stroke ━━━  │  PNG ▾  Download  Copy     │
└─────────────────────────────────────────────────────┘
```

**Tools available:**

| Tool | Behaviour |
|------|-----------|
| `Rectangle` | Draw filled or outlined rectangles to highlight regions |
| `Arrow` | Click and drag to place directional arrows |
| `Text` | Click anywhere to insert a custom text label |
| `Pen` | Freehand drawing — like a marker on the screen |
| `Highlight` | Semi-transparent overlay to draw attention to areas |
| `Undo` | Remove the last annotation step-by-step |

---

## 🏗️ Architecture

```
Screenshot Master/
│
├── manifest.json            ← Manifest V3 — permissions, shortcuts, icons
│
├── popup/                   ← Extension popup UI
│   ├── popup.html           ← Markup (Inter font, SVG icons)
│   ├── popup.css            ← Dark/light theme, capture buttons
│   └── popup.js             ← Sends capture mode to background worker
│
├── background/
│   └── background.js        ← Service worker: routes captures, slicing loop,
│                               scroll orchestration, selection listener
│
├── content/
│   └── content.js           ← Injected into pages: page dimensions, scroll,
│                               selection overlay (drag UI), capture overlay
│
├── preview/
│   ├── preview.html         ← Full-screen annotation workspace
│   ├── preview.css          ← Canvas layout, toolbar, dark/light theme
│   └── preview.js           ← Image assembly (stitch), annotation engine,
│                               tool handling, undo stack, export (PNG/JPEG)
│
└── utils/
    └── filename.js          ← Auto-generates domain + timestamp filename
```

### How Full-Page Capture Works

```
Popup ──► background.js ──► inject content.js
                │
                ├── getPageDimensions (scrollHeight, clientHeight)
                ├── hideScrollbars
                ├── showCaptureOverlay (progress: N/total)
                │
                └── for each slice:
                      scrollTo(i × clientHeight)
                      pauseOverlay → captureTab() → resumeOverlay
                │
                ├── hideCaptureOverlay + restoreScrollbars
                └── openPreview(slices[]) ──► preview.js stitches on canvas
```

---

## 🔒 Permissions

| Permission | Reason |
|------------|--------|
| `activeTab` | Capture the screenshot of the currently active tab |
| `scripting` | Inject content script for scroll control and selection overlay |
| `storage` | Persist theme setting and temporarily hold screenshot data between pages |

**Privacy:** No data is sent to any external server. All processing is local, in-browser. Storage is cleared immediately after the preview tab loads.

---

## 👥 Who Is This For?

| Role | Use Case |
|------|----------|
| **Developers** | Capture UI states, debug layout issues, document responsive breakpoints |
| **Designers** | Archive website designs, create reference screenshots |
| **QA / Testers** | Annotate and share bug reports with highlighted problem areas |
| **Students** | Save full-page articles and annotate for study notes |
| **Content Creators** | Produce clean, annotated screenshots for tutorials and posts |

---

## 📄 License

Released under the **MIT License** — free to use, modify, and distribute.

<div align="center">

<br/>

---

[![Version](https://img.shields.io/badge/version-2.1.2-6366f1?style=flat-square)](manifest.json)
[![Built%20With](https://img.shields.io/badge/built%20with-Manifest%20V3-8b5cf6?style=flat-square&logo=googlechrome&logoColor=white)](manifest.json)
[![License](https://img.shields.io/badge/license-MIT-22c55e?style=flat-square)](LICENSE)

<sub>Made with ♥ for developers who live in the browser</sub>

<br/>

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:6366f1,50:8b5cf6,100:ec4899&height=4&section=footer" width="100%" alt="footer line"/>

</div>
