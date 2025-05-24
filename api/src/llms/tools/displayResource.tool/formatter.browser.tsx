/** @jsxImportSource preact */
//import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { DisplayResult, LLMToolDisplayResourceInput, LLMToolDisplayResourceResult } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';

const TOOL_SPECIFIC_STYLES = {
	container: `${LLMTool.TOOL_STYLES_BROWSER.base.container}`,
	metadata: 'mb-2 text-sm text-gray-600',
	contentContainer: 'mt-2',
	textContent: `
        resize-y overflow-auto min-h-[100px] max-h-[1000px] p-4 
        font-mono text-sm bg-gray-50 rounded-lg
        ${LLMTool.TOOL_STYLES_BROWSER.content.code}
    `,
	imageContent: 'max-w-full h-auto rounded-lg border border-gray-200',
	error: `${LLMTool.TOOL_STYLES_BROWSER.status.error} mt-2`,
	truncated: 'mt-2 text-sm text-amber-600',
};

function formatMetadata(metadata: DisplayResult['metadata']) {
	const size = metadata.size > 1024 * 1024
		? `${(metadata.size / (1024 * 1024)).toFixed(2)} MB`
		: metadata.size > 1024
		? `${(metadata.size / 1024).toFixed(2)} KB`
		: `${metadata.size} bytes`;

	return (
		<div className={TOOL_SPECIFIC_STYLES.metadata}>
			{LLMTool.TOOL_TAGS_BROWSER.base.label('Resource:')} {metadata.name}
			<br />
			{LLMTool.TOOL_TAGS_BROWSER.base.label('Type:')} {metadata.mimeType}
			<br />
			{LLMTool.TOOL_TAGS_BROWSER.base.label('Size:')} {size}
			<br />
			{LLMTool.TOOL_TAGS_BROWSER.base.label('Modified:')} {new Date(metadata.lastModified).toLocaleString()}
		</div>
	);
}

function formatContent(result: DisplayResult) {
	if (result.error) {
		return (
			<div className={TOOL_SPECIFIC_STYLES.error}>
				{result.error}
			</div>
		);
	}

	return (
		<div className={TOOL_SPECIFIC_STYLES.contentContainer}>
			{result.contentType === 'text' && (
				<>
					<pre className={TOOL_SPECIFIC_STYLES.textContent}>{result.content}</pre>
					{result.truncated && (
						<div className={TOOL_SPECIFIC_STYLES.truncated}>
							Content truncated due to size. Showing first 1MB of resource.
						</div>
					)}
				</>
			)}
			{result.contentType === 'image' && (
				<img
					src={`data:${result.metadata.mimeType};base64,${result.content}`}
					alt={result.metadata.name}
					className={TOOL_SPECIFIC_STYLES.imageContent}
				/>
			)}
			{result.contentType === 'unsupported' && (
				<div className={TOOL_SPECIFIC_STYLES.error}>
					This resource type is not currently supported for display.
				</div>
			)}
		</div>
	);
}

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const { resourcePath } = toolInput as LLMToolDisplayResourceInput;
	const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			{LLMTool.TOOL_TAGS_BROWSER.base.label('Displaying resource:')}{' '}
			{LLMTool.TOOL_TAGS_BROWSER.content.filename(resourcePath)}
		</>,
	);

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Display Resource'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('Reading resource contents'),
		content,
		preview: `Displaying resource: ${resourcePath}`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent as LLMToolDisplayResourceResult;

	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		// 	type: 'text' | 'image' | 'unsupported';
		// 	content: string; // Base64 for images, text content for text resources
		// 	metadata: ResourceMetadata;
		// 	truncated?: boolean;
		// 	error?: string;

		const result = bbResponse.data;

		const content = (
			<div className={TOOL_SPECIFIC_STYLES.container}>
				{formatMetadata(result.metadata)}
				{formatContent(result)}
			</div>
		);

		const subtitle = result.error
			? 'Error displaying resource'
			: result.contentType === 'unsupported'
			? 'Unsupported resource type'
			: 'Resource contents displayed';

		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Display Resource'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(subtitle),
			content,
			preview: `Displayed ${result.metadata.name}`,
		};
	} else {
		const errorContent = LLMTool.TOOL_TAGS_BROWSER.base.container(
			<div className={TOOL_SPECIFIC_STYLES.error}>
				{String(bbResponse)}
			</div>,
		);

		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Display Resource'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('failed'),
			content: errorContent,
			preview: 'Operation failed',
		};
	}
};
