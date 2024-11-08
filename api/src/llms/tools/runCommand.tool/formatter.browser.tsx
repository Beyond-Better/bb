/** @jsxImportSource preact */
import type { JSX } from 'preact';
import { AnsiUp } from 'ansi_up';

import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import { logger } from 'shared/logger.ts';

export const formatToolUse = (toolInput: LLMToolInputSchema): JSX.Element => {
	const { command, args = [] } = toolInput as { command: string; args?: string[] };
	return (
		<div className='tool-use run-command'>
			<h3>Run Command Tool</h3>
			<p>
				<strong>Command:</strong> <span style={{ color: '#DAA520' }}>{command}</span>
			</p>
			{args.length > 0 && (
				<p>
					<strong>Arguments:</strong> <span style={{ color: '#4169E1' }}>{args.join(' ')}</span>
				</p>
			)}
		</div>
	);
};

export const formatToolResult = (resultContent: ConversationLogEntryContentToolResult): JSX.Element => {
	const { bbResponse } = resultContent;
	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const { code, command, stderrContainsError, stdout, stderr } = bbResponse.data as {
			code: number;
			command: string;
			stderrContainsError: boolean;
			stdout: string;
			stderr: string;
		};
		var ansi_up = new AnsiUp();
		return (
			<div className='tool-result run-command'>
				<p>
					<strong>BB ran command:</strong> <span style={{ color: '#DAA520' }}>{command}</span>
					{stderrContainsError ? ' (with potential issues in stderr)' : ''}
					<br />
					<strong>Exit Code:</strong> {code}
				</p>
				{stdout
					? (
						<div>
							<p>
								<strong>Command output:</strong>
							</p>
							<pre
								style={{ backgroundColor: '#F0F8FF', padding: '10px' }}
								dangerouslySetInnerHTML={{ __html: ansi_up.ansi_to_html(stdout) }}
							/>
						</div>
					)
					: ''}
				{stderr
					? (
						<div>
							<p>
								<strong>Error output:</strong>
							</p>
							<pre
								style={{ backgroundColor: '#F0F8FF', padding: '10px' }}
								dangerouslySetInnerHTML={{ __html: ansi_up.ansi_to_html(stderr) }}
							/>
						</div>
					)
					: ''}
			</div>
		);
	} else {
		logger.error('LLMToolRunCommand: Unexpected bbResponse format:', bbResponse);
		return (
			<div className='tool-result'>
				<p>
					<strong>{bbResponse}</strong>
				</p>
			</div>
		);
	}
};
