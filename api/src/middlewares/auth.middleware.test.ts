import { assertEquals } from 'testing/asserts.ts';
import { Context, testing } from 'oak';
import { authMiddleware, requireAuth } from './auth.middleware.ts';
import { ConfigManagerV2 } from 'shared/config/configManager.ts';
import type { BbState } from '../types/app.types.ts';
import type { Session } from '../types/auth.ts';

// Mock session data
const mockSession: Session = {
	user: {
		id: 'test-user-id',
		email: 'test@example.com',
	},
	access_token: 'test-access-token',
	refresh_token: 'test-refresh-token',
	expires_at: Date.now() + 3600000,
};

// Mock session manager
const mockSessionManager = {
	getSession: async () => mockSession,
};

// Mock unauthenticated session manager
const mockUnauthenticatedSessionManager = {
	getSession: async () => null,
};

// Helper to create mock context
function createMockContext(
	path: string,
	authenticated = true,
	localMode = false,
) {
	const ctx = testing.createMockContext<BbState>({
		path: `/api/v1${path}`,
	});

	// Mock app state
	ctx.app = {
		state: {
			auth: {
				sessionManager: authenticated ? mockSessionManager : mockUnauthenticatedSessionManager,
			},
		},
	} as any;

	// Mock config manager
	ConfigManagerV2.getInstance = async () =>
		({
			getGlobalConfig: async () => ({
				api: {
					localMode,
				},
			}),
		}) as unknown as ConfigManagerV2;

	return ctx;
}

Deno.test('Auth Middleware', async (t) => {
	await t.step('skips auth check in localMode', async () => {
		const ctx = createMockContext('/protected', false, true);
		let nextCalled = false;

		await authMiddleware(ctx as Context<BbState>, async () => {
			nextCalled = true;
		});

		assertEquals(nextCalled, true);
		assertEquals(ctx.response.status, undefined);
	});

	await t.step('allows authenticated requests', async () => {
		const ctx = createMockContext('/protected', true, false);
		let nextCalled = false;

		await authMiddleware(ctx as Context<BbState>, async () => {
			nextCalled = true;
		});

		assertEquals(nextCalled, true);
		assertEquals(ctx.response.status, undefined);
		assertEquals(ctx.state.session, mockSession);
	});

	await t.step('blocks unauthenticated requests', async () => {
		const ctx = createMockContext('/protected', false, false);
		let nextCalled = false;

		await authMiddleware(ctx as Context<BbState>, async () => {
			nextCalled = true;
		});

		assertEquals(nextCalled, false);
		assertEquals(ctx.response.status, 401);
		assertEquals(ctx.response.body.error.code, 'UNAUTHORIZED');
	});
});

Deno.test('requireAuth helper', async (t) => {
	await t.step('applies auth to specified paths', async () => {
		const middleware = requireAuth(['/protected', '/api/*']);
		const ctx = createMockContext('/protected', false, false);
		let nextCalled = false;

		await middleware(ctx as Context<BbState>, async () => {
			nextCalled = true;
		});

		assertEquals(nextCalled, false);
		assertEquals(ctx.response.status, 401);
	});

	await t.step('skips auth for non-protected paths', async () => {
		const middleware = requireAuth(['/protected', '/api/*']);
		const ctx = createMockContext('/public', false, false);
		let nextCalled = false;

		await middleware(ctx as Context<BbState>, async () => {
			nextCalled = true;
		});

		assertEquals(nextCalled, true);
		assertEquals(ctx.response.status, undefined);
	});

	await t.step('handles wildcard paths', async () => {
		const middleware = requireAuth(['/protected/*']);
		const ctx = createMockContext('/protected/resource', false, false);
		let nextCalled = false;

		await middleware(ctx as Context<BbState>, async () => {
			nextCalled = true;
		});

		assertEquals(nextCalled, false);
		assertEquals(ctx.response.status, 401);
	});

	await t.step('respects localMode for protected paths', async () => {
		const middleware = requireAuth(['/protected']);
		const ctx = createMockContext('/protected', false, true);
		let nextCalled = false;

		await middleware(ctx as Context<BbState>, async () => {
			nextCalled = true;
		});

		assertEquals(nextCalled, true);
		assertEquals(ctx.response.status, undefined);
	});
});
