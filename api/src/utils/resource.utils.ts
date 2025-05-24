export function extractResourceName(uri: string): string {
	try {
		const url = new URL(uri);

		// Extract the base protocol type
		//The protocols can be completely different, eg. 'filesystem-local', 'filesystem-2', 'notion-customWorkspace', etc
		const protocolBase = url.protocol.split('-')[0].replace(':', '');

		switch (protocolBase) {
			case 'filesystem':
				return url.pathname.split('/').pop() || '';

			// [TODO] mcp URL's can be more varied than this
			case 'mcp':
				return url.hostname;

			case 'notion': {
				const segments = url.pathname.split('/');
				return segments[segments.length - 1];
			}

			default:
				// Default fallback - get the last path segment
				return url.pathname ? url.pathname.split('/').pop() || '' : url.hostname;
		}
	} catch (error) {
		// Handle malformed URIs
		console.error(`Failed to parse URI: ${uri}`, error);
		return uri.split('/').pop() || uri;
	}
}
