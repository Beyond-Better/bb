/**
 * Tests for dynamic datasource loading functionality in DataSourceRegistry
 */

import { assert, assertEquals } from '@std/assert';
import { DataSourceRegistry } from '../../../src/dataSources/dataSourceRegistry.ts';
import { CORE_DATASOURCES } from '../../../src/dataSources/dataSource_manifest.ts';

Deno.test({
	name: 'DataSourceRegistry - Dynamic Loading - Product variant detection',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const registry = await DataSourceRegistry.getTestInstance('variant-test');
		
		// Should detect product variant (will be either 'opensource' or 'saas' based on available files)
		const variant = registry.getProductVariant();
		assert(variant === 'opensource' || variant === 'saas', `Expected 'opensource' or 'saas', got '${variant}'`);
		
		console.log(`Detected product variant: ${variant}`);
	},
});

Deno.test({
	name: 'DataSourceRegistry - Dynamic Loading - Core datasource manifest loading',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const registry = await DataSourceRegistry.getTestInstance('manifest-test');
		
		// Check that metadata was loaded from manifest
		const metadata = registry.getDataSourceMetadata();
		
		// Should have loaded all core datasources from manifest
		for (const coreDataSource of CORE_DATASOURCES) {
			assert(
				metadata.has(coreDataSource.metadata.name),
				`Expected datasource ${coreDataSource.metadata.name} to be in metadata`
			);
			
			const loadedMetadata = metadata.get(coreDataSource.metadata.name)!;
			assertEquals(loadedMetadata.version, coreDataSource.metadata.version);
			assertEquals(loadedMetadata.author, coreDataSource.metadata.author);
		}
	},
});

Deno.test({
	name: 'DataSourceRegistry - Dynamic Loading - Conditional loading based on product variant',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const registry = await DataSourceRegistry.getTestInstance('conditional-test');
		const variant = registry.getProductVariant();
		const providers = registry.getAllProviders();
		
		// Filesystem should always be available
		const filesystemProvider = registry.getProvider('filesystem', 'bb');
		assert(filesystemProvider, 'Filesystem provider should always be available');
		
		// Check variant-specific providers
		if (variant === 'opensource') {
			// In opensource, notion and googledocs should NOT be available
			const notionProvider = registry.getProvider('notion', 'bb');
			const googleDocsProvider = registry.getProvider('googledocs', 'bb');
			
			assert(!notionProvider, 'Notion provider should not be available in opensource variant');
			assert(!googleDocsProvider, 'GoogleDocs provider should not be available in opensource variant');
		} else if (variant === 'saas') {
			// In saas, all providers should be available
			const notionProvider = registry.getProvider('notion', 'bb');
			const googleDocsProvider = registry.getProvider('googledocs', 'bb');
			
			assert(notionProvider, 'Notion provider should be available in saas variant');
			assert(googleDocsProvider, 'GoogleDocs provider should be available in saas variant');
		}
		
		console.log(`Product variant: ${variant}, Available providers: ${providers.length}`);
	},
});

Deno.test({
	name: 'DataSourceRegistry - Dynamic Loading - Global config integration',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const registry = await DataSourceRegistry.getTestInstance('config-test');
		
		// Registry should work with global config (loaded automatically)
		const providers = registry.getAllProviders();
		assert(providers.length > 0, 'Should have at least one provider loaded from global config');
		
		// Should have access to global config for plugin directories
		const metadata = registry.getDataSourceMetadata();
		assert(metadata.size > 0, 'Should have datasource metadata from manifest');
	},
});

Deno.test({
	name: 'DataSourceRegistry - Dynamic Loading - Error handling for missing providers',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const registry = await DataSourceRegistry.getTestInstance('error-test');
		
		// Should handle requests for non-existent providers gracefully
		const nonExistentProvider = registry.getProvider('nonexistent' as any, 'bb');
		assert(!nonExistentProvider, 'Should return undefined for non-existent providers');
		
		// Should still return valid providers
		const filesystemProvider = registry.getProvider('filesystem', 'bb');
		assert(filesystemProvider, 'Should still return valid providers');
	},
});

Deno.test({
	name: 'DataSourceRegistry - Dynamic Loading - Registry state methods',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const registry = await DataSourceRegistry.getTestInstance('state-test');
		
		// Test metadata access
		const metadata = registry.getDataSourceMetadata();
		assert(metadata.size > 0, 'Should have datasource metadata');
		
		// Test product variant access
		const variant = registry.getProductVariant();
		assert(variant, 'Should have detected product variant');
		
		// Test provider access methods
		const allProviders = registry.getAllProviders();
		const bbProviders = registry.getProvidersByAccessMethod('bb');
		const mcpProviders = registry.getProvidersByAccessMethod('mcp');
		
		assert(allProviders.length >= bbProviders.length, 'All providers should include BB providers');
		assert(allProviders.length >= mcpProviders.length, 'All providers should include MCP providers');
		assertEquals(allProviders.length, bbProviders.length + mcpProviders.length, 'All providers should equal sum of BB and MCP providers');
	},
});