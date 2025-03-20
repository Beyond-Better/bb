import { logger } from 'shared/logger.ts';
import { KVManager } from 'api/utils/kvManager.ts';

// Interface matching the compressed cache item structure in baseLLM.ts
interface CompressedCacheItem {
  compressed: true;
  data: Uint8Array;
}

// Simple mock of an LLM response structure (minimal version)
interface MockLLMResponse {
  messageResponse: {
    answer: string;
    fromCache?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Test function to generate and cache a large response
 * to verify compression functionality.
 * 
 * @param sizeInKB Size of the response to generate in kilobytes
 * @returns Information about the test results including sizes and compression ratio
 */
export async function testLargeResponseCompression(sizeInKB = 100): Promise<{
  originalSize: number;
  compressedSize?: number;
  compressionRatio?: number;
  fromCache: boolean;
  status: string;
}> {
  // Create a storage instance with a specific prefix for testing
  const storage = await new KVManager<MockLLMResponse | CompressedCacheItem>({ 
    prefix: 'compressionTest' 
  }).init();
  
  // Generate a cache key for this test
  const cacheKey = ['test', `size_${sizeInKB}kb`];
  
  // Check if we already have a cached version
  const cachedItem = await storage.getItem(cacheKey);
  if (cachedItem) {
    logger.info(`🔍 Found cached test response`);
    
    // Check if it's compressed
    if ('compressed' in cachedItem && cachedItem.compressed === true) {
      try {
        // Decompress using DecompressionStream
        const stream = new DecompressionStream('gzip');
        
        // Create a readable stream from the compressed data
        const readableStream = new ReadableStream({
          start(controller) {
            controller.enqueue(cachedItem.data);
            controller.close();
          }
        });
        
        // Get decompressed data
        const decompressedData = await new Response(readableStream.pipeThrough(stream)).text();
        const response = JSON.parse(decompressedData) as MockLLMResponse;
        
        // Get sizes for reporting
        const originalSize = new TextEncoder().encode(decompressedData).length;
        const compressedSize = cachedItem.data.byteLength;
        
        logger.info(`✅ Successfully decompressed cached test response`);
        logger.info(`📊 Original: ${originalSize} bytes, Compressed: ${compressedSize} bytes (${Math.round((compressedSize/originalSize)*100)}%)`);
        
        return {
          originalSize,
          compressedSize,
          compressionRatio: compressedSize / originalSize,
          fromCache: true,
          status: 'Retrieved and decompressed from cache'
        };
      } catch (error) {
        logger.error(`Failed to decompress cached test response:`, error);
        // Continue to generate a new response
      }
    } else {
      // Uncompressed cached response
      const response = cachedItem as MockLLMResponse;
      const serialized = JSON.stringify(response);
      const size = new TextEncoder().encode(serialized).length;
      
      logger.info(`✅ Retrieved uncompressed cached test response (${size} bytes)`);
      
      return {
        originalSize: size,
        fromCache: true,
        status: 'Retrieved uncompressed from cache'
      };
    }
  }
  
  // Generate a large response
  logger.info(`🔄 Generating new test response (${sizeInKB}KB)...`);
  
  // Create a string of the specified size (approx)
  // Each character is ~1 byte, so we multiply by 1024 to get KB
  const repeatedText = "This is a test of the large response compression system. ";
  const repetitions = Math.ceil((sizeInKB * 1024) / repeatedText.length);
  const largeText = repeatedText.repeat(repetitions);
  
  // Create a mock LLM response
  const mockResponse: MockLLMResponse = {
    messageResponse: {
      answer: largeText,
      fromCache: false,
      usage: { totalTokens: sizeInKB * 4 }, // Rough estimate: 4 tokens per KB
      type: 'text'
    },
    meta: {
      timestamp: new Date().toISOString(),
      testDescription: `${sizeInKB}KB test response`
    }
  };
  
  // Serialize the response
  const serialized = JSON.stringify(mockResponse);
  const serializedSize = new TextEncoder().encode(serialized).length;
  
  logger.info(`📝 Generated test response (${serializedSize} bytes)`);
  
  // Cache the response, potentially with compression
  try {
    // We'll use similar logic to baseLLM.ts
    const COMPRESSION_THRESHOLD = 30000; // ~30KB
    const KV_MAX_SIZE = 65000; // Just under the 65536 limit
    
    // Check if we need to compress based on size
    if (serializedSize > COMPRESSION_THRESHOLD) {
      logger.info(`🔍 Large response detected (${serializedSize} bytes), applying compression`);
      
      // Compress the data using CompressionStream
      const encoder = new TextEncoder();
      const uint8Array = encoder.encode(serialized);
      
      // Create a compression stream
      const stream = new CompressionStream('gzip');
      
      // Create a readable stream from the uint8array and pipe through compression
      const readableStream = new ReadableStream({
        start(controller) {
          controller.enqueue(uint8Array);
          controller.close();
        }
      });
      
      // Collect compressed chunks
      const compressed = await new Response(readableStream.pipeThrough(stream)).arrayBuffer().then(buffer => new Uint8Array(buffer));
      const compressedSize = compressed.byteLength;
      
      // Check if compressed data is still too large
      if (compressedSize > KV_MAX_SIZE) {
        logger.warn(`⚠️ CACHING FAILURE: Response too large even after compression (${compressedSize} bytes)`);
        logger.warn(`⚠️ CACHING FAILURE: Original size: ${serializedSize} bytes, compressed size: ${compressedSize} bytes`);
        
        return {
          originalSize: serializedSize,
          compressedSize,
          compressionRatio: compressedSize / serializedSize,
          fromCache: false,
          status: 'Generated but too large to cache even with compression'
        };
      } else {
        // Store the compressed data with a marker
        const compressedItem: CompressedCacheItem = {
          compressed: true,
          data: compressed
        };
        
        await storage.setItem(cacheKey, compressedItem, { expireIn: 24 * 60 * 60 * 1000 }); // 24 hours
        logger.info(`✅ Cached compressed response (${serializedSize} → ${compressedSize} bytes, ${Math.round((compressedSize/serializedSize)*100)}%)`);
        
        return {
          originalSize: serializedSize,
          compressedSize,
          compressionRatio: compressedSize / serializedSize,
          fromCache: false,
          status: 'Generated and cached with compression'
        };
      }
    } else {
      // Store uncompressed for small responses
      await storage.setItem(cacheKey, mockResponse, { expireIn: 24 * 60 * 60 * 1000 }); // 24 hours
      logger.info(`✅ Cached uncompressed response (${serializedSize} bytes)`);
      
      return {
        originalSize: serializedSize,
        fromCache: false,
        status: 'Generated and cached without compression'
      };
    }
  } catch (error) {
    logger.error(`Error caching test response:`, error);
    
    return {
      originalSize: serializedSize,
      fromCache: false,
      status: `Generated but failed to cache: ${error.message}`
    };
  }
}

/**
 * Run multiple compression tests with different sizes
 */
export async function runCompressionTests(): Promise<void> {
  logger.info(`🧪 Running compression tests...`);
  
  const sizes = [10, 30, 50, 100, 200]; // KB sizes to test
  
  for (const size of sizes) {
    logger.info(`\n📏 Testing ${size}KB response...`);
    const result = await testLargeResponseCompression(size);
    
    // Log the result in a formatted way
    logger.info(`📊 Test Result (${size}KB):\n` +
      `   Status: ${result.status}\n` +
      `   Original Size: ${result.originalSize} bytes\n` +
      (result.compressedSize ? `   Compressed Size: ${result.compressedSize} bytes\n` : '') +
      (result.compressionRatio ? `   Compression Ratio: ${Math.round(result.compressionRatio * 100)}%\n` : '') +
      `   From Cache: ${result.fromCache}`);
  }
  
  logger.info(`✅ Compression tests completed`);
}