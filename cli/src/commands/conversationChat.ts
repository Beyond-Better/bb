import { Command } from 'cliffy/command/mod.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { TerminalHandler } from '../utils/terminalHandler.utils.ts';
import { logger } from 'shared/logger.ts';
import ApiClient from 'cli/apiClient.ts';
import WebsocketManager from 'cli/websocketManager.ts';
import type {
	ConversationContinue,
	ConversationId,
	ConversationResponse,
	ConversationStart,
	ProgressStatusMessage,
	PromptCacheTimerMessage,
} from 'shared/types.ts';
import { ApiStatus } from 'shared/types.ts';
import { checkApiStatus } from '../utils/apiStatus.utils.ts';
import { getApiStatus, startApiServer, stopApiServer } from '../utils/apiControl.utils.ts';
import { getBbDir, getProjectId, getProjectRootFromStartDir } from 'shared/dataDir.ts';
import { addToStatementHistory } from '../utils/statementHistory.utils.ts';
import { generateConversationId } from 'shared/conversationManagement.ts';
import { eventManager } from 'shared/eventManager.ts';
import { ConfigManagerV2 } from 'shared/config/v2/configManager.ts';
import type { ApiConfig } from 'shared/config/v2/types.ts';

export const conversationChat = new Command()
	.name('chat')
	.description('Start a new conversation or continue an existing one')
	.option('-p, -s, --statement <string>', 'Statement (or question) to start or continue the conversation')
	.option('-i, --id <string>', 'Conversation ID to continue (optional)')
	.option('-m, --model <string>', 'LLM model to use for the conversation')
	.option('--max-turns <number:number>', 'Maximum number of turns in the conversation')
	.option('--json', 'Return JSON instead of plain text')
	.action(async (options) => {
		let projectId;
		try {
			const startDir = Deno.cwd();
			const projectRoot = await getProjectRootFromStartDir(startDir);
			projectId = await getProjectId(projectRoot);
		} catch (_error) {
			//console.error(`Could not set ProjectId: ${(error as Error).message}`);
			console.error('Not a valid project directory. Run `bb init`.');
			Deno.exit(1);
		}

		let apiStartedByUs = false;
		const configManager = await ConfigManagerV2.getInstance();
		const globalConfig = await configManager.getGlobalConfig();
		let apiConfig: ApiConfig;
		if (projectId) {
			const projectConfig = await configManager.getProjectConfig(projectId);
			apiConfig = projectConfig.settings.api as ApiConfig || globalConfig.api;
		} else {
			apiConfig = globalConfig.api;
		}
		const bbDir = projectId ? await getBbDir(projectId) : (Deno.env.get('HOME') || '');

		const apiHostname = apiConfig.hostname || 'localhost';
		const apiPort = apiConfig.port || 3162; // cast as string
		const apiUseTls = typeof apiConfig.tls?.useTls !== 'undefined' ? apiConfig.tls.useTls : false;
		const apiClient = await ApiClient.create(projectId, apiHostname, apiPort, apiUseTls);
		const websocketManager = new WebsocketManager();

		let terminalHandler: TerminalHandler | null = null;
		let conversationId: ConversationId;
		let conversationTitle: string | undefined;

		const handleInterrupt = async () => {
			if (terminalHandler && terminalHandler.isStatementInProgress()) {
				if (conversationId) {
					console.log('\nCancelling current statement...');
					websocketManager.sendCancellationMessage(conversationId);
				} else {
					console.log("\nCan't cancel without conversation ID...");
				}
				terminalHandler?.cancelStatement('Waiting for Claude to finish speaking...');
			} else {
				console.log('\nCleaning up...');
				await exit();
			}
		};

		const cleanup = async () => {
			// Ensure API is stopped when the process exits
			if (apiStartedByUs) {
				await stopApiServer(projectId);
			}
		};
		const exit = async (code: number = 0) => {
			await cleanup();
			Deno.exit(code);
		};
		// Additional signal listeners will be added after terminalHandler is initialized
		Deno.addSignalListener('SIGTERM', exit);

		try {
			// Check API status with enhanced checking
			const processStatus = await checkApiStatus(projectId);
			if (!processStatus.apiResponds) {
				if (processStatus.pidExists) {
					console.log('BB server process exists but is not responding. Attempting restart...');
					await stopApiServer(projectId);
				} else {
					console.log('BB server is not running. Starting it now...');
				}

				const { pid: _pid, apiLogFilePath: _apiLogFilePath, listen: _listen } = await startApiServer(
					projectId,
					apiHostname,
					`${apiPort}`,
				);
				// Check if the API is running with enhanced status checking
				let apiRunning = false;
				const maxAttempts = 5;
				const delayMs = 250;

				await new Promise((resolve) => setTimeout(resolve, delayMs * 2));
				for (let attempt = 1; attempt <= maxAttempts; attempt++) {
					const processStatus = await checkApiStatus(projectId);
					const status = await getApiStatus(projectId);

					if (processStatus.apiResponds && status.running) {
						apiRunning = true;
						break;
					}

					// Provide detailed status information
					if (processStatus.pidExists && !processStatus.apiResponds) {
						console.error(colors.yellow(
							`BB server process exists but is not responding [${attempt}/${maxAttempts}]. PID: ${processStatus.pid}`,
						));
					} else if (!processStatus.pidExists) {
						console.error(colors.yellow(
							`BB server process not found [${attempt}/${maxAttempts}]. Starting up...`,
						));
					}

					if (status.error) {
						console.error(
							colors.yellow(`BB server status check [${attempt}/${maxAttempts}]: ${status.error}`),
						);
					}

					await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
				}
				if (!apiRunning) {
					const finalStatus = await checkApiStatus(projectId);
					if (finalStatus.pidExists && !finalStatus.apiResponds) {
						throw new Error(
							`BB server process (PID: ${finalStatus.pid}) exists but is not responding. Try stopping the server first.`,
						);
					} else {
						throw new Error('Failed to start the BB server: ' + (finalStatus.error || 'unknown error'));
					}
				} else {
					apiStartedByUs = true;
					const finalStatus = await checkApiStatus(projectId);
					console.log(colors.bold.green(`BB server started successfully (PID: ${finalStatus.pid}).`));
				}
			}

			conversationId = options.id || generateConversationId();
			let statement = options.statement?.trim();

			const stdin = Deno.stdin;
			// if we got a statement passed on cli, or if we're not running in terminal then must be getting stdin
			if (statement || (!statement && !stdin.isTerminal())) {
				// no statement passed, so must be stdin, read all the lines
				if (!statement) {
					const input = [];
					const reader = stdin.readable.getReader();
					try {
						while (true) {
							const { done, value } = await reader.read();
							if (done) break;
							input.push(new TextDecoder().decode(value));
						}
					} finally {
						reader.releaseLock();
					}
					if (input.length === 0) {
						console.error('No input provided. Use -p option or provide input via STDIN.');
						Deno.exit(1);
					}

					statement = input.join('\n');
				}
				// we've got a statement now; either passed as cli arg or read from stdin
				const response = await apiClient.post(`/api/v1/conversation/${conversationId}`, {
					statement: statement,
					//model: options.model,
					projectId: projectId,
					maxTurns: options.maxTurns,
				});

				if (response.ok) {
					const data = await response.json();

					terminalHandler = await new TerminalHandler(projectId).init();
					await terminalHandler.displayConversationComplete(data, options);
				} else {
					const errorBody = await response.text();
					console.error(JSON.stringify(
						{
							error: `Failed to ${conversationId ? 'continue' : 'start'} conversation`,
							status: response.status,
							body: errorBody,
						},
						null,
						2,
					));
					logger.error(`BB server request failed: ${response.status} ${response.statusText}`);
					logger.error(`Error body: ${errorBody}`);
				}
			} else {
				terminalHandler = await new TerminalHandler(projectId).init();
				await terminalHandler.initializeTerminal();

				// Spinner is now managed by terminalHandler
				terminalHandler.startSpinner('Setting up...');

				// Now that terminalHandler is initialized, we can add the signal listeners
				Deno.addSignalListener('SIGINT', handleInterrupt);
				Deno.addSignalListener('SIGTERM', exit);

				// 				console.log(`Waiting for 2 mins.`);
				// 	await new Promise((resolve) => setTimeout(resolve, 120000));
				await websocketManager.setupWebsocket(conversationId, projectId, apiHostname, apiPort);

				// Set up event listeners
				let conversationChatDisplayed = false;

				// Handle new conversation metadata
				eventManager.on('cli:conversationNew', async (data) => {
					conversationTitle = (data as ConversationStart).conversationTitle;
					if (!terminalHandler) {
						logger.error(
							`Terminal handler not initialized for conversation ${conversationId} and event cli:conversationNew`,
						);
					}
					await terminalHandler?.displayConversationStart(
						data as ConversationStart,
						conversationId,
						true,
					);
					conversationChatDisplayed = true;
				}, conversationId);

				eventManager.on('cli:conversationReady', async (data) => {
					// For existing conversations, get title from ready event
					if (!conversationTitle) {
						conversationTitle = (data as ConversationStart).conversationTitle;
					}
					// Only display start if we haven't received conversationNew
					if (!conversationChatDisplayed) {
						if (!terminalHandler) {
							logger.error(
								`Terminal handler not initialized for conversation ${conversationId} and event cli:conversationReady`,
							);
						}
						await terminalHandler?.displayConversationStart(
							data as ConversationStart,
							conversationId,
							true,
						);
						conversationChatDisplayed = true;
					}
				}, conversationId);

				eventManager.on('cli:conversationContinue', async (data) => {
					if (!terminalHandler) {
						logger.error(
							`Terminal handler not initialized for conversation ${conversationId} and event cli:conversationContinue`,
						);
					}
					// Use stored title if available
					const messageData = {
						...(data as ConversationContinue),
						conversationTitle: conversationTitle || (data as ConversationContinue).conversationTitle ||
							'<pending>',
					} as ConversationContinue;
					await terminalHandler?.displayConversationContinue(
						messageData,
						conversationId,
						true,
					);
				}, conversationId);

				eventManager.on('cli:conversationAnswer', async (data) => {
					if (!terminalHandler) {
						logger.error(
							`Terminal handler not initialized for conversation ${conversationId} and event cli:conversationAnswer`,
						);
					}
					// Use stored title if available
					const messageData = {
						...(data as ConversationResponse),
						conversationTitle: conversationTitle || (data as ConversationResponse).conversationTitle ||
							'<pending>',
					} as ConversationResponse;
					await terminalHandler?.displayConversationAnswer(
						messageData,
						conversationId,
						false,
					);
					// Set idle state after answer is displayed
					terminalHandler?.handleProgressStatus({
						type: 'progress_status',
						status: ApiStatus.IDLE,
						statementCount: messageData.conversationStats.statementCount,
						sequence: Number.MAX_SAFE_INTEGER,
						timestamp: Date.now(),
					});
				}, conversationId);

				eventManager.on('cli:conversationError', async (data) => {
					if (!terminalHandler) {
						logger.error(
							`Terminal handler not initialized for conversation ${conversationId} and event cli:conversationError`,
						);
						return;
					}
					await terminalHandler.displayError(data);
				}, conversationId);

				eventManager.on('cli:websocketReconnected', handleWebsocketReconnection);

				// Handle progress status updates
				eventManager.on('cli:progressStatus', async (data) => {
					if (!terminalHandler) {
						logger.error(
							`Terminal handler not initialized for conversation ${conversationId} and event cli:progressStatus`,
						);
						return;
					}
					const message = data as ProgressStatusMessage;
					terminalHandler.handleProgressStatus(message);
				}, conversationId);

				// Handle prompt cache timer updates
				eventManager.on('cli:promptCacheTimer', async (data) => {
					if (!terminalHandler) {
						logger.error(
							`Terminal handler not initialized for conversation ${conversationId} and event cli:promptCacheTimer`,
						);
						return;
					}
					const message = data as PromptCacheTimerMessage;
					terminalHandler.handlePromptCacheTimer(message);
				}, conversationId);

				await websocketManager.waitForReady(conversationId!);

				// Main chat loop
				while (true) {
					terminalHandler.hideSpinner();
					statement = await terminalHandler.getMultilineInput();

					const statementCmd = statement.toLowerCase();
					if (statementCmd === 'exit' || statementCmd === 'quit') {
						console.log('Exiting chat...');
						break;
					}
					if (statement === '') {
						console.log('Ask something first...\n');
						continue;
					}

					// terminalHandler.displayDividerLine();

					try {
						//console.log(`Processing statement using conversationId: ${conversationId}`);
						await processStatement(
							projectId,
							bbDir,
							websocketManager,
							terminalHandler,
							conversationId!,
							statement,
							{
								maxTurns: options.maxTurns,
							},
						);
					} catch (error) {
						logger.error(`Error in chat: ${(error as Error).message}`);
					}
				}
				await cleanup();
				Deno.exit(0);
			}
		} catch (error) {
			if ((error as Error).message.startsWith('Failed to start')) {
				console.error(colors.bold.red((error as Error).message));
				exit(1);
			} else {
				console.error(JSON.stringify(
					{
						error: 'Error in conversation',
						message: (error as Error).message,
					},
					null,
					2,
				));
				logger.error(`Unexpected error: ${(error as Error).message}`);
				logger.error(`Stack trace: ${(error as Error).stack}`);
			}
		} finally {
			await cleanup();
		}
	});

function handleWebsocketReconnection() {
	//console.log(palette.info('WebSocket reconnected. Redrawing prompt...'));
	//redrawPrompt();
}

const processStatement = async (
	projectId: string,
	bbDir: string,
	websocketManager: WebsocketManager,
	terminalHandler: TerminalHandler,
	conversationId: ConversationId,
	statement: string,
	options?: { maxTurns?: number },
): Promise<void> => {
	await addToStatementHistory(bbDir, statement);
	const task = 'converse';
	terminalHandler.startStatement('Claude is thinking...');
	try {
		websocketManager.ws?.send(
			JSON.stringify({ conversationId, projectId, task, statement, options: { maxTurns: options?.maxTurns } }),
		);
		await websocketManager.waitForAnswer(conversationId);
	} finally {
		terminalHandler.stopStatement('Claude is finished');
	}
};
