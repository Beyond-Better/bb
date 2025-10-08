import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolDownloadResourceInput, LLMToolDownloadResourceResultData } from './types.ts';
import { stripIndents } from 'common-tags';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const {
		url,
		method = 'GET',
		headers,
		auth,
		queryParams,
		requestBody,
		dataSourceId,
		resourcePath,
		overwriteExisting,
		createMissingDirectories,
		includeInMessages,
		followRedirects,
		maxRedirects,
		timeout,
		maxFileSize,
	} = toolInput as LLMToolDownloadResourceInput;

	// Determine auth description
	let authDescription = '';
	if (auth && auth.type !== 'none') {
		switch (auth.type) {
			case 'basic':
				authDescription = 'Basic Authentication';
				break;
			case 'bearer':
				authDescription = 'Bearer Token';
				break;
			case 'apikey':
				authDescription = `API Key ${auth.useQueryParam ? '(query parameter)' : '(header)'}`;
				break;
		}
	}

	// Create options array for display
	const options: string[] = [];
	if (overwriteExisting) options.push('overwrite existing');
	if (createMissingDirectories) options.push('create directories');
	if (includeInMessages) options.push('include in messages');
	if (followRedirects === false) options.push('no redirects');
	if (maxRedirects && maxRedirects !== 10) options.push(`max redirects: ${maxRedirects}`);
	if (timeout && timeout !== 30000) options.push(`timeout: ${timeout / 1000}s`);
	if (maxFileSize && maxFileSize !== 50 * 1024 * 1024) {
		options.push(`max size: ${Math.round(maxFileSize / 1024 / 1024)}MB`);
	}

	let formattedContent = stripIndents`
		${LLMTool.TOOL_STYLES_CONSOLE.base.label('Method:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.data(method)}
		${LLMTool.TOOL_STYLES_CONSOLE.base.label('URL:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.url(url)}
		${LLMTool.TOOL_STYLES_CONSOLE.base.label('Save to:')} ${
		dataSourceId ? LLMTool.TOOL_STYLES_CONSOLE.content.data(dataSourceId + ':') + ' ' : ''
	}${LLMTool.TOOL_STYLES_CONSOLE.content.filename(resourcePath)}
	`;

	if (authDescription) {
		formattedContent += `\n${LLMTool.TOOL_STYLES_CONSOLE.base.label('Authentication:')} ${
			LLMTool.TOOL_STYLES_CONSOLE.content.data(authDescription)
		}`;
	}

	if (queryParams && Object.keys(queryParams).length > 0) {
		formattedContent += `\n${LLMTool.TOOL_STYLES_CONSOLE.base.label('Query Parameters:')}`;
		Object.entries(queryParams).forEach(([key, value]) => {
			formattedContent += `\n  ${LLMTool.TOOL_STYLES_CONSOLE.content.data(key)}: ${
				LLMTool.TOOL_STYLES_CONSOLE.content.data(value)
			}`;
		});
	}

	if (headers && Object.keys(headers).length > 0) {
		formattedContent += `\n${LLMTool.TOOL_STYLES_CONSOLE.base.label('Headers:')}`;
		Object.entries(headers).forEach(([key, value]) => {
			formattedContent += `\n  ${LLMTool.TOOL_STYLES_CONSOLE.content.data(key)}: ${
				LLMTool.TOOL_STYLES_CONSOLE.content.data(value)
			}`;
		});
	}

	if (requestBody) {
		formattedContent += `\n${LLMTool.TOOL_STYLES_CONSOLE.base.label('Request Body:')} ${
			LLMTool.TOOL_STYLES_CONSOLE.content.data(requestBody.contentType)
		}`;
		const bodyPreview = requestBody.content.length > 200
			? `${requestBody.content.substring(0, 200)}...`
			: requestBody.content;
		formattedContent += `\n\n${LLMTool.TOOL_STYLES_CONSOLE.content.code(bodyPreview)}`;
	}

	if (options.length > 0) {
		formattedContent += `\n${LLMTool.TOOL_STYLES_CONSOLE.base.label('Options:')} ${
			LLMTool.TOOL_STYLES_CONSOLE.content.data(options.join(', '))
		}`;
	}

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Download Resource'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(`${method} ${url} → ${resourcePath}`),
		content: formattedContent,
		preview: `Download ${method} ${url} to ${resourcePath}`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: CollaborationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent;

	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const data = bbResponse.data as LLMToolDownloadResourceResultData;
		const { response, bytesDownloaded, durationMs, isNewResource, dataSource } = data;
		const { contentTypeInfo } = response;
		const operation = isNewResource ? 'Downloaded' : 'Updated';

		let content = stripIndents`
			${LLMTool.TOOL_STYLES_CONSOLE.base.label(`✅ ${operation} successfully:`)}
			${LLMTool.TOOL_STYLES_CONSOLE.content.url(data.url)}
		`;

		// Show redirect chain if applicable
		if (response.finalUrl !== data.url) {
			content += `\n${LLMTool.TOOL_STYLES_CONSOLE.base.label('Final URL:')} ${
				LLMTool.TOOL_STYLES_CONSOLE.content.data(response.finalUrl)
			}`;
		}

		content += stripIndents`
			
			${LLMTool.TOOL_STYLES_CONSOLE.base.label('Saved to:')} ${
			LLMTool.TOOL_STYLES_CONSOLE.content.data(dataSource.dsConnectionName + ':')
		} ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(data.resourcePath)}
			${LLMTool.TOOL_STYLES_CONSOLE.base.label('Resource ID:')} ${
			LLMTool.TOOL_STYLES_CONSOLE.content.data(data.resourceId)
		}
		`;

		// Add metadata
		content += stripIndents`
			
			${LLMTool.TOOL_STYLES_CONSOLE.base.label('Details:')}
			  Content-Type: ${LLMTool.TOOL_STYLES_CONSOLE.content.data(contentTypeInfo.mimeType)} ${
			LLMTool.TOOL_STYLES_CONSOLE.content.data('(' + contentTypeInfo.contentType + ')')
		}
			  Size: ${LLMTool.TOOL_STYLES_CONSOLE.content.bytes(bytesDownloaded)}
			  Duration: ${LLMTool.TOOL_STYLES_CONSOLE.content.duration(durationMs)}
			  HTTP Status: ${LLMTool.TOOL_STYLES_CONSOLE.content.data(response.status + ' ' + response.statusText)}
		`;

		// Add optional details
		if (response.redirectCount > 0) {
			content += `\n  Redirects: ${LLMTool.TOOL_STYLES_CONSOLE.content.number(response.redirectCount)}`;
		}

		if (response.contentLength) {
			content += `\n  Content-Length: ${LLMTool.TOOL_STYLES_CONSOLE.content.bytes(response.contentLength)}`;
		}

		// Add warnings
		if (contentTypeInfo.warningMessage) {
			content += `\n\n${LLMTool.TOOL_STYLES_CONSOLE.status.warning(contentTypeInfo.warningMessage)}`;
		}

		// Add conversation content preview if included
		if (data.conversationContent) {
			content += `\n\n${LLMTool.TOOL_STYLES_CONSOLE.base.label('Content included in messages:')}`;
			const contentPreview = data.conversationContent.length > 500
				? `${data.conversationContent.substring(0, 500)}...`
				: data.conversationContent;
			content += `\n\n${LLMTool.TOOL_STYLES_CONSOLE.content.code(contentPreview)}`;
		}

		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Download Resource'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(`${operation} ${data.resourcePath}`),
			content,
			preview: `${operation} ${bytesDownloaded} bytes in ${durationMs}ms`,
		};
	} else {
		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Download Resource'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('failed'),
			content: LLMTool.TOOL_STYLES_CONSOLE.status.error(String(bbResponse)),
			preview: 'Download failed',
		};
	}
};
