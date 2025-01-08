// Test script to read from Deno's Storage API
const key = 'test_storage';

const storedValue = localStorage.getItem(key);

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
