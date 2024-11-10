import { contentType } from '@std/media-types';
import { extname } from '@std/path';

// Map of source code file extensions to their appropriate MIME types
const sourceCodeTypes: Record<string, string> = {
  '.ts': 'text/typescript',
  '.tsx': 'text/typescript',
  '.js': 'text/javascript',
  '.jsx': 'text/javascript',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.py': 'text/x-python',
  '.rb': 'text/ruby',
  '.java': 'text/x-java-source',
  '.c': 'text/x-c',
  '.cpp': 'text/x-c++',
  '.h': 'text/x-c',
  '.hpp': 'text/x-c++',
  '.cs': 'text/x-csharp',
  '.go': 'text/x-go',
  '.rs': 'text/x-rust',
  '.html': 'text/html',
  '.css': 'text/css',
  '.scss': 'text/x-scss',
  '.less': 'text/x-less',
  '.xml': 'text/xml',
  '.svg': 'image/svg+xml',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.toml': 'text/x-toml',
  '.ini': 'text/x-ini',
  '.sh': 'text/x-shellscript',
  '.bash': 'text/x-shellscript',
  '.zsh': 'text/x-shellscript',
  '.fish': 'text/x-shellscript',
  '.sql': 'text/x-sql',
  '.graphql': 'text/x-graphql',
  '.proto': 'text/x-protobuf',
};

/**
 * Get the MIME type for a file based on its extension.
 * Prioritizes source code file types with appropriate MIME types,
 * falling back to std/media-types for other files.
 * 
 * @param filePath - The path to the file (only the extension is used)
 * @returns The MIME type string
 * 
 * @example
 * ```ts
 * getContentType('src/main.ts') // returns 'text/typescript'
 * getContentType('image.png')   // returns 'image/png'
 * ```
 */
export function getContentType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  
  // Check for known source code extensions first
  if (ext in sourceCodeTypes) {
    return sourceCodeTypes[ext];
  }

  // Fall back to std/media-types for other file types
  return contentType(ext) || 'application/octet-stream';
}