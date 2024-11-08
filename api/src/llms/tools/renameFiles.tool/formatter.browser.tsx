/** @jsxImportSource preact */
import type { JSX } from 'preact';
import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import { logger } from 'shared/logger.ts';

export const formatToolUse = (toolInput: LLMToolInputSchema): JSX.Element => {
	const { operations, createMissingDirectories, overwrite } = toolInput as {
		operations: Array<{ source: string; destination: string }>;
		createMissingDirectories?: boolean;
		overwrite?: boolean;
	};
	return (
		<div className='tool-use'>
			<p>Renaming the following files/directories:</p>
			<ul>
				{operations.map((op, index) => <li key={index}>{op.source} -&gt; {op.destination}</li>)}
			</ul>
			<p>Overwrite: {overwrite ? 'Yes' : 'No'}</p>
			<p>Create Missing Directories: {createMissingDirectories ? 'Yes' : 'No'}</p>
		</div>
	);
};

export const formatToolResult = (resultContent: ConversationLogEntryContentToolResult): JSX.Element => {
	const { bbResponse } = resultContent;
	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const data = bbResponse.data as {
			filesRenamed: Array<{ source: string; destination: string }>;
			filesError: Array<{ source: string; destination: string }>;
		};
		return (
			<div className='tool-result'>
				{data.filesRenamed.length > 0
					? (
						<div>
							<p>
								<strong>✅ BB has renamed these files:</strong>
							</p>
							<p>
								<ul>
									{data.filesRenamed.map((file) => <li>{file.source} -&gt; ${file.destination}</li>)}
								</ul>
							</p>
						</div>
					)
					: ''}
				{data.filesError.length > 0
					? (
						<div>
							<p>
								<strong>⚠️ BB failed to rename these files:</strong>
							</p>
							<p>
								<ul>
									{data.filesError.map((file) => <li>{file.source} -&gt; ${file.destination}</li>)}
								</ul>
							</p>
						</div>
					)
					: ''}
			</div>
		);
	} else {
		logger.error('LLMToolRenameFiles: Unexpected bbResponse format:', bbResponse);
		return (
			<div className='tool-result'>
				<p>
					<strong>{bbResponse}</strong>
				</p>
			</div>
		);
	}
};
