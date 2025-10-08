//import type { JSX } from 'preact';
import {
	formatLogEntryToolResult as formatLogEntryToolResultBrowser,
	formatLogEntryToolUse as formatLogEntryToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatLogEntryToolResult as formatLogEntryToolResultConsole,
	formatLogEntryToolUse as formatLogEntryToolUseConsole,
} from './formatter.console.ts';
import type {
	BinaryContent,
	isBinaryContent,
	isPlainTextContent,
	isStructuredContent,
	isTabularContent,
	LLMToolWriteResourceInput,
	PlainTextContent,
	StructuredContent,
	TabularContent,
} from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult, LLMToolRunResult } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type { PortableTextBlock } from 'api/types/portableText.ts';
import type { TabularSheet } from 'api/types/tabular.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type {
	DataSourceHandlingErrorOptions,
	ResourceHandlingErrorOptions,
	ToolHandlingErrorOptions,
} from 'api/errors/error.ts';
import { isResourceNotFoundError } from 'api/errors/error.ts';
import { logger } from 'shared/logger.ts';
import { checkDatasourceAccess } from 'api/utils/featureAccess.ts';
import { enhanceDatasourceError } from '../../../utils/datasourceErrorEnhancement.ts';

const ACKNOWLEDGMENT_STRING =
	'I have checked for existing resource contents and confirm this is the complete resource content with no omissions or placeholders';

