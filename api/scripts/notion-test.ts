/**
 * Test script for Notion integration.
 * This script demonstrates how to use the enhanced NotionClient and NotionAccessor.
 *
 * To use this script:
 * 1. Add your Notion API key in the NOTION_API_KEY environment variable
 * 2. Replace WORKSPACE_ID with your Notion workspace ID
 * 3. Replace PAGE_ID with a valid page ID from your workspace
 * 4. Run with: deno run -A notion-test.ts
 */

import { logger } from 'shared/logger.ts';
import { NotionClient } from 'api/dataSources/notionClient.ts';
import { NotionAccessor } from 'api/dataSources/notionAccessor.ts';
import type { DataSourceConnection } from 'api/dataSources/interfaces/dataSourceConnection.ts';
import type { ResourceLoadOptions } from 'shared/types/dataSourceResource.ts';

// Configuration
const NOTION_API_KEY = Deno.env.get('NOTION_API_KEY') || 'your-notion-api-key';
const WORKSPACE_ID = 'your-workspace-id'; // Replace with actual workspace ID
const PAGE_ID = 'your-page-id'; // Replace with an actual page ID from your workspace
const DATABASE_ID = 'your-database-id'; // Replace with an actual database ID

/**
 * Test function to demonstrate the Notion integration
 */
async function testNotionIntegration() {
	console.log('Testing Notion integration...');

	try {
		// Create a NotionClient instance
		const client = new NotionClient(NOTION_API_KEY);
		console.log('NotionClient created successfully');

		// Set up a mock connection for the NotionAccessor
		const mockConnection: Partial<DataSourceConnection> = {
			id: 'notion-test',
			name: 'Notion Test',
			providerType: 'notion',
			config: {
				workspaceId: WORKSPACE_ID,
			},
			auth: {
				method: 'apiKey',
				apiKey: NOTION_API_KEY,
			},
			capabilities: ['read', 'list', 'search', 'write'],
		};

		// Create a NotionAccessor instance
		const accessor = new NotionAccessor(mockConnection, client);
		console.log('NotionAccessor created successfully');

		// Test 1: Load a page
		console.log('\n=== Test 1: Loading a page ===');
		const pageUri = `notion://page/${PAGE_ID}`;
		console.log(`Loading page: ${pageUri}`);

		const pageOptions: ResourceLoadOptions = {};
		const pageResult = await accessor.loadResource(pageUri, pageOptions);

		console.log('Page loaded successfully');
		console.log('Title:', pageResult.content.split('\n')[0]); // Show the first line as title
		console.log('Content length:', pageResult.content.length);
		console.log('Last modified:', pageResult.metadata.lastModified);

		// Test 2: Check if resource exists
		console.log('\n=== Test 2: Checking resource existence ===');
		const exists = await accessor.resourceExists(pageUri);
		console.log(`Page exists: ${exists}`);

		// Test 3: List resources
		console.log('\n=== Test 3: Listing resources ===');
		const listResult = await accessor.listResources({ pageSize: 5 });
		console.log(`Found ${listResult.resources.length} resources`);
		listResult.resources.forEach((resource, index) => {
			console.log(`${index + 1}. ${resource.uri} (${resource.type})`);
		});

		// Test 4: Search resources
		console.log('\n=== Test 4: Searching resources ===');
		// Replace with an actual search term relevant to your workspace
		const searchTerm = 'meeting';
		const searchResult = await accessor.searchResources(searchTerm, { pageSize: 5 });

		console.log(`Found ${searchResult.matches.length} matches for "${searchTerm}"`);
		searchResult.matches.forEach((match, index) => {
			console.log(`${index + 1}. ${match.resource.uri} (score: ${match.score})`);
		});

		// Test 5: Load database (if DATABASE_ID is provided)
		if (DATABASE_ID !== 'your-database-id') {
			console.log('\n=== Test 5: Loading a database ===');
			const dbUri = `notion://database/${DATABASE_ID}`;
			console.log(`Loading database: ${dbUri}`);

			const dbResult = await accessor.loadResource(dbUri);

			console.log('Database loaded successfully');
			console.log('Title:', dbResult.content.split('\n')[0]); // Show the first line as title
			console.log('Content length:', dbResult.content.length);
			console.log('Last modified:', dbResult.metadata.lastModified);
		}

		// Advanced test: Create a new page in a database (uncomment to use)
		/*
    if (DATABASE_ID !== 'your-database-id') {
      console.log('\n=== Advanced Test: Creating a new page ===');
      const parentUri = `notion://database/${DATABASE_ID}`;
      const newPageTitle = 'Test Page Created by BB';
      const newPageContent = 'This is a test page created by the BB Notion integration.';

      const newPageUri = await accessor.createPage(parentUri, newPageTitle, newPageContent);
      console.log(`New page created: ${newPageUri}`);

      // Load the new page to verify
      const newPageResult = await accessor.loadResource(newPageUri);
      console.log('New page loaded successfully');
      console.log('Content:', newPageResult.content);
    }
    */

		console.log('\nAll tests completed successfully');
	} catch (error) {
		console.error('Error during Notion integration test:', error);
	}
}

// Run the test
if (import.meta.main) {
	testNotionIntegration();
}
