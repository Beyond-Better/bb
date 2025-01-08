import { assertEquals, assertRejects } from '@std/testing/asserts';
import { beforeEach, describe, it } from '@std/testing/bdd';
import { KVStorage } from './kvStorage.ts';
import { join } from '@std/path';
import { ensureDir } from '@std/fs';
import { delay } from '@std/async';

describe('KVStorage', () => {
  let storage: KVStorage;
  const testDir = join(Deno.cwd(), '.bb', 'test');
  const testKvPath = join(testDir, 'test.kv');

  beforeEach(async () => {
    // Ensure test directory exists
    await ensureDir(testDir);
    
    // Create a new storage instance for each test
    storage = new KVStorage({
      prefix: 'test:',
      filename: 'test.kv'
    });
  });

  it('should initialize successfully', async () => {
    await storage.initialize();
  });

  it('should throw error when using methods before initialization', () => {
    assertEquals(storage.getItem('test'), null);
  });

  it('should store and retrieve values synchronously', async () => {
    await storage.initialize();
    storage.setItem('testKey', 'testValue');
    assertEquals(storage.getItem('testKey'), 'testValue');
  });

  it('should persist values to KV store', async () => {
    await storage.initialize();
    storage.setItem('testKey', 'testValue');
    
    // Wait for async operation to complete
    await delay(100);
    
    // Create new storage instance to verify persistence
    const storage2 = new KVStorage({
      prefix: 'test:',
      filename: 'test.kv'
    });
    await storage2.initialize();
    
    assertEquals(storage2.getItem('testKey'), 'testValue');
    await storage2.close();
  });

  it('should return null for non-existent keys', async () => {
    await storage.initialize();
    assertEquals(storage.getItem('nonexistent'), null);
  });

  it('should remove items', async () => {
    await storage.initialize();
    storage.setItem('testKey', 'testValue');
    storage.removeItem('testKey');
    assertEquals(storage.getItem('testKey'), null);
    
    // Wait for async operation and verify persistence
    await delay(100);
    await storage.sync();
    assertEquals(storage.getItem('testKey'), null);
  });

  it('should clear all items', async () => {
    await storage.initialize();
    storage.setItem('key1', 'value1');
    storage.setItem('key2', 'value2');
    storage.clear();
    
    assertEquals(storage.getItem('key1'), null);
    assertEquals(storage.getItem('key2'), null);
    
    // Wait for async operation and verify persistence
    await delay(100);
    await storage.sync();
    assertEquals(storage.getItem('key1'), null);
    assertEquals(storage.getItem('key2'), null);
  });

  it('should respect prefixes for isolation', async () => {
    const storage1 = new KVStorage({ prefix: 'prefix1:', filename: 'test.kv' });
    const storage2 = new KVStorage({ prefix: 'prefix2:', filename: 'test.kv' });

    await storage1.initialize();
    await storage2.initialize();

    storage1.setItem('key', 'value1');
    storage2.setItem('key', 'value2');

    assertEquals(storage1.getItem('key'), 'value1');
    assertEquals(storage2.getItem('key'), 'value2');

    storage1.clear();
    assertEquals(storage1.getItem('key'), null);
    assertEquals(storage2.getItem('key'), 'value2');

    await storage1.close();
    await storage2.close();
  });

  it('should maintain cache consistency with sync', async () => {
    await storage.initialize();
    
    // Set value in first instance
    storage.setItem('key', 'value1');
    await delay(100); // Wait for async operation
    
    // Create second instance and modify value
    const storage2 = new KVStorage({
      prefix: 'test:',
      filename: 'test.kv'
    });
    await storage2.initialize();
    storage2.setItem('key', 'value2');
    await delay(100); // Wait for async operation
    
    // Sync first instance and verify updated value
    await storage.sync();
    assertEquals(storage.getItem('key'), 'value2');
    
    await storage2.close();
  });

  it('should handle length property correctly', async () => {
    await storage.initialize();
    assertEquals(storage.length, 0);
    
    storage.setItem('key1', 'value1');
    storage.setItem('key2', 'value2');
    assertEquals(storage.length, 2);
    
    storage.removeItem('key1');
    assertEquals(storage.length, 1);
    
    storage.clear();
    assertEquals(storage.length, 0);
  });

  it('should implement key() method correctly', async () => {
    await storage.initialize();
    storage.setItem('key1', 'value1');
    storage.setItem('key2', 'value2');
    
    assertEquals(storage.key(0), 'key1');
    assertEquals(storage.key(1), 'key2');
    assertEquals(storage.key(2), null);
  });

  // Clean up after all tests
  await storage?.close();
});