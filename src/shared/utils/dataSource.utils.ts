import crypto from 'node:crypto';

import { logger } from 'shared/logger.ts';
import type { DataSourceProviderType } from 'shared/types/dataSource.ts';

/**
 * Parse a data source URI into its components
 * @param uri The URI to parse
 * @returns The parsed components or null if invalid
 */
// export function parseDataSourceUri(uri: string): {
// 	prefix: string;
// 	accessMethod: string;
// 	providerType: DataSourceProviderType;
// 	name?: string;
// 	resourcePath: string;
// } | null {
// 	// Match the URI pattern
// 	const match = uri.match(/^([^:]+):\/\/(.*)$/);
// 	if (!match) {
// 		return null;
// 	}
//
// 	const [, prefix, resourcePath] = match;
//
// 	// Split the prefix into its components
// 	const parts = prefix.split('+');
// 	if (parts.length < 2) {
// 		return null;
// 	}
//
// 	const accessMethod = parts[0];
// 	const providerType = parts[1];
// 	const name = parts.length > 2 ? parts[2] : undefined;
//
// 	return {
// 		prefix,
// 		accessMethod,
// 		providerType,
// 		name,
// 		resourcePath,
// 	};
// }
export function parseDataSourceUri(uri: string): {
	uriPrefix: string;
	accessMethod: string;
	providerType: string;
	dataSourceName: string;
	originalUri: string;
	resourceType: string;
	resourcePath: string;
} {
	// Find the scheme delimiter - could be "://" or just ":"
	const stdDelimiterIndex = uri.indexOf('://');
	const colonIndex = uri.indexOf(':');

	let schemeEndIndex: number;
	let delimiter: string;

	if (stdDelimiterIndex !== -1 && stdDelimiterIndex === colonIndex) {
		// Standard "://" delimiter
		schemeEndIndex = stdDelimiterIndex;
		delimiter = '://';
	} else {
		// Simple ":" delimiter (like mailto:)
		schemeEndIndex = colonIndex;
		delimiter = ':';
	}

	if (schemeEndIndex === -1) {
		throw new Error('Invalid URI format');
	}

	const fullScheme = uri.substring(0, schemeEndIndex);
	const restOfUri = uri.substring(schemeEndIndex);

	// Split the fullScheme by "+" delimiters
	const prefixParts = fullScheme.split('+'); //{accessMethod}+{providerType}+{dataSourceName}+{originalScheme}

	// Check for valid format
	if (prefixParts.length < 4) {
		throw new Error('Invalid data source URI format');
	}

	const accessMethod = prefixParts[0]; // "bb" or "mcp"
	const providerType = prefixParts[1]; // "filesystem", "database", etc.
	const dataSourceName = prefixParts[2]; // Normalized data source name
	const originalScheme = prefixParts[3]; // Original URI scheme

	const uriPrefix = `${accessMethod}+${providerType}+${dataSourceName}`;
	// Reconstruct the original URI
	const originalUri = `${originalScheme}${restOfUri}`;

	const parsedOriginalUri = URL.parse(originalUri);
	//logger.info(`DataSourceUtils: parseDataSourceUri: ${uri}`, { parsedOriginalUri });
	let resourceType = '';
	let resourcePath = '';
	if (parsedOriginalUri) {
		resourceType = parsedOriginalUri.protocol.slice(0, -1); // Removes trailing colon
		resourcePath = resourceType === 'file'
			//? `.${parsedOriginalUri.pathname}` // make file URL relative path - it's not valid URI path though
			? parsePreservingRelative(originalUri).pathname // make file URL relative path - it's not valid URI path though
			: resourceType.startsWith('http') // [TODO] this needs to be way more robust - there is ftp:// and so many more...
			? parsedOriginalUri.pathname // + parsedOriginalUri.search + parsedOriginalUri.hash
			: `${parsedOriginalUri.hostname}${parsedOriginalUri.pathname}`; // + parsedOriginalUri.search + parsedOriginalUri.hash
	}
	//logger.info(`DataSourceUtils: parseDataSourceUri: ${uri}`, { resourceType, resourcePath });

	return {
		uriPrefix,
		accessMethod,
		providerType,
		dataSourceName,
		originalUri,
		resourceType,
		resourcePath,
	};
}

/**
 * Sanitize a string for use in a URI
 * @param str The string to sanitize
 * @returns The sanitized string
 */
function sanitizeForUri(str: string): string {
	return str
		.toLowerCase()
		.replace(/\s+/g, '-') // Replace spaces with hyphens
		.replace(/[^\w-]/g, ''); // Remove non-alphanumeric chars except hyphens
	//.replace(/[^-_a-z0-9]/g, '') // Remove non-alphanumeric characters except hyphens and underscores
	//.replace(/--+/g, '-'); // Replace multiple hyphens with a single hyphen
}

/**
 * Generate a URI prefix for a data source
 * @param accessMethod The access method (bb or mcp)
 * @param providerType The provider type
 * @param name Optional name for uniqueness
 * @returns A URI prefix string
 */
