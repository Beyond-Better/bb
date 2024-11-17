import { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import hljs from 'highlight';
import { Toast } from './Toast.tsx';
import { ApiClient, LogEntryFormatResponse } from '../utils/apiClient.utils.ts';
import { ConversationLogEntry } from 'shared/types.ts';

interface MessageEntryToolProps {
	type: 'input' | 'output';
	toolName: string;
	content: any;
	onCopy?: (text: string) => void;
	apiClient?: ApiClient;
	startDir?: string;
	logEntry?: ConversationLogEntry;
}

export function MessageEntryTool({
	type,
	toolName,
	content,
	onCopy,
	apiClient,
	startDir,
	logEntry,
}: MessageEntryToolProps): JSX.Element {
	const [showToast, setShowToast] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [apiFormattedContent, setApiFormattedContent] = useState<string | null>(null);

	// Format content using API if available
	useEffect(() => {
		if (!apiClient || !startDir || !logEntry) return;

		const fetchFormatting = async () => {
			setIsLoading(true);
			try {
				const response = await apiClient.post<LogEntryFormatResponse>(
					`/api/v1/format_log_entry/browser/${logEntry.entryType}`,
					{ logEntry, startDir },
				);
				setApiFormattedContent(response?.formattedContent ?? null);
			} catch (error) {
				console.error('Error formatting tool message:', error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchFormatting();
	}, [apiClient, startDir, logEntry]);

	// Default JSON formatting as fallback
	const formattedContent = JSON.stringify(content, null, 2);
	const highlighted = hljs.highlight(formattedContent, { language: 'json' }).value;

	const handleCopy = () => {
		if (onCopy) {
			onCopy(formattedContent);
			setShowToast(true);
		}
	};

	return (
		<>
			<div className='tool-message bg-gray-50 border border-gray-200 rounded-lg overflow-hidden'>
				{/* Loading state */}
				{isLoading && (
					<div className='flex items-center justify-center py-4'>
						<div className='animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent' />
						<span className='ml-2 text-blue-500'>Formatting message...</span>
					</div>
				)}

				{/* API formatted content or fallback */}
				{!isLoading && (
					<div className='overflow-x-auto'>
						{apiFormattedContent
							? (
								<div
									className='prose max-w-none py-1 px-4'
									dangerouslySetInnerHTML={{ __html: apiFormattedContent }}
								/>
							)
							: (
								<pre className='m-0 py-1 px-4 bg-gray-50 text-sm'>
								<code
									className="language-json hljs"
									dangerouslySetInnerHTML={{ __html: highlighted }}
								/>
								</pre>
							)}
					</div>
				)}

				{/* Show parameters and results sections only when using JSON fallback */}
				{!apiFormattedContent && (
					<>
						{content.parameters && (
							<div className='px-2 py-2 bg-gray-100 border-t border-gray-200 text-sm'>
								<strong>Parameters:</strong>
								<div className='mt-1 overflow-x-auto'>
									<pre className='text-xs'>
										{JSON.stringify(content.parameters, null, 2)}
									</pre>
								</div>
							</div>
						)}
						{content.result && (
							<div className='px-2 py-2 bg-gray-100 border-t border-gray-200 text-sm'>
								<strong>Result:</strong>
								<div className='mt-1 overflow-x-auto'>
									<pre className='text-xs'>
										{JSON.stringify(content.result, null, 2)}
									</pre>
								</div>
							</div>
						)}
					</>
				)}
			</div>
			{showToast && (
				<Toast
					message='Tool content copied to clipboard!'
					type='success'
					duration={2000}
					onClose={() => setShowToast(false)}
				/>
			)}
		</>
	);
}
