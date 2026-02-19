/** Shared TypeScript type definitions. */

/** A single file or directory entry returned by the API. */
export interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  size: number | null;
  modified: string;
  extension: string | null;
  editable: boolean;
}

/** The full response from GET /api/files. */
export interface DirectoryListing {
  path: string;
  parent: string | null;
  entries: FileEntry[];
}

/** Payload sent to POST /api/log. */
export interface ClientLogEntry {
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  stack?: string;
  url?: string;
  line?: number;
  col?: number;
  userAgent?: string;
  timestamp?: string;
}

/** An entry in the on-screen debug panel. */
export interface DebugMessage {
  level: string;
  message: string;
  timestamp: Date;
}
