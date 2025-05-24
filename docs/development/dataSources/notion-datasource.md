# Notion Data Source Guide

## Overview

The Notion data source allows BB to access and search content from Notion workspaces. This integration provides read-only access to Notion pages, databases, and workspaces, converting them to Markdown for use in your projects.

## Features

- **Read Access**: Load Notion pages, databases, and workspace content
- **List Resources**: View all accessible pages and databases in a workspace
- **Search**: Find content across your Notion workspace
- **Markdown Conversion**: Automatic conversion of Notion's block-based content to Markdown

## Setup Requirements

### 1. Create a Notion Integration

Before you can use the Notion data source, you need to create a Notion integration and obtain an API key:

1. Go to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click "+ New integration"
3. Name your integration (e.g., "BB Integration")
4. Select the workspace to install the integration to
5. Choose the capabilities (Read content is required)
6. Click "Submit"
7. Copy the "Internal Integration Token" (this is your API key)

### 2. Share Pages with Your Integration

For your integration to access pages, you need to share them with your integration:

1. Open a page in Notion
2. Click the "..." menu in the top right
3. Click "Add connections"
4. Find and select your integration
5. Repeat for any top-level pages or databases you want to access

## Adding a Notion Data Source to BB

### Using the API

```typescript
import { NotionProvider } from 'api/dataSources/notion/notionProvider.ts';
import { getDataSourceRegistry } from 'api/dataSources/dataSourceRegistry.ts';

// Get the registry
const registry = await getDataSourceRegistry();

// Register the NotionProvider if not already registered
const notionProvider = new NotionProvider();
registry.registerProvider(notionProvider);

// Create a Notion data source
const dataSource = NotionProvider.createNotionDataSource(
  'My Notion Workspace',  // Name for the data source
  'workspace-id',         // Your workspace ID (typically your team ID)
  'secret_apikey123456',  // Your Notion API key
  registry
);

// Add the data source to your project
await projectPersistence.registerDataSource(dataSource);
```

### Using the Configuration UI (Future)

Once the UI is implemented, you'll be able to add a Notion data source through the BB interface:

1. Navigate to Settings > Data Sources
2. Click "Add Data Source"
3. Select "Notion" from the data source types
4. Enter your workspace name and ID
5. Enter your API key
6. Click "Add Data Source"

## URI Format

Notion resources use the following URI format:

```
bb+notion+{connection-name}://{resource-type}/{resource-id}
```

Where:
- `{connection-name}` is the name of your Notion data source
- `{resource-type}` is one of: `page`, `database`, or `workspace`
- `{resource-id}` is the ID of the specific resource

Examples:
- `bb+notion+my-workspace://page/123abc456def789`
- `bb+notion+my-workspace://database/456def789abc123`
- `bb+notion+my-workspace://workspace/workspace-id`

## Usage Examples

### Loading a Notion Page

```typescript
const resourceManager = new ResourceManager(projectEditor);
await resourceManager.init();

// Load a page by its ID
const result = await resourceManager.loadResource('bb+notion+my-workspace://page/123abc456def789');

// The content is a markdown string
const markdown = result.content;
```

### Listing All Resources in a Workspace

```typescript
// List all resources in the workspace
const dataSourceId = 'your-notion-datasource-id';
const listing = await resourceManager.listResources(dataSourceId);

// Process the resources
for (const resource of listing.resources) {
  console.log(`Resource: ${resource.name}, URI: ${resource.uri}`);
}
```

### Searching for Content

```typescript
// Search for content matching a query
const dataSourceId = 'your-notion-datasource-id';
const searchResults = await resourceManager.searchResources(dataSourceId, 'my search query');

// Process the search results
for (const match of searchResults.matches) {
  console.log(`Match: ${match.resource.uri}, Score: ${match.score}`);
}
```

## Limitations

1. **Read-Only Access**: The current implementation only supports reading content from Notion, not writing or updating.

2. **Block Types**: Not all Notion block types are fully supported in the Markdown conversion. Complex elements like tables may be simplified.

3. **Authentication**: Only API key authentication is supported, not OAuth.

4. **Rate Limits**: Notion API has rate limits that may affect performance for large workspaces.

## Troubleshooting

### Common Issues

1. **Access Denied Errors**
   - Make sure you've shared your pages with the integration
   - Check that your API key is correct
   - Verify that your integration has the necessary capabilities

2. **Content Not Found**
   - Verify the page or database ID is correct
   - Check that the page hasn't been archived or deleted
   - Ensure the page is shared with your integration

3. **Conversion Problems**
   - Some complex Notion elements may not convert perfectly to Markdown
   - If you notice issues, please report them with examples

### Debug Logs

Enable debug logging for additional information:

```
BB_LOG_LEVEL=debug bb ...
```

This will show detailed information about Notion API requests and content conversion.

## Future Enhancements

1. **Write Support**: Add the ability to create and update Notion pages
2. **OAuth Authentication**: Support for user-based authentication
3. **Better Block Support**: Improved conversion of complex block types
4. **Caching**: Performance improvements for frequently accessed content

## Contributing

If you'd like to contribute to improving the Notion data source, please:

1. File an issue describing the enhancement or bug
2. Reference the issue in your pull request
3. Include tests for any new functionality
4. Update documentation to reflect your changes