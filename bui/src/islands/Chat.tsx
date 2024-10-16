import { useEffect, useRef, useState } from 'preact/hooks';
import { useCallback } from 'preact/hooks';
import { ConversationMetadata } from 'shared/types.ts';

import { marked } from 'marked';
import { IS_BROWSER } from '$fresh/runtime.ts';
import { generateConversationId } from 'shared/conversationManagement.ts';
import { createWebSocketManager } from '../utils/websocketManager.ts';
import { ConversationContinue, ConversationEntry, ConversationResponse, ConversationStart } from 'shared/types.ts';
import type { ConversationLogEntry } from 'shared/types.ts';
//import type { EventPayloadMap } from 'shared/eventManager.ts';
import { ApiClient } from '../utils/apiClient.utils.ts';
import { useSignal } from '@preact/signals';

interface ChatProps {
	//apiHostname: string;
	//apiPort: number;
	//startDir: string;
}

export default function Chat() {
	/*
	console.log('Chat component: Received apiPort:', apiPort);
	if (typeof window !== 'undefined') {
		console.log('Chat component: window.location.href:', window.location.href);
		console.log('Chat component: window.location.hash:', window.location.hash);
	}
	console.log('Chat component: Received apiPort:', apiPort);
 */

	const [selectedConversationId, setSelectedConversationId] = useState<
		string | null
	>(null);
	const [currentConversation, setCurrentConversation] = useState<
		ConversationMetadata | null
	>(null);
	const [conversations, setConversations] = useState<ConversationMetadata[]>(
		[],
	);
	const [isLoadingConversations, setIsLoadingConversations] = useState(false);
	const [input, setInput] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [isWorking, setIsWorking] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const clearConversation = () => {
		conversationEntries.value = [];
		setInput('');
	};
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const [apiHostname, setApiHostname] = useState(() => {
		if (IS_BROWSER) {
			const hash = window.location.hash.slice(1); // Remove the '#'
			const params = new URLSearchParams(hash);
			console.log('Chat component: Received apiHostname:', params.get('apiHostname'));
			return params.get('apiHostname');
		}
		return null;
	});
	const [apiPort, setApiPort] = useState(() => {
		if (IS_BROWSER) {
			const hash = window.location.hash.slice(1); // Remove the '#'
			const params = new URLSearchParams(hash);
			console.log('Chat component: Received apiPort:', params.get('apiPort'));
			return params.get('apiPort');
		}
		return null;
	});
	const [apiUseTls, setApiUseTls] = useState(() => {
		if (IS_BROWSER) {
			const hash = window.location.hash.slice(1); // Remove the '#'
			const params = new URLSearchParams(hash);
			// if blank, set to true - otherwise check for string 'true'
			const useTls = params.get('apiUseTls') === '' ? true : params.get('apiUseTls') === 'true' ? true : false;
			console.log('Chat component: Received apiUseTls:', useTls);
			return useTls;
		}
		return true;
	});
	const [startDir, setStartDir] = useState(() => {
		let startDirFromHash = '';
		if (IS_BROWSER) {
			const hash = window.location.hash.slice(1); // Remove the '#'
			const params = new URLSearchParams(hash);
			console.log('Chat component: Received startDir:', params.get('startDir'));
			startDirFromHash = params.get('startDir') || '';
		}
		if (typeof window !== 'undefined') {
			return (startDirFromHash !== '' ? startDirFromHash : localStorage.getItem('startDir')) || '';
		}
		return startDirFromHash;
	});
	const [conversationId, setConversationId] = useState<string | null>(null);
	const wsManager = useSignal<ReturnType<typeof createWebSocketManager> | null>(
		null,
	);
	const conversationEntries = useSignal<ConversationEntry[]>([]);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const apiClient = useSignal<ApiClient | null>(null);

	useEffect(() => {
		if (selectedConversationId) {
			loadConversation(selectedConversationId);
		}
	}, [selectedConversationId]);

	const startNewConversation = async () => {
		if (!apiClient.value) return;
		try {
			const response = await apiClient.value.post('/api/v1/conversation', {
				startDir,
			});
			if (response.ok) {
				const newConversation = await response.json();
				setSelectedConversationId(newConversation.id);
				setConversationId(newConversation.id);
				setCurrentConversation((prevConversation) => {
					const updatedConversation = {
						...newConversation,
						title: 'New Conversation',
						updatedAt: new Date().toISOString(),
						conversationStats: { conversationTurnCount: 0 },
						tokenUsageConversation: { totalTokensTotal: 0 },
					};
					return prevConversation ? updatedConversation : null;
				});
				conversationEntries.value = [];
				await fetchConversations();
			} else {
				console.error('Failed to create new conversation');
			}
		} catch (error) {
			console.error('Error creating new conversation:', error);
		}
	};

	const handleConversationSelect = (id: string) => {
		console.log('Selected conversation:', id);
		setSelectedConversationId(id);
		loadConversation(id);
	};

	const fetchConversations = async () => {
		console.log('Fetching conversations...');
		if (!apiClient.value) return;
		setIsLoadingConversations(true);
		try {
			console.log('API Client:', apiClient.value);
			const url = `/api/v1/conversation?startDir=${encodeURIComponent(startDir)}&limit=50`;
			console.log('Fetching URL:', url);
			const response = await apiClient.value.get(url);
			console.log('Response:', response);
			if (response.ok) {
				const data = await response.json();
				console.log('Conversations data:', data);
				setConversations(data.conversations);
			} else {
				console.error('Failed to fetch conversations');
			}
		} catch (error) {
			console.error('Error fetching conversations:', error);
		} finally {
			setIsLoadingConversations(false);
		}
	};

	useEffect(() => {
		console.log('Chat component useEffect. apiHostname:', apiHostname);
		console.log('Chat component useEffect. apiPort:', apiPort);
		console.debug(
			'Chat component mounted. IS_BROWSER:',
			IS_BROWSER,
			'apiHostname:',
			apiHostname,
			'apiPort:',
			apiPort,
			'apiUseTls:',
			apiUseTls,
			'startDir:',
			startDir,
		);
		console.log(
			`Initializing API client with baseUrl: ${
				apiUseTls ? 'https' : 'http'
			}://${apiHostname}:${apiPort} in ${startDir}`,
		);
		if (IS_BROWSER && !wsManager.value && apiHostname && apiPort && startDir) {
			console.log('Initializing chat with apiHostname:', apiHostname);
			console.log('Initializing chat with apiPort:', apiPort);
			console.log('Initializing chat with apiUseTls:', apiUseTls);
			console.log('Initializing chat with startDir:', startDir);
			const initializeChat = async () => {
				const baseUrl = `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}`;
				console.log('Chat component: Initializing API client with baseUrl in startDir:', baseUrl, startDir);
				apiClient.value = new ApiClient(baseUrl);
				await fetchConversations();
			};
			initializeChat();
			const newConversationId = generateConversationId();
			setConversationId(newConversationId);

			const manager = createWebSocketManager(apiHostname, parseInt(apiPort), apiUseTls, startDir);
			manager.setConversationId(newConversationId);
			wsManager.value = manager;
			manager.connect();

			return () => {
				manager.disconnect();
			};
		}
	}, [apiHostname, apiPort, apiUseTls, startDir]);

	useEffect(() => {
		if (wsManager.value) {
			//console.log('Subscribing to wsManager');
			const subscription = wsManager.value.subscribe(async (newEntry) => {
				console.debug('Received a newEntry', newEntry);
				if ('logEntry' in newEntry) {
					const formattedEntry = await formatLogEntry(newEntry);
					conversationEntries.value = [
						...conversationEntries.value,
						formattedEntry,
					];
					// Only set isWorking to false when we receive the final answer
					if (newEntry.logEntry.entryType === 'answer') setIsWorking(false);
				} else if ('conversationTitle' in newEntry) {
					wsManager.value!.isReady.value = true;
				}
				// Update current conversation metadata
				if (currentConversation) {
					setCurrentConversation({
						...currentConversation,
						title: newEntry.conversationTitle || currentConversation.title,
						updatedAt: new Date().toISOString(),
						//conversationStats: {
						//	...currentConversation.conversationStats,
						//	conversationTurnCount:
						//		(currentConversation.conversationStats?.conversationTurnCount || 0) +
						//		1,
						//},
						tokenUsageConversation: newEntry.tokenUsageConversation ||
							currentConversation.tokenUsageConversation,
					});
				}
			});

			return () => {
				subscription.unsubscribe();
			};
		}
	}, [wsManager.value, currentConversation]);

	useEffect(() => {
		if (messagesEndRef.current) {
			messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
		}
	}, [conversationEntries.value]);

	const formatLogEntry = async (entry: any) => {
		if (!apiClient.value) return entry;
		try {
			//console.debug('Formatting log entry', entry);
			const formatterResponse = await apiClient.value.post(
				`/api/v1/format_log_entry/browser/${entry.logEntry?.entryType || ''}`,
				{ logEntry: entry.logEntry, startDir },
			);
			if (!formatterResponse.ok) {
				throw new Error(
					`Failed to fetch formatted response: ${formatterResponse.statusText}`,
				);
			}
			const responseContent = await formatterResponse.json();
			return { ...entry, formattedContent: responseContent.formattedContent };
		} catch (error) {
			console.error(`Error formatting log entry: ${error.message}`);
			return {
				...entry,
				formattedContent: entry.logEntry?.content ||
					JSON.stringify(entry.logEntry),
			};
		}
	};

	const loadConversation = async (id: string) => {
		if (wsManager.value) {
			wsManager.value.updateConversation(id);
		}
		if (!apiClient.value) {
			console.error('API client is not initialized');
			return;
		}
		setIsLoading(true);
		try {
			const response = await apiClient.value.get(
				`/api/v1/conversation/${id}?startDir=${encodeURIComponent(startDir)}`,
			);
			if (response.ok) {
				const data = await response.json();
				console.log(data);
				const formattedMessages = await Promise.all(
					data.logEntries.map(async (entry: any) => {
						return await formatLogEntry(entry);
					}),
				);
				conversationEntries.value = formattedMessages;
				setConversationId(id);
				setCurrentConversation({
					...data,
					title: data.title || 'Untitled Conversation',
					updatedAt: data.updatedAt || new Date().toISOString(),
					conversationStats: data.conversationStats ||
						{ conversationTurnCount: formattedMessages.length },
					tokenUsageConversation: data.tokenUsageConversation ||
						{ totalTokensTotal: 0 },
				});
			} else {
				console.error('Failed to load conversation');
			}
		} catch (error) {
			console.error('Error loading conversation:', error);
		} finally {
			setIsLoading(false);
		}
	};

	const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

	const sendMessage = async () => {
		console.debug('Attempting to send message. Input:', input);
		if (!wsManager.value?.isReady.value) {
			console.error('WebSocket is not ready');
			alert(
				'Chat is not ready yet. Please wait for the conversation to start.',
			);
			return;
		}
		setIsWorking(true);
		setIsLoading(true);
		if (input.trim() && wsManager.value) {
			try {
				await wsManager.value.sendMessage({
					conversationId,
					startDir,
					task: 'converse',
					statement: input.trim(),
				});
				setInput('');
				// give input time to update before adjusting height of text area
				await delay(500);
				adjustTextareaHeight();
				// Update current conversation metadata
				//if (currentConversation) {
				//	setCurrentConversation((prev) =>
				//		prev
				//			? ({
				//				...prev,
				//				updatedAt: new Date().toISOString(),
				//				conversationStats: {
				//					...prev.conversationStats,
				//					conversationTurnCount: (prev.conversationStats?.conversationTurnCount ?? 0) + 1,
				//				},
				//			})
				//			: {}
				//	);
				//}
			} catch (error) {
				console.error('Error sending message:', error);
				console.error('WebSocket manager state at error:', wsManager.value);
				setError('Failed to send message. Please try again.');
				setIsWorking(false);
			}
		}
		setIsLoading(false);
		// Note: We're not setting isWorking to false here anymore
	};

	const handleInputChange = (e: Event) => {
		const target = e.target as HTMLTextAreaElement;
		setInput(target.value);
		adjustTextareaHeight();
	};

	const adjustTextareaHeight = () => {
		if (textareaRef.current) {
			textareaRef.current.style.height = 'auto';
			textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
		}
	};

	const copyToClipboard = useCallback((text: string) => {
		navigator.clipboard.writeText(text).then(() => {
			alert('Copied to clipboard!');
		}).catch((err) => {
			console.error('Failed to copy text: ', err);
		});
	}, []);

	const renderEntry = (entry: ConversationEntry, index: number) => {
		//console.debug('renderEntry: ', entry);
		const renderTitle = (logEntry: ConversationLogEntry) => {
			return logEntry.entryType === 'tool_use' ||
					logEntry.entryType === 'tool_result'
				? (
					(logEntry.entryType === 'tool_use' ? 'Tool Input' : 'Tool Output') +
					` (${logEntry.toolName})`
				)
				: logEntry.entryType === 'answer'
				? 'Answer from Assistant'
				: (
					logEntry.entryType.charAt(0).toUpperCase() + logEntry.entryType.slice(1)
				);
		};
		const renderContent = (content: any) => {
			if (typeof content === 'string') {
				return marked(content);
				//return content;
			} else if (Array.isArray(content)) {
				return content.map((part, i) => {
					if (typeof part === 'string') {
						return marked(part);
						//return part;
					} else if (part.type === 'text') {
						return marked(part.text);
						//return part.text;
					} else if (part.type === 'tool_use' || part.type === 'tool_result') {
						return `<div class="tool-message"><strong>${
							part.type === 'tool_use' ? 'Tool Input' : 'Tool Output'
						}:</strong><div class="overflow-x-auto"><pre class="whitespace-pre p-2 bg-gray-100 rounded" style="max-width: 100%">${
							JSON.stringify(part, null, 2)
						}</pre></div></div>`;
					}
					return '';
				}).join('');
			}
			return JSON.stringify(content);
		};
		if ('logEntry' in entry) {
			const bgColor = entry.logEntry.entryType === 'user'
				? 'bg-blue-100'
				: entry.logEntry.entryType === 'assistant' ||
						entry.logEntry.entryType === 'answer'
				? 'bg-green-100'
				: entry.logEntry.entryType === 'tool_use' ||
						entry.logEntry.entryType === 'tool_result'
				? 'bg-yellow-100'
				: entry.logEntry.entryType === 'auxiliary'
				? 'bg-purple-100'
				: 'bg-red-100';

			return (
				<div
					key={index}
					className={`p-4 rounded-lg mb-4 ${bgColor} shadow-md transition-all duration-300 hover:shadow-lg relative`}
				>
					<div className='font-semibold mb-2 flex justify-between items-center'>
						<span>
							{renderTitle(entry.logEntry)}
						</span>
						<button
							onClick={() => copyToClipboard(renderContent(entry.logEntry.content) as string)}
							className='text-sm bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 transition-colors duration-300'
						>
							Copy
						</button>
					</div>
					<div
						className='max-w-none'
						dangerouslySetInnerHTML={{
							__html: renderContent(entry.formattedContent) as string,
						}}
					/>
					<div className='text-xs text-gray-500 mt-2'>
						{new Date(entry.timestamp).toLocaleString()}
						<br />
						Tokens: {entry.tokenUsageTurn?.totalTokens || 0} | Total:{' '}
						{entry.tokenUsageConversation.totalTokensTotal}
					</div>
				</div>
			);
		} else {
			return (
				<div
					key={index}
					className='bg-red-100 p-4 rounded-lg mb-4 shadow-md transition-all duration-300 hover:shadow-lg'
				>
					<div className='font-semibold mb-2'>Error</div>
					<div className='max-w-none'>
						Unknown Entry
					</div>
				</div>
			);
		}
	};

	return (
		<div className='flex flex-col h-screen bg-gray-100'>
			<header className='bg-blue-600 text-white p-4 shadow-md'>
				<h1 className='text-2xl font-bold'>BB Chat Interface</h1>
			</header>
			<main className='flex-grow flex flex-col md:flex-row p-4 space-y-4 md:space-y-0 md:space-x-4 overflow-hidden'>
				{error && (
					<div
						className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4'
						role='alert'
					>
						<strong className='font-bold'>Generic Error:</strong>
						<span className='block sm:inline'>{error}</span>
						<span
							className='absolute top-0 bottom-0 right-0 px-4 py-3'
							onClick={() => setError(null)}
						>
							<svg
								className='fill-current h-6 w-6 text-red-500'
								role='button'
								xmlns='http://www.w3.org/2000/svg'
								viewBox='0 0 20 20'
							>
								<title>Close</title>
								<path d='M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z' />
							</svg>
						</span>
					</div>
				)}
				{/* Conversation List */}
				<div className='w-full md:w-64 lg:w-80 bg-white rounded-lg shadow-md p-4 overflow-y-auto flex-shrink-0 max-h-screen'>
					<div className='flex justify-between items-center mb-4'>
						<h2 className='text-xl font-semibold'>Conversations</h2>
						<button
							onClick={startNewConversation}
							className='bg-blue-500 text-white px-3 py-1 rounded-md hover:bg-blue-600 transition-colors duration-300'
						>
							New
						</button>
					</div>
					{isLoadingConversations ? <p>Loading conversations...</p> : (
						<ul>
							{[...conversations].sort((a, b) =>
								new Date(b.updatedAt).getTime() -
								new Date(a.updatedAt).getTime()
							).map((conv) => (
								<li
									key={conv.id}
									className={`p-2 mb-2 rounded cursor-pointer ${
										selectedConversationId === conv.id ? 'bg-blue-100' : 'hover:bg-gray-100'
									}`}
									onClick={() => handleConversationSelect(conv.id)}
								>
									<h3 className='font-semibold'>{conv.title}</h3>
									<p className='text-xs text-gray-500'>ID: {conv.id}</p>
									<p className='text-sm'>
										Updated: {new Date(conv.updatedAt).toLocaleString()}
									</p>
									{conv.conversationStats && (
										<p className='text-sm'>
											Turns: {conv.conversationStats.conversationTurnCount}
										</p>
									)}
									{conv.tokenUsageConversation && (
										<p className='text-sm'>
											Tokens: {conv.tokenUsageConversation.totalTokensTotal
												.toLocaleString()}
										</p>
									)}
								</li>
							))}
						</ul>
					)}
				</div>
				{/* Conversation List Panel */}

				{/* Chat Interface */}
				<div className='flex-grow flex flex-col space-y-4 overflow-hidden md:ml-4 min-w-0 max-w-full'>
					{wsManager.value?.error.value && !error && (
						<div
							className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative animate-pulse'
							role='alert'
						>
							<strong className='font-bold'>Error:</strong>
							<span className='block sm:inline'>
								{wsManager.value.error.value}
							</span>
						</div>
					)}
					<div className='bg-white p-4 rounded-lg shadow-md'>
						<div className='flex items-start space-x-4'>
							<div className='flex-shrink-0 w-1/4'>
								<label
									htmlFor='startDir'
									className='block text-sm font-medium text-gray-700 mb-1'
								>
									Project Directory:
								</label>
								<input
									type='text'
									id='startDir'
									value={startDir}
									onChange={(e) => {
										const newStartDir = e.currentTarget.value;
										setStartDir(newStartDir);
										localStorage.setItem('startDir', newStartDir);
										wsManager.value?.setStartDir(e.currentTarget.value);
										fetchConversations();
									}}
									className='w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300'
									placeholder='Enter project path'
								/>
							</div>
							{currentConversation && (
								<div className='flex-grow grid grid-cols-3 gap-2'>
									<div>
										<p className='text-xs text-gray-500'>Title & ID</p>
										<p className='text-sm text-gray-600'>
											{currentConversation.title}
										</p>
										<p className='text-xs text-gray-600'>
											{currentConversation.id}
										</p>
									</div>
									<div>
										<p className='text-xs text-gray-500'>Updated</p>
										<p className='text-sm text-gray-600'>
											{new Date(currentConversation.updatedAt).toLocaleString()}
										</p>
									</div>
									<div>
										<p className='text-xs text-gray-500'>Turns & Tokens</p>
										<p className='text-sm text-gray-600'>
											Turns: {currentConversation.conversationStats
												?.conversationTurnCount || 0}
										</p>
										<p className='text-sm text-gray-600'>
											Tokens: {currentConversation.tokenUsageConversation
												?.totalTokensTotal
												.toLocaleString() || 0}
										</p>
									</div>
								</div>
							)}
						</div>
					</div>
					<div className='flex justify-between items-center mb-4'>
						<h2 className='text-xl font-semibold'>Conversation</h2>
						<button
							onClick={clearConversation}
							className='bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600 transition-colors duration-300'
						>
							Clear Conversation
						</button>
					</div>
					<div
						className='flex-grow overflow-y-auto bg-white rounded-lg shadow-md p-4'
						ref={messagesEndRef}
					>
						{conversationEntries.value.map((entry, index) => renderEntry(entry, index))}
					</div>
					<div className='bg-white p-4 rounded-lg shadow-md'>
						{isWorking && (
							<div className='flex items-center justify-center mb-4'>
								<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500'>
								</div>
								<span className='ml-2 text-blue-500'>Claude is working...</span>
							</div>
						)}
						<div className='flex items-end space-x-2'>
							<div className='flex-grow relative'>
								<textarea
									ref={textareaRef}
									value={input}
									onInput={handleInputChange}
									onKeyPress={(e) =>
										e.key === 'Enter' && !e.shiftKey &&
										(e.preventDefault(), sendMessage())}
									className='w-full p-2 border rounded-lg resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300'
									placeholder='Type your message... (Shift + Enter for new line)'
									rows={1}
								/>
								<span className='absolute bottom-2 right-2 text-xs text-gray-400'>
									{input.length} / 4000
								</span>
							</div>
							<button
								onClick={sendMessage}
								className='bg-blue-500 text-white p-2 rounded-lg transition-all duration-300 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50'
								disabled={isLoading}
							>
								{isLoading
									? (
										<svg
											className='animate-spin h-5 w-5 text-white'
											xmlns='http://www.w3.org/2000/svg'
											fill='none'
											viewBox='0 0 24 24'
										>
											<circle
												className='opacity-25'
												cx='12'
												cy='12'
												r='10'
												stroke='currentColor'
												stroke-width='4'
											>
											</circle>
											<path
												className='opacity-75'
												fill='currentColor'
												d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
											>
											</path>
										</svg>
									)
									: (
										'Send'
									)}
							</button>
						</div>
					</div>
				</div>
			</main>
		</div>
	);
}
