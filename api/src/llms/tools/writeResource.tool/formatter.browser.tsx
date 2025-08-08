/** @jsxImportSource preact */
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolWriteResourceInput, LLMToolWriteResourceResult } from './types.ts';
import { logger } from 'shared/logger.ts';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const {
		resourcePath,
		overwriteExisting,
		createMissingDirectories,
		plainTextContent,
		structuredContent,
		binaryContent,
	} = toolInput as LLMToolWriteResourceInput;

	// Determine content type and preview
	let contentType = 'unknown';
	let contentPreview = '';
	let contentSize = 0;
	let expectedLineCount: number | undefined;

	if (plainTextContent && plainTextContent.content) {
		contentType = 'plain-text';
		contentPreview = plainTextContent.content.length > 100
			? plainTextContent.content.slice(0, 100) + '...'
			: plainTextContent.content;
		contentSize = plainTextContent.content.length;
		expectedLineCount = plainTextContent.expectedLineCount;
	} else if (structuredContent && structuredContent.blocks) {
		contentType = 'structured';
		const blockCount = structuredContent.blocks.length;
		contentPreview = `${blockCount} structured block${blockCount !== 1 ? 's' : ''}`;
		contentSize = JSON.stringify(structuredContent.blocks).length;
	} else if (binaryContent && binaryContent.data) {
		contentType = 'binary';
		contentPreview = `Binary data (${binaryContent.mimeType})`;
		contentSize = binaryContent.data instanceof Uint8Array ? binaryContent.data.length : binaryContent.data.length;
	}

	const formattedContent = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			{LLMTool.TOOL_TAGS_BROWSER.base.container(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Resource:')}{' '}
					{LLMTool.TOOL_TAGS_BROWSER.content.filename(resourcePath)}
				</>,
			)}
			{LLMTool.TOOL_TAGS_BROWSER.base.container(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Content type:')}{' '}
					{LLMTool.TOOL_TAGS_BROWSER.base.text(contentType)}
				</>,
			)}
			{LLMTool.TOOL_TAGS_BROWSER.base.container(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Content size:')}{' '}
					{LLMTool.TOOL_TAGS_BROWSER.content.number(contentSize)} bytes
				</>,
			)}
			{expectedLineCount !== undefined && LLMTool.TOOL_TAGS_BROWSER.base.container(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Expected line count:')}{' '}
					{LLMTool.TOOL_TAGS_BROWSER.content.number(expectedLineCount)}
				</>,
			)}
			{LLMTool.TOOL_TAGS_BROWSER.base.container(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Overwrite existing:')}{' '}
					{LLMTool.TOOL_TAGS_BROWSER.content.boolean(overwriteExisting ?? false)}
				</>,
			)}
			{LLMTool.TOOL_TAGS_BROWSER.base.container(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Create missing directories:')}{' '}
					{LLMTool.TOOL_TAGS_BROWSER.content.boolean(createMissingDirectories ?? true)}
				</>,
			)}
			{LLMTool.TOOL_TAGS_BROWSER.base.container(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Content preview:')}
					{plainTextContent
						? (
							LLMTool.TOOL_TAGS_BROWSER.base.pre(contentPreview)
						)
						: <div>{contentPreview}</div>}
				</>,
				plainTextContent
					? `${LLMTool.TOOL_STYLES_BROWSER.base.container} ${LLMTool.TOOL_STYLES_BROWSER.content.code}`
					: LLMTool.TOOL_STYLES_BROWSER.base.container,
			)}
		</>,
		LLMTool.TOOL_STYLES_BROWSER.base.container,
	);

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Write Resource'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(`Creating ${resourcePath} (${contentType})`),
		content: formattedContent,
		preview: `Creating ${resourcePath} with ${contentType} content`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: CollaborationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent as LLMToolWriteResourceResult;

	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const {
			resourcePath,
			contentType,
			size,
			isNewResource,
			lineCount,
			lineCountError,
		} = bbResponse.data;

		const operation = isNewResource ? 'Created' : 'Overwrote';
		const sizeDisplay = lineCount !== undefined ? `${lineCount} lines, ${size} bytes` : `${size} bytes`;

		const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
			<>
				{LLMTool.TOOL_TAGS_BROWSER.base.container(
					<>
						{LLMTool.TOOL_TAGS_BROWSER.base.label(`✅ Resource ${operation.toLowerCase()} successfully:`)}
						<div>
							{LLMTool.TOOL_TAGS_BROWSER.content.filename(resourcePath)}
						</div>
						<div>
							{LLMTool.TOOL_TAGS_BROWSER.base.label('Content type:')}{' '}
							{LLMTool.TOOL_TAGS_BROWSER.base.text(contentType)}
						</div>
						<div>
							{LLMTool.TOOL_TAGS_BROWSER.base.label('Size:')}{' '}
							{LLMTool.TOOL_TAGS_BROWSER.base.text(sizeDisplay)}
						</div>
					</>,
				)}
				{lineCountError && LLMTool.TOOL_TAGS_BROWSER.base.container(
					<>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('⚠️ Line count warning:')}
						<div>{lineCountError}</div>
					</>,
					`${LLMTool.TOOL_STYLES_BROWSER.base.container} ${LLMTool.TOOL_STYLES_BROWSER.status.warning}`,
				)}
			</>,
			`${LLMTool.TOOL_STYLES_BROWSER.base.container} ${LLMTool.TOOL_STYLES_BROWSER.status.success}`,
		);

		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Write Resource'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(`${operation} ${resourcePath}`),
			content,
			preview: `${operation} ${contentType} resource (${sizeDisplay})`,
		};
	} else {
		logger.error('LLMToolWriteResource: Unexpected bbResponse format:', bbResponse);
		const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
			LLMTool.TOOL_TAGS_BROWSER.base.label(String(bbResponse)),
			`${LLMTool.TOOL_STYLES_BROWSER.base.container} ${LLMTool.TOOL_STYLES_BROWSER.status.error}`,
		);

		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Write Resource'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('failed'),
			content,
			preview: 'Operation failed',
		};
	}
};
