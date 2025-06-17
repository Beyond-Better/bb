/** @jsxImportSource preact */
//import { JSX } from 'preact';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type { ImageOperation, LLMToolImageProcessingResult, LLMToolImageProcessingResultData } from './types.ts';

export function formatLogEntryToolUse(toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult {
	const { inputPath, outputPath, operations, createMissingDirectories, overwrite } = toolInput;

	const operationElements = operations.map((op: ImageOperation, _index: number) => {
		const params = Object.entries(op.params || {})
			.map(([key, value]) => `${key}: ${value}`)
			.join(', ');
		return LLMTool.TOOL_TAGS_BROWSER.base.box(
			<>
				{LLMTool.TOOL_TAGS_BROWSER.base.label(op.type)}
				{params ? <span>({params})</span> : null}
			</>,
			`${LLMTool.TOOL_STYLES_BROWSER.base.box} mb-1`,
		);
	});

	const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			{LLMTool.TOOL_TAGS_BROWSER.base.box(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Input:')}{' '}
					{inputPath.startsWith('http')
						? LLMTool.TOOL_TAGS_BROWSER.content.url(inputPath)
						: LLMTool.TOOL_TAGS_BROWSER.content.filename(inputPath)}
				</>,
				`${LLMTool.TOOL_STYLES_BROWSER.base.box} mb-2`,
			)}
			{LLMTool.TOOL_TAGS_BROWSER.base.box(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Output:')}{' '}
					{LLMTool.TOOL_TAGS_BROWSER.content.filename(outputPath)}
				</>,
				`${LLMTool.TOOL_STYLES_BROWSER.base.box} mb-2`,
			)}
			{LLMTool.TOOL_TAGS_BROWSER.base.box(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Operations:')}
					<div className='pl-4 mt-1'>{operationElements}</div>
				</>,
				`${LLMTool.TOOL_STYLES_BROWSER.base.box} mb-2`,
			)}
			{createMissingDirectories !== undefined &&
				LLMTool.TOOL_TAGS_BROWSER.base.box(
					<>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('Create Missing Directories:')}{' '}
						{createMissingDirectories ? 'Yes' : 'No'}
					</>,
					`${LLMTool.TOOL_STYLES_BROWSER.base.box} mb-2`,
				)}
			{overwrite !== undefined &&
				LLMTool.TOOL_TAGS_BROWSER.base.box(
					<>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('Overwrite:')} {overwrite ? 'Yes' : 'No'}
					</>,
					`${LLMTool.TOOL_STYLES_BROWSER.base.box} mb-2`,
				)}
		</>,
		LLMTool.TOOL_STYLES_BROWSER.base.container,
	);

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Image Manipulation'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(`Processing image`),
		content,
		preview: `Processing image: ${inputPath} → ${outputPath}`,
	};
}

export function formatLogEntryToolResult(
	resultContent: CollaborationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult {
	const result = resultContent as LLMToolImageProcessingResult;

	if (typeof result.bbResponse === 'string') {
		// Handle error case
		const errorContent = LLMTool.TOOL_TAGS_BROWSER.base.container(
			LLMTool.TOOL_TAGS_BROWSER.base.label(String(result.bbResponse)),
			`${LLMTool.TOOL_STYLES_BROWSER.base.container} ${LLMTool.TOOL_STYLES_BROWSER.status.error}`,
		);

		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Image Manipulation'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('failed'),
			content: errorContent,
			preview: 'Image processing failed',
		};
	}

	const data = result.bbResponse.data as LLMToolImageProcessingResultData;
	const { inputPath, outputPath, operations, success, thumbnail, meta, error } = data;

	if (!success || error) {
		const errorContent = LLMTool.TOOL_TAGS_BROWSER.base.container(
			LLMTool.TOOL_TAGS_BROWSER.base.label(error || 'Image processing failed'),
			`${LLMTool.TOOL_STYLES_BROWSER.base.container} ${LLMTool.TOOL_STYLES_BROWSER.status.error}`,
		);

		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Image Manipulation'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('failed'),
			content: errorContent,
			preview: 'Image processing failed',
		};
	}

	// // Helper function to extract image content from message parts
	// const getImageContent = (contentParts: unknown): string => {
	// 	if (!contentParts || !Array.isArray(contentParts) || contentParts.length === 0) {
	// 		return '';
	// 	}
	// 	const content = contentParts[0];
	// 	if (
	// 		content && typeof content === 'object' && 'source' in content &&
	// 		content.source && typeof content.source === 'object' && 'data' in content.source
	// 	) {
	// 		return content.source.data as string;
	// 	}
	// 	return '';
	// };

	// Display the thumbnail image
	//const imageData = getImageContent(result.toolResult);
	const imageData = thumbnail.data;
	const imageContent = imageData
		? (
			<img
				src={`data:${thumbnail.mediaType};base64,${imageData}`}
				alt='Processed image thumbnail'
				className='max-w-full h-auto mt-2 rounded-lg border border-gray-200'
			/>
		)
		: null;

	const operationElements = operations.map((op: ImageOperation, _index: number) => {
		const params = Object.entries(op.params || {})
			.map(([key, value]) => `${key}: ${value}`)
			.join(', ');
		return LLMTool.TOOL_TAGS_BROWSER.base.box(
			<>
				{LLMTool.TOOL_TAGS_BROWSER.base.label(op.type)}
				{params ? <span>({params})</span> : null}
			</>,
			`${LLMTool.TOOL_STYLES_BROWSER.base.box} mb-1`,
		);
	});

	const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			{imageContent}

			{LLMTool.TOOL_TAGS_BROWSER.base.box(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Original image from:')}{' '}
					{inputPath.startsWith('http')
						? LLMTool.TOOL_TAGS_BROWSER.content.url(inputPath)
						: LLMTool.TOOL_TAGS_BROWSER.content.filename(inputPath)}
				</>,
				`${LLMTool.TOOL_STYLES_BROWSER.base.box} mb-2`,
			)}

			{LLMTool.TOOL_TAGS_BROWSER.base.box(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Processed image saved to:')}{' '}
					{LLMTool.TOOL_TAGS_BROWSER.content.filename(outputPath)}
				</>,
				`${LLMTool.TOOL_STYLES_BROWSER.base.box} mb-2`,
			)}

			{meta && LLMTool.TOOL_TAGS_BROWSER.base.box(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Image Info:')}
					<div className='pl-4'>
						{meta.width && meta.height && <div>Dimensions: {meta.width} × {meta.height}</div>}
						{meta.format && <div>Format: {meta.format}</div>}
						{meta.size && <div>Size: {(meta.size / 1024).toFixed(1)} KB</div>}
					</div>
				</>,
				`${LLMTool.TOOL_STYLES_BROWSER.base.box} mb-2`,
			)}

			{LLMTool.TOOL_TAGS_BROWSER.base.box(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Operations Applied:')}
					<div className='pl-4'>{operationElements}</div>
				</>,
				`${LLMTool.TOOL_STYLES_BROWSER.base.box} mb-2`,
			)}
		</>,
		LLMTool.TOOL_STYLES_BROWSER.base.container,
	);

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Image Manipulation'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(`successful`),
		content,
		preview: `Image processed: ${outputPath}`,
	};
}
