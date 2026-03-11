/**
 * Generate an automatic filename for a screenshot.
 * Format: screenshot_<domain>_<YYYY-MM-DD>_<HH-MM-SS>.<ext>
 */
function generateFilename(url, format = 'png') {
  let domain = 'unknown';
  try {
    domain = new URL(url).hostname.replace(/^www\./, '');
  } catch (_) {}

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

  return `screenshot_${domain}_${date}_${time}.${format}`;
}
