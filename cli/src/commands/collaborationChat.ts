import { Command } from 'cliffy/command';
import { colors } from 'cliffy/ansi/colors';
import { TerminalHandler } from '../utils/terminalHandler.utils.ts';
import { logger } from 'shared/logger.ts';
import ApiClient from 'cli/apiClient.ts';
import WebsocketManager from 'cli/websocketManager.ts';
import type {
	CollaborationContinue,
	CollaborationId,
	CollaborationResponse,
	CollaborationStart,
	ProgressStatusMessage,
	ProjectId,
	PromptCacheTimerMessage,
} from 'shared/types.ts';
import { ApiStatus } from 'shared/types.ts';
import { checkApiStatus } from '../utils/apiStatus.utils.ts';
import { getApiStatus, startApiServer, stopApiServer } from '../utils/apiControl.utils.ts';
import { getBbDir, getProjectId, getWorkingRootFromStartDir } from 'shared/dataDir.ts';
import { addToStatementHistory } from '../utils/statementHistory.utils.ts';
import { generateCollaborationId, shortenCollaborationId } from 'shared/utils/generateIds.utils.ts';
import { eventManager } from 'shared/eventManager.ts';
import { getConfigManager } from 'shared/config/configManager.ts';
import type { ApiConfig } from 'shared/config/types.ts';

export const collaborationChat = new Command()
	.name('chat')
	.description('Start a new collaboration or continue an existing one')
	.option('-p, -s, --statement <string>', 'Statement (or question) to start or continue the collaboration')
	.option('-i, --id <string>', 'Collaboration ID to continue (optional)')
	.option('-m, --model <string>', 'LLM model to use for the collaboration')
	.option('--max-turns <number:number>', 'Maximum number of turns in the collaboration')
	.option('--json', 'Return JSON instead of plain text')
	.action(async (options) => {
		let projectId: ProjectId | undefined;
		try {
			const startDir = Deno.cwd();
			const workingRoot = await getWorkingRootFromStartDir(startDir);
			projectId = await getProjectId(workingRoot);
			if (!projectId) throw new Error(`Could not find a project for: ${workingRoot}`);
		} catch (_error) {
			//console.error(`Could not set ProjectId: ${(error as Error).message}`);
			console.error('Not a valid project directory. Run `bb init`.');
			Deno.exit(1);
		}

		let apiStartedByUs = false;
		const configManager = await getConfigManager();
		const globalConfig = await configManager.getGlobalConfig();

		let apiConfig: ApiConfig;

		await configManager.ensureLatestProjectConfig(projectId);
		const projectConfig = await configManager.getProjectConfig(projectId);
		apiConfig = projectConfig.api as ApiConfig || globalConfig.api;
		//console.log(`CollaborationChat: projectId: ${projectId}`);

		const bbDir = projectId ? await getBbDir(projectId) : (Deno.env.get('HOME') || '');

		const apiHostname = apiConfig.hostname || 'localhost';
		const apiPort = apiConfig.port || 3162; // cast as string
		const apiUseTls = typeof apiConfig.tls?.useTls !== 'undefined' ? apiConfig.tls.useTls : false;
		const apiClient = await ApiClient.create(projectId, apiHostname, apiPort, apiUseTls);
		const websocketManager = new WebsocketManager();

		let terminalHandler: TerminalHandler | null = null;
		let collaborationId: CollaborationId;
		let collaborationTitle: string | undefined;

		const handleInterrupt = async () => {
			if (terminalHandler && terminalHandler.isStatementInProgress()) {
				if (collaborationId) {
					console.log('\nCancelling current statement...');
					websocketManager.sendCancellationMessage(collaborationId);
				} else {
					console.log("\nCan't cancel without collaboration ID...");
				}
				terminalHandler?.cancelStatement('Waiting for Assistant to finish speaking...');
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

			collaborationId = options.id || shortenCollaborationId(generateCollaborationId());
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
				const response = await apiClient.post(`/api/v1/collaboration/${collaborationId}`, {
					statement: statement,
					//model: options.model,
					projectId: projectId,
					maxTurns: options.maxTurns,
				});

				if (response.ok) {
					const data = await response.json();

					terminalHandler = await new TerminalHandler(projectId).init();
					await terminalHandler.displayCollaborationComplete(data, options);
				} else {
					const errorBody = await response.text();
					console.error(JSON.stringify(
						{
							error: `Failed to ${collaborationId ? 'continue' : 'start'} collaboration`,
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
				// Windows only supports SIGINT and SIGBREAK, while Unix-like systems support SIGINT and SIGTERM
				Deno.addSignalListener('SIGINT', handleInterrupt);
				if (Deno.build.os === 'windows') {
					Deno.addSignalListener('SIGBREAK', exit);
				} else {
					Deno.addSignalListener('SIGTERM', exit);
				}

				// 				console.log(`Waiting for 2 mins.`);
				// 	await new Promise((resolve) => setTimeout(resolve, 120000));
				await websocketManager.setupWebsocket(collaborationId, projectId, apiHostname, apiPort);

				// Set up event listeners
				let collaborationChatDisplayed = false;

				// Handle new collaboration metadata
				eventManager.on('cli:collaborationNew', async (data) => {
					collaborationTitle = (data as CollaborationStart).collaborationTitle;
					if (!terminalHandler) {
						logger.error(
							`Terminal handler not initialized for collaboration ${collaborationId} and event cli:collaborationNew`,
						);
					}
					await terminalHandler?.displayCollaborationStart(
						data as CollaborationStart,
						collaborationId,
						true,
					);
					collaborationChatDisplayed = true;
				}, collaborationId);

				eventManager.on('cli:collaborationReady', async (data) => {
					// For existing collaborations, get title from ready event
					if (!collaborationTitle) {
						collaborationTitle = (data as CollaborationStart).collaborationTitle;
					}
					// Only display start if we haven't received collaborationNew
					if (!collaborationChatDisplayed) {
						if (!terminalHandler) {
							logger.error(
								`Terminal handler not initialized for collaboration ${collaborationId} and event cli:collaborationReady`,
							);
						}
						await terminalHandler?.displayCollaborationStart(
							data as CollaborationStart,
							collaborationId,
							true,
						);
						collaborationChatDisplayed = true;
					}
				}, collaborationId);

				eventManager.on('cli:collaborationContinue', async (data) => {
					if (!terminalHandler) {
						logger.error(
							`Terminal handler not initialized for collaboration ${collaborationId} and event cli:collaborationContinue`,
						);
					}
					// Use stored title if available
					const messageData = {
						...(data as CollaborationContinue),
						collaborationTitle: collaborationTitle || (data as CollaborationContinue).collaborationTitle ||
							'<pending>',
					} as CollaborationContinue;
					await terminalHandler?.displayCollaborationContinue(
						messageData,
						collaborationId,
						true,
					);
				}, collaborationId);

				eventManager.on('cli:collaborationAnswer', async (data) => {
					if (!terminalHandler) {
						logger.error(
							`Terminal handler not initialized for collaboration ${collaborationId} and event cli:collaborationAnswer`,
						);
					}
					// Use stored title if available
					const messageData = {
						...(data as CollaborationResponse),
						collaborationTitle: collaborationTitle || (data as CollaborationResponse).collaborationTitle ||
							'<pending>',
					} as CollaborationResponse;
					await terminalHandler?.displayCollaborationAnswer(
						messageData,
						collaborationId,
						false,
					);
					// Set idle state after answer is displayed
					terminalHandler?.handleProgressStatus({
						type: 'progress_status',
						status: ApiStatus.IDLE,
						statementCount: messageData.interactionStats.statementCount,
						sequence: Number.MAX_SAFE_INTEGER,
						timestamp: Date.now(),
					});
				}, collaborationId);

				eventManager.on('cli:collaborationError', async (data) => {
					if (!terminalHandler) {
						logger.error(
							`Terminal handler not initialized for collaboration ${collaborationId} and event cli:collaborationError`,
						);
						return;
					}
					await terminalHandler.displayError(data);
				}, collaborationId);

				eventManager.on('cli:websocketReconnected', handleWebsocketReconnection);

				// Handle progress status updates
				eventManager.on('cli:progressStatus', async (data) => {
					if (!terminalHandler) {
						logger.error(
							`Terminal handler not initialized for collaboration ${collaborationId} and event cli:progressStatus`,
						);
						return;
					}
					const message = data as ProgressStatusMessage;
					terminalHandler.handleProgressStatus(message);
				}, collaborationId);

				// Handle prompt cache timer updates
				eventManager.on('cli:promptCacheTimer', async (data) => {
					if (!terminalHandler) {
						logger.error(
							`Terminal handler not initialized for collaboration ${collaborationId} and event cli:promptCacheTimer`,
						);
						return;
					}
					const message = data as PromptCacheTimerMessage;
					terminalHandler.handlePromptCacheTimer(message);
				}, collaborationId);

				await websocketManager.waitForReady(collaborationId!);

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
						//console.log(`Processing statement using collaborationId: ${collaborationId}`);
						await processStatement(
							projectId,
							bbDir,
							websocketManager,
							terminalHandler,
							collaborationId!,
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
						error: 'Error in collaboration',
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
	projectId: ProjectId,
	bbDir: string,
	websocketManager: WebsocketManager,
	terminalHandler: TerminalHandler,
	collaborationId: CollaborationId,
	statement: string,
	options?: { maxTurns?: number },
): Promise<void> => {
	await addToStatementHistory(bbDir, statement);
	const task = 'converse';
	terminalHandler.startStatement('Assistant is thinking...');
	try {
		websocketManager.ws?.send(
			JSON.stringify({ collaborationId, projectId, task, statement, options: { maxTurns: options?.maxTurns } }),
		);
		await websocketManager.waitForAnswer(collaborationId);
	} finally {
		terminalHandler.stopStatement('Assistant is finished');
	}
};