function normalizeLineEndings(content: string): string {
	return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function getLineCount(content: string): number {
	if (!content) return 0;
	const normalized = normalizeLineEndings(content);
	// Handle empty resource (0 bytes) and single empty line as equivalent
	if (normalized === '' || normalized === '\n') return 0;
	// Count lines, handling final newline
	const lines = normalized.split('\n');
	return lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
}

function validateLineCount(actualCount: number, expectedCount: number): { valid: boolean; tolerance: number } {
	// Define tolerance based on resource size
	let tolerance: number;
	if (actualCount < 10) {
		tolerance = 0; // Exact match for small resources
	} else if (actualCount < 100) {
		tolerance = 2; // ±2 lines for medium resources
	} else {
		tolerance = Math.ceil(actualCount * 0.05); // 5% tolerance for large resources
	}

	const difference = Math.abs(actualCount - expectedCount);
	return {
		valid: difference <= tolerance,
		tolerance,
	};
}

function validateAcknowledgment(acknowledgment: string): boolean {
	if (!acknowledgment) return false;
	// Case-insensitive comparison
	const normalized = acknowledgment.trim().toLowerCase();
	const expected = ACKNOWLEDGMENT_STRING.toLowerCase();

	// Remove any final punctuation
	const withoutPunctuation = normalized.replace(/[.!?]$/, '');

	return withoutPunctuation === expected;
}

// Content type validation helpers are now imported from shared types

export default class LLMToolWriteResource extends LLMTool {
	/**
	 * Extract resource ID from URI based on provider type
	 * @param uri The resource URI
	 * @param providerType The data source provider type
	 * @returns The extracted resource ID
	 */
	private extractResourceIdFromUri(uri: string, providerType: string): string {
		try {
			switch (providerType) {
				case 'filesystem':
				default: {
					// filesystem-local:./path/to/file.txt -> file.txt
					// Or return the full path for filesystem resources
					const match = uri.match(/filesystem[^:]*:\.\/(.+)$/);
					if (match) {
						const fullPath = match[1];
						// For filesystem, return the full relative path
						return fullPath;
					}
					return uri;
				}
			}
		} catch (error) {
			// Fallback to original URI if parsing fails
			return uri;
		}
	}
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
						'The path of the resource to be created, relative to the data source root. Must be within the data source directory.',
				},
				resourceName: {
					type: 'string',
					description:
						'Optional name/title for the resource when creating new documents. Used for Notion pages and Google Docs documents. If not provided, will derive title from resourcePath.',
				},
				overwriteExisting: {
					type: 'boolean',
					description: 'Whether to overwrite the resource if it already exists. Default is false.',
					default: false,
				},
				createMissingDirectories: {
					type: 'boolean',
					description: 'Whether to create missing parent directories. Default is true.',
					default: true,
				},
				plainTextContent: {
					type: 'object',
					description: 'Plain text content for filesystem and text-based data sources.',
					properties: {
						content: {
							type: 'string',
							description: 'The text content to write to the resource.',
						},
						expectedLineCount: {
							type: 'number',
							description:
								'The expected number of lines in the content. Must match the actual line count within tolerance.',
						},
						allowEmptyContent: {
							type: 'boolean',
							description: 'Whether to allow empty content. Default is false.',
							default: false,
						},
						acknowledgement: {
							type: 'string',
							description:
								'Required confirmation string acknowledging plain text content creation. Must be exactly: "' +
								ACKNOWLEDGMENT_STRING + '" (case insensitive, may include final punctuation)',
						},
					},
					required: ['content', 'acknowledgement', 'expectedLineCount'],
				},
				structuredContent: {
					type: 'object',
					description: 'Structured content for block-based data sources like Notion and Google Docs.',
					properties: {
						blocks: {
							type: 'array',
							description: 'Array of Portable Text blocks representing the structured content.',
							items: {
								type: 'object',
								properties: {
									_type: { type: 'string' },
									_key: { type: 'string' },
									style: { type: 'string' },
									listItem: { type: 'string' },
									level: { type: 'number' },
									children: {
										type: 'array',
										items: {
											type: 'object',
											properties: {
												_type: { type: 'string', enum: ['span'] },
												_key: { type: 'string' },
												text: { type: 'string' },
												marks: {
													type: 'array',
													items: { type: 'string' },
												},
											},
											required: ['_type', 'text'],
										},
									},
								},
								required: ['_type', 'children'],
							},
						},
						acknowledgement: {
							type: 'string',
							description:
								'Required confirmation string acknowledging structured content creation. Must be exactly: "' +
								ACKNOWLEDGMENT_STRING + '" (case insensitive, may include final punctuation)',
						},
					},
					required: ['blocks', 'acknowledgement'],
				},
				binaryContent: {
					type: 'object',
					description: 'Binary content for images, documents, and other non-text resources.',
					properties: {
						data: {
							type: 'string',
							description: 'Binary data encoded as base64 string or Uint8Array.',
						},
						mimeType: {
							type: 'string',
							description: 'MIME type of the binary content (e.g., "image/png", "application/pdf").',
						},
					},
					required: ['data', 'mimeType'],
				},
				tabularContent: {
					type: 'object',
					description: 'Tabular content for spreadsheets and structured data sources.',
					properties: {
						sheets: {
							type: 'array',
							description: 'Array of sheets/tables with their data.',
							items: {
								type: 'object',
								properties: {
									name: {
										type: 'string',
										description: 'Name of the sheet/table',
									},
									data: {
										type: 'array',
										description: '2D array of cell values',
										items: {
											type: 'array',
											items: {
												type: ['string', 'number', 'boolean', 'null'],
												description: 'Cell value (string, number, boolean, or null)',
											},
										},
									},
									metadata: {
										type: 'object',
										description: 'Optional metadata about the sheet',
										properties: {
											headers: {
												type: 'array',
												items: { type: 'string' },
												description: 'Column headers (if first row contains headers)',
											},
											dataRange: {
												type: 'string',
												description: 'Data range in A1 notation (e.g., "A1:C10")',
											},
											formulas: {
												type: 'object',
												description: 'Named cell formulas (key: cell range, value: formula)',
											},
											namedRanges: {
												type: 'object',
												description:
													'Named ranges defined in the sheet (key: name, value: range)',
											},
										},
									},
								},
								required: ['name', 'data'],
							},
						},
						allowEmptyContent: {
							type: 'boolean',
							description: 'Whether to allow empty content. Default is false.',
							default: false,
						},
						acknowledgement: {
							type: 'string',
							description:
								'Required confirmation string acknowledging tabular content creation. Must be exactly: "' +
								ACKNOWLEDGMENT_STRING + '" (case insensitive, may include final punctuation)',
						},
					},
					required: ['sheets', 'acknowledgement'],
				},
			},
			required: ['resourcePath'],
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
		const { toolInput } = toolUse;
		const {
			resourcePath,
			resourceName,
			overwriteExisting = false,
			createMissingDirectories = true,
			plainTextContent,
			structuredContent,
			binaryContent,
			tabularContent,
			dataSourceId = undefined,
		} = toolInput as LLMToolWriteResourceInput;

		// Validate exactly one content type is provided
		const contentTypes = [plainTextContent, structuredContent, binaryContent, tabularContent].filter(Boolean);
		if (contentTypes.length === 0) {
			throw createError(
				ErrorType.ToolHandling,
				'No content type provided. Must provide exactly one of: plainTextContent, structuredContent, binaryContent, or tabularContent',
				{
					toolName: 'write_resource',
					operation: 'tool-run',
				} as ToolHandlingErrorOptions,
			);
		}
		if (contentTypes.length > 1) {
			throw createError(
				ErrorType.ToolHandling,
				'Multiple content types provided. Must provide exactly one of: plainTextContent, structuredContent, binaryContent, or tabularContent',
				{
					toolName: 'write_resource',
					operation: 'tool-run',
				} as ToolHandlingErrorOptions,
			);
		}

		// Get datasource connections
		const { primaryDsConnection, dsConnections, notFound } = this.getDsConnectionsById(
			projectEditor,
			dataSourceId ? [dataSourceId] : undefined,
		);

		const dsConnectionToUse = dsConnections[0] || primaryDsConnection;
		const dsConnectionToUseId = dsConnectionToUse.id;
		if (!dsConnectionToUseId) {
			throw createError(ErrorType.DataSourceHandling, `No data source id`, {
				name: 'datasource',
				dataSourceIds: dataSourceId ? [dataSourceId] : undefined,
			} as DataSourceHandlingErrorOptions);
		}

		if (!dsConnectionToUse) {
			throw createError(ErrorType.DataSourceHandling, `No primary data source`, {
				name: 'datasource',
				dataSourceIds: dataSourceId ? [dataSourceId] : undefined,
			} as DataSourceHandlingErrorOptions);
		}

		// Check datasource write access
		const hasWriteAccess = await checkDatasourceAccess(
			projectEditor.userContext,
			dsConnectionToUse.providerType,
			'write',
		);
		if (!hasWriteAccess) {
			throw createError(
				ErrorType.ToolHandling,
				`Write access for ${dsConnectionToUse.providerType} not available on your current plan`,
				{
					toolName: 'write_resource',
					operation: 'capability-check',
				} as ToolHandlingErrorOptions,
			);
		}

		// Get resource accessor
		const resourceAccessor = await dsConnectionToUse.getResourceAccessor();
		//logger.info(`LLMToolWriteResource: resourceAccessor`, resourceAccessor);
		if (!resourceAccessor.writeResource) {
			throw createError(ErrorType.ToolHandling, `No writeResource method on resourceAccessor`, {
				toolName: 'write_resource',
				operation: 'tool-run',
			} as ToolHandlingErrorOptions);
		}

		// Determine content type and validate compatibility
		let contentTypeUsed: 'plain-text' | 'structured' | 'binary' | 'tabular';
		let contentToWrite:
			| string
			| Uint8Array
			| Array<PortableTextBlock>
			| Array<TabularSheet>;
		let actualLineCount = 0;
		let lineCountErrorMessage = '';

		if (plainTextContent) {
			contentTypeUsed = 'plain-text';

			// Validate that datasource supports plain text
			// For now, we'll assume filesystem and most datasources support plain text
			// TODO: Add provider capability validation once provider enhancement is implemented

			// Validate line count for plain text
			actualLineCount = getLineCount(plainTextContent.content);
			const lineCountValidation = validateLineCount(actualLineCount, plainTextContent.expectedLineCount);
			if (!lineCountValidation.valid) {
				lineCountErrorMessage =
					`Line count mismatch. Content has ${actualLineCount} lines but expected ${plainTextContent.expectedLineCount} lines.`;
			}

			// Validate acknowledgment for structured content
			if (!validateAcknowledgment(plainTextContent.acknowledgement)) {
				throw createError(
					ErrorType.ResourceHandling,
					'Invalid acknowledgement string for plain text content. Must be exactly: "' +
						ACKNOWLEDGMENT_STRING +
						'" (case insensitive, may include final punctuation)',
					{
						name: 'write',
						filePath: resourcePath,
						operation: 'write',
					} as ResourceHandlingErrorOptions,
				);
			}

			// Check empty content
			if (!plainTextContent.content && !plainTextContent.allowEmptyContent) {
				throw createError(
					ErrorType.ResourceHandling,
					'Empty content provided and allowEmptyContent is false. To create an empty resource, set allowEmptyContent: true',
					{
						name: 'write-resource',
						filePath: resourcePath,
						operation: 'write',
					} as ResourceHandlingErrorOptions,
				);
			}

			contentToWrite = plainTextContent.content;
		} else if (structuredContent) {
			contentTypeUsed = 'structured';

			// Validate acknowledgment for structured content
			if (!validateAcknowledgment(structuredContent.acknowledgement)) {
				throw createError(
					ErrorType.ResourceHandling,
					'Invalid acknowledgement string for structured content. Must be exactly: "' +
						ACKNOWLEDGMENT_STRING +
						'" (case insensitive, may include final punctuation)',
					{
						name: 'write-resource',
						filePath: resourcePath,
						operation: 'write',
					} as ResourceHandlingErrorOptions,
				);
			}

			// Check empty content
			if (
				(!structuredContent.blocks || structuredContent.blocks.length === 0) &&
				!structuredContent.allowEmptyContent
			) {
				throw createError(
					ErrorType.ResourceHandling,
					'Empty content provided and allowEmptyContent is false. To create an empty resource, set allowEmptyContent: true',
					{
						name: 'write-resource',
						filePath: resourcePath,
						operation: 'write',
					} as ResourceHandlingErrorOptions,
				);
			}

			// For structured content, pass the blocks directly
			// The individual data source accessors will handle conversion as needed
			contentToWrite = structuredContent.blocks; // as any; // Type assertion needed for mixed content types
		} else if (binaryContent) {
			contentTypeUsed = 'binary';

			// Handle binary content
			if (typeof binaryContent.data === 'string') {
				// Assume base64 encoded
				try {
					const base64Data = binaryContent.data.replace(/^data:[^;]+;base64,/, '');
					contentToWrite = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
				} catch (error) {
					throw createError(ErrorType.ResourceHandling, 'Invalid base64 binary data provided', {
						name: 'write-resource',
						filePath: resourcePath,
						operation: 'write',
					} as ResourceHandlingErrorOptions);
				}
			} else {
				contentToWrite = binaryContent.data;
			}
		} else if (tabularContent) {
			contentTypeUsed = 'tabular';

			// Validate acknowledgment for tabular content
			if (!validateAcknowledgment(tabularContent.acknowledgement)) {
				throw createError(
					ErrorType.ResourceHandling,
					'Invalid acknowledgement string for tabular content. Must be exactly: "' +
						ACKNOWLEDGMENT_STRING +
						'" (case insensitive, may include final punctuation)',
					{
						name: 'write-resource',
						filePath: resourcePath,
						operation: 'write',
					} as ResourceHandlingErrorOptions,
				);
			}

			// Check empty content
			if (
				(!tabularContent.sheets || tabularContent.sheets.length === 0) &&
				!tabularContent.allowEmptyContent
			) {
				throw createError(
					ErrorType.ResourceHandling,
					'Empty content provided and allowEmptyContent is false. To create an empty resource, set allowEmptyContent: true',
					{
						name: 'write-resource',
						filePath: resourcePath,
						operation: 'write',
					} as ResourceHandlingErrorOptions,
				);
			}

			// For tabular content, pass the sheets array directly
			// The data source accessors will handle conversion as needed
			contentToWrite = tabularContent.sheets;
		} else {
			// This should never happen due to earlier validation, but added for type safety
			throw createError(ErrorType.ToolHandling, 'Invalid content type detected', {
				toolName: 'write_resource',
				operation: 'tool-run',
			} as ToolHandlingErrorOptions);
		}
		logger.info(`LLMToolWriteResource: resourcePath: ${resourcePath}`);

		// Validate resource path is within datasource
		const resourceUri = (resourcePath.includes('://') || resourcePath.startsWith('file:'))
			? dsConnectionToUse.getUriForResource(resourcePath) // Already a URI, use as is
			: dsConnectionToUse.getUriForResource(`file:./${resourcePath}`); // Likely a file path, prepend file:./

		if (!await dsConnectionToUse.isResourceWithinDataSource(resourceUri)) {
			throw createError(
				ErrorType.ResourceHandling,
				`Access denied: ${resourcePath} is outside the data source directory`,
				{
					name: 'write-resource',
					filePath: resourcePath,
					operation: 'write',
				} as ResourceHandlingErrorOptions,
			);
		}

		logger.info(`LLMToolWriteResource: Handling creation for resource: ${resourceUri}`);

		try {
			let isNewResource = true;

			// Check if resource exists
			try {
				await resourceAccessor.loadResource(resourceUri);
				isNewResource = false;

				if (!overwriteExisting) {
					throw createError(
						ErrorType.ResourceHandling,
						`Resource ${resourcePath} already exists and overwriteExisting is false`,
						{
							name: 'write-resource',
							filePath: resourcePath,
							operation: 'write',
						} as ResourceHandlingErrorOptions,
					);
				}
			} catch (error) {
				if (isResourceNotFoundError(error)) {
					isNewResource = true;
					logger.info(
						`LLMToolWriteResource: Resource ${resourceUri} not found. Creating new resource.`,
					);

					// Create missing directories if needed
					if (createMissingDirectories) {
						await resourceAccessor.ensureResourcePathExists(resourceUri);
						logger.info(`LLMToolWriteResource: Created directory structure for ${resourceUri}`);
					}
				} else {
					throw error;
				}
			}

			//logger.info(`LLMToolWriteResource: Writing content for resource: ${resourceUri}`, contentToWrite);
			// Write using resource accessor
			const results = await resourceAccessor.writeResource(resourceUri, contentToWrite, {
				overwrite: overwriteExisting,
				createMissingDirectories,
				resourceName,
				contentFormat: contentTypeUsed,
			});

			if (!results.success) {
				throw createError(
					ErrorType.ResourceHandling,
					`Writing resource failed for ${resourcePath}`,
					{
						name: 'write-resource',
						filePath: resourcePath,
						operation: 'write',
					} as ResourceHandlingErrorOptions,
				);
			}

			logger.info(
				`LLMToolWriteResource: Wrote ${results.bytesWritten} bytes for: ${results.uri}`, // {results}
			);

			// Extract resource ID from URI
			const resourceId = this.extractResourceIdFromUri(results.uri, dsConnectionToUse.providerType);

			// Log change and commit for text content
			if (contentTypeUsed === 'plain-text') {
				logger.info(`LLMToolWriteResource: Saving conversation create resource: ${interaction.id}`);
				await projectEditor.orchestratorController.logChangeAndCommit(
					interaction,
					dsConnectionToUse.getDataSourceRoot(),
					resourcePath,
					contentToWrite as string,
				);
			}

			const dsConnectionStatus = notFound.length > 0
				? `Could not find data source for: [${notFound.join(', ')}]`
				: `Data source: ${dsConnectionToUse.name} [${dsConnectionToUse.id}]`;

			const toolResults = `Used data source: ${dsConnectionToUse.name}\nResource ${resourcePath} ${
				isNewResource ? 'created' : 'overwritten'
			} with ${contentTypeUsed} content (${results.bytesWritten} bytes).\nResource ID: ${resourceId}`;

			const toolResponse = `${dsConnectionStatus}\n${
				isNewResource ? 'Created' : 'Overwrote'
			} ${resourcePath} with ${contentTypeUsed} content (${results.bytesWritten} bytes)\nResource ID: ${resourceId}`;

			return {
				toolResults,
				toolResponse,
				bbResponse: {
					data: {
						resourcePath,
						resourceId,
						contentType: contentTypeUsed,
						size: results.bytesWritten || 0,
						lastModified: new Date().toISOString(),
						revision: results.uri, // Use URI as revision for now
						isNewResource,
						lineCount: contentTypeUsed === 'plain-text' ? actualLineCount : undefined,
						lineCountError: lineCountErrorMessage || undefined,
						dataSource: {
							dsConnectionId: dsConnectionToUse.id,
							dsConnectionName: dsConnectionToUse.name,
							dsProviderType: dsConnectionToUse.providerType,
						},
					},
				},
			};
		} catch (error) {
			if ((error as Error).name === 'write-resource') {
				throw error;
			}
			const originalErrorMessage = `Failed to create resource ${resourcePath}: ${(error as Error).message}`;

			// Enhance error message with datasource-specific guidance
			const enhancedErrorMessage = enhanceDatasourceError(
				originalErrorMessage,
				dsConnectionToUse.provider,
				'write',
				resourcePath,
				interaction,
			);

			logger.error(`LLMToolWriteResource: ${enhancedErrorMessage}`);

			throw createError(ErrorType.ResourceHandling, enhancedErrorMessage, {
				name: 'write-resource',
				filePath: resourcePath,
				operation: 'write',
			} as ResourceHandlingErrorOptions);
		}
	}
}
