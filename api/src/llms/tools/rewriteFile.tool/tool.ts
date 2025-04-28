//import type { JSX } from 'preact';
import {
	formatLogEntryToolResult as formatLogEntryToolResultBrowser,
	formatLogEntryToolUse as formatLogEntryToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatLogEntryToolResult as formatLogEntryToolResultConsole,
	formatLogEntryToolUse as formatLogEntryToolUseConsole,
} from './formatter.console.ts';
import type { LLMToolRewriteResourceInput } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult, LLMToolRunResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type { DataSourceHandlingErrorOptions, FileHandlingErrorOptions } from 'api/errors/error.ts';
import { logger } from 'shared/logger.ts';

import { ensureDir } from '@std/fs';
import { dirname, join } from '@std/path';

//const ACKNOWLEDGMENT_STRING = 'I confirm this is the complete resource content with no omissions or placeholders';
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
	// Case-insensitive comparison
	const normalized = acknowledgment.trim().toLowerCase();
	const expected = ACKNOWLEDGMENT_STRING.toLowerCase();

	// Remove any final punctuation
	const withoutPunctuation = normalized.replace(/[.!?]$/, '');

	return withoutPunctuation === expected;
}

// Additional Enforcement Option:
// - Add a required parameter to rewrite_resource: "existingContentChecked": boolean
// - Add a required parameter: "contentComparison": string - must include diff or "new resource"
// - Make the tool fail if these aren't provided
// - Force explicit acknowledgment of content changes

