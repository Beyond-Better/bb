import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { LLMMessageContentPart } from 'api/llms/llmMessage.ts';

export const getContentArrayFromToolResult = (toolRunResultContent: LLMToolRunResultContent): string[] => {
	if (Array.isArray(toolRunResultContent)) {
		return toolRunResultContent.map((part) => getTextContent(part));
	} else if (typeof toolRunResultContent !== 'string') {
		return [getTextContent(toolRunResultContent)];
	} else {
		return [toolRunResultContent];
	}
};

export const getContentFromToolResult = (toolRunResultContent: LLMToolRunResultContent): string => {
	return getContentArrayFromToolResult(toolRunResultContent).join('\n');
};

export const getTextContent = (content: LLMMessageContentPart): string => {
	if ('text' in content) {
		return content.text;
	} else if ('image' in content) {
		return '[Image content]';
	} else if ('tool_use_id' in content) {
		return `[Tool result: ${content.tool_use_id}]`;
	}
	return '[Unknown content]';
};
