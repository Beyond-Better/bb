import { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import hljs from 'highlight';
import { Toast } from './Toast.tsx';
import { ApiClient, LogEntryFormatResponse } from '../utils/apiClient.utils.ts';
import { CollaborationLogEntry } from 'shared/types.ts';
import type { ProjectConfig } from 'shared/config/types.ts';

interface MessageEntryToolProps {
	type: 'input' | 'output';
	toolName: string;
	content: any;
	onCopy?: (text: string, html?: string, toastMessage?: string) => void;
	onFormattedLogEntry: (
		logEntry: CollaborationLogEntry,
		formattedLogEntry: LogEntryFormatResponse['formattedResult'],
	) => void;
	apiClient?: ApiClient;
	projectId?: string;
	collaborationId?: string;
	logEntry?: CollaborationLogEntry;
	projectConfig?: ProjectConfig | null; // Project configuration
}

export function MessageEntryTool({
	//type,
	//toolName,
	content,
	//onCopy,
	onFormattedLogEntry,
	apiClient,
	projectId,
	collaborationId,
	logEntry,
	projectConfig,
}: MessageEntryToolProps): JSX.Element {
	const [showToast, setShowToast] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [formatted, setFormatted] = useState<LogEntryFormatResponse | null>(null);

	// Format content using API if available
	useEffect(() => {
		if (!apiClient || !projectId || !collaborationId || !logEntry) return;

		const fetchFormatted = async () => {
			setIsLoading(true);
			try {
				const response = await apiClient.formatLogEntry(
					logEntry.entryType,
					logEntry,
					projectId,
					collaborationId,
				);
				if (response) {
					onFormattedLogEntry(logEntry, response.formattedResult);
					setFormatted(response);
				}
				setFormatted(response);
			} catch (error) {
				console.error('Error formatting tool message:', error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchFormatted();
	}, [logEntry, apiClient, projectId, collaborationId]);

	// Default JSON formatting as fallback
	const formattedContent = JSON.stringify(content, null, 2);
	const highlighted = hljs.highlight(formattedContent, { language: 'json' }).value;

	//const handleCopy = () => {
	//	if (onCopy) {
	//		onCopy(formattedContent);
	//		setShowToast(true);
	//	}
	//};

	// Determine success/error status
	const isSuccess = typeof content === 'object' && content !== null && 'success' in content
		? content.success !== false
		: true;

	return (
		<>
			<div className='bb-tool-message'>
				{/* Loading state */}
				{isLoading && (
					<div className='flex items-center py-3'>
						<div className='animate-spin rounded-full h-4 w-4 border-2 border-blue-500 dark:border-blue-400 border-t-transparent' />
						<span className='ml-2 text-sm text-blue-500 dark:text-blue-400'>Formatting content...</span>
					</div>
				)}

				{/* Status indicator for tool output */}
				{logEntry?.entryType === 'tool_result' && !isLoading && (
					<div
						className={`flex items-center mb-2 text-sm ${
							isSuccess ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
						}`}
					>
						<div
							className={`flex-shrink-0 w-4 h-4 mr-2 rounded-full ${
								isSuccess ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'
							} flex items-center justify-center`}
						>
							{isSuccess
								? (
									<svg className='w-3 h-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth='2'
											d='M5 13l4 4L19 7'
										/>
									</svg>
								)
								: (
									<svg className='w-3 h-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth='2'
											d='M6 18L18 6M6 6l12 12'
										/>
									</svg>
								)}
						</div>
						<span>{isSuccess ? 'Operation completed successfully' : 'Operation failed'}</span>
					</div>
				)}

				{/* API formatted content or fallback */}
				{!isLoading && (
					<div className='overflow-x-auto rounded-md'>
						{formatted?.formattedResult?.content
							? <div dangerouslySetInnerHTML={{ __html: formatted.formattedResult.content as string }} />
							: (
								<pre className='py-3 px-4 bg-gray-50 dark:bg-gray-800 text-sm dark:text-gray-200 rounded-md'>
                                <code
                                    dangerouslySetInnerHTML={{ __html: highlighted }}
                                    className="language-json hljs"
                                />
								</pre>
							)}
					</div>
				)}

				{/* Show parameters and results sections only when using JSON fallback */}
				{!formatted?.formattedResult?.content && !isLoading && content && typeof content === 'object' && (
					<div className='mt-3 space-y-3'>
						{content.parameters && (
							<div className='rounded-md overflow-hidden border border-gray-200 dark:border-gray-700'>
								<div className='px-3 py-2 bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300'>
									Parameters
								</div>
								<div className='p-3 bg-gray-50 dark:bg-gray-800'>
									<pre className='text-xs text-gray-800 dark:text-gray-300 overflow-x-auto'>
                                        {JSON.stringify(content.parameters, null, 2)}
									</pre>
								</div>
							</div>
						)}

						{content.result && (
							<div className='rounded-md overflow-hidden border border-gray-200 dark:border-gray-700'>
								<div className='px-3 py-2 bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300'>
									Result
								</div>
								<div className='p-3 bg-gray-50 dark:bg-gray-800'>
									<pre className='text-xs text-gray-800 dark:text-gray-300 overflow-x-auto'>
                                        {JSON.stringify(content.result, null, 2)}
									</pre>
								</div>
							</div>
						)}
					</div>
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
