import { stripIndent } from 'common-tags';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import LLMTool from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { ImageOperation, LLMToolImageProcessingResult, LLMToolImageProcessingResultData } from './types.ts';

export function formatLogEntryToolUse(toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult {
	const { inputPath, outputPath, operations, createMissingDirectories, overwrite } = toolInput;

	const operationsFormatted = operations.map((op: ImageOperation) => {
		const params = Object.entries(op.params || {})
			.map(([key, value]) => `${key}: ${value}`)
			.join(', ');
		return `  - ${LLMTool.TOOL_STYLES_CONSOLE.content.code(op.type)}${params ? ` (${params})` : ''}`;
	}).join('\n');

	const content = stripIndent`
		${LLMTool.TOOL_STYLES_CONSOLE.base.label('Input:')} ${inputPath}
		${LLMTool.TOOL_STYLES_CONSOLE.base.label('Output:')} ${outputPath}
		${LLMTool.TOOL_STYLES_CONSOLE.base.label('Operations:')}
		${operationsFormatted}
		${
		createMissingDirectories !== undefined
			? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('Create Missing Directories:')} ${
				createMissingDirectories ? 'Yes' : 'No'
			}`
			: ''
	}
		${
		overwrite !== undefined
			? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('Overwrite:')} ${overwrite ? 'Yes' : 'No'}`
			: ''
	}`;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Image Manipulation'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('Processing image'),
		content,
		preview: `Processing image: ${inputPath} → ${outputPath}`,
	};
}

export function formatLogEntryToolResult(
	resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult {
	const result = resultContent as LLMToolImageProcessingResult;

	if (typeof result.bbResponse === 'string') {
		// Handle error case
		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Image Manipulation'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('failed'),
			content: LLMTool.TOOL_STYLES_CONSOLE.status.error(String(result.bbResponse)),
			preview: 'Image processing failed',
		};
	}

	const data = result.bbResponse.data as LLMToolImageProcessingResultData;
	const { inputPath, outputPath, operations, success, thumbnail, meta, error } = data;

	if (!success || error) {
		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Image Manipulation'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('failed'),
			content: LLMTool.TOOL_STYLES_CONSOLE.status.error(error || 'Image processing failed'),
			preview: 'Image processing failed',
		};
	}

	const operationsFormatted = operations.map((op: ImageOperation) => {
		const params = Object.entries(op.params || {})
			.map(([key, value]) => `${key}: ${value}`)
			.join(', ');
		return `  - ${LLMTool.TOOL_STYLES_CONSOLE.content.code(op.type)}${params ? ` (${params})` : ''}`;
	}).join('\n');

	let metaInfo = '';
	if (meta) {
		const metaItems = [];
		if (meta.width && meta.height) {
			metaItems.push(`Dimensions: ${meta.width} u00d7 ${meta.height}`);
		}
		if (meta.format) {
			metaItems.push(`Format: ${meta.format}`);
		}
		if (meta.size) {
			metaItems.push(`Size: ${(meta.size / 1024).toFixed(1)} KB`);
		}
		if (metaItems.length > 0) {
			metaInfo = `${LLMTool.TOOL_STYLES_CONSOLE.base.label('Image Info:')}
  ${metaItems.join('\n  ')}`;
		}
	}

	const content = stripIndent`
		${LLMTool.TOOL_STYLES_CONSOLE.base.label('Original image from:')} ${
		LLMTool.TOOL_STYLES_CONSOLE.content.filename(inputPath)
	}
		${LLMTool.TOOL_STYLES_CONSOLE.base.label('Processed image saved to:')} ${
		LLMTool.TOOL_STYLES_CONSOLE.content.filename(outputPath)
	}
		${metaInfo ? metaInfo + '\n' : ''}
		${LLMTool.TOOL_STYLES_CONSOLE.base.label('Operations Applied:')}
		${operationsFormatted}
		\u001b]1337;File=name=${outputPath};inline=1:${thumbnail.data}\u0007
		`;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Image Manipulation'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('successful'),
		content,
		preview: `Image processed: ${outputPath}`,
	};
}
