// Test script to write to Deno's Storage API
const timestamp = new Date().toISOString();
const key = "test_storage";

console.log(`Writing timestamp ${timestamp} to storage key "${key}"...`);
localStorage.setItem(key, timestamp);
console.log("Write complete. Run test_storage_read.ts to verify persistence.");