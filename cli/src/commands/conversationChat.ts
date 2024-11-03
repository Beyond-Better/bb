import { Command } from 'cliffy/command/mod.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { TerminalHandler } from '../utils/terminalHandler.utils.ts';
import { logger } from 'shared/logger.ts';
import ApiClient from 'cli/apiClient.ts';
import WebsocketManager from 'cli/websocketManager.ts';
import type { ConversationContinue, ConversationId, ConversationResponse, ConversationStart } from 'shared/types.ts';
import { isApiRunning } from '../utils/pid.utils.ts';
import { getApiStatus, startApiServer, stopApiServer } from '../utils/apiControl.utils.ts';
import { getBbDir, getProjectRoot } from 'shared/dataDir.ts';
import { addToStatementHistory } from '../utils/statementHistory.utils.ts';
import { generateConversationId } from 'shared/conversationManagement.ts';
import { eventManager } from 'shared/eventManager.ts';
import { ConfigManager } from 'shared/configManager.ts';

const startDir = Deno.cwd();

export const conversationChat = new Command()
	.name('chat')
	.description('Start a new conversation or continue an existing one')
	.option('-p, -s, --statement <string>', 'Statement (or question) to start or continue the conversation')
	.option('-i, --id <string>', 'Conversation ID to continue (optional)')
	.option('-m, --model <string>', 'LLM model to use for the conversation')
	.option('--max-turns <number:number>', 'Maximum number of turns in the conversation')
	.option('--json', 'Return JSON instead of plain text')
	.action(async (options) => {
		let apiStartedByUs = false;
		const fullConfig = await ConfigManager.fullConfig(startDir);
		const bbDir = await getBbDir(startDir);
		const projectRoot = await getProjectRoot(startDir);

		const apiHostname = fullConfig.api?.apiHostname || 'localhost';
		const apiPort = fullConfig.api?.apiPort || 3000; // cast as string
		const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
		const apiClient = await ApiClient.create(startDir, apiHostname, apiPort, apiUseTls);
		const websocketManager = new WebsocketManager();

		let terminalHandler: TerminalHandler | null = null;
		let conversationId: ConversationId;

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
				await stopApiServer(projectRoot);
			}
		};
		const exit = async (code: number = 0) => {
			await cleanup();
			Deno.exit(code);
		};
		// Additional signal listeners will be added after terminalHandler is initialized
		Deno.addSignalListener('SIGTERM', exit);

		try {
			// Check if API is running, start it if not
			const apiRunning = await isApiRunning(projectRoot);
			if (!apiRunning) {
				console.log('API is not running. Starting it now...');
				const { pid: _pid, apiLogFilePath: _apiLogFilePath, listen: _listen } = await startApiServer(
					projectRoot,
					apiHostname,
					`${apiPort}`,
				);
				//console.debug(`API running - PID: ${pid} - Log: ${apiLogFilePath} - Listening on: ${listen}.`);

				// Check if the API is running
				let apiRunning = false;
				const maxAttempts = 5;
				const delayMs = 250;

				await new Promise((resolve) => setTimeout(resolve, delayMs * 2));
				for (let attempt = 1; attempt <= maxAttempts; attempt++) {
					const status = await getApiStatus(startDir);
					if (status.running) {
						apiRunning = true;
						break;
					}
					await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
					console.error(colors.yellow(`API status[${attempt}/${maxAttempts}]: ${status.error}`));
				}
				if (!apiRunning) {
					//console.error(colors.bold.red('Failed to start the API server after multiple attempts.'));
					//exit(1);
					throw new Error('Failed to start the API server.');
				} else {
					apiStartedByUs = true;
					console.log(colors.bold.green('API started successfully.'));
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
					startDir: startDir,
					maxTurns: options.maxTurns,
				});

				if (response.ok) {
					const data = await response.json();

					terminalHandler = await new TerminalHandler(startDir).init();
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
					logger.error(`API request failed: ${response.status} ${response.statusText}`);
					logger.error(`Error body: ${errorBody}`);
				}
			} else {
				terminalHandler = await new TerminalHandler(startDir).init();
				await terminalHandler.initializeTerminal();

				// Spinner is now managed by terminalHandler
				terminalHandler.startSpinner('Setting up...');

				// Now that terminalHandler is initialized, we can add the signal listeners
				Deno.addSignalListener('SIGINT', handleInterrupt);
				Deno.addSignalListener('SIGTERM', exit);

				// 				console.log(`Waiting for 2 mins.`);
				// 	await new Promise((resolve) => setTimeout(resolve, 120000));
				await websocketManager.setupWebsocket(conversationId, startDir, apiHostname, apiPort);

				// Set up event listeners
				let conversationChatDisplayed = false;
				eventManager.on('cli:conversationReady', async (data) => {
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
					await terminalHandler?.displayConversationContinue(
						data as ConversationContinue,
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
					await terminalHandler?.displayConversationAnswer(
						data as ConversationResponse,
						conversationId,
						false,
					);
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
						await processStatement(bbDir, websocketManager, terminalHandler, conversationId!, statement, {
							maxTurns: options.maxTurns,
						});
					} catch (error) {
						logger.error(`Error in chat: ${error.message}`);
					}
				}
				await cleanup();
				Deno.exit(0);
			}
		} catch (error) {
			if (error.message.startsWith('Failed to start')) {
				console.error(colors.bold.red(error.message));
				exit(1);
			} else {
				console.error(JSON.stringify(
					{
						error: 'Error in conversation',
						message: error.message,
					},
					null,
					2,
				));
				logger.error(`Unexpected error: ${error.message}`);
				logger.error(`Stack trace: ${error.stack}`);
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
	bbDir: string,
	websocketManager: WebsocketManager,
	terminalHandler: TerminalHandler,
	conversationId: ConversationId,
	statement: string,
	options?: { maxTurns?: number },
): Promise<void> => {
	await addToStatementHistory(bbDir, statement);
	const task = 'converse';
	terminalHandler.startStatement('Claude is working...');
	try {
		websocketManager.ws?.send(
			JSON.stringify({ conversationId, startDir, task, statement, options: { maxTurns: options?.maxTurns } }),
		);
		await websocketManager.waitForAnswer(conversationId);
	} finally {
		terminalHandler.stopStatement('Claude is finished');
	}
};
