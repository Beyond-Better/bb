// Enhanced MIME type detection system to handle both text and binary files correctly
import { contentType } from '@std/media-types';
import { extname } from '@std/path';
import { logger } from 'shared/logger.ts';

// Map of source code file extensions to their appropriate MIME types
const sourceCodeTypes: Record<string, string> = {
	'.epub': 'application/epub+zip',
	'.gz': 'application/gzip',
	'.jar': 'application/java-archive',
	'.json': 'application/json',
	'.jsonld': 'application/ld+json',
	'.doc': 'application/msword',
	'.bin': 'application/octet-stream',
	'.pdf': 'application/pdf',
	'.rtf': 'application/rtf',
	'.azw': 'application/vnd.amazon.ebook',
	'.xls': 'application/vnd.ms-excel',
	'.ppt': 'application/vnd.ms-powerpoint',
	'.odp': 'application/vnd.oasis.opendocument.presentation',
	'.ods': 'application/vnd.oasis.opendocument.spreadsheet',
	'.odt': 'application/vnd.oasis.opendocument.text',
	'.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	'.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'.bz': 'application/x-bzip',
	'.bzip': 'application/x-bzip',
	'.bz2': 'application/x-bzip2',
	'.csh': 'application/x-csh',
	'.php': 'application/x-httpd-php',
	'.tar': 'application/x-tar',
	'.xhtml': 'application/xhtml+xml',
	'.zip': 'application/zip',
	'.aac': 'audio/aac',
	'.mp3': 'audio/mpeg',
	'.weba': 'audio/webm',
	'.apng': 'image/apng',
	'.avif': 'image/avif',
	'.bmp': 'image/bmp',
	'.gif': 'image/gif',
	'.jpeg': 'image/jpeg',
	'.jpg': 'image/jpeg',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.tif': 'image/tiff',
	'.tiff': 'image/tiff',
	'.ico': 'image/vnd.microsoft.icon',
	'.webp': 'image/webp',
	'.ics': 'text/calendar',
	'.css': 'text/css',
	'.csv': 'text/csv',
	'.htm': 'text/html',
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.jsx': 'text/javascript',
	'.mjs': 'text/javascript',
	'.markdown': 'text/markdown',
	'.md': 'text/markdown',
	'.txt': 'text/plain',
	'.rb': 'text/ruby',
	'.ts': 'text/typescript',
	'.tsx': 'text/typescript',
	'.c': 'text/x-c',
	'.h': 'text/x-c',
	'.cpp': 'text/x-c++',
	'.hpp': 'text/x-c++',
	'.cs': 'text/x-csharp',
	'.go': 'text/x-go',
	'.graphql': 'text/x-graphql',
	'.ini': 'text/x-ini',
	'.java': 'text/x-java',
	'.less': 'text/x-less',
	'.proto': 'text/x-protobuf',
	'.py': 'text/x-python',
	'.rs': 'text/x-rust',
	'.scss': 'text/x-scss',
	'.bash': 'text/x-shellscript',
	'.fish': 'text/x-shellscript',
	'.sh': 'text/x-shellscript',
	'.zsh': 'text/x-shellscript',
	'.sql': 'text/x-sql',
	'.toml': 'text/x-toml',
	'.xml': 'text/xml',
	'.yaml': 'text/yaml',
	'.yml': 'text/yaml',
	'.mp4': 'video/mp4',
	'.mpeg': 'video/mpeg',
	'.webm': 'video/webm',
	'.avi': 'video/x-msvideo',
};

/**
 * Checks if content appears to be binary by examining a sample
 * @param buffer Sample of file content to analyze
 * @returns true if content appears to be binary, false if it appears to be text
 */
export function isBinaryContent(buffer: Uint8Array): boolean {
  // Check for NULL bytes or unexpected control characters
  const sampleSize = Math.min(buffer.length, 1024);
  let textCharCount = 0;
  let binaryCharCount = 0;

  for (let i = 0; i < sampleSize; i++) {
    const byte = buffer[i];
    // NULL byte or control characters (except common ones like tab, newline, etc.)
    if (byte === 0 || (byte < 32 && ![9, 10, 13].includes(byte))) {
      binaryCharCount++;
    } else if (byte <= 127) {
      // ASCII text characters
      textCharCount++;
    }
  }

  // If we found any NULL bytes, almost certainly binary
  if (buffer.includes(0)) {
    return true;
  }

  // If more than 10% appear to be binary, consider it binary
  return (binaryCharCount / sampleSize) > 0.1;
}

/**
 * Get the MIME type for a file based on its extension.
 * Prioritizes source code file types with appropriate MIME types,
 * falling back to std/media-types for other files.
 *
 * @param filePath - The path to the file (only the extension is used)
 * @returns The MIME type string or a default type if unknown
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

/**
 * Comprehensively detect the MIME type of a file using multiple methods
 * 1. First tries custom extension mapping
 * 2. Then analyzes file content if needed
 * 3. Falls back to standard media type detection
 *
 * @param filePath Full path to the file
 * @returns The detected MIME type string
 */
export async function detectContentType(filePath: string): Promise<string> {
  // Skip content checks for directories
  try {
    const fileInfo = await Deno.stat(filePath);
    if (fileInfo.isDirectory) {
      return 'application/directory';
    }
  } catch (error) {
    // If we can't stat the file, proceed with extension-based checks
    logger.debug(`Error getting file info for ${filePath}: ${(error as Error).message}`);
  }
  
  // 1. First try our custom MIME mapping
  const mimeType = getContentType(filePath);
  
  // If we got a specific type (not the generic octet-stream), use it
  if (mimeType && mimeType !== 'application/octet-stream') {
    return mimeType;
  }
  
  try {
    // 2. For uncertain types, check the actual content
    const file = await Deno.open(filePath, { read: true });
    const buffer = new Uint8Array(1024);
    const bytesRead = await file.read(buffer);
    file.close();
    
    if (bytesRead === null) {
      // Empty file, treat as text
      return 'text/plain';
    }
    
    const actualBuffer = buffer.subarray(0, bytesRead);
    const isBinary = isBinaryContent(actualBuffer);
    
    if (!isBinary) {
      // It's text content, so use a generic text type
      return 'text/plain';
    }
  } catch (error) {
    // If we can't read the file, just log and continue with the original type
    logger.debug(`Unable to read file for MIME detection: ${filePath}. Using extension-based type.`);
  }
  
  // 3. If we're here, it seems to be binary or we couldn't check, so use the original type
  return mimeType;
}

/**
 * Determines if a MIME type represents text content
 * @param mimeType The MIME type to check
 * @returns true if it represents text content, false otherwise
 */
export function isTextMimeType(mimeType: string): boolean {
  return mimeType.startsWith('text/') || 
         mimeType === 'application/json' ||
         mimeType === 'application/xml' ||
         mimeType.includes('+json') ||
         mimeType.includes('+xml') ||
         mimeType === 'application/javascript' ||
         mimeType === 'application/typescript';
}