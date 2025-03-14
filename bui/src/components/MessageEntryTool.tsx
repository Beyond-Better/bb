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
	projectId?: string;
	logEntry?: ConversationLogEntry;
}

export function MessageEntryTool({
	//type,
	//toolName,
	content,
	//onCopy,
	apiClient,
	projectId,
	logEntry,
}: MessageEntryToolProps): JSX.Element {
	const [showToast, setShowToast] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [formatted, setFormatted] = useState<LogEntryFormatResponse | null>(null);

	// Format content using API if available
	useEffect(() => {
		if (!apiClient || !projectId || !logEntry) return;

		const fetchFormatting = async () => {
			setIsLoading(true);
			try {
				const response = await apiClient.formatLogEntry(
					logEntry.entryType,
					logEntry,
					projectId,
				);
				setFormatted(response);
			} catch (error) {
				console.error('Error formatting tool message:', error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchFormatting();
	}, [apiClient, projectId, logEntry]);

	// Default JSON formatting as fallback
	const formattedContent = JSON.stringify(content, null, 2);
	const highlighted = hljs.highlight(formattedContent, { language: 'json' }).value;

	//const handleCopy = () => {
	//	if (onCopy) {
	//		onCopy(formattedContent);
	//		setShowToast(true);
	//	}
	//};

	return (
		<>
			{/* <div className='bb-tool-message bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden'> */}
			<div className='bb-tool-message overflow-hidden'>
				{/* Loading state */}
				{isLoading && (
					<div className='flex items-center justify-center py-4 dark:bg-gray-800'>
						<div className='animate-spin rounded-full h-6 w-6 border-2 border-blue-500 dark:border-blue-400 border-t-transparent' />
						<span className='ml-2 text-blue-500 dark:text-blue-400'>Formatting message...</span>
					</div>
				)}

				{/* API formatted content or fallback */}
				{!isLoading && (
					<div className='overflow-x-auto'>
						{formatted?.formattedResult?.content
							? (
								<div
									// deno-lint-ignore react-no-danger
									dangerouslySetInnerHTML={{ __html: formatted.formattedResult.content as string }}
								/>
							)
							: (
								<pre className='m-0 py-1 px-4 bg-gray-50 dark:bg-gray-900 text-sm dark:text-gray-200'>
								<code
									className="language-json hljs"
								// deno-lint-ignore react-no-danger
									dangerouslySetInnerHTML={{ __html: highlighted }}
								/>
								// deno-lint-ignore react-no-danger

								</pre>
							)}
					</div>
				)}

				{/* Show parameters and results sections only when using JSON fallback */}
				{!formatted?.formattedResult?.content && !isLoading && (
					<>
						{content.parameters && (
							<div className='px-2 py-2 bg-gray-100 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-700 text-sm dark:text-gray-200'>
								<strong>Parameters:</strong>
								<div className='mt-1 overflow-x-auto'>
									<pre className='text-xs dark:text-gray-300'>
										{JSON.stringify(content.parameters, null, 2)}
									</pre>
								</div>
							</div>
						)}
						{content.result && (
							<div className='px-2 py-2 bg-gray-100 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-700 text-sm dark:text-gray-200'>
								<strong>Result:</strong>
								<div className='mt-1 overflow-x-auto'>
									<pre className='text-xs dark:text-gray-300'>
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