export default class LLMToolRewriteResource extends LLMTool {
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
						'The path of the resource to be rewritten or created, relative to the data source root. Must be within the data source directory.',
				},
				content: {
					type: 'string',
					description:
						"The complete new content that will replace the resource's existing content. IMPORTANT: Must include the entire desired resource contents - partial content or placeholders are not allowed. The resource will be completely overwritten with this content.",
				},
				createIfMissing: {
					type: 'boolean',
					description:
						'Whether to create the resource if it does not exist. When true, missing parent directories will also be created.',
					default: true,
				},
				allowEmptyContent: {
					type: 'boolean',
					description:
						'Whether to allow empty content (0 bytes) or a single empty line. Default is false to prevent accidental resource emptying.',
					default: false,
				},
				acknowledgement: {
					type: 'string',
					description:
						'Required confirmation string acknowledging that the content is complete. Must be exactly: "' +
						ACKNOWLEDGMENT_STRING + '" (case insensitive, may include final punctuation)',
				},
				expectedLineCount: {
					type: 'number',
					description:
						'The expected number of lines in the content. Be sure to include empty lines in your count. Must match the actual line count within tolerance:\n' +
						'- <10 lines: Exact match required\n' +
						'- <100 lines: ±2 lines tolerance\n' +
						'- ≥100 lines: ±5% tolerance\n' +
						'Empty resources (0 bytes) and single empty lines are treated as 0 lines.',
				},
			},
			required: ['resourcePath', 'content', 'acknowledgement', 'expectedLineCount'],
		};
	}

	formatLogEntryToolUse(
		toolInput: LLMToolInputSchema,
		format: 'console' | 'browser',
	): LLMToolLogEntryFormattedResult {
		return format === 'console' ? formatLogEntryToolUseConsole(toolInput) : formatLogEntryToolUseBrowser(toolInput);
	}

	formatLogEntryToolResult(
		resultContent: ConversationLogEntryContentToolResult,
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
			content,
			createIfMissing = true,
			allowEmptyContent = false,
			acknowledgement,
			expectedLineCount,
			dataSourceId = undefined,
		} = toolInput as LLMToolRewriteResourceInput;

		const { primaryDsConnection, dsConnections, notFound } = this.getDsConnectionsById(
			projectEditor,
			dataSourceId ? [dataSourceId] : undefined,
		);

		const dsConnectionToUse = dsConnections[0] || primaryDsConnection;
		const dsConnectionToUseId = dsConnectionToUse.id;
		if (!dsConnectionToUseId) {
			throw createError(ErrorType.DataSourceHandling, `No data source id`, {
				name: 'data-source',
				dataSourceIds: dataSourceId ? [dataSourceId] : undefined,
			} as DataSourceHandlingErrorOptions);
		}

		if (!dsConnectionToUse) {
			throw createError(ErrorType.DataSourceHandling, `No primary data source`, {
				name: 'data-source',
				dataSourceIds: dataSourceId ? [dataSourceId] : undefined,
			} as DataSourceHandlingErrorOptions);
		}
		const dataSourceRoot = dsConnectionToUse.getDataSourceRoot();
		if (!dataSourceRoot) {
			throw createError(ErrorType.DataSourceHandling, `No data source root`, {
				name: 'data-source',
				dataSourceIds: dataSourceId ? [dataSourceId] : undefined,
			} as DataSourceHandlingErrorOptions);
		}
		// [TODO] check that dsConnectionToUse is type filesystem

		// Validate acknowledgment string
		if (!validateAcknowledgment(acknowledgement)) {
			const errorMessage = 'Invalid acknowledgement string. Must be exactly: "' + ACKNOWLEDGMENT_STRING +
				'" (case insensitive, may include final punctuation).\n\n' +
				'This validation ensures you are aware that:\n' +
				'1. The provided content will completely replace the resource\n' +
				'2. Any existing content not included will be permanently lost\n' +
				'3. Placeholder comments like "// Rest of file remains..." are not allowed\n' +
				'4. You must provide ALL imports, types, and code';

			throw createError(ErrorType.FileHandling, errorMessage, {
				name: 'rewrite-resource',
				filePath: resourcePath,
				operation: 'rewrite-file',
			} as FileHandlingErrorOptions);
		}

		// Validate line count
		const actualLineCount = getLineCount(content);
		const lineCountValidation = validateLineCount(actualLineCount, expectedLineCount);
		let lineCountErrorMessage = '';
		if (!lineCountValidation.valid) {
			lineCountErrorMessage =
				`Line count mismatch. Content has ${actualLineCount} lines but expected ${expectedLineCount} lines.`;

			/*
			const errorMessage =
				`Line count mismatch. Content has ${actualLineCount} lines but expected ${expectedLineCount} lines.\n\n` +
				`For resources with ${actualLineCount} lines, the tolerance is ±${lineCountValidation.tolerance} lines.\n\n` +
				'Common fixes:\n' +
				'1. Count the actual lines in your content\n' +
				'2. Include all necessary imports and code\n' +
				'3. Remove any placeholder comments\n' +
				'4. Ensure no content is accidentally omitted\n' +
				'5. Check for missing closing braces or tags';

			throw createError(ErrorType.FileHandling, errorMessage, {
				name: 'rewrite-resource',
				filePath: resourcePath,
				operation: 'rewrite-file',
			} as FileHandlingErrorOptions);
			 */
		}

		const resourceUri = dsConnectionToUse.getUriForResource(`file:./${resourcePath}`);
		if (!await dsConnectionToUse.isResourceWithinDataSource(resourceUri)) {
			throw createError(
				ErrorType.FileHandling,
				`Access denied: ${resourcePath} is outside the data source directory`,
				{
					name: 'rewrite-resource',
					filePath: resourcePath,
					operation: 'rewrite-file',
				} as FileHandlingErrorOptions,
			);
		}

		const fullResourcePath = join(dataSourceRoot, resourcePath);
		logger.info(`LLMToolRewriteResource: Handling rewrite for resource: ${fullResourcePath}`);

		try {
			let isNewResource = false;
			try {
				await Deno.stat(fullResourcePath);
			} catch (error) {
				if (error instanceof Deno.errors.NotFound && createIfMissing) {
					isNewResource = true;
					logger.info(`LLMToolRewriteResource: Resource ${fullResourcePath} not found. Creating new resource.`);
					// Create missing directories
					await ensureDir(dirname(fullResourcePath));
					logger.info(`LLMToolRewriteResource: Created directory structure for ${fullResourcePath}`);
				} else {
					throw error;
				}
			}

			if (!content && !allowEmptyContent) {
				const noChangesMessage =
					`No changes were made to the resource: ${resourcePath}. The content is empty and allowEmptyContent is false.\n\n` +
					'To intentionally empty a resource, set allowEmptyContent: true';
				logger.info(`LLMToolRewriteResource: ${noChangesMessage}`);
				throw createError(ErrorType.FileHandling, noChangesMessage, {
					name: 'rewrite-resource',
					filePath: resourcePath,
					operation: 'rewrite-file',
				} as FileHandlingErrorOptions);
			}

			await Deno.writeTextFile(fullResourcePath, content);

			logger.info(`LLMToolRewriteResource: Saving conversation rewrite resource: ${interaction.id}`);
			await projectEditor.orchestratorController.logChangeAndCommit(
				interaction,
				dataSourceRoot,
				resourcePath,
				content,
			);

			const dsConnectionStatus = notFound.length > 0
				? `Could not find data source for: [${notFound.join(', ')}]`
				: `Data source: ${dsConnectionToUse.name} [${dsConnectionToUse.id}]`;

			const toolResults = `Used data source: ${dsConnectionToUse.name}\nResource ${resourcePath} ${
				isNewResource ? 'created' : 'rewritten'
			} with new contents (${actualLineCount} lines).`;
			const toolResponse = `${dsConnectionStatus}\n${
				isNewResource ? 'Created' : 'Rewrote'
			} ${resourcePath} with ${actualLineCount} lines of content`;
			// const bbResponse = `BB ${
			// 	isNewResource ? 'created' : 'rewrote'
			// } resource ${resourcePath} with new contents (${actualLineCount} lines).${
			// 	lineCountErrorMessage ? `\n${lineCountErrorMessage}` : ''
			// }`;

			return {
				toolResults,
				toolResponse,
				bbResponse: {
					data: {
						resourcePath,
						lineCount: actualLineCount,
						isNewResource,
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
			if ((error as Error).name === 'rewrite-resource') {
				throw error;
			}
			const errorMessage = `Failed to write contents to ${resourcePath}: ${(error as Error).message}`;
			logger.error(`LLMToolRewriteResource: ${errorMessage}`);

			throw createError(ErrorType.FileHandling, errorMessage, {
				name: 'rewrite-resource',
				filePath: resourcePath,
				operation: 'rewrite-file',
			} as FileHandlingErrorOptions);
		}
	}
}
