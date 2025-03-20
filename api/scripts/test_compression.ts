#!/usr/bin/env -S deno run -A

import { runCompressionTests } from './test_compression-lib.ts';
import { logger } from 'shared/logger.ts';

/**
 * This script tests the compression functionality used for caching large LLM responses.
 * It will generate responses of various sizes and demonstrate the compression behavior.
 */
async function main() {
  logger.info('\n==================================================');
  logger.info('  🧪 LLM Response Compression Test 🧪');
  logger.info('==================================================\n');
  
  logger.info('This test will:');
  logger.info('1. Generate responses of various sizes (10KB to 200KB)');
  logger.info('2. Apply compression to large responses (>30KB)');
  logger.info('3. Cache the responses in the KV store');
  logger.info('4. Read them back on subsequent runs');
  logger.info('5. Display detailed size and compression metrics\n');
  
  logger.info('Running tests...');
  await runCompressionTests();
  
  logger.info('\n==================================================');
  logger.info('  ✅ Compression test completed successfully');
  logger.info('==================================================\n');
  
  logger.info('To see different results:');
  logger.info('- First run: Will generate and cache all test responses');
  logger.info('- Second run: Will retrieve responses from cache');
  logger.info('- To force regeneration: Delete .kv files in your data directory\n');
}

await main().catch(err => {
  logger.error('Error running compression test:', err);
  Deno.exit(1);
});