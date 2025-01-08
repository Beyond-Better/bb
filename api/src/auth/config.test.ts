import { assertEquals, assertThrows } from 'testing/asserts.ts';
import { fetchSupabaseConfig, validateSupabaseConfig } from './config.ts';
import { ConfigFetchError } from '../types/auth.ts';
import { ConfigManagerV2 } from '../../../src/shared/config/v2/configManager.ts';

// Mock ConfigManagerV2
const mockGlobalConfig = {
	api: {
		supabaseConfigUrl: 'https://test.example.com/api/config/supabase',
	},
};

ConfigManagerV2.getInstance = async () =>
	({
		getGlobalConfig: async () => mockGlobalConfig,
	}) as unknown as ConfigManagerV2;

Deno.test('validateSupabaseConfig', async (t) => {
	await t.step('validates correct config', () => {
		const validConfig = {
			url: 'https://example.supabase.co',
			anonKey: 'valid-key-123',
		};

		const result = validateSupabaseConfig(validConfig);
		assertEquals(result, true);
	});

	await t.step('rejects non-object input', () => {
		assertThrows(
			() => validateSupabaseConfig('not an object'),
			ConfigFetchError,
			'Invalid config: Config must be an object',
		);
	});

	await t.step('rejects missing url', () => {
		assertThrows(
			() => validateSupabaseConfig({ anonKey: 'valid-key' }),
			ConfigFetchError,
			'Invalid config: url must be a non-empty string',
		);
	});

	await t.step('rejects missing anonKey', () => {
		assertThrows(
			() => validateSupabaseConfig({ url: 'https://example.com' }),
			ConfigFetchError,
			'Invalid config: anonKey must be a non-empty string',
		);
	});

	await t.step('rejects invalid URL', () => {
		assertThrows(
			() => validateSupabaseConfig({ url: 'not-a-url', anonKey: 'valid-key' }),
			ConfigFetchError,
			'Invalid config: url must be a valid URL',
		);
	});

	await t.step('rejects invalid anonKey characters', () => {
		assertThrows(
			() =>
				validateSupabaseConfig({
					url: 'https://example.com',
					anonKey: 'invalid!@#key',
				}),
			ConfigFetchError,
			'Invalid config: anonKey contains invalid characters',
		);
	});
});

Deno.test('fetchSupabaseConfig', async (t) => {
	// Mock fetch for testing
	const originalFetch = globalThis.fetch;

	await t.step('succeeds with valid response', async () => {
		const validConfig = {
			url: 'https://example.supabase.co',
			anonKey: 'valid-key-123',
		};

		globalThis.fetch = async () =>
			new Response(
				JSON.stringify(validConfig),
				{ status: 200 },
			);

		const config = await fetchSupabaseConfig({ maxRetries: 1, retryDelay: 0 });
		assertEquals(config, validConfig);
	});

	await t.step('retries on failure', async () => {
		let attempts = 0;
		globalThis.fetch = async () => {
			attempts++;
			if (attempts < 2) {
				throw new Error('Network error');
			}
			return new Response(
				JSON.stringify({
					url: 'https://example.supabase.co',
					anonKey: 'valid-key-123',
				}),
				{ status: 200 },
			);
		};

		const config = await fetchSupabaseConfig({ maxRetries: 2, retryDelay: 0 });
		assertEquals(attempts, 2);
		assertEquals(config.url, 'https://example.supabase.co');
	});

	await t.step('fails after max retries', async () => {
		globalThis.fetch = async () => {
			throw new Error('Network error');
		};

		await assertThrows(
			() => fetchSupabaseConfig({ maxRetries: 2, retryDelay: 0 }),
			ConfigFetchError,
			'Failed to fetch Supabase config (attempt 2): Network error',
		);
	});

	await t.step('fails on invalid response data', async () => {
		globalThis.fetch = async () =>
			new Response(
				JSON.stringify({ invalid: 'config' }),
				{ status: 200 },
			);

		await assertThrows(
			() => fetchSupabaseConfig({ maxRetries: 1, retryDelay: 0 }),
			ConfigFetchError,
			'Invalid config: url must be a non-empty string',
		);
	});

	// Restore original fetch
	t.teardown(() => {
		globalThis.fetch = originalFetch;
	});
});
