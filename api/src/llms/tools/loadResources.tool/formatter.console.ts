import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolLoadResourcesInput, LLMToolLoadResourcesResult } from './types.ts';
import { logger } from 'shared/logger.ts';
import { stripIndents } from 'common-tags';

export const formatLogEntryToolUse = (
	toolInput: LLMToolInputSchema,
): LLMToolLogEntryFormattedResult => {
	const { mode, uriTemplate, templateResources, directUris } = toolInput as LLMToolLoadResourcesInput;

	// Get the appropriate URIs based on mode
	let uris: string[] = [];
	let resourceCount = 0;

	if (mode === 'direct' && directUris) {
		uris = directUris;
		resourceCount = directUris.length;
	} else if (mode === 'template' && templateResources) {
		// For template mode, show a representation of each resource that will be loaded
		resourceCount = templateResources.length;
		if (uriTemplate) {
			// If we have a template, show a preview for each resource
			uris = templateResources.map((resource, _index) => {
				// Create a simplified representation of the template resource
				const params = Object.entries(resource)
					.map(([key, value]) => `${key}=${value}`)
					.join(', ');
				return `${uriTemplate} [${params}]`;
			});
		} else {
			// Fallback if no template is provided
			uris = [`Template resources (${resourceCount})`];
		}
	}

	const content = stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Loading resources:')}
        ${uris.map((uri) => LLMTool.TOOL_STYLES_CONSOLE.content.filename(uri)).join('\n')}
    `;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Load Resources'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(`${resourceCount} resources`),
		content,
		preview: `Loading ${resourceCount} resource${resourceCount === 1 ? '' : 's'}`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: CollaborationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent;

	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const { data } = bbResponse as LLMToolLoadResourcesResult['bbResponse'];

		const contentParts = [];

		if (data.resourcesAdded.length > 0) {
			contentParts.push(stripIndents`
                ${LLMTool.TOOL_STYLES_CONSOLE.content.status.completed('Resources Added:')}
                ${
				data.resourcesAdded.map((resource) => `  ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(resource)}`)
					.join('\n')
			}
            `);
		}

		if (data.resourcesError.length > 0) {
			contentParts.push(stripIndents`
                ${LLMTool.TOOL_STYLES_CONSOLE.content.status.failed('Failed to Add:')}
                ${
				data.resourcesError.map((resource) => `  ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(resource)}`)
					.join('\n')
			}
            `);
		}

		const content = contentParts.join('\n\n');
		const addedCount = data.resourcesAdded.length;
		const errorCount = data.resourcesError.length;
		const subtitle = `${addedCount} added${errorCount > 0 ? `, ${errorCount} failed` : ''}`;

		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Load Resources'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(subtitle),
			content,
			preview: addedCount > 0
				? `Added ${addedCount} resource${addedCount === 1 ? '' : 's'}`
				: 'No resources added',
		};
	} else {
		logger.error('LLMToolLoadResources: Unexpected bbResponse format:', bbResponse);
		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Load Resources'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('Error'),
			content: LLMTool.TOOL_STYLES_CONSOLE.content.status.failed(String(bbResponse)),
			preview: 'Error loading resources',
		};
	}
};
