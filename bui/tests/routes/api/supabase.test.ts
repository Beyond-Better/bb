import { assertEquals } from 'testing/asserts.ts';
import { handler } from './supabase.ts';
import { ConfigManagerV2 } from 'shared/config/v2/configManager.ts';

// Mock config data
const mockConfig = {
	bui: {
		supabaseUrl: 'https://test.supabase.co',
		supabaseAnonKey: 'test-anon-key',
	},
};

// Mock ConfigManagerV2
ConfigManagerV2.getInstance = async () =>
	({
		getGlobalConfig: async () => mockConfig,
	}) as unknown as ConfigManagerV2;

Deno.test('Supabase Config Handler', async (t) => {
	await t.step('returns Supabase config', async () => {
		const response = await handler.GET(new Request('http://localhost'), {});
		assertEquals(response.status, 200);
		assertEquals(response.headers.get('Content-Type'), 'application/json');

		const body = await response.json();
		assertEquals(body, {
			url: mockConfig.bui.supabaseUrl,
			anonKey: mockConfig.bui.supabaseAnonKey,
		});
	});
});
