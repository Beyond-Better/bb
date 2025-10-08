/** @jsxImportSource preact */
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolDownloadResourceInput, LLMToolDownloadResourceResultData } from './types.ts';

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

	// Determine auth description
	let authDescription = '';
	if (auth && auth.type !== 'none') {
		switch (auth.type) {
			case 'basic':
				authDescription = 'Basic Auth';
				break;
			case 'bearer':
				authDescription = 'Bearer Token';
				break;
			case 'apikey':
				authDescription = `API Key ${auth.useQueryParam ? '(query param)' : '(header)'}`;
				break;
		}
	}

	const formattedContent = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			{LLMTool.TOOL_TAGS_BROWSER.base.container(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Method:')} {LLMTool.TOOL_TAGS_BROWSER.base.text(method)}
				</>,
			)}
			{LLMTool.TOOL_TAGS_BROWSER.base.container(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('URL:')} {LLMTool.TOOL_TAGS_BROWSER.content.url(url)}
				</>,
			)}
			{LLMTool.TOOL_TAGS_BROWSER.base.container(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Save to:')}{' '}
					{dataSourceId && <>{LLMTool.TOOL_TAGS_BROWSER.base.text(dataSourceId + ':')}</>}
					{LLMTool.TOOL_TAGS_BROWSER.content.filename(resourcePath)}
				</>,
			)}
			{authDescription && LLMTool.TOOL_TAGS_BROWSER.base.container(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Authentication:')}{' '}
					{LLMTool.TOOL_TAGS_BROWSER.base.text(authDescription)}
				</>,
			)}
			{queryParams && Object.keys(queryParams).length > 0 && LLMTool.TOOL_TAGS_BROWSER.base.container(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Query Parameters:')}
					<div>
						{Object.entries(queryParams).map(([key, value]) => (
							<div key={key}>
								{LLMTool.TOOL_TAGS_BROWSER.base.text(key)}: {LLMTool.TOOL_TAGS_BROWSER.base.text(value)}
							</div>
						))}
					</div>
				</>,
			)}
			{headers && Object.keys(headers).length > 0 && LLMTool.TOOL_TAGS_BROWSER.base.container(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Headers:')}
					<div>
						{Object.entries(headers).map(([key, value]) => (
							<div key={key}>
								{LLMTool.TOOL_TAGS_BROWSER.base.text(key)}: {LLMTool.TOOL_TAGS_BROWSER.base.text(value)}
							</div>
						))}
					</div>
				</>,
			)}
			{requestBody && LLMTool.TOOL_TAGS_BROWSER.base.container(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Request Body:')}{' '}
					{LLMTool.TOOL_TAGS_BROWSER.base.text(requestBody.contentType)}
					{LLMTool.TOOL_TAGS_BROWSER.base.pre(
						requestBody.content.length > 200
							? `${requestBody.content.substring(0, 200)}...`
							: requestBody.content,
					)}
				</>,
				`${LLMTool.TOOL_STYLES_BROWSER.base.container} ${LLMTool.TOOL_STYLES_BROWSER.content.code}`,
			)}
			{options.length > 0 && LLMTool.TOOL_TAGS_BROWSER.base.container(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Options:')}{' '}
					{LLMTool.TOOL_TAGS_BROWSER.base.text(options.join(', '))}
				</>,
			)}
		</>,
		LLMTool.TOOL_STYLES_BROWSER.base.container,
	);

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Download Resource'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(`${method} ${url} → ${resourcePath}`),
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

		const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
			<>
				{LLMTool.TOOL_TAGS_BROWSER.base.container(
					<>
						{LLMTool.TOOL_TAGS_BROWSER.base.label(`✅ ${operation} successfully:`)}
						<div>{LLMTool.TOOL_TAGS_BROWSER.content.url(data.url)}</div>
						{response.finalUrl !== data.url && (
							<div>
								{LLMTool.TOOL_TAGS_BROWSER.base.text('→ ')}
								{LLMTool.TOOL_TAGS_BROWSER.content.url(response.finalUrl)}
							</div>
						)}
					</>,
				)}
				{LLMTool.TOOL_TAGS_BROWSER.base.container(
					<>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('Saved to:')}{' '}
						{LLMTool.TOOL_TAGS_BROWSER.base.text(dataSource.dsConnectionName + ':')}{' '}
						{LLMTool.TOOL_TAGS_BROWSER.content.filename(data.resourcePath)}
					</>,
				)}
				{LLMTool.TOOL_TAGS_BROWSER.base.container(
					<>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('Content-Type:')}{' '}
						{LLMTool.TOOL_TAGS_BROWSER.base.text(contentTypeInfo.mimeType)}{' '}
						{LLMTool.TOOL_TAGS_BROWSER.base.text(`(${contentTypeInfo.contentType})`)}
					</>,
				)}
				{LLMTool.TOOL_TAGS_BROWSER.base.container(
					<>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('Size:')}{' '}
						{LLMTool.TOOL_TAGS_BROWSER.content.bytes(bytesDownloaded)}
					</>,
				)}
				{LLMTool.TOOL_TAGS_BROWSER.base.container(
					<>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('Duration:')}{' '}
						{LLMTool.TOOL_TAGS_BROWSER.content.duration(durationMs)}
					</>,
				)}
				{LLMTool.TOOL_TAGS_BROWSER.base.container(
					<>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('HTTP Status:')}{' '}
						{LLMTool.TOOL_TAGS_BROWSER.base.text(`${response.status} ${response.statusText}`)}
					</>,
				)}
				{response.redirectCount > 0 && LLMTool.TOOL_TAGS_BROWSER.base.container(
					<>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('Redirects:')}{' '}
						{LLMTool.TOOL_TAGS_BROWSER.content.number(response.redirectCount)}
					</>,
				)}
				{response.contentLength && LLMTool.TOOL_TAGS_BROWSER.base.container(
					<>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('Content-Length:')}{' '}
						{LLMTool.TOOL_TAGS_BROWSER.content.bytes(response.contentLength)}
					</>,
				)}
				{contentTypeInfo.warningMessage && LLMTool.TOOL_TAGS_BROWSER.base.container(
					<>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('⚠️ Warning:')}{' '}
						{LLMTool.TOOL_TAGS_BROWSER.base.text(contentTypeInfo.warningMessage)}
					</>,
					`${LLMTool.TOOL_STYLES_BROWSER.base.container} ${LLMTool.TOOL_STYLES_BROWSER.status.warning}`,
				)}
				{data.conversationContent && LLMTool.TOOL_TAGS_BROWSER.base.container(
					<>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('Content included in messages:')}
						{LLMTool.TOOL_TAGS_BROWSER.base.pre(
							data.conversationContent.length > 500
								? `${data.conversationContent.substring(0, 500)}...`
								: data.conversationContent,
						)}
					</>,
					`${LLMTool.TOOL_STYLES_BROWSER.base.container} ${LLMTool.TOOL_STYLES_BROWSER.content.code}`,
				)}
			</>,
			`${LLMTool.TOOL_STYLES_BROWSER.base.container} ${LLMTool.TOOL_STYLES_BROWSER.status.success}`,
		);

		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Download Resource'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(`${operation} ${data.resourcePath}`),
			content,
			preview: `${operation} ${bytesDownloaded} bytes in ${durationMs}ms`,
		};
	} else {
		const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
			LLMTool.TOOL_TAGS_BROWSER.base.label(String(bbResponse)),
			`${LLMTool.TOOL_STYLES_BROWSER.base.container} ${LLMTool.TOOL_STYLES_BROWSER.status.error}`,
		);

		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Download Resource'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('failed'),
			content,
			preview: 'Download failed',
		};
	}
};
