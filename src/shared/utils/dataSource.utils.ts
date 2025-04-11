import crypto from 'node:crypto';

export function parseDataSourceUri(uri: string): {
	uriPrefix: string;
	accessMethod: string;
	dataSourceType: string;
	dataSourceName: string;
	originalUri: string;
	resourceType: string;
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
	const prefixParts = fullScheme.split('+'); //{accessMethod}-{dataSourceType}+{dataSourceName}+{originalScheme}

	// Check for valid format
	if (prefixParts.length < 3) {
		throw new Error('Invalid data source URI format');
	}

	// Extract components
	const accessTypeParts = prefixParts[0].split('-'); //{accessMethod}-{dataSourceType}
	if (accessTypeParts.length !== 2) {
		throw new Error('Invalid prefix format');
	}

	const accessMethod = accessTypeParts[0]; // "bb" or "mcp"
	const dataSourceType = accessTypeParts[1]; // "filesystem", "database", etc.
	const dataSourceName = prefixParts[1]; // Normalized data source name
	const originalScheme = prefixParts[2]; // Original URI scheme

	const uriPrefix = `${accessMethod}-${dataSourceType}+${dataSourceName}`;
	// Reconstruct the original URI
	const originalUri = `${originalScheme}${restOfUri}`;

	const parsedOriginalUri = URL.parse(originalUri);
	let resourceType = '';
	if (parsedOriginalUri) {
		resourceType = parsedOriginalUri.protocol.slice(0, -1); // Removes trailing colon
	}

	return {
		uriPrefix,
		accessMethod,
		dataSourceType,
		dataSourceName,
		originalUri,
		resourceType,
	};
}

export function generateDataSourcePrefix(
	accessMethod: string,
	type: string,
	name: string,
): string {
	const normalizedName = name
		.toLowerCase()
		.replace(/\s+/g, '-')
		.replace(/[^\w-]/g, ''); // Remove non-alphanumeric chars except hyphens
	return `${accessMethod}-${type}+${normalizedName}`;
}

export function generateDataSourceUri(
	accessMethod: string,
	type: string,
	name: string,
	originalUri: string,
): string {
	const uriPrefix = generateDataSourcePrefix(accessMethod, type, name);
	return `${uriPrefix}+${originalUri}`;
}

export function parsePreservingRelative(url: string): { href: string; pathname: string } {
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
