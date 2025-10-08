import { KVStorage } from 'shared/kvStorage.ts';
import { delay } from '@std/async';

const timestamp = new Date().toISOString();
const key = 'test_storage';

// Initialize KV storage
const storage = new KVStorage({
	prefix: 'test:',
	filename: 'test_storage.kv',
});

console.log(`Initializing KV storage...`);
await storage.initialize();

console.log(`Writing timestamp ${timestamp} to storage key "${key}"...`);
storage.setItem(key, timestamp);

// Wait for async operation to complete
await delay(100);

// Verify the write
const storedValue = storage.getItem(key);
console.log(`Verified stored value: ${storedValue}`);
console.log('Write complete. Run test_storage_read.ts to verify persistence.');

// Clean up
await storage.close();
