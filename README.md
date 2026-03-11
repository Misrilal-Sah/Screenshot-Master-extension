# 📸 Screenshot Master

A lightweight Chrome extension for capturing high-quality webpage screenshots - visible area, full page, or custom selected regions - with built-in annotation tools and instant export.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Visible Area Capture** | Instantly capture the current viewport |
| **Full Page Capture** | Auto-scrolls and stitches the entire page into one image |
| **Selected Area Capture** | Drag to select and capture a specific region |
| **Freehand Drawing** | Draw on screenshots like a pencil/pen tool |
| **Annotations** | Add rectangles, arrows, text labels, and highlights |
| **Export** | Download as PNG or JPEG, or copy to clipboard |
| **Keyboard Shortcuts** | Capture without opening the popup |
| **Dark / Light Mode** | Toggle theme in popup and preview |
| **Auto Filename** | Files named with domain + timestamp |

---

## 🚀 Installation

1. Download or clone this repository
2. Open Chrome → navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked** → select the `Screenshot Master` folder
5. Pin the extension for quick access

---

## 🎯 Usage

### Popup
Click the extension icon to open the popup with three capture buttons:
- **Visible Area** — captures what you currently see
- **Full Page** — scrolls and captures the entire page
- **Selected Area** — lets you drag a region to capture

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Alt+Shift+V` | Capture visible area |
| `Alt+Shift+F` | Capture full page |
| `Alt+Shift+S` | Capture selected area |

> Shortcuts can be customized in `chrome://extensions/shortcuts`

### Preview & Annotation
After capturing, a preview tab opens where you can:
- **Annotate** — rectangles, arrows, text, highlights, freehand pen
- **Choose color & stroke width** for all annotation tools
- **Undo** annotations (Ctrl+Z)
- **Download** as PNG or JPEG
- **Copy** to clipboard
- **Toggle** dark/light theme

---

## 📁 Project Structure

```
Screenshot Master/
├── manifest.json            # Chrome Extension Manifest V3
├── icons/                   # Extension icons
├── popup/                   # Popup interface
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── background/              # Service worker (capture logic)
│   └── background.js
├── content/                 # Injected into pages
│   └── content.js
├── preview/                 # Screenshot preview + annotations
│   ├── preview.html
│   ├── preview.css
│   └── preview.js
└── utils/
    └── filename.js          # Auto filename generator
```

---

## 🔒 Permissions

| Permission | Why |
|------------|-----|
| `activeTab` | Capture the current tab's visible content |
| `scripting` | Inject content script for scrolling & selection |
| `storage` | Persist theme preference and pass screenshot data |

No background data collection. No external network requests.

---

## 🎨 Target Users

- **Developers** — capture UI layouts and debug visuals
- **Designers** — document website designs
- **Testers** — create annotated bug reports
- **Students** — save webpage content for reference
- **Content Creators** — share annotated screenshots

---

## 📄 License

MIT License — free to use, modify, and distribute.
