/**
 * VLC URL-scheme integration.
 *
 * On iOS, VLC can be launched via the `vlc://` custom URL scheme
 * to directly stream or open a file URL.
 */

import { getDownloadUrl } from './api';
import { isVideoFile, isAudioFile } from './utils';

/** Whether the given extension can be opened in VLC. */
export function canOpenInVlc(extension: string | null): boolean {
  return isVideoFile(extension) || isAudioFile(extension);
}

/** Build a `vlc://` URL that will open the file in VLC on iOS. */
export function getVlcUrl(filePath: string): string {
  const downloadUrl = getDownloadUrl(filePath);
  const baseUrl = window.location.protocol + '//' + window.location.host;
  const fullUrl = baseUrl + downloadUrl;
  return 'vlc://' + fullUrl;
}
