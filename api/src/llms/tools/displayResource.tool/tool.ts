//import type { JSX } from 'preact';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult, LLMToolRunResult } from 'api/llms/llmTool.ts';
import {
	formatLogEntryToolResult as formatLogEntryToolResultBrowser,
	formatLogEntryToolUse as formatLogEntryToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatLogEntryToolResult as formatLogEntryToolResultConsole,
	formatLogEntryToolUse as formatLogEntryToolUseConsole,
} from './formatter.console.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
//import type { ResourceManager } from 'api/resources/resourceManager.ts';
import { encodeBase64 } from '@std/encoding';
import { logger } from 'shared/logger.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type { DataSourceHandlingErrorOptions, ResourceHandlingErrorOptions } from 'api/errors/error.ts';
import type {
	LLMToolDisplayResourceInput,
	LLMToolDisplayResourceResultData,
	ResourceMetadata,
	//LLMToolDisplayResourceResultData,
} from './types.ts';
//import {
//    TEXT_DISPLAY_LIMIT,
//    TEXT_HARD_LIMIT,
//    IMAGE_DISPLAY_LIMIT,
//    IMAGE_HARD_LIMIT,
//} from './types.ts';

export default class LLMToolDisplayResource extends LLMTool {
	//private resourceManager: ResourceManager|null = null;

	// constructor() {
	//     super();
	//     // ResourceManager will be initialized in runTool when we have access to ProjectEditor
	//     this.resourceManager = null as unknown as ResourceManager;
	// }
	// public override async init(): Promise<LLMToolDisplayResource> {
	// 	await super.init();
	// 	this.resourceManager = projectEditor.resourceManager;
	// 	return this;
	// }

	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				dataSourceId: {
					type: 'string',
					description:
						"Data source ID to operate on. Defaults to the primary data source if omitted. Examples: 'primary', 'filesystem-1', 'db-staging'. Data sources are identified by their name (e.g., 'primary', 'local-2', 'supabase'). **IMPORTANT: Different data sources have different path format requirements - use loadDataSource with returnType='instructions' and operations=['utility'] to get provider-specific resource path guidance.**",
				},
				resourcePath: {
					type: 'string',
					description: 'The path of the resource to display, relative to the data source root.',
				},
			},
			required: ['resourcePath'],
		};
	}

	formatLogEntryToolUse(
		toolInput: LLMToolInputSchema,
		format: 'console' | 'browser' = 'console',
	): LLMToolLogEntryFormattedResult {
		return format === 'console' ? formatLogEntryToolUseConsole(toolInput) : formatLogEntryToolUseBrowser(toolInput);
	}

	formatLogEntryToolResult(
		resultContent: CollaborationLogEntryContentToolResult,
		format: 'console' | 'browser' = 'console',
	): LLMToolLogEntryFormattedResult {
		return format === 'console'
			? formatLogEntryToolResultConsole(resultContent)
			: formatLogEntryToolResultBrowser(resultContent);
	}

	async runTool(
		_interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { resourcePath, dataSourceId = undefined } = toolUse.toolInput as LLMToolDisplayResourceInput;
		const { primaryDsConnection, dsConnections, notFound } = this.getDsConnectionsById(
			projectEditor,
			dataSourceId ? [dataSourceId] : undefined,
		);
		if (!primaryDsConnection) {
			throw createError(ErrorType.DataSourceHandling, `No primary data source`, {
				name: 'datasource',
				dataSourceIds: dataSourceId ? [dataSourceId] : undefined,
			} as DataSourceHandlingErrorOptions);
		}

		const dsConnectionToUse = dsConnections[0] || primaryDsConnection;
		const dsConnectionToUseId = dsConnectionToUse.id;
		if (!dsConnectionToUseId) {
			throw createError(ErrorType.DataSourceHandling, `No data source id`, {
				name: 'datasource',
				dataSourceIds: dataSourceId ? [dataSourceId] : undefined,
			} as DataSourceHandlingErrorOptions);
		}

		try {
			// //const projectData = projectEditor.projectData;
			// const resourceManager = projectEditor.resourceManager;
			//
			// const resourceUri = dsConnectionToUse.getUriForResource(`file:./${resourcePath}`, { resourcePath });
			// //logger.error(`LLMToolDisplayResource: display resource for: ${resourceUri}`);
			//
			// const resource = await resourceManager.loadResource(resourceUri);

			// const resourceUri = `file:./${resourcePath}`;
			const resourceUri = dsConnectionToUse.getUriForResource(`file:./${resourcePath}`);
			const resourceAccessor = await dsConnectionToUse.getResourceAccessor();
			//logger.error(`LLMToolDisplayResource: display resource for: ${resourceUri}`, {resourceAccessor});
			const resource = await resourceAccessor.loadResource(resourceUri);
			if (!resource) {
				throw createError(ErrorType.DataSourceHandling, `Could not load resource`, {
					operation: 'read',
				} as ResourceHandlingErrorOptions);
			}
			const displayResult: LLMToolDisplayResourceResultData = {
				contentType: resource.metadata?.mimeType?.startsWith('image/') ? 'image' : 'text',
				content: resource.content instanceof Uint8Array ? encodeBase64(resource.content) : resource.content,
				metadata: {
					name: resourcePath,
					size: resource.metadata?.size || 0,
					mimeType: resource.metadata?.mimeType || 'application/octet-stream',
					lastModified: resource.metadata?.lastModified, // new Date(),
				} as ResourceMetadata,
				//truncated: resource.truncated,
				dataSource: {
					dsConnectionId: dsConnectionToUse.id,
					dsConnectionName: dsConnectionToUse.name,
					dsProviderType: dsConnectionToUse.providerType,
				},
			};

			const dsConnectionStatus = notFound.length > 0
				? `Could not find data source for: [${notFound.join(', ')}]`
				: `Data source: ${dsConnectionToUse.name} [${dsConnectionToUse.id}]`;

			const toolResults =
				`Used data source: ${dsConnectionToUse.name}\nResource: ${resourcePath} - Size: ${displayResult.metadata.size} - MimeType: ${displayResult.metadata.mimeType} - LastModified: ${displayResult.metadata.lastModified} - Content: <not displayed here>`;
			const toolResponse =
				`${dsConnectionStatus}\n\nDisplayed resource: ${resourcePath}\nThe resource has been displayed for the user only, and you have been provided with the metadata of the resource. Since this tool is for benefit of the user you are not being shown the content.`;

			return {
				toolResults,
				toolResponse,
				bbResponse: { data: displayResult },
			};
		} catch (error) {
			logger.error(`LLMToolDisplayResource: Failed to display resource: ${(error as Error).message}`);

			const toolResults = `⚠️  ${(error as Error).message}`;
			const bbResponse = `BB failed to display resource. Error: ${(error as Error).message}`;
			const toolResponse = `Failed to display resource. Error: ${(error as Error).message}`;
			return { toolResults, toolResponse, bbResponse };
		}
	}
}
