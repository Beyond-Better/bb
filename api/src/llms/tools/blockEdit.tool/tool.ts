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
import type { LLMToolBlockEditInput } from './types.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMAnswerToolUse, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type {
	DataSourceHandlingErrorOptions,
	ResourceHandlingErrorOptions,
	ToolHandlingErrorOptions,
} from 'api/errors/error.ts';
import { logger } from 'shared/logger.ts';
import type { BlockResourceAccessor, PortableTextOperationResult } from 'api/src/dataSources/interfaces/blockResourceAccessor.ts';

export default class LLMToolBlockEdit extends LLMTool {
	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				dataSourceId: {
					type: 'string',
					description:
						"Data source ID to operate on. Defaults to the primary data source if omitted. Examples: 'primary', 'filesystem-1', 'db-staging'. Data sources are identified by their name (e.g., 'primary', 'local-2', 'supabase').",
				},
				resourcePath: {
					type: 'string',
					description:
						'The path of the document to be modified, relative to the data source root. Example: "page/123abc" for Notion pages.',
				},
				operations: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							type: {
								type: 'string',
								enum: ['update', 'insert', 'delete', 'move'],
								description: 'Type of operation to perform on the document blocks.',
							},
							index: {
								type: 'number',
								description: 'Block index for update, delete, or move operations (0-based).',
							},
							_key: {
								type: 'string',
								description: 'Block key for targeting specific blocks (alternative to index).',
							},
							content: {
								type: 'object',
								description: 'New block content for update operations.',
								properties: {
									_type: {
										type: 'string',
										description: 'Block type (e.g., "block", "code", "divider").',
									},
									_key: {
										type: 'string',
										description: 'Unique identifier for the block.',
									},
									style: {
										type: 'string',
										description: 'Block style (e.g., "normal", "h1", "h2", "h3", "blockquote").',
									},
									children: {
										type: 'array',
										items: {
											type: 'object',
											properties: {
												_type: {
													type: 'string',
													enum: ['span'],
													description: 'Span type (always "span").',
												},
												_key: {
													type: 'string',
													description: 'Unique identifier for the span.',
												},
												text: {
													type: 'string',
													description: 'Text content of the span.',
												},
												marks: {
													type: 'array',
													items: {
														type: 'string',
													},
													description: 'Text formatting marks (e.g., "strong", "em", "code").',
												},
											},
											required: ['_type', 'text'],
										},
										description: 'Array of text spans for block-type elements.',
									},
								},
								required: ['_type'],
							},
							position: {
								type: 'number',
								description: 'Position for insert operations (0-based index).',
							},
							block: {
								type: 'object',
								description: 'Block to insert for insert operations.',
								properties: {
									_type: {
										type: 'string',
										description: 'Block type (e.g., "block", "code", "divider").',
									},
									_key: {
										type: 'string',
										description: 'Unique identifier for the block.',
									},
									style: {
										type: 'string',
										description: 'Block style (e.g., "normal", "h1", "h2", "h3", "blockquote").',
									},
									children: {
										type: 'array',
										items: {
											type: 'object',
											properties: {
												_type: {
													type: 'string',
													enum: ['span'],
													description: 'Span type (always "span").',
												},
												_key: {
													type: 'string',
													description: 'Unique identifier for the span.',
												},
												text: {
													type: 'string',
													description: 'Text content of the span.',
												},
												marks: {
													type: 'array',
													items: {
														type: 'string',
													},
													description: 'Text formatting marks (e.g., "strong", "em", "code").',
												},
											},
											required: ['_type', 'text'],
										},
										description: 'Array of text spans for block-type elements.',
									},
								},
								required: ['_type'],
							},
							from: {
								type: 'number',
								description: 'Source index for move operations.',
							},
							to: {
								type: 'number',
								description: 'Target index for move operations.',
							},
							fromKey: {
								type: 'string',
								description: 'Source block key for move operations (alternative to from).',
							},
							toPosition: {
								type: 'number',
								description: 'Target position for move operations (alternative to to).',
							},
						},
						required: ['type'],
					},
					description:
						'Array of Portable Text operations to apply in sequence. Each operation modifies the document structure.',
				},
			},
			required: ['resourcePath', 'operations'],
		};
	}

	formatLogEntryToolUse(
		toolInput: LLMToolInputSchema,
		format: 'console' | 'browser',
	): LLMToolLogEntryFormattedResult {
		return format === 'console' ? formatLogEntryToolUseConsole(toolInput) : formatLogEntryToolUseBrowser(toolInput);
	}

	formatLogEntryToolResult(
		resultContent: CollaborationLogEntryContentToolResult,
		format: 'console' | 'browser',
	): LLMToolLogEntryFormattedResult {
		return format === 'console'
			? formatLogEntryToolResultConsole(resultContent)
			: formatLogEntryToolResultBrowser(resultContent);
	}

	async runTool(
		interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { toolUseId: _toolUseId, toolInput } = toolUse;
		const { resourcePath, operations, dataSourceId = undefined } = toolInput as LLMToolBlockEditInput;

		const { primaryDsConnection, dsConnections, notFound } = this.getDsConnectionsById(
			projectEditor,
			dataSourceId ? [dataSourceId] : undefined,
		);
		if (!primaryDsConnection) {
			throw createError(ErrorType.DataSourceHandling, `No primary data source`, {
				name: 'data-source',
				dataSourceIds: dataSourceId ? [dataSourceId] : undefined,
			} as DataSourceHandlingErrorOptions);
		}

		const dsConnectionToUse = dsConnections[0] || primaryDsConnection;
		const dsConnectionToUseId = dsConnectionToUse.id;
		if (!dsConnectionToUseId) {
			throw createError(ErrorType.DataSourceHandling, `No data source id`, {
				name: 'data-source',
				dataSourceIds: dataSourceId ? [dataSourceId] : undefined,
			} as DataSourceHandlingErrorOptions);
		}

		const dataSourceRoot = dsConnectionToUse.getDataSourceRoot();

		// Construct the resource URI
		const resourceUri = (resourcePath.includes('://') || resourcePath.startsWith('file:'))
			? dsConnectionToUse.getUriForResource(resourcePath) // Already a URI, use as is
			: dsConnectionToUse.getUriForResource(resourcePath); // Convert path to URI

		if (!await dsConnectionToUse.isResourceWithinDataSource(resourceUri)) {
			throw createError(
				ErrorType.ResourceHandling,
				`Access denied: ${resourcePath} is outside the data source`,
				{
					name: 'block-edit',
					filePath: resourcePath,
					operation: 'block-edit',
				} as ResourceHandlingErrorOptions,
			);
		}

		const resourceAccessor = await dsConnectionToUse.getResourceAccessor();

		// Check if the accessor supports block editing
		if (!resourceAccessor.hasCapability || !resourceAccessor.hasCapability('blockEdit')) {
			throw createError(ErrorType.ToolHandling, `Data source does not support block editing operations`, {
				toolName: 'block_edit',
				operation: 'capability-check',
			} as ToolHandlingErrorOptions);
		}

		// Cast to BlockResourceAccessor to access block editing methods
		const blockAccessor = resourceAccessor as unknown as BlockResourceAccessor;
		if (!blockAccessor.getDocumentAsPortableText || !blockAccessor.applyPortableTextOperations) {
			throw createError(ErrorType.ToolHandling, `Resource accessor does not implement block editing interface`, {
				toolName: 'block_edit',
				operation: 'interface-check',
			} as ToolHandlingErrorOptions);
		}

		logger.info(`LLMToolBlockEdit: Applying ${operations.length} block operations to resource: ${resourceUri}`);

		try {
			// Apply the operations using the block accessor
			const operationResults = await blockAccessor.applyPortableTextOperations(resourceUri, operations);

			// Process results
			const successfulOperations = operationResults.filter((result: PortableTextOperationResult) => result.success);
			const failedOperations = operationResults.filter((result: PortableTextOperationResult) => !result.success);

			const allOperationsSucceeded = failedOperations.length === 0;
			const allOperationsFailed = successfulOperations.length === 0;

			// Log the changes if any operations succeeded
			if (successfulOperations.length > 0) {
				logger.info(
					`LLMToolBlockEdit: Saving conversation block edit operations: ${interaction.id}`,
				);
				await projectEditor.orchestratorController.logChangeAndCommit(
					interaction,
					dataSourceRoot,
					resourcePath,
					JSON.stringify(successfulOperations.map((r: PortableTextOperationResult) => ({
						type: r.type,
						success: r.success,
						message: r.message,
						operationIndex: r.operationIndex,
					}))),
				);
			}

			// Build response content
			const toolResultContentParts: LLMMessageContentParts = operationResults.map((
				result: { success: boolean; operationIndex: number; message: string; type: string },
			) => ({
				type: 'text',
				text: `${result.success ? '✅' : '❌'} Operation ${result.operationIndex + 1} (${result.type}): ${result.message}`,
			}));

			const dsConnectionStatus = notFound.length > 0
				? `Could not find data source for: [${notFound.join(', ')}]`
				: 'Data source found';

			const operationStatus = allOperationsSucceeded
				? 'All operations succeeded'
				: (allOperationsFailed ? 'All operations failed' : 'Partial operations succeeded');

			toolResultContentParts.unshift({
				type: 'text',
				text: `Block edit operations applied to resource: ${resourcePath}. ${operationStatus}. ${successfulOperations.length}/${operations.length} operations succeeded.`,
			});

			toolResultContentParts.unshift({
				type: 'text',
				text: `Operated on data source: ${dsConnectionToUse.name} [${dsConnectionToUse.id}]`,
			});

			const toolResults = toolResultContentParts;
			const toolResponse = `${dsConnectionStatus}\n${operationStatus}: ${successfulOperations.length}/${operations.length} operations succeeded`;
			const bbResponse = `BB applied block edit operations.\n${dsConnectionStatus}`;

			return { toolResults, toolResponse, bbResponse };

		} catch (error) {
			const errorMessage = `Failed to apply block edit operations to ${resourcePath}: ${(error as Error).message}`;
			logger.error(`LLMToolBlockEdit: ${errorMessage}`);

			throw createError(ErrorType.ResourceHandling, errorMessage, {
				name: 'block-edit',
				filePath: resourcePath,
				operation: 'block-edit',
			} as ResourceHandlingErrorOptions);
		}
	}
}