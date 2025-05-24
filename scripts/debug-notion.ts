#!/usr/bin/env deno run --allow-env --allow-net
/**
 * Debug script for Notion integration.
 * This script attempts to diagnose issues with the Notion data source connection.
 */
import { logger } from 'shared/logger.ts';
import { NotionClient } from './notionClient.ts';

// Configuration
const NOTION_API_KEY = Deno.env.get('NOTION_API_KEY') || 'ntn_xxxx';

/**
 * Test function to debug Notion connection issues
 */
async function debugNotionConnection() {
  console.log('Debugging Notion connection...');
  
  try {
    // Create a NotionClient instance
    const client = new NotionClient(NOTION_API_KEY);
    console.log('NotionClient created successfully');
    
    // Test the connection by making a simple API call
    console.log('Testing connection to Notion API...');
    
    // Get the current bot user (basic API call that should always work if credentials are valid)
    const user = await client.getBotUser();
    console.log('✅ Connection successful!');
    console.log('Connected as:', user.name || user.id);
    
    // Search for resources (should return workspace, pages, and databases)
    console.log('\nSearching for resources...');
    const searchResults = await client.search();
    //console.log(`searchResults `, {searchResults});    
    console.log(`searchResults `, searchResults.results[0].properties.Title);    

//     const pageResults = await client.getPage('1a436d1afcff80be95c4d77b3560582f');
//     console.log(`page `, {pageResults});    
//     //https://www.notion.so/Docs-Tab-feedback-1cd36d1afcff804bb9d4f68e983cc943?pvs=4
//     //https://www.notion.so/Getting-Started-1a436d1afcff80be95c4d77b3560582f?pvs=4

    console.log(`Found ${searchResults.results.length} resources`);
    
    // Display workspace details
    console.log('\nWorkspace Details:');
    searchResults.results.forEach((result, index) => {
      if ('properties' in result) {
        // This is a page
        const page = result;
        const pageId = page.id;
        const pageTitle = page.properties?.Title?.title?.[0]?.plain_text || 'Untitled';
        console.log(`${index + 1}. Page: ${pageTitle} (${pageId})`);
      } else if ('title' in result) {
        // This is a database
        const db = result;
        const dbId = db.id;
        const dbTitle = db.title?.[0]?.plain_text || 'Untitled';
        console.log(`${index + 1}. Database: ${dbTitle} (${dbId})`);
      } else {
        // Unknown type
        console.log(`${index + 1}. Unknown type:`, result);
      }
    });
    
    console.log('\nAll tests completed successfully');
  } catch (error) {
    console.error('⚠️ Error during Notion connection test:', error);
    console.log('\nDiagnostic information:');
    console.log('API Key length:', NOTION_API_KEY ? NOTION_API_KEY.length : 0);
    console.log('API Key format valid:', NOTION_API_KEY ? NOTION_API_KEY.startsWith('secret_') : false);
  }
}

// Run the debug function
if (import.meta.main) {
  debugNotionConnection();
}