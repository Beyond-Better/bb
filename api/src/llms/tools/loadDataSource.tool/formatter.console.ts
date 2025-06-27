import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolLoadDatasourceInput, LLMToolLoadDatasourceResponseData } from './types.ts';
import { logger } from 'shared/logger.ts';
import { stripIndents } from 'common-tags';

export const formatLogEntryToolUse = (
	toolInput: LLMToolInputSchema,
): LLMToolLogEntryFormattedResult => {
	const { dataSourceId, returnType = 'metadata', path, depth, pageSize, pageToken } =
		toolInput as LLMToolLoadDatasourceInput;

	// Build options list
	const optionsParts = [];
	optionsParts.push(`Return Type: ${returnType}`);
	if (path) optionsParts.push(`Path: ${path}`);
	if (depth !== undefined) optionsParts.push(`Depth: ${depth}`);
	if (pageSize) optionsParts.push(`Page Size: ${pageSize}`);
	if (pageToken) optionsParts.push(`Page Token: ${pageToken}`);

	const optionsText = optionsParts.length > 0
		? `\n${LLMTool.TOOL_STYLES_CONSOLE.base.label('Options:')}\n  ${optionsParts.join('\n  ')}`
		: '';

	const content = stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Loading data source:')} ${dataSourceId}${optionsText}
    `;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Load Data Source'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(`Listing resources from ${dataSourceId}`),
		content,
		preview: `Loading resources from data source: ${dataSourceId}`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: CollaborationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent;

	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const { data } = bbResponse as LLMToolLoadDatasourceResponseData;
		const resources = data.resources || [];
		const metadata = data.metadata;

		// Handle metadata display (for 'metadata' or 'both' modes)
		if (metadata) {
			const contentParts = [];

			// Header
			contentParts.push(stripIndents`
				${LLMTool.TOOL_STYLES_CONSOLE.base.label('Data Source:')} ${data.dataSource.dsConnectionName} | ${
				LLMTool.TOOL_STYLES_CONSOLE.base.label('Type:')
			} ${data.dataSource.dsProviderType}
			`);

			// Overview
			contentParts.push(stripIndents`
				${LLMTool.TOOL_STYLES_CONSOLE.content.status.completed('📊 Data Source Overview')}
				${LLMTool.TOOL_STYLES_CONSOLE.base.label('Total Resources:')} ${metadata.totalResources || 0}
			`);

			// Resource types
			if (metadata.resourceTypes && Object.keys(metadata.resourceTypes).length > 0) {
				const typesList = Object.entries(metadata.resourceTypes)
					.map(([type, count]) => `  ${type}: ${count}`)
					.join('\n');
				contentParts.push(stripIndents`
					${LLMTool.TOOL_STYLES_CONSOLE.base.label('Resource Types:')}
					${typesList}
				`);
			}

			// Filesystem details
			if (metadata.filesystem) {
				const fsDetails = [];
				if (metadata.filesystem.deepestPathDepth !== undefined) {
					fsDetails.push(`  📁 Directory Depth: ${metadata.filesystem.deepestPathDepth}`);
				}
				if (metadata.filesystem.largestFileSize !== undefined) {
					fsDetails.push(
						`  📏 Largest File: ${
							LLMTool.TOOL_STYLES_CONSOLE.content.bytes(metadata.filesystem.largestFileSize)
						}`,
					);
				}
				if (metadata.filesystem.oldestFileDate) {
					const newest = metadata.filesystem.newestFileDate
						? new Date(metadata.filesystem.newestFileDate).toLocaleDateString()
						: 'Unknown';
					fsDetails.push(
						`  📅 Date Range: ${
							new Date(metadata.filesystem.oldestFileDate).toLocaleDateString()
						} - ${newest}`,
					);
				}

				if (fsDetails.length > 0) {
					contentParts.push(stripIndents`
						${LLMTool.TOOL_STYLES_CONSOLE.base.label('Filesystem Details:')}
						${fsDetails.join('\n')}
					`);
				}

				// File extensions
				if (metadata.filesystem.fileExtensions && Object.keys(metadata.filesystem.fileExtensions).length > 0) {
					const sortedExts = Object.entries(metadata.filesystem.fileExtensions)
						.sort(([, a], [, b]) => b - a)
						.slice(0, 8);
					const extsList = sortedExts.map(([ext, count]) => `  ${ext}: ${count}`).join('\n');
					const moreText = Object.keys(metadata.filesystem.fileExtensions).length > 8
						? `\n  ... and ${Object.keys(metadata.filesystem.fileExtensions).length - 8} more`
						: '';

					contentParts.push(stripIndents`
						${LLMTool.TOOL_STYLES_CONSOLE.base.label('Top File Extensions:')}
						${extsList}${moreText}
					`);
				}
			}

			// Notion details
			if (metadata.notion) {
				const notionDetails = [];
				if (metadata.notion.workspaceInfo) {
					notionDetails.push(`  🏢 Workspace: ${metadata.notion.workspaceInfo.name || 'Unknown'}`);
				}
				if (metadata.notion.totalPages !== undefined) {
					notionDetails.push(`  📄 Pages: ${metadata.notion.totalPages}`);
				}
				if (metadata.notion.totalDatabases !== undefined) {
					notionDetails.push(`  🗃️ Databases: ${metadata.notion.totalDatabases}`);
				}

				if (notionDetails.length > 0) {
					contentParts.push(stripIndents`
						${LLMTool.TOOL_STYLES_CONSOLE.base.label('Notion Details:')}
						${notionDetails.join('\n')}
					`);
				}
			}

			// Sample resources (for 'both' mode)
			if (resources && resources.length > 0) {
				contentParts.push(stripIndents`
					${LLMTool.TOOL_STYLES_CONSOLE.content.status.completed(`📝 Sample Resources (${resources.length})`)}
					${
					resources.map((resource) => {
						const description = resource.description ? ` (${resource.description})` : '';
						const size = resource.size !== undefined
							? ` - ${LLMTool.TOOL_STYLES_CONSOLE.content.bytes(resource.size)}`
							: '';
						return `  ${
							LLMTool.TOOL_STYLES_CONSOLE.content.filename(resource.name || resource.uri)
						}${description}${size}`;
					}).join('\n')
				}
				`);

				if (data.pagination?.nextPageToken) {
					contentParts.push(stripIndents`
						${LLMTool.TOOL_STYLES_CONSOLE.content.status.warning('More Resources Available:')}
						  Use returnType='resources' with pageToken: ${data.pagination.nextPageToken}
					`);
				}
			}

			// Last scanned
			if (metadata.lastScanned) {
				contentParts.push(`Last scanned: ${new Date(metadata.lastScanned).toLocaleString()}`);
			}

			const content = contentParts.join('\n\n');

			return {
				title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Load Data Source'),
				subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(
					resources && resources.length > 0
						? `${metadata.totalResources || 0} total resources + ${resources.length} sample`
						: `${metadata.totalResources || 0} total resources`,
				),
				content,
				preview: resources && resources.length > 0
					? `Overview + ${resources.length} sample resources from ${data.dataSource.dsConnectionName}`
					: `Data source overview: ${
						metadata.totalResources || 0
					} resources in ${data.dataSource.dsConnectionName}`,
			};
		}

		// Handle resources display (existing logic)
		const contentParts = [];
		contentParts.push(stripIndents`
            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Data Source:')} ${data.dataSource.dsConnectionName} | ${
			LLMTool.TOOL_STYLES_CONSOLE.base.label('Type:')
		} ${data.dataSource.dsProviderType}
        `);

		if (resources.length > 0) {
			contentParts.push(stripIndents`
                ${LLMTool.TOOL_STYLES_CONSOLE.content.status.completed('Resources Found:')}
                ${
				resources.map((resource) => {
					const description = resource.description ? ` (${resource.description})` : '';
					return `  ${
						LLMTool.TOOL_STYLES_CONSOLE.content.filename(resource.name || resource.uri)
					}${description}`;
				}).join('\n')
			}
            `);
		} else {
			contentParts.push(stripIndents`
                ${LLMTool.TOOL_STYLES_CONSOLE.content.status.warning('No Resources Found')}
            `);
		}

		if (data.pagination?.nextPageToken) {
			contentParts.push(stripIndents`
                ${LLMTool.TOOL_STYLES_CONSOLE.content.status.warning('More Results Available:')}
                  Use page token: ${data.pagination.nextPageToken}
            `);
		}

		const content = contentParts.join('\n\n');

		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Load Data Source'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(`${resources.length} resources found`),
			content,
			preview: `Found ${resources.length} resources in ${data.dataSource.dsConnectionName}`,
		};
	} else {
		logger.error('LLMToolLoadDatasource: Unexpected bbResponse format:', bbResponse);
		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Load Data Source'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('Error'),
			content: LLMTool.TOOL_STYLES_CONSOLE.content.status.failed(String(bbResponse)),
			preview: 'Error loading data source resources',
		};
	}
};