export function generateDataSourcePrefix(
	accessMethod: string,
	providerType: DataSourceProviderType,
	name?: string,
): string {
	// Sanitize the name for use in a URI
	const sanitizedName = name ? sanitizeForUri(name) : '';

	// Create the prefix
	if (sanitizedName) {
		return `${accessMethod}+${providerType}+${sanitizedName}`;
	} else {
		return `${accessMethod}+${providerType}`;
	}
}

/**
 * Generate a complete URI for a resource in a data source
 * @param accessMethod The access method (bb or mcp)
 * @param providerType The provider type
 * @param name Optional name for uniqueness
 * @param resourcePath The path to the resource
 * @returns A complete URI string
 */
// export function generateDataSourceUri(
// 	accessMethod: string,
// 	providerType: DataSourceProviderType,
// 	name: string | undefined,
// 	resourcePath: string,
// ): string {
// 	const prefix = generateDataSourcePrefix(accessMethod, providerType, name);
// 	return `${prefix}://${resourcePath}`;
// }

export function generateDataSourceUri(
	accessMethod: string,
	providerType: DataSourceProviderType,
	name: string | undefined,
	originalUri: string,
): string {
	const uriPrefix = generateDataSourcePrefix(accessMethod, providerType, name);
	return `${uriPrefix}+${originalUri}`;
}

export function parsePreservingRelative(url: string): { href: string; pathname: string } {
	//logger.info(`DataSourceUtils: parsePreservingRelative: ${url}`);
	if (url.startsWith('file:.')) {
		const parsedUrl = new URL(url);
		// Extract the original relative path
		const relativePath = url.substring(7); // Remove "file:./"
		return {
			href: parsedUrl.href,
			pathname: relativePath,
			// Add other URL properties as needed
		};
	}
	return URL.parse(url) || { href: url, pathname: '' };
}

// Add this method to your class
// export function generateResourceUriKeyB64(uri: string): string {
// 	// Base64 encode the URI to handle special characters and maintain uniqueness
// 	const base64 = btoa(uri);
// 	// Replace characters that are problematic in filenames
// 	// Base64 can contain '/' and '+' which are problematic on some filesystems
// 	return base64
// 		.replace(/\//g, '_')
// 		.replace(/\+/g, '-')
// 		.replace(/=/g, '');
// }
// export async function generateResourceUriKey(uri: string): Promise<string> {
// 	// Create a SHA-256 hash of the URI
// 	const encoder = new TextEncoder();
// 	const data = encoder.encode(uri);
// 	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
//
// 	// Convert the hash to a hex string
// 	const hashArray = Array.from(new Uint8Array(hashBuffer));
// 	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
//
// 	// For debugging/lookup purposes, you might want to keep a prefix of the original URI
// 	// that's still readable, combined with the hash
// 	const { originalUri } = parseDataSourceUri(uri);
// 	const { pathname } = parsePreservingRelative(originalUri);
//
// 	const safePrefix = pathname
// 		.replace(/[^a-zA-Z0-9]/g, '_') // Replace non-alphanumeric chars with underscore
// 		.substring(0, 30); // Limit prefix length
//
// 	return `${safePrefix}_${hashHex}`;
// }
export function generateResourceUriKey(uri: string): string {
	// Create a SHA-256 hash of the URI
	const hashHex = crypto.hash('sha256', uri);

	// For debugging/lookup purposes, you might want to keep a prefix of the original URI
	// that's still readable, combined with the hash
	const { originalUri } = parseDataSourceUri(uri);
	const { pathname } = parsePreservingRelative(originalUri);

	const safePrefix = pathname
		.replace(/[^a-zA-Z0-9]/g, '_') // Replace non-alphanumeric chars with underscore
		.substring(0, 30); // Limit prefix length

	return `${safePrefix}_${hashHex}`;
}
export function generateResourceRevisionKey(resourceUri: string, revisionId: string): string {
	const resourceKey = generateResourceUriKey(resourceUri);
	return `${resourceKey}_rev_${revisionId}`;
}

// 	export async function generateRevisionId(content: string): Promise<string> {
// 		const encoder = new TextEncoder();
// 		const data = encoder.encode(content);
// 		const hashBuffer = await crypto.subtle.digest('SHA-256', data);
// 		return encodeHex(new Uint8Array(hashBuffer));
// 	}

export function extractResourceKeyAndRevision(
	resourceRevisionKey: string,
): { resourceKey: string; resourceRevision: string } {
	const lastRevIndex = resourceRevisionKey.lastIndexOf('_rev_');
	const resourceKey = resourceRevisionKey.slice(0, lastRevIndex);
	const resourceRevision = resourceRevisionKey.slice(lastRevIndex + 5);
	return { resourceKey, resourceRevision };
}

/**
 * Extracts the data source prefix from a URI
 * @param uri The URI to extract from
 * @returns The data source prefix or null if invalid
 */
export function extractDataSourcePrefix(uri: string): string | null {
	const parsed = parseDataSourceUri(uri);
	return parsed ? parsed.uriPrefix : null;
}

/**
 * Extracts the resource path from a URI
 * @param uri The URI to extract from
 * @returns The resource path or null if invalid
 */
export function extractResourcePath(uri: string): string | null {
	const parsed = parseDataSourceUri(uri);
	return parsed ? parsed.resourcePath : null;
}
