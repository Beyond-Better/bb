import { assertEquals, assertRejects, assertThrows } from "testing/asserts.ts";
import { SessionManager } from "./session.ts";
import { ConfigFetchError } from "../types/auth.ts";

// Mock Supabase client
const mockSession = {
  user: {
    id: "test-user-id",
    email: "test@example.com"
  },
  access_token: "test-access-token",
  refresh_token: "test-refresh-token",
  expires_at: Date.now() + 3600000
};

const mockSupabaseClient = {
  auth: {
    getSession: async () => ({ data: { session: mockSession }, error: null }),
    signOut: async () => ({ error: null }),
    startAutoRefresh: async () => {},
    stopAutoRefresh: async () => {}
  }
};

// Mock createClient function
globalThis.createClient = () => mockSupabaseClient;

// Mock fetchSupabaseConfig
const mockConfig = {
  url: "https://test.supabase.co",
  anonKey: "test-anon-key"
};

// Store original fetch
const originalFetch = globalThis.fetch;

// Mock localStorage
const mockStorage = new Map<string, string>();

globalThis.localStorage = {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, value: string) => mockStorage.set(key, value),
  removeItem: (key: string) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
  key: (index: number) => Array.from(mockStorage.keys())[index] ?? null,
  get length() { return mockStorage.size; }
};

Deno.test("SessionManager", async (t) => {
  let manager: SessionManager;

  // Setup fresh manager for each test
  function setupManager() {
    mockStorage.clear();
    manager = new SessionManager();
    return { manager };
  }

  // Mock successful config fetch
  function mockSuccessfulFetch() {
    globalThis.fetch = async () => new Response(
      JSON.stringify(mockConfig),
      { status: 200 }
    );
  }

  // Mock failed config fetch
  function mockFailedFetch() {
    globalThis.fetch = async () => new Response(
      "Not Found",
      { status: 404 }
    );
  }

  await t.step("initializes successfully", async () => {
    const { manager } = setupManager();
    mockSuccessfulFetch();
    
    await manager.initialize();
    const client = manager.getClient();
    
    assertEquals(typeof client.auth.getSession, "function");
  });

  await t.step("fails initialization with invalid config", async () => {
    const { manager } = setupManager();
    mockFailedFetch();
    
    await assertRejects(
      () => manager.initialize(),
      ConfigFetchError
    );
  });

  await t.step("gets session after initialization", async () => {
    const { manager } = setupManager();
    mockSuccessfulFetch();
    
    await manager.initialize();
    const session = await manager.getSession();
    
    assertEquals(session, mockSession);
  });

  await t.step("throws when accessing client before initialization", () => {
    const { manager } = setupManager();
    
    assertThrows(
      () => manager.getClient(),
      Error,
      "SessionManager not initialized"
    );
  });

  await t.step("throws when getting session before initialization", async () => {
    const { manager } = setupManager();
    
    await assertRejects(
      () => manager.getSession(),
      Error,
      "SessionManager not initialized"
    );
  });

  await t.step("clears session successfully", async () => {
    const { manager } = setupManager();
    mockSuccessfulFetch();
    
    await manager.initialize();
    await manager.clearSession();
    
    const session = await manager.getSession();
    assertEquals(session, null);
  });

  await t.step("cleanup stops auto refresh and clears session", async () => {
    const { manager } = setupManager();
    mockSuccessfulFetch();
    
    await manager.initialize();
    await manager.destroy();
    
    assertThrows(
      () => manager.getClient(),
      Error,
      "SessionManager not initialized"
    );
  });

  // Restore original fetch
  t.teardown(() => {
    globalThis.fetch = originalFetch;
  });
});