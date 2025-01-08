// import { assertEquals, assertRejects } from 'testing/asserts.ts';
// import { Context, testing } from 'oak';
// import { handleCallback, handleLogin, handleLogout, handleStatus } from './auth.handlers.ts';
// import { SessionManager } from '../../auth/session.ts';
// import type { BbState } from '../../types/app.types.ts';
// 
// // Mock successful session data
// const mockSession = {
// 	user: {
// 		id: 'test-user-id',
// 		email: 'test@example.com',
// 	},
// 	access_token: 'test-access-token',
// 	refresh_token: 'test-refresh-token',
// 	expires_at: Date.now() + 3600000,
// };
// 
// // Mock Supabase client responses
// const mockSuccessfulAuth = {
// 	data: { session: mockSession },
// 	error: null,
// };
// 
// const mockFailedAuth = {
// 	data: { session: null },
// 	error: { message: 'Invalid credentials' },
// };
// 
// // Mock Supabase client
// const mockSupabaseClient = {
// 	auth: {
// 		signInWithPassword: async (credentials: { email: string; password: string }) => {
// 			if (credentials.email === 'valid@example.com' && credentials.password === 'valid-password') {
// 				return mockSuccessfulAuth;
// 			}
// 			return mockFailedAuth;
// 		},
// 		exchangeCodeForSession: async (code: string) => {
// 			if (code === 'valid-code') {
// 				return mockSuccessfulAuth;
// 			}
// 			return mockFailedAuth;
// 		},
// 		getSession: async () => mockSuccessfulAuth,
// 		signOut: async () => ({ error: null }),
// 	},
// };
// 
// // Mock localStorage
// const mockStorage = new Map<string, string>();
// globalThis.localStorage = {
// 	getItem: (key: string) => mockStorage.get(key) ?? null,
// 	setItem: (key: string, value: string) => mockStorage.set(key, value),
// 	removeItem: (key: string) => mockStorage.delete(key),
// 	clear: () => mockStorage.clear(),
// 	key: (index: number) => Array.from(mockStorage.keys())[index] ?? null,
// 	get length() {
// 		return mockStorage.size;
// 	},
// };
// 
// // Mock createClient
// globalThis.createClient = () => mockSupabaseClient;
// 
// // Store original fetch
// const originalFetch = globalThis.fetch;
// 
// // Mock successful config fetch
// globalThis.fetch = async () =>
// 	new Response(
// 		JSON.stringify({
// 			url: 'https://test.supabase.co',
// 			anonKey: 'test-anon-key',
// 		}),
// 		{ status: 200 },
// 	);
// 
// Deno.test("Auth Handlers", async (t) => {
//   // Initialize session manager for tests
//   const sessionManager = new SessionManager();
//   await sessionManager.initialize();
//
//   // Helper function to create mock context with auth state
//   function createMockContext(path: string, method: string) {
//     return testing.createMockContext<BbState>({
//       path,
//       method,
//       state: { auth: { sessionManager } }
//     });
//   }
//
//   await t.step("handleLogin - successful login", async () => {
//     const ctx = createMockContext(
//       state: { auth: { sessionManager } },
//       path: "/api/auth/login",
//       method: "POST"
//     });
//
//     // Mock request body
//     ctx.request.body = () => ({
//       type: "json",
//       value: Promise.resolve({
//         email: "valid@example.com",
//         password: "valid-password"
//       })
//     });
//
//     await handleLogin(ctx as unknown as Context);
//
//     assertEquals(ctx.response.status, 200);
//     assertEquals(ctx.response.body.session, mockSession);
//   });
//
//   await t.step("handleLogin - invalid credentials", async () => {
//     const ctx = createMockContext(
//       path: "/api/auth/login",
//       method: "POST"
//     });
//
//     ctx.request.body = () => ({
//       type: "json",
//       value: Promise.resolve({
//         email: "invalid@example.com",
//         password: "wrong-password"
//       })
//     });
//
//     await handleLogin(ctx as unknown as Context);
//
//     assertEquals(ctx.response.status, 401);
//     assertEquals(ctx.response.body.error.code, "AUTH_ERROR");
//   });
//
//   await t.step("handleLogin - missing credentials", async () => {
//     const ctx = testing.createMockContext({
//       path: "/api/auth/login",
//       method: "POST"
//     });
//
//     ctx.request.body = () => ({
//       type: "json",
//       value: Promise.resolve({})
//     });
//
//     await handleLogin(ctx as unknown as Context);
//
//     assertEquals(ctx.response.status, 400);
//     assertEquals(ctx.response.body.error.code, "INVALID_REQUEST");
//   });
//
//   await t.step("handleLogout - successful logout", async () => {
//     const ctx = testing.createMockContext({
//       path: "/api/auth/logout",
//       method: "POST"
//     });
//
//     await handleLogout(ctx as unknown as Context);
//
//     assertEquals(ctx.response.status, 200);
//     assertEquals(ctx.response.body.success, true);
//   });
//
//   await t.step("handleStatus - authenticated", async () => {
//     const ctx = testing.createMockContext({
//       path: "/api/auth/session",
//       method: "GET"
//     });
//
//     await handleStatus(ctx as unknown as Context);
//
//     assertEquals(ctx.response.status, 200);
//     assertEquals(ctx.response.body.authenticated, true);
//     assertEquals(ctx.response.body.session, mockSession);
//   });
//
//   await t.step("handleCallback - valid code", async () => {
//     const ctx = testing.createMockContext({
//       path: "/api/auth/callback?code=valid-code",
//       method: "POST"
//     });
//
//     await handleCallback(ctx as unknown as Context);
//
//     assertEquals(ctx.response.status, 200);
//     assertEquals(ctx.response.body.session, mockSession);
//   });
//
//   await t.step("handleCallback - invalid code", async () => {
//     const ctx = testing.createMockContext({
//       path: "/api/auth/callback?code=invalid-code",
//       method: "POST"
//     });
//
//     await handleCallback(ctx as unknown as Context);
//
//     assertEquals(ctx.response.status, 401);
//     assertEquals(ctx.response.body.error.code, "AUTH_ERROR");
//   });
//
//   await t.step("handleCallback - missing code", async () => {
//     const ctx = testing.createMockContext({
//       path: "/api/auth/callback",
//       method: "POST"
//     });
//
//     await handleCallback(ctx as unknown as Context);
//
//     assertEquals(ctx.response.status, 400);
//     assertEquals(ctx.response.body.error.code, "INVALID_REQUEST");
//   });
//
//   // Restore original fetch
//   t.teardown(() => {
//     globalThis.fetch = originalFetch;
//   });
// });
