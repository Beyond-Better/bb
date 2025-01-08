import { KVStorage } from '../../shared/storage/kvStorage.ts';

const key = 'test_storage';

// Initialize KV storage
const storage = new KVStorage({
  prefix: 'test:',
  filename: 'test_storage.kv'
});

console.log(`Initializing KV storage...`);
await storage.initialize();

// Read value synchronously after initialization
const storedValue = storage.getItem(key);

if (storedValue) {
  const now = new Date();
  const stored = new Date(storedValue);
  const elapsed = now.getTime() - stored.getTime();
  const seconds = Math.floor(elapsed / 1000);

  console.log('Found stored timestamp:');
  console.log(`- Stored at: ${stored.toISOString()}`);
  console.log(`- Current time: ${now.toISOString()}`);
  console.log(`- Elapsed time: ${seconds} seconds`);
} else {
  console.log(`No value found for key "${key}"`);
  console.log('Run test_storage_write.ts first to store a value.');
}

// Clean up
await storage.close();