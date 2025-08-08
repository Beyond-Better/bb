/** @jsxImportSource preact */
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolLoadDatasourceInput, LLMToolLoadDatasourceResponseData } from './types.ts';
import type { ContentTypeExample } from 'shared/types/dataSource.ts';
import { logger } from 'shared/logger.ts';

export const formatLogEntryToolUse = (
	toolInput: LLMToolInputSchema,
): LLMToolLogEntryFormattedResult => {
	const { dataSourceId, returnType = 'metadata', path, depth, pageSize, pageToken } =
		toolInput as LLMToolLoadDatasourceInput;

	// Build options list
	const optionsList = [];
	optionsList.push(`Return Type: ${returnType}`);
	if (path) optionsList.push(`Path: ${path}`);
	if (depth !== undefined) optionsList.push(`Depth: ${depth}`);
	if (pageSize) optionsList.push(`Page Size: ${pageSize}`);
	if (pageToken) optionsList.push(`Page Token: ${pageToken}`);

	const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			{LLMTool.TOOL_TAGS_BROWSER.content.status('running', 'Loading Data Source')}
			<div className='datasource-id'>
				{LLMTool.TOOL_TAGS_BROWSER.base.label('Data Source:')} {dataSourceId}
			</div>
			{optionsList.length > 0 && (
				<div className='datasource-options'>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Options:')}
					{LLMTool.TOOL_TAGS_BROWSER.base.list(
						optionsList.map((option, idx) => <span key={idx}>{option}</span>),
					)}
				</div>
			)}
		</>,
	);

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Load Data Source'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(`Listing resources from ${dataSourceId}`),
		content,
		preview: `Loading resources from data source: ${dataSourceId}`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: CollaborationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent;

	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const { data } = bbResponse as LLMToolLoadDatasourceResponseData;
		const resources = data.resources || [];
		const metadata = data.metadata;

		// Handle metadata display (for 'metadata' or 'both' modes)
		if (metadata) {
			const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
				<>
					<div className='datasource-info'>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('Data Source:')} {data.dataSource.dsConnectionName}
						{' | '}
						{LLMTool.TOOL_TAGS_BROWSER.base.label('Type:')} {data.dataSource.dsProviderType}
					</div>
					<div className='metadata-container'>
						{LLMTool.TOOL_TAGS_BROWSER.content.status('completed', 'Data Source Overview')}

						{/* Basic counts */}
						<div className='metadata-summary'>
							<div className='metadata-stat'>
								{LLMTool.TOOL_TAGS_BROWSER.base.label('Total Resources:')}
								<span className='stat-value'>{metadata.totalResources || 0}</span>
							</div>
						</div>

						{/* Resource types breakdown */}
						{metadata.resourceTypes && Object.keys(metadata.resourceTypes).length > 0 && (
							<div className='resource-types'>
								{LLMTool.TOOL_TAGS_BROWSER.base.label('Resource Types:')}
								{LLMTool.TOOL_TAGS_BROWSER.base.list(
									Object.entries(metadata.resourceTypes).map(([type, count]) => (
										<div className='type-stat' key={type}>
											<span className='type-name'>{type}:</span>
											<span className='type-count'>{count}</span>
										</div>
									)),
								)}
							</div>
						)}

						{/* Filesystem-specific details */}
						{metadata.filesystem && (
							<div className='filesystem-details'>
								{LLMTool.TOOL_TAGS_BROWSER.base.label('Filesystem Details:')}
								<div className='filesystem-stats'>
									{metadata.filesystem.deepestPathDepth !== undefined && (
										<div>📁 Directory Depth: {metadata.filesystem.deepestPathDepth}</div>
									)}
									{metadata.filesystem.largestFileSize !== undefined && (
										<div>
											📊 Largest File: {LLMTool.TOOL_TAGS_BROWSER.content.bytes(
												metadata.filesystem.largestFileSize,
											)}
										</div>
									)}
									{metadata.filesystem.oldestFileDate && (
										<div>
											📅 Date Range:{' '}
											{new Date(metadata.filesystem.oldestFileDate).toLocaleDateString()} -{' '}
											{metadata.filesystem.newestFileDate
												? new Date(metadata.filesystem.newestFileDate).toLocaleDateString()
												: 'Unknown'}
										</div>
									)}
								</div>

								{/* File extensions */}
								{metadata.filesystem.fileExtensions &&
									Object.keys(metadata.filesystem.fileExtensions).length > 0 && (
									<div className='file-extensions'>
										{LLMTool.TOOL_TAGS_BROWSER.base.label('Top File Extensions:')}
										{LLMTool.TOOL_TAGS_BROWSER.base.list(
											Object.entries(metadata.filesystem.fileExtensions)
												.sort(([, a], [, b]) => b - a)
												.slice(0, 8)
												.map(([ext, count]) => (
													<span key={ext} className='ext-stat'>
														<code>{ext}</code>: {count}
													</span>
												)),
										)}
										{Object.keys(metadata.filesystem.fileExtensions).length > 8 && (
											<div className='ext-more'>
												... and {Object.keys(metadata.filesystem.fileExtensions).length - 8}
												{' '}
												more
											</div>
										)}
									</div>
								)}
							</div>
						)}

						{/* Notion-specific details */}
						{metadata.notion && (
							<div className='notion-details'>
								{LLMTool.TOOL_TAGS_BROWSER.base.label('Notion Details:')}
								<div className='notion-stats'>
									{metadata.notion.workspaceInfo && (
										<div>🏢 Workspace: {metadata.notion.workspaceInfo.name || 'Unknown'}</div>
									)}
									{metadata.notion.totalPages !== undefined && (
										<div>📄 Pages: {metadata.notion.totalPages}</div>
									)}
									{metadata.notion.totalDatabases !== undefined && (
										<div>🗃️ Databases: {metadata.notion.totalDatabases}</div>
									)}
								</div>
							</div>
						)}

						{/* Content Type Guidance */}
						{data.contentTypeGuidance && (
							<div className='content-type-guidance'>
								{LLMTool.TOOL_TAGS_BROWSER.content.status('completed', '🛠️ Content Type Guidance')}
								<div className='guidance-overview'>
									<div className='guidance-stat'>
										{LLMTool.TOOL_TAGS_BROWSER.base.label('Primary Type:')}
										<span className='stat-value'>
											{data.contentTypeGuidance.primaryContentType}
										</span>
									</div>
									<div className='guidance-stat'>
										{LLMTool.TOOL_TAGS_BROWSER.base.label('Preferred:')}
										<span className='stat-value'>
											{data.contentTypeGuidance.preferredContentType}
										</span>
									</div>
								</div>

								{/* Accepted types */}
								<div className='accepted-types'>
									<div className='content-types'>
										{LLMTool.TOOL_TAGS_BROWSER.base.label('Accepted Content Types:')}
										{LLMTool.TOOL_TAGS_BROWSER.base.list(
											data.contentTypeGuidance.acceptedContentTypes.map((type: string) => (
												<code key={type} className='content-type'>{type}</code>
											)),
										)}
									</div>
									<div className='edit-types'>
										{LLMTool.TOOL_TAGS_BROWSER.base.label('Accepted Edit Types:')}
										{LLMTool.TOOL_TAGS_BROWSER.base.list(
											data.contentTypeGuidance.acceptedEditTypes.map((type: string) => (
												<code key={type} className='edit-type'>{type}</code>
											)),
										)}
									</div>
								</div>

								{/* Usage Examples */}
								{data.contentTypeGuidance.examples && data.contentTypeGuidance.examples.length > 0 && (
									<div className='usage-examples'>
										{LLMTool.TOOL_TAGS_BROWSER.base.label('Usage Examples:')}
										{LLMTool.TOOL_TAGS_BROWSER.base.list(
											data.contentTypeGuidance.examples.slice(0, 2).map((
												example: ContentTypeExample,
												idx: number,
											) => (
												<div key={idx} className='example-item'>
													<div className='example-description'>{example.description}</div>
													<div className='example-details'>
														<code className='tool-name'>{example.toolCall.tool}</code>
														{Object.keys(example.toolCall.input).filter((k) =>
																	k !== 'resourcePath'
																).length > 0 && (
															<span className='content-types'>
																{Object.keys(example.toolCall.input).filter((k) =>
																	k !== 'resourcePath'
																).join(', ')}
															</span>
														)}
													</div>
												</div>
											)),
										)}
									</div>
								)}

								{/* Important Notes */}
								{data.contentTypeGuidance.notes && data.contentTypeGuidance.notes.length > 0 && (
									<div className='guidance-notes'>
										{LLMTool.TOOL_TAGS_BROWSER.base.label('Important Notes:')}
										{LLMTool.TOOL_TAGS_BROWSER.base.list(
											data.contentTypeGuidance.notes.slice(0, 3).map((note: string, idx: number) => (
												<div key={idx} className='guidance-note'>• {note}</div>
											)),
										)}
									</div>
								)}
							</div>
						)}

						{/* Last scanned */}
						{metadata.lastScanned && (
							<div className='last-scanned'>
								<small>Last scanned: {new Date(metadata.lastScanned).toLocaleString()}</small>
							</div>
						)}
					</div>

					{/* Show sample resources if present (for 'both' mode) */}
					{resources && resources.length > 0 && (
						<div className='resources-container'>
							{LLMTool.TOOL_TAGS_BROWSER.content.status(
								'completed',
								`Sample Resources (${resources.length})`,
							)}
							{LLMTool.TOOL_TAGS_BROWSER.base.list(
								resources.map((resource, idx) => (
									<div className='resource-item' key={idx}>
										{LLMTool.TOOL_TAGS_BROWSER.content.filename(resource.name || resource.uri)}{' '}
										{resource.description && (
											<span className='resource-description'>({resource.description})</span>
										)}
										{resource.size !== undefined && (
											<span className='resource-size'>
												- {LLMTool.TOOL_TAGS_BROWSER.content.bytes(resource.size)}
											</span>
										)}
									</div>
								)),
							)}
							{data.pagination?.nextPageToken && (
								<div className='pagination-info'>
									{LLMTool.TOOL_TAGS_BROWSER.content.status('warning', 'More Resources Available')}
									<span>
										Use returnType='resources' with pageToken: {data.pagination.nextPageToken}
									</span>
								</div>
							)}
						</div>
					)}
				</>,
			);

			return {
				title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Load Data Source'),
				subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(
					resources && resources.length > 0
						? `${metadata.totalResources || 0} total resources + ${resources.length} sample`
						: `${metadata.totalResources || 0} total resources`,
				),
				content,
				preview: resources && resources.length > 0
					? `Overview + ${resources.length} sample resources from ${data.dataSource.dsConnectionName}`
					: `Data source overview: ${
						metadata.totalResources || 0
					} resources in ${data.dataSource.dsConnectionName}`,
			};
		}

		// Handle resources display (existing logic)
		const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
			<>
				<div className='datasource-info'>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Data Source:')} {data.dataSource.dsConnectionName}
					{' | '}
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Type:')} {data.dataSource.dsProviderType}
				</div>
				{resources.length > 0
					? (
						<div className='resources-container'>
							{LLMTool.TOOL_TAGS_BROWSER.content.status('completed', 'Resources Found')}
							{LLMTool.TOOL_TAGS_BROWSER.base.list(
								resources.map((resource) => (
									<div className='resource-item'>
										{LLMTool.TOOL_TAGS_BROWSER.content.filename(resource.name || resource.uri)}{' '}
										{resource.description && (
											<span className='resource-description'>({resource.description})</span>
										)}
									</div>
								)),
							)}
						</div>
					)
					: (
						<div className='no-resources'>
							{LLMTool.TOOL_TAGS_BROWSER.content.status('warning', 'No Resources Found')}
						</div>
					)}
				{data.pagination?.nextPageToken && (
					<div className='pagination-info'>
						{LLMTool.TOOL_TAGS_BROWSER.content.status('warning', 'More Results Available')}
						<span>Use page token: {data.pagination.nextPageToken}</span>
					</div>
				)}
			</>,
		);

		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Load Data Source'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(`${resources.length} resources found`),
			content,
			preview: `Found ${resources.length} resources in ${data.dataSource.dsConnectionName}`,
		};
	} else {
		logger.error('LLMToolLoadDatasource: Unexpected bbResponse format:', bbResponse);
		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Load Data Source'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('Error'),
			content: LLMTool.TOOL_TAGS_BROWSER.base.container(
				LLMTool.TOOL_TAGS_BROWSER.content.status('failed', String(bbResponse)),
			),
			preview: 'Error loading data source resources',
		};
	}
};
