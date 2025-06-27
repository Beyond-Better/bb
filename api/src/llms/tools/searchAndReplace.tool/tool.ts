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
import type { LLMToolSearchAndReplaceInput } from './types.ts';
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
// import { dirname, join } from '@std/path';
// import { ensureDir } from '@std/fs';

export default class LLMToolSearchAndReplace extends LLMTool {
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
						'The path of the resource to be modified or created, relative to the data source root. Example: "src/config.ts"',
				},
				operations: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							search: {
								type: 'string',
								description:
									'The text to search for in the resource. Two modes available:\n\n1. Literal mode (default):\n* Must match the resource content EXACTLY, including all whitespace and indentation\n* Special characters are matched literally\n* Example: "  const x = 10;" will only match if the spaces and semicolon exist\n\n2. Regex mode (set regexPattern: true):\n* Use JavaScript regex patterns\n* Can match varying whitespace with patterns like "\\s+"\n* Example: "const\\s+x\\s*=\\s*10" matches various spacing around "const x = 10"',
							},
							replace: {
								type: 'string',
								description:
									'The text to replace matches with. Important notes:\n* In literal mode: Match the indentation level of the original text\n* In regex mode: Use $1, $2, etc. for capture groups\n* Preserve line endings and spacing for clean diffs\nExample: If replacing "  const x = 10;" keep the leading spaces in the replacement',
							},
							regexPattern: {
								type: 'boolean',
								description:
									'When true, treats search as a JavaScript regex pattern. When false (default), matches text literally including all whitespace. Examples:\n* false: "function main" matches that exact text with one space\n* true: "function\\s+main" matches the text with any whitespace between words',
								default: false,
							},
							replaceAll: {
								type: 'boolean',
								description:
									'When true, replaces all occurrences of the search text. When false (default), replaces only the first occurrence. Use carefully with regex patterns.',
								default: false,
							},
							caseSensitive: {
								type: 'boolean',
								description:
									'When true (default), matches must have exact case. When false, matches ignore case. Examples:\n* true: "Constructor" only matches "Constructor"\n* false: "constructor" matches "Constructor" and "constructor"',
								default: true,
							},
						},
						required: ['search', 'replace'],
					},
					description:
						'Array of search and replace operations to apply in sequence. Each operation is applied to the result of previous operations.',
				},
				createIfMissing: {
					type: 'boolean',
					description:
						"When true (recommended), creates the resource and any missing parent directories if they don't exist. When false, fails if the resource doesn't exist.",
					default: true,
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
		let allOperationsFailed = true;
		let allOperationsSucceeded = true;
		const { toolUseId: _toolUseId, toolInput } = toolUse;
		const { resourcePath, operations, createIfMissing = true, dataSourceId = undefined } =
			toolInput as LLMToolSearchAndReplaceInput;

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
		//if (!dataSourceRoot) {
		//	throw createError(ErrorType.DataSourceHandling, `No data source root`, {
		//		name: 'data-source',
		//		dataSourceIds: dataSourceId ? [dataSourceId] : undefined,
		//	} as DataSourceHandlingErrorOptions);
		//}
		// [TODO] check that dsConnectionToUse is type filesystem

		// const resourceUri = `file:./${resourcePath}`;
		const resourceUri = (resourcePath.includes('://') || resourcePath.startsWith('file:'))
			? dsConnectionToUse.getUriForResource(resourcePath) // Already a URI, use as is
			: dsConnectionToUse.getUriForResource(`file:./${resourcePath}`); // Likely a file path, prepend file:./
		if (!await dsConnectionToUse.isResourceWithinDataSource(resourceUri)) {
			throw createError(
				ErrorType.ResourceHandling,
				`Access denied: ${resourcePath} is outside the data source`,
				{
					name: 'search-and-replace',
					filePath: resourcePath,
					operation: 'search-replace',
				} as ResourceHandlingErrorOptions,
			);
		}

		const resourceAccessor = await dsConnectionToUse.getResourceAccessor();
		if (!resourceAccessor.writeResource) {
			throw createError(ErrorType.ToolHandling, `No writeResource method on resourceAccessor`, {
				toolName: 'image_manipulation',
				operation: 'tool-run',
			} as ToolHandlingErrorOptions);
		}
		//logger.error(`LLMToolDisplayResource: display resource for: ${resourceUri}`, {resourceAccessor});

		logger.info(`LLMToolSearchAndReplace: Handling search and replace for resource: ${resourceUri}`);

		try {
			let isNewResource = false;

			let content: string | Uint8Array; // we only work with strings - we throw an error below if we don't get a string back from loadResource
			try {
				const resource = await resourceAccessor.loadResource(resourceUri);
				content = resource.content; // as string;
				// Validate that content is actually text
				if (typeof content !== 'string') {
					if (content instanceof Uint8Array) {
						throw new Error(
							`Cannot perform search and replace on binary content: ${resourcePath}. The resource appears to be binary data (${content.length} bytes).`,
						);
					} else {
						throw new Error(
							`Cannot perform search and replace on non-string content: ${resourcePath}. Content type: ${typeof content}`,
						);
					}
				}
			} catch (error) {
				//if (error instanceof Deno.errors.NotFound && createIfMissing) {

				if (isResourceNotFoundError(error) && createIfMissing) {
					content = '';
					isNewResource = true;
					logger.info(`LLMToolSearchAndReplace: Resource ${resourceUri} not found. Creating new resource.`);
					// Create missing directories
					await resourceAccessor.ensureResourcePathExists(resourceUri);
					logger.info(`LLMToolSearchAndReplace: Created directory structure for ${resourceUri}`);
				} else {
					throw error;
				}
			}

			const operationResults = [];
			const successfulOperations = [];
			for (const [index, operation] of operations.entries()) {
				const { search, replace, regexPattern = false, replaceAll = false, caseSensitive = true } = operation;
				const operationWarnings = [];
				let operationSuccess = false;

				// Validate search string
				if (!isNewResource && search.length < LLMToolSearchAndReplace.MIN_SEARCH_LENGTH) {
					operationWarnings.push(
						`Search string is too short (minimum ${LLMToolSearchAndReplace.MIN_SEARCH_LENGTH} character(s)) for existing resource.`,
					);
					continue;
				}

				// Validate that search and replace strings are different
				if (search === replace) {
					operationWarnings.push('Search and replace strings are identical.');
					continue;
				}

				const originalContent = content as string;

				let searchPattern: string | RegExp;

				const escapeRegExp = (str: string) => str.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
				const flags = `${replaceAll ? 'g' : ''}${caseSensitive ? '' : 'i'}`;

				if (regexPattern) {
					searchPattern = new RegExp(search, flags);
				} else if (!caseSensitive) {
					// literal search, but case insensitive so must use a regex - escape regex special characters
					searchPattern = new RegExp(escapeRegExp(search), flags);
				} else {
					// literal search that is case sensitive
					searchPattern = search;
				}
				//logger.info(`LLMToolSearchAndReplace: Searching for pattern: `, searchPattern);

				content = replaceAll && searchPattern instanceof RegExp
					? content.replaceAll(searchPattern, replace)
					: content.replace(searchPattern, replace);

				// Check if the content actually changed
				if (content !== originalContent) {
					operationSuccess = true;
					allOperationsFailed = false;
					successfulOperations.push(operation);
				} else {
					operationWarnings.push(
						'No changes were made. The search string was not found in the resource content.',
					);
					allOperationsSucceeded = false;
				}

				if (operationWarnings.length > 0) {
					operationResults.push({
						operationIndex: index,
						status: 'warning',
						message: `Operation ${index + 1} warnings: ${operationWarnings.join(' ')}`,
					});
					allOperationsSucceeded = false;
				} else if (operationSuccess) {
					operationResults.push({
						operationIndex: index,
						status: 'success',
						message: `Operation ${index + 1} completed successfully`,
					});
				} else {
					operationResults.push({
						operationIndex: index,
						status: 'warning',
						message: `Operation ${index + 1} failed: No changes were made`,
					});
					allOperationsSucceeded = false;
				}
			}

			if (successfulOperations.length > 0 || isNewResource) {
				const results = await resourceAccessor.writeResource(resourceUri, content, {
					overwrite: true,
					createMissingDirectories: true,
				});
				// success: true,
				// uri: resourceUri,
				// metadata: resourceMetadata,
				// bytesWritten: typeof content === 'string' ? new TextEncoder().encode(content).length : content.length,
				if (!results.success) {
					throw createError(
						ErrorType.ResourceHandling,
						`Writing resource failed for ${resourcePath}`,
						{
							name: 'search-and-replace',
							filePath: resourcePath,
							operation: 'write',
						} as ResourceHandlingErrorOptions,
					);
				}
				logger.info(
					`LLMToolSearchAndReplace: Wrote ${results.bytesWritten} bytes for: ${results.uri}`,
				);
				logger.info(
					`LLMToolSearchAndReplace: Saving conversation search and replace operations: ${interaction.id}`,
				);
				await projectEditor.orchestratorController.logChangeAndCommit(
					interaction,
					dataSourceRoot,
					resourcePath,
					JSON.stringify(successfulOperations),
				);

				const toolResultContentParts: LLMMessageContentParts = operationResults.map((
					result: { status: string; operationIndex: number; message: string },
				) => ({
					type: 'text',
					text: `${result.status === 'success' ? '✅  ' : '⚠️  '}${result.message}`,
				}));

				const dsConnectionStatus = notFound.length > 0
					? `Could not find data source for: [${notFound.join(', ')}]`
					: 'Data source searched';

				const operationStatus = allOperationsSucceeded
					? 'All operations succeeded'
					: (allOperationsFailed ? 'All operations failed' : 'Partial operations succeeded');
				toolResultContentParts.unshift({
					type: 'text',
					text: `${
						isNewResource ? 'Resource created and s' : 'S'
					}earch and replace operations applied to resource: ${resourcePath}. ${operationStatus}.`,
				});

				toolResultContentParts.unshift({
					type: 'text',
					text: `Searched data source: ${dsConnectionToUse.name} [${dsConnectionToUse.id}]`,
				});

				const toolResults = toolResultContentParts;
				const toolResponse = `${dsConnectionStatus}\n${operationStatus}`;
				const bbResponse = `BB applied search and replace operations.\n${dsConnectionStatus}`;
				//dataSource: {
				//	dsConnectionId: dsConnectionToUse.id,
				//	dsConnectionName: dsConnectionToUse.name,
				//	dsProviderType: dsConnectionToUse.providerType,
				//},

				return { toolResults, toolResponse, bbResponse };
			} else {
				const noChangesMessage = `No changes were made to the resource: ${resourcePath}. Results: ${
					JSON.stringify(operationResults)
				}`;
				logger.info(`LLMToolSearchAndReplace: ${noChangesMessage}`);

				throw createError(ErrorType.ResourceHandling, noChangesMessage, {
					name: 'search-and-replace',
					filePath: resourcePath,
					operation: 'search-replace',
				} as ResourceHandlingErrorOptions);

				//const toolResultContentParts: LLMMessageContentParts = [{
				//	type: 'text',
				//	text: noChangesMessage,
				//}];
				//return { toolResults: toolResultContentParts, toolResponse: noChangesMessage, bbResponse: noChangesMessage };
			}
		} catch (error) {
			if ((error as Error).name === 'search-and-replace') {
				throw error;
			}
			const errorMessage = `Failed to apply search and replace to ${resourcePath}: ${(error as Error).message}`;
			logger.error(`LLMToolSearchAndReplace: ${errorMessage}`);

			throw createError(ErrorType.ResourceHandling, errorMessage, {
				name: 'search-and-replace',
				filePath: resourcePath,
				operation: 'search-replace',
			} as ResourceHandlingErrorOptions);
		}
	}
}
