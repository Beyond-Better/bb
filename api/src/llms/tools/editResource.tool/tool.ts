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
import type { LLMToolEditResourceInput } from './types.ts';
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
import { isResourceNotFoundError } from 'api/errors/error.ts';
import { logger } from 'shared/logger.ts';

import type { SearchReplaceOperation } from 'shared/types/dataSourceResource.ts';

export default class LLMToolEditResource extends LLMTool {
	private static readonly MIN_SEARCH_LENGTH = 1;

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
						'The path of the resource to be edited, relative to the data source root. Example: "src/config.ts" for files, "page/123abc" for Notion pages.',
				},
				createIfMissing: {
					type: 'boolean',
					description:
						"When true, creates the resource if it doesn't exist (only for search-and-replace operations). When false (default), fails if the resource doesn't exist.",
					default: false,
				},
				operations: {
					type: 'array',
					description:
						'Array of editing operations to apply in sequence. Each operation must specify its editType.',
					items: {
						type: 'object',
						properties: {
							editType: {
								type: 'string',
								enum: ['searchReplace', 'range', 'blocks', 'structuredData'],
								description: 'Type of edit operation to perform.',
							},
							// Search and replace properties
							searchReplace_search: {
								type: 'string',
								description:
									'The text to search for in the resource (searchReplace only). Two modes available:\n\n1. Literal mode (default):\n* Must match the resource content EXACTLY, including all whitespace and indentation\n* Special characters are matched literally\n* Example: "  const x = 10;" will only match if the spaces and semicolon exist\n\n2. Regex mode (set searchReplace_regexPattern: true):\n* Use JavaScript regex patterns\n* Can match varying whitespace with patterns like "\\s+"\n* Example: "const\\s+x\\s*=\\s*10" matches various spacing around "const x = 10"',
							},
							searchReplace_replace: {
								type: 'string',
								description:
									'The text to replace matches with (searchReplace only). Important notes:\n* In literal mode: Match the indentation level of the original text\n* In regex mode: Use $1, $2, etc. for capture groups\n* Preserve line endings and spacing for clean diffs\nExample: If replacing "  const x = 10;" keep the leading spaces in the replacement',
							},
							searchReplace_regexPattern: {
								type: 'boolean',
								description:
									'When true, treats search as a JavaScript regex pattern (searchReplace only). When false (default), matches text literally including all whitespace.',
								default: false,
							},
							searchReplace_replaceAll: {
								type: 'boolean',
								description:
									'When true, replaces all occurrences (searchReplace only). When false (default), replaces only the first occurrence.',
								default: false,
							},
							searchReplace_caseSensitive: {
								type: 'boolean',
								description:
									'When true (default), matches must have exact case (searchReplace only). When false, matches ignore case.',
								default: true,
							},
							// Range edit properties
							range_rangeType: {
								type: 'string',
								enum: [
									'insertText',
									'deleteRange',
									'replaceRange',
									'updateTextStyle',
									'updateParagraphStyle',
								],
								description: 'Type of range operation to perform (range only).',
							},
							range_location: {
								type: 'object',
								description:
									'Character position for insertion (range only, for insertText operations).',
								properties: {
									index: {
										type: 'number',
										description: 'Character index for insertion (0-based)',
									},
									tabId: {
										type: 'string',
										description: 'Tab ID for multi-tab documents (optional)',
									},
								},
								required: ['index'],
							},
							range_range: {
								type: 'object',
								description:
									'Character range for operations (range only, for delete/replace/style operations).',
								properties: {
									startIndex: {
										type: 'number',
										description: 'Start character index (0-based, inclusive)',
									},
									endIndex: {
										type: 'number',
										description: 'End character index (0-based, exclusive)',
									},
									tabId: {
										type: 'string',
										description: 'Tab ID for multi-tab documents (optional)',
									},
								},
								required: ['startIndex', 'endIndex'],
							},
							range_text: {
								type: 'string',
								description: 'Text content for insert/replace operations (range only).',
							},
							range_textStyle: {
								type: 'object',
								description: 'Text formatting to apply (range only, for updateTextStyle operations).',
								properties: {
									bold: { type: 'boolean', description: 'Apply bold formatting' },
									italic: { type: 'boolean', description: 'Apply italic formatting' },
									underline: { type: 'boolean', description: 'Apply underline formatting' },
									strikethrough: { type: 'boolean', description: 'Apply strikethrough formatting' },
									fontSize: { type: 'number', description: 'Font size in points' },
									fontFamily: { type: 'string', description: 'Font family name' },
									color: { type: 'string', description: 'Text color as hex code (e.g., #FF0000)' },
									backgroundColor: {
										type: 'string',
										description: 'Background color as hex code (e.g., #FFFF00)',
									},
									link: {
										type: 'object',
										description: 'Hyperlink properties',
										properties: {
											url: { type: 'string', description: 'URL for the hyperlink' },
											title: { type: 'string', description: 'Optional title for the hyperlink' },
										},
										required: ['url'],
									},
								},
							},
							range_paragraphStyle: {
								type: 'object',
								description:
									'Paragraph formatting to apply (range only, for updateParagraphStyle operations).',
								properties: {
									namedStyleType: {
										type: 'string',
										enum: [
											'NORMAL_TEXT',
											'HEADING_1',
											'HEADING_2',
											'HEADING_3',
											'HEADING_4',
											'HEADING_5',
											'HEADING_6',
											'BLOCKQUOTE',
										],
										description: 'Named paragraph style type',
									},
									alignment: {
										type: 'string',
										enum: ['START', 'CENTER', 'END', 'JUSTIFIED'],
										description: 'Paragraph alignment',
									},
									lineSpacing: {
										type: 'number',
										description: 'Line spacing multiplier (1.0 = single, 2.0 = double)',
									},
									spaceAbove: { type: 'number', description: 'Space above paragraph in points' },
									spaceBelow: { type: 'number', description: 'Space below paragraph in points' },
									indentation: {
										type: 'object',
										description: 'Paragraph indentation settings',
										properties: {
											firstLine: {
												type: 'number',
												description: 'First line indentation in points',
											},
											left: { type: 'number', description: 'Left indentation in points' },
											right: { type: 'number', description: 'Right indentation in points' },
										},
									},
								},
							},
							range_fields: {
								type: 'string',
								description:
									'Comma-separated fields to update (range only, for style operations). If not provided, all fields in the style object will be updated.',
							},
							// Block edit properties
							blocks_operationType: {
								type: 'string',
								enum: ['update', 'insert', 'delete', 'move'],
								description: 'Type of block operation to perform (blocks only).',
							},
							blocks_index: {
								type: 'number',
								description: 'Block index for operations (blocks only, 0-based).',
							},
							blocks_key: {
								type: 'string',
								description:
									'Block key for targeting specific blocks (blocks only, alternative to index).',
							},
							blocks_content: {
								type: 'object',
								description: 'New block content (blocks only, for update operations).',
							},
							blocks_position: {
								type: 'number',
								description: 'Position for insert operations (blocks only, 0-based index).',
							},
							blocks_block: {
								type: 'object',
								description: 'Block to insert (blocks only, for insert operations).',
							},
							blocks_from: {
								type: 'number',
								description: 'Source index for move operations (blocks only).',
							},
							blocks_to: {
								type: 'number',
								description: 'Target index for move operations (blocks only).',
							},
							blocks_fromKey: {
								type: 'string',
								description: 'Source block key for move operations (blocks only, alternative to from).',
							},
							blocks_toPosition: {
								type: 'number',
								description: 'Target position for move operations (blocks only, alternative to to).',
							},
							// Structured data properties (future implementation)
							structuredData_operation: {
								type: 'object',
								description:
									'Structured data operation details (structuredData only, future implementation).',
							},
						},
						required: ['editType'],
					},
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
		const {
			resourcePath,
			createIfMissing = false,
			dataSourceId = undefined,
			operations,
		} = toolInput as LLMToolEditResourceInput;

		// Validate operations array structure
		this.validateOperations(operations);

		// Group operations by editType for processing
		const operationsByType = new Map<string, any[]>();
		for (const operation of operations) {
			const editType = operation.editType;
			if (!operationsByType.has(editType)) {
				operationsByType.set(editType, []);
			}
			operationsByType.get(editType)!.push(operation);
		}

		// Get data source connections
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

		const dataSourceRoot = dsConnectionToUse.getDataSourceRoot();

		// Get resource accessor
		const resourceAccessor = await dsConnectionToUse.getResourceAccessor();
		if (!resourceAccessor.writeResource) {
			throw createError(ErrorType.ToolHandling, `No writeResource method on resourceAccessor`, {
				name: 'edit-resource',
				toolName: 'edit_resource',
				operation: 'interface-check',
			} as ToolHandlingErrorOptions);
		}

		try {
			logger.info(
				`LLMToolEditResource: Applying ${operations.length} operations to resource: ${resourcePath}`,
			);

			if (!resourceAccessor.editResource) {
				throw createError(ErrorType.ToolHandling, `No writeResource method on resourceAccessor`, {
					toolName: 'write_resource',
					operation: 'tool-run',
				} as ToolHandlingErrorOptions);
			}
			// Validate resource path is within datasource
			const resourceUri = (resourcePath.includes('://') || resourcePath.startsWith('file:'))
				? dsConnectionToUse.getUriForResource(resourcePath) // Already a URI, use as is
				: dsConnectionToUse.getUriForResource(`file:./${resourcePath}`); // Likely a file path, prepend file:./

			if (!await dsConnectionToUse.isResourceWithinDataSource(resourceUri)) {
				throw createError(
					ErrorType.ResourceHandling,
					`Access denied: ${resourcePath} is outside the data source directory`,
					{
						name: 'edit-resource',
						filePath: resourcePath,
						operation: 'edit',
					} as ResourceHandlingErrorOptions,
				);
			}

			const result = await resourceAccessor.editResource(resourceUri, operations, { createIfMissing });

			// Log successful changes and commit
			if (result.successfulOperations.length > 0) {
				logger.info(
					`LLMToolEditResource: Saving conversation edit operations: ${interaction.id}`,
				);
				await projectEditor.orchestratorController.logChangeAndCommit(
					interaction,
					dataSourceRoot,
					resourcePath,
					JSON.stringify(result.successfulOperations),
				);
			}

			// Build response from unified result
			const toolResultContentParts: LLMMessageContentParts = result.operationResults.map((
				opResult: any,
				index: number,
			) => ({
				type: 'text',
				text: `${
					opResult.status === 'success' ? 'PASS' : opResult.status === 'skipped' ? '️SKIP' : 'FAIL'
				} Operation ${index + 1} (${opResult.editType}): ${opResult.message}`,
			}));

			const dsConnectionStatus = notFound.length > 0
				? `Could not find data source for: [${notFound.join(', ')}]`
				: 'Data source found';

			const operationStatus = result.allOperationsSucceeded
				? 'All operations succeeded'
				: (result.allOperationsFailed ? 'All operations failed' : 'Some operations skipped or failed');

			const newResourceStatus = result.isNewResource ? 'Resource created and ' : '';

			toolResultContentParts.unshift({
				type: 'text',
				text:
					`${newResourceStatus}Edit operations applied to resource: ${resourcePath}. ${operationStatus}. ${result.successfulOperations.length}/${operations.length} operations succeeded.`,
			});

			toolResultContentParts.unshift({
				type: 'text',
				text: `Operated on data source: ${dsConnectionToUse.name} [${dsConnectionToUse.id}]`,
			});

			const toolResults = toolResultContentParts;
			const toolResponse =
				`${dsConnectionStatus}\n${operationStatus}: ${result.successfulOperations.length}/${operations.length} operations succeeded`;

			// Create structured bbResponse
			const bbResponse = {
				data: {
					resourcePath,
					resourceId: resourcePath,
					//editType: 'unified' as const,
					operationResults: result.operationResults,
					operationsApplied: operations.length,
					operationsSuccessful: result.successfulOperations.length,
					operationsFailed: operations.length - result.successfulOperations.length,
					operationsWithWarnings: result.operationResults.filter((r: any) => r.warning).length,
					lastModified: result.metadata.lastModified || new Date().toISOString(),
					revision: result.metadata.revision || 'updated',
					bytesWritten: result.metadata.bytesWritten || 0,
					isNewResource: result.isNewResource || false,
					dataSource: {
						dsConnectionId: dsConnectionToUse.id,
						dsConnectionName: dsConnectionToUse.name,
						dsProviderType: dsConnectionToUse.providerType,
					},
				},
			};

			return { toolResults, toolResponse, bbResponse };
		} catch (error) {
			const errorMessage = `Failed to apply unified edit operations to ${resourcePath}: ${
				(error as Error).message
			}`;
			logger.error(`LLMToolEditResource: ${errorMessage}`);

			throw createError(ErrorType.ResourceHandling, errorMessage, {
				name: 'edit-resource',
				filePath: resourcePath,
				operation: 'edit',
			} as ResourceHandlingErrorOptions);
		}
	}

	/**
	 * Validate operations array structure
	 */
	private validateOperations(operations: any): void {
		if (!operations || !Array.isArray(operations)) {
			throw createError(
				ErrorType.ToolHandling,
				'operations must be an array',
				{
					name: 'edit-resource',
					toolName: 'edit_resource',
					operation: 'tool-input',
				} as ToolHandlingErrorOptions,
			);
		}

		if (operations.length === 0) {
			throw createError(
				ErrorType.ToolHandling,
				'operations array cannot be empty',
				{
					name: 'edit-resource',
					toolName: 'edit_resource',
					operation: 'tool-input',
				} as ToolHandlingErrorOptions,
			);
		}

		// Validate each operation
		for (const [index, operation] of operations.entries()) {
			if (!operation || typeof operation !== 'object') {
				throw createError(
					ErrorType.ToolHandling,
					`Operation ${index + 1} must be an object`,
					{
						name: 'edit-resource',
						toolName: 'edit_resource',
						operation: 'tool-input',
					} as ToolHandlingErrorOptions,
				);
			}

			// Validate editType field
			if (!operation.editType || typeof operation.editType !== 'string') {
				throw createError(
					ErrorType.ToolHandling,
					`Operation ${index + 1}: editType must be a string`,
					{
						name: 'edit-resource',
						toolName: 'edit_resource',
						operation: 'tool-input',
					} as ToolHandlingErrorOptions,
				);
			}

			const validEditTypes = ['searchReplace', 'range', 'blocks', 'structuredData'];
			if (!validEditTypes.includes(operation.editType)) {
				throw createError(
					ErrorType.ToolHandling,
					`Operation ${index + 1}: editType must be one of ${validEditTypes.join(', ')}`,
					{
						name: 'edit-resource',
						toolName: 'edit_resource',
						operation: 'tool-input',
					} as ToolHandlingErrorOptions,
				);
			}

			// Validate operations only use properties with matching prefixes
			const expectedPrefix = `${operation.editType}_`;
			const otherPrefixes = validEditTypes.filter((type) => type !== operation.editType).map((type) =>
				`${type}_`
			);

			for (const prop of Object.keys(operation)) {
				if (prop === 'editType') continue; // Skip editType field

				// Check if property has the correct prefix
				if (!prop.startsWith(expectedPrefix)) {
					// Check if it has another edit type prefix (which is invalid)
					const hasOtherPrefix = otherPrefixes.some((prefix) => prop.startsWith(prefix));
					if (hasOtherPrefix) {
						throw createError(
							ErrorType.ToolHandling,
							`Operation ${
								index + 1
							}: property '${prop}' does not match editType '${operation.editType}' (expected prefix: '${expectedPrefix}')`,
							{
								name: 'edit-resource',
								toolName: 'edit_resource',
								operation: 'tool-input',
							} as ToolHandlingErrorOptions,
						);
					} else {
						// Invalid property name (no recognized prefix)
						throw createError(
							ErrorType.ToolHandling,
							`Operation ${
								index + 1
							}: invalid property '${prop}' for editType '${operation.editType}' (expected prefix: '${expectedPrefix}')`,
							{
								name: 'edit-resource',
								toolName: 'edit_resource',
								operation: 'tool-input',
							} as ToolHandlingErrorOptions,
						);
					}
				}
			}

			// Validate required properties for each editType
			this.validateOperationProperties(operation, index + 1);
		}
	}

	/**
	 * Validate required properties for specific operation types
	 */
	private validateOperationProperties(operation: any, operationNumber: number): void {
		switch (operation.editType) {
			case 'searchReplace':
				if (typeof operation.searchReplace_search !== 'string') {
					throw createError(
						ErrorType.ToolHandling,
						`Operation ${operationNumber}: searchReplace_search must be a string`,
						{
							name: 'edit-resource',
							toolName: 'edit_resource',
							operation: 'tool-input',
						} as ToolHandlingErrorOptions,
					);
				}
				if (typeof operation.searchReplace_replace !== 'string') {
					throw createError(
						ErrorType.ToolHandling,
						`Operation ${operationNumber}: searchReplace_replace must be a string`,
						{
							name: 'edit-resource',
							toolName: 'edit_resource',
							operation: 'tool-input',
						} as ToolHandlingErrorOptions,
					);
				}
				break;
			case 'range':
				if (!operation.range_rangeType || typeof operation.range_rangeType !== 'string') {
					throw createError(
						ErrorType.ToolHandling,
						`Operation ${operationNumber}: range_rangeType must be a string`,
						{
							name: 'edit-resource',
							toolName: 'edit_resource',
							operation: 'tool-input',
						} as ToolHandlingErrorOptions,
					);
				}
				const validRangeTypes = [
					'insertText',
					'deleteRange',
					'replaceRange',
					'updateTextStyle',
					'updateParagraphStyle',
				];
				if (!validRangeTypes.includes(operation.range_rangeType)) {
					throw createError(
						ErrorType.ToolHandling,
						`Operation ${operationNumber}: range_rangeType must be one of ${validRangeTypes.join(', ')}`,
						{
							name: 'edit-resource',
							toolName: 'edit_resource',
							operation: 'tool-input',
						} as ToolHandlingErrorOptions,
					);
				}

				// Validate required properties based on range type
				switch (operation.range_rangeType) {
					case 'insertText':
						if (!operation.range_location || typeof operation.range_location !== 'object') {
							throw createError(
								ErrorType.ToolHandling,
								`Operation ${operationNumber}: insertText requires range_location object`,
								{
									name: 'edit-resource',
									toolName: 'edit_resource',
									operation: 'tool-input',
								} as ToolHandlingErrorOptions,
							);
						}
						if (typeof operation.range_location.index !== 'number') {
							throw createError(
								ErrorType.ToolHandling,
								`Operation ${operationNumber}: range_location.index must be a number`,
								{
									name: 'edit-resource',
									toolName: 'edit_resource',
									operation: 'tool-input',
								} as ToolHandlingErrorOptions,
							);
						}
						if (!operation.range_text || typeof operation.range_text !== 'string') {
							throw createError(
								ErrorType.ToolHandling,
								`Operation ${operationNumber}: insertText requires range_text string`,
								{
									name: 'edit-resource',
									toolName: 'edit_resource',
									operation: 'tool-input',
								} as ToolHandlingErrorOptions,
							);
						}
						break;
					case 'deleteRange':
						if (!operation.range_range || typeof operation.range_range !== 'object') {
							throw createError(
								ErrorType.ToolHandling,
								`Operation ${operationNumber}: deleteRange requires range_range object`,
								{
									name: 'edit-resource',
									toolName: 'edit_resource',
									operation: 'tool-input',
								} as ToolHandlingErrorOptions,
							);
						}
						if (
							typeof operation.range_range.startIndex !== 'number' ||
							typeof operation.range_range.endIndex !== 'number'
						) {
							throw createError(
								ErrorType.ToolHandling,
								`Operation ${operationNumber}: range_range.startIndex and endIndex must be numbers`,
								{
									name: 'edit-resource',
									toolName: 'edit_resource',
									operation: 'tool-input',
								} as ToolHandlingErrorOptions,
							);
						}
						break;
					case 'replaceRange':
						if (!operation.range_range || typeof operation.range_range !== 'object') {
							throw createError(
								ErrorType.ToolHandling,
								`Operation ${operationNumber}: replaceRange requires range_range object`,
								{
									name: 'edit-resource',
									toolName: 'edit_resource',
									operation: 'tool-input',
								} as ToolHandlingErrorOptions,
							);
						}
						if (
							typeof operation.range_range.startIndex !== 'number' ||
							typeof operation.range_range.endIndex !== 'number'
						) {
							throw createError(
								ErrorType.ToolHandling,
								`Operation ${operationNumber}: range_range.startIndex and endIndex must be numbers`,
								{
									name: 'edit-resource',
									toolName: 'edit_resource',
									operation: 'tool-input',
								} as ToolHandlingErrorOptions,
							);
						}
						if (!operation.range_text || typeof operation.range_text !== 'string') {
							throw createError(
								ErrorType.ToolHandling,
								`Operation ${operationNumber}: replaceRange requires range_text string`,
								{
									name: 'edit-resource',
									toolName: 'edit_resource',
									operation: 'tool-input',
								} as ToolHandlingErrorOptions,
							);
						}
						break;
					case 'updateTextStyle':
					case 'updateParagraphStyle':
						if (!operation.range_range || typeof operation.range_range !== 'object') {
							throw createError(
								ErrorType.ToolHandling,
								`Operation ${operationNumber}: ${operation.range_rangeType} requires range_range object`,
								{
									name: 'edit-resource',
									toolName: 'edit_resource',
									operation: 'tool-input',
								} as ToolHandlingErrorOptions,
							);
						}
						if (
							typeof operation.range_range.startIndex !== 'number' ||
							typeof operation.range_range.endIndex !== 'number'
						) {
							throw createError(
								ErrorType.ToolHandling,
								`Operation ${operationNumber}: range_range.startIndex and endIndex must be numbers`,
								{
									name: 'edit-resource',
									toolName: 'edit_resource',
									operation: 'tool-input',
								} as ToolHandlingErrorOptions,
							);
						}
						// Style validation is optional - if provided, must be objects
						if (
							operation.range_rangeType === 'updateTextStyle' && operation.range_textStyle &&
							typeof operation.range_textStyle !== 'object'
						) {
							throw createError(
								ErrorType.ToolHandling,
								`Operation ${operationNumber}: range_textStyle must be an object`,
								{
									name: 'edit-resource',
									toolName: 'edit_resource',
									operation: 'tool-input',
								} as ToolHandlingErrorOptions,
							);
						}
						if (
							operation.range_rangeType === 'updateParagraphStyle' && operation.range_paragraphStyle &&
							typeof operation.range_paragraphStyle !== 'object'
						) {
							throw createError(
								ErrorType.ToolHandling,
								`Operation ${operationNumber}: range_paragraphStyle must be an object`,
								{
									name: 'edit-resource',
									toolName: 'edit_resource',
									operation: 'tool-input',
								} as ToolHandlingErrorOptions,
							);
						}
						break;
				}
				break;
			case 'blocks':
				if (!operation.blocks_operationType || typeof operation.blocks_operationType !== 'string') {
					throw createError(
						ErrorType.ToolHandling,
						`Operation ${operationNumber}: blocks_operationType must be a string`,
						{
							name: 'edit-resource',
							toolName: 'edit_resource',
							operation: 'tool-input',
						} as ToolHandlingErrorOptions,
					);
				}
				const validBlockTypes = ['update', 'insert', 'delete', 'move'];
				if (!validBlockTypes.includes(operation.blocks_operationType)) {
					throw createError(
						ErrorType.ToolHandling,
						`Operation ${operationNumber}: blocks_operationType must be one of ${
							validBlockTypes.join(', ')
						}`,
						{
							name: 'edit-resource',
							toolName: 'edit_resource',
							operation: 'tool-input',
						} as ToolHandlingErrorOptions,
					);
				}
				break;
			case 'structuredData':
				// Minimal validation for structured data (future implementation)
				if (!operation.structuredData_operation || typeof operation.structuredData_operation !== 'object') {
					throw createError(
						ErrorType.ToolHandling,
						`Operation ${operationNumber}: structuredData_operation must be an object`,
						{
							name: 'edit-resource',
							toolName: 'edit_resource',
							operation: 'tool-input',
						} as ToolHandlingErrorOptions,
					);
				}
				break;
		}
	}
}
