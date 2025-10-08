# Test Scaffolding for Multiple Datasources

This directory contains the enhanced test scaffolding that supports testing with multiple datasource types including Notion and Google Docs. The infrastructure provides mock clients, test providers, and comprehensive test data to facilitate testing of tools that work with structured content.

## Overview

The test scaffolding consists of several key components:

2. **Test Providers** (`testProviders.ts`) - Test-specific providers that inject mock clients instead of real API clients
3. **Test Data** (`testData.ts`) - Comprehensive predefined datasets covering common and edge cases
4. **Enhanced Test Setup** (`testSetup.ts`) - Extended setup functions that support additional datasources

## Quick Start

### Basic Usage with Extra Datasources

```typescript
import { getTestProvider, withTestProject } from 'api/tests/lib/testSetup.ts';

Deno.test({
	name: 'My tool test with Notion support',
	async fn() {
		const extraDatasources = ['notion'];
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			// Your test code here - Notion datasource is now available
			// The mock client is pre-loaded with default test data
		}, extraDatasources);
	},
});
```

## Architecture

#### Key Features:

- **Portable Text Storage**: All data is stored in a standardized JSON format, making it easy to verify changes without hardcoding native API formats
- **Predefined Test Data**: Comes loaded with comprehensive test datasets covering various scenarios
- **Error Simulation**: Can simulate API errors for testing error handling paths
- **Data Inspection**: Easy methods to check what data was created, modified, or deleted

## Test Patterns

### Testing Tool Functionality

```typescript
Deno.test({
	name: 'Test write_resource with structured content',
	async fn() {
		const extraDatasources = ['notion', 'google'];
		await withTestProject(async (testProjectId, testProjectRoot) => {
			// Setup
			const projectEditor = await getProjectEditor(testProjectId);
			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('write_resource');

			// Execute tool with structured content
			const toolUse = {
				toolInput: {
					resourcePath: 'test-resource.json',
					structuredContent: {
						blocks: [/* portable text blocks */],
						acknowledgement: 'I have checked...',
					},
				},
			};

			const result = await tool.runTool(interaction, toolUse, projectEditor);

			// Verify in mock clients
			const notionProvider = await getTestProvider(projectEditor, 'notion');
			if (notionProvider) {
				const mockClient = notionProvider.getMockClient();
				const allPages = mockClient.getAllPagesData();
				// Verify structured content was created correctly
			}
		}, extraDatasources);
	},
});
```

### Testing Error Handling

```typescript
// Setup error condition
const notionProvider = await getTestProvider(projectEditor, 'notion');
if (notionProvider) {
	const mockClient = notionProvider.getMockClient();
	mockClient.triggerError('getPage');

	// Test that your tool handles the error correctly
	await assertRejects(
		() => tool.runTool(interaction, toolUse, projectEditor),
		Error,
		'Expected error message',
	);
}
```

### Custom Test Data

```typescript
import { createTestDocument, createTestPage } from 'api/tests/lib/testData.ts';

// Create custom test page
const customPage = createTestPage(
	'custom-id',
	'Custom Page Title',
	['Paragraph 1', 'Paragraph 2', 'Paragraph 3'],
	['normal', 'h1', 'normal'],
);

// Set up mock client with custom data
mockClient.setPageData('custom-id', customPage);
```

## Best Practices

### 1. Declare Extra Datasources at the Top

```typescript
Deno.test({
	name: 'My test',
	async fn() {
		const extraDatasources = ['notion', 'google']; // Clear and visible
		await withTestProject(async (testProjectId, testProjectRoot) => {
			// Test implementation
		}, extraDatasources);
	},
});
```

### 2. Use Default Test Data When Possible

The predefined test data covers most common scenarios. Only create custom data when testing specific edge cases.

### 3. Verify Changes in Portable Text Format

```typescript
// Good: Testing in portable text format
const pageData = mockClient.getPageData('page-id');
assertEquals(pageData.blocks[0].children[0].text, 'Expected text');

// Avoid: Testing native format details
// This couples tests to specific API response formats
```

### 4. Test Both Success and Error Cases

```typescript
// Test successful operation
const result = await tool.runTool(interaction, toolUse, projectEditor);
assert(result.success);

// Test error handling
mockClient.triggerError('updateBlock');
await assertRejects(() => tool.runTool(interaction, toolUse, projectEditor));
```

### 5. Clean Test Isolation

Each test gets fresh mock clients with default data, so tests don't interfere with each other.

## Migration Guide

### From Existing Tests

1. **Import Changes**:
   ```typescript
   // Old
   import { withTestProject } from 'api/tests/testSetup.ts';

   // New
   import { getTestProvider, withTestProject } from 'api/tests/lib/testSetup.ts';
   ```

2. **Add Extra Datasources**:
   ```typescript
   // Old
   await withTestProject(async (testProjectId, testProjectRoot) => {
   	// test code
   });

   // New
   const extraDatasources = ['notion'];
   await withTestProject(async (testProjectId, testProjectRoot) => {
   	// test code
   }, extraDatasources);
   ```

3. **Update Verification Logic**:
   ```typescript
   // Instead of checking filesystem files for structured content,
   // check the mock client data:
   const provider = await getTestProvider(projectEditor, 'notion');
   const mockClient = provider.getMockClient();
   const pageData = mockClient.getPageData('page-id');
   ```

## Implementation Details

### Provider Injection

The system uses the existing `DataSourceRegistry` test instance mechanism to inject test providers:

1. Test providers are created with mock clients loaded with default data
2. Test providers are registered in the registry (replacing real providers)
3. When tools request accessors, they get accessors with mock clients
4. Tests can inspect and modify mock client data as needed

### Data Flow

```
Tool Request → DataSourceFactory → DataSourceRegistry → TestProvider → MockClient → Portable Text Data
```

This ensures that tools work with the same interfaces they would use in production, but with predictable mock data instead of real API calls.

## Troubleshooting

### Mock Client Not Found

```typescript
const provider = await getTestProvider(projectEditor, 'notion');
if (!provider) {
	throw new Error('Notion provider not found - did you include it in extraDatasources?');
}
```

### Test Data Not Found

The mock clients are pre-loaded with default test data. If you need specific data, set it up explicitly:

```typescript
mockClient.setPageData('specific-id', customPageData);
```

### Type Errors

Make sure to import types from the correct locations:

```typescript
import type { TestNotionProvider } from 'api/tests/lib/testProviders.ts';
```
