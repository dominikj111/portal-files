/** Shared utility / formatting functions. */

// ---------------------------------------------------------------------------
// Size formatting
// ---------------------------------------------------------------------------

/** Format a byte count as a human-readable string (e.g. "1.2 MB"). */
export function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '--';
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = (bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0);
  return size + ' ' + units[i];
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

/** Format an ISO-8601 date string for display. */
export function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  } catch (_e) {
    return isoString;
  }
}

// ---------------------------------------------------------------------------
// File-type helpers
// ---------------------------------------------------------------------------

const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'];
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'];
const DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'];
const SPREADSHEET_EXTENSIONS = ['xls', 'xlsx', 'csv', 'ods'];
const ARCHIVE_EXTENSIONS = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'];
const CODE_EXTENSIONS = ['js', 'ts', 'py', 'html', 'css', 'json', 'xml', 'yaml', 'yml', 'sh', 'md'];

function inList(value: string, list: string[]): boolean {
  for (let i = 0; i < list.length; i++) {
    if (list[i] === value) return true;
  }
  return false;
}

/** Return an emoji icon for a file entry based on its type / extension. */
export function getFileIcon(entry: { type: string; extension: string | null }): string {
  if (entry.type === 'directory') return '\u25A0'; // ■ folder
  const ext = entry.extension;
  if (!ext) return '\u25A1'; // □ generic file

  if (inList(ext, VIDEO_EXTENSIONS)) return '\u25B6'; // ▶ video
  if (inList(ext, AUDIO_EXTENSIONS)) return '\u266B'; // ♫ audio
  if (inList(ext, IMAGE_EXTENSIONS)) return '\u2600'; // ☀ image
  if (inList(ext, DOCUMENT_EXTENSIONS)) return '\u2261'; // ≡ document
  if (inList(ext, SPREADSHEET_EXTENSIONS)) return '\u2637'; // ☷ spreadsheet
  if (inList(ext, ARCHIVE_EXTENSIONS)) return '\u2338'; // ⌸ archive
  if (inList(ext, CODE_EXTENSIONS)) return '\u2039\u203A'; // ‹› code
  return '\u25A1'; // □ generic file
}

/** Check whether the extension belongs to a video file. */
export function isVideoFile(extension: string | null): boolean {
  if (!extension) return false;
  return inList(extension, VIDEO_EXTENSIONS);
}

/** Check whether the extension belongs to an audio file. */
export function isAudioFile(extension: string | null): boolean {
  if (!extension) return false;
  return inList(extension, AUDIO_EXTENSIONS);
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

/** Escape a string for safe insertion into innerHTML. */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}
