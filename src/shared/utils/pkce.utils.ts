/**
 * PKCE Utility Functions
 * Generate cryptographically secure parameters for OAuth PKCE flow
 */

/**
 * Generate a cryptographically random string for PKCE code verifier
 * @param length Length of the generated string (43-128 chars per RFC 7636)
 */
export function generateRandomString(length: number): string {
	const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
	const array = new Uint8Array(length);
	crypto.getRandomValues(array);
	return Array.from(array, (byte) => charset[byte % charset.length]).join('');
}

export function generateCodeVerifier(): string {
	return generateRandomString(128);
}

/**
 * Generate PKCE code challenge from code verifier using SHA256
 * @param codeVerifier The code verifier string
 * @returns Base64url-encoded SHA256 hash of the verifier
 */
export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
	// Create SHA256 hash of the code verifier
	const encoder = new TextEncoder();
	const data = encoder.encode(codeVerifier);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);

	// Convert to base64url encoding (RFC 4648 Section 5)
	const base64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
	return base64
		.replace(/\+/g, '-') // Replace + with -
		.replace(/\//g, '_') // Replace / with _
		.replace(/=/g, ''); // Remove padding =
}
