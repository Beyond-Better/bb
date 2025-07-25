import { Input } from 'cliffy/prompt';
import type { ProgressStatusMessage, PromptCacheTimerMessage } from 'shared/types.ts';
import { DEFAULT_TOKEN_USAGE } from 'shared/types.ts';
import { ApiStatus } from 'shared/types.ts';
import { colors } from 'cliffy/ansi/colors';
import { tty } from 'cliffy/ansi/tty';
import { ansi } from 'cliffy/ansi';
//import { crayon } from 'https://deno.land/x/crayon@3.3.3/mod.ts';
//import { handleInput, handleKeyboardControls, handleMouseControls, Tui } from 'https://deno.land/x/tui@2.1.11/mod.ts';
//import { TextBox } from 'https://deno.land/x/tui@2.1.11/src/components/mod.ts';

//import { unicodeWidth } from '@std/cli';
//import { stripAnsiCode } from '@std/fmt/colors';
import Kia from 'kia-spinner';
import { SPINNERS } from './terminalSpinners.ts';
import ApiClient from 'cli/apiClient.ts';
import CollaborationLogFormatter from 'cli/collaborationLogFormatter.ts';
//import { LLMProviderMessageMeta, LLMProviderMessageResponse } from 'api/types/llms.ts';
//import type { LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import { getStatementHistory } from './statementHistory.utils.ts';
import { getBbDir } from 'shared/dataDir.ts';
import type {
	CollaborationContinue,
	CollaborationId,
	CollaborationNew,
	CollaborationResponse,
	CollaborationStart,
	ProjectId,
	TokenUsage,
} from 'shared/types.ts';
import { getConfigManager } from 'shared/config/configManager.ts';
//import { logger } from 'shared/logger.ts';

type Spinner = Kia;
export type { Spinner };

export const symbols = {
	info: '🛈',
	radioOn: '🔘',
	clockwiseRightAndLeftSemicircleArrows: '🔁',
	arrowDown: '⬇️',
	arrowUp: '⬆️',
	sparkles: '✨',
	speechBalloon: '💬',
	hourglass: '⏳',
};

export const palette = {
	primary: colors.blue,
	secondary: colors.cyan,
	accent: colors.yellow,
	success: colors.green,
	warning: colors.yellow,
	error: colors.red,
	info: colors.magenta,
};

interface StatusMessage {
	status: ApiStatus;
	timestamp: number;
	statementCount: number;
	sequence: number;
	metadata?: {
		toolName?: string;
		error?: string;
	};
}

export class TerminalHandler {
	private formatter!: CollaborationLogFormatter;
	private history: string[] = [];
	private spinner!: Spinner;
	private currentStatus: StatusMessage | null = null;
	private assistantName: string = 'Assistant';
	private statusQueue: StatusMessage[] = [];
	private lastStatusUpdateTime: number = 0;
	private readonly minStatusDisplayTime: number = 500; // ms
	private promptCacheStartTime: number | null = null;
	private promptCacheDuration: number | null = null;
	private statementInProgress: boolean = false;
	private projectId: ProjectId;
	private bbDir!: string;
	private apiClient!: ApiClient;

	constructor(projectId: ProjectId) {
		this.projectId = projectId;
		this.spinner = this.createSpinner('BB warming up...');
	}
	private getStatusColor(status: ApiStatus): (s: string) => string {
		switch (status) {
			case ApiStatus.LLM_PROCESSING:
				return palette.success; // green
			case ApiStatus.TOOL_HANDLING:
				return palette.warning; // yellow
			case ApiStatus.API_BUSY:
				return palette.secondary; // cyan
			case ApiStatus.ERROR:
				return palette.error; // red
			default:
				return palette.info; // magenta
		}
	}

	private getStatusMessage(status: ApiStatus, metadata?: { toolName?: string; error?: string }): string {
		switch (status) {
			case ApiStatus.LLM_PROCESSING:
				return `${this.assistantName || 'Assistant'} is thinking...`;
			case ApiStatus.TOOL_HANDLING:
				return `Running tool: ${metadata?.toolName || 'unknown'}`;
			case ApiStatus.API_BUSY:
				return 'Processing request...';
			case ApiStatus.ERROR:
				return `Error: ${metadata?.error || 'Unknown error'}`;
			default:
				return 'Ready';
		}
	}

	public handleProgressStatus(message: ProgressStatusMessage): void {
		// Ignore messages from previous statements
		if (this.currentStatus && message.statementCount < this.currentStatus.statementCount) {
			return;
		}

		// Add to queue sorted by sequence number
		this.statusQueue.push(message);
		this.statusQueue.sort((a, b) => {
			if (a.statementCount !== b.statementCount) {
				return a.statementCount - b.statementCount;
			}
			return a.sequence - b.sequence;
		});

		this.processStatusQueue();
	}

	public handlePromptCacheTimer(message: PromptCacheTimerMessage): void {
		this.promptCacheStartTime = message.startTimestamp;
		this.promptCacheDuration = message.duration;
	}

	private processStatusQueue(): void {
		const now = Date.now();
		const timeSinceLastUpdate = now - this.lastStatusUpdateTime;

		// If we haven't waited long enough since the last update, schedule a check
		if (this.currentStatus && timeSinceLastUpdate < this.minStatusDisplayTime) {
			setTimeout(() => this.processStatusQueue(), this.minStatusDisplayTime - timeSinceLastUpdate);
			return;
		}

		// If queue is empty, nothing to do
		if (this.statusQueue.length === 0) return;

		// Get the last message in the current batch (messages for the same statement)
		const currentMessage = this.statusQueue[0];
		const currentStatementCount = currentMessage.statementCount;
		let lastMessageInBatch = currentMessage;
		let batchSize = 1;

		// Look ahead to find all messages in the same batch
		for (let i = 1; i < this.statusQueue.length; i++) {
			if (this.statusQueue[i].statementCount === currentStatementCount) {
				lastMessageInBatch = this.statusQueue[i];
				batchSize++;
			} else {
				break;
			}
		}

		// If we have multiple messages in the batch and the last one is recent
		if (batchSize > 1 && lastMessageInBatch.timestamp + (this.minStatusDisplayTime / 2) > now) {
			// Wait a short time to see if more messages arrive
			setTimeout(() => this.processStatusQueue(), this.minStatusDisplayTime / 2);
			return;
		}

		// Process the last message in the batch
		this.currentStatus = lastMessageInBatch;
		this.lastStatusUpdateTime = now;
		// Remove all messages up to and including the one we're processing
		this.statusQueue.splice(0, batchSize);

		// Update the spinner with the new status
		const statusColor = this.getStatusColor(lastMessageInBatch.status);
		let statusMessage = statusColor(this.getStatusMessage(lastMessageInBatch.status, lastMessageInBatch.metadata));

		// Show prompt cache timer if applicable
		if (
			lastMessageInBatch.status === ApiStatus.LLM_PROCESSING && this.promptCacheStartTime &&
			this.promptCacheDuration
		) {
			const elapsed = now - this.promptCacheStartTime;
			const remaining = Math.max(0, this.promptCacheDuration - elapsed);
			if (remaining > 0) {
				statusMessage += palette.info(` (Cache: ${Math.ceil(remaining / 1000)}s)`);
			}
		}
		this.startSpinner(statusMessage);

		// If there are more messages, schedule the next check
		if (this.statusQueue.length > 0) {
			setTimeout(() => this.processStatusQueue(), this.minStatusDisplayTime);
		}
	}

	public async init(): Promise<TerminalHandler> {
		this.bbDir = await getBbDir(this.projectId);
		this.loadHistory();
		this.formatter = await new CollaborationLogFormatter().init(this.projectId);

		const configManager = await getConfigManager();
		const projectConfig = await configManager.getProjectConfig(this.projectId);
		if (projectConfig.myAssistantsName) this.assistantName = projectConfig.myAssistantsName;

		return this;
	}

	public async initializeTerminal(): Promise<void> {
		tty
			//.cursorSave
			//.cursorHide
			.cursorTo(0, 0)
			.eraseScreen();

		console.log(
			ansi.cursorTo(0, 0) +
				ansi.eraseDown() +
				//ansi.image(imageBuffer, {
				//	width: 2,
				//	preserveAspectRatio: true,
				//}) + '  ' +
				ansi.cursorTo(6, 2) +
				colors.bold.blue.underline('BB') + colors.bold.blue(' - Beyond Better - with code and docs'),
			//colors.bold.blue(ansi.link('BB', 'https://beyondbetter.app')) +
			//+ '\n',
		);
		this.apiClient = await ApiClient.create(this.projectId);
	}

	/*
	public async getMultilineInput(): Promise<string> {
		console.log('Enter your multi-line input (Ctrl+D to finish):');
		const lines: string[] = [];
		const decoder = new TextDecoder();

		while (true) {
			const buffer = new Uint8Array(1024);
			const readResult = await Deno.stdin.read(buffer);

			if (readResult === null) {
				// EOF (Ctrl+D) detected
				break;
			}

			const chunk = decoder.decode(buffer.subarray(0, readResult));
			const chunkLines = chunk.split('\n');

			if (chunkLines.length > 1) {
				// Add all but the last line to the lines array
				lines.push(...chunkLines.slice(0, -1));
				// Print the lines as they are entered
				chunkLines.slice(0, -1).forEach((line) => console.log(line));
			}

			// Keep the last line (which might be incomplete) in the buffer
			const lastLine = chunkLines[chunkLines.length - 1];
			if (lastLine.endsWith('\r')) {
				lines.push(lastLine.slice(0, -1));
				console.log(lastLine.slice(0, -1));
			} else {
				// Move the cursor to the beginning of the line and clear it
				Deno.stdout.writeSync(new TextEncoder().encode('\r\x1b[K' + lastLine));
			}
		}

		console.log('\nInput finished.');
		return lines.join('\n');
	}
	 */
	public async getMultilineInput(): Promise<string> {
		const history = await this.loadHistory();
		const input = await Input.prompt({
			message: 'Ask Assistant',
			prefix: '👤  ',
			//files: true,
			info: true,
			//list: true,
			suggestions: history,
			//completeOnEmpty: true,
			//history: {
			//	enable: true,
			//	persistent: true,
			//},
			//suggestions: [
			//	'apiStart',
			//	'apiStatus',
			//],
			//transform: (input: string) => highlight(input, { language: 'plaintext' }).value,
		});
		return input;
	}
	/*
	public async getMultilineInput(): Promise<string> {
		let inputValue = '';
		const handleKeyPress = (event: KeyboardEvent) => {
			if (event.ctrlKey && event.key === 'd') {
				tui.emit('destroy');
				resolve(inputValue);
			}
		};
		globalThis.addEventListener('keydown', handleKeyPress);
		return new Promise((resolve) => {
			const handleSubmit = (value: string) => {
				resolve(value);
			};

			const saveHistory = (value: string) => {
				if (!this.history.includes(value)) {
					this.history.push(value);
					this.saveHistory();
				}
			};

			renderMultilineInput({
				onSubmit: handleSubmit,
				history: this.history,
				saveHistory: saveHistory,
			});
		});
	}
	*/

	private async loadHistory(): Promise<string[]> {
		// TODO: Implement loading history from file or database
		this.history = await getStatementHistory(this.bbDir);
		return this.history;
	}

	//private async saveHistory(): Promise<void> {
	//	// TODO: Implement saving history to file or database
	//}

	public displayDividerLine(): void {
		const cols = this.formatter.maxLineLength;
		console.log(palette.secondary(`╭${'─'.repeat(cols - 2)}╮`));
	}

	public async displayCollaborationStart(
		data: CollaborationStart | CollaborationNew,
		collaborationId?: CollaborationId,
		expectingMoreInput: boolean = true,
	): Promise<void> {
		if (this.spinner) this.hideSpinner();
		collaborationId = data.collaborationId;

		if (!data.collaborationId) {
			console.log('Entry has no collaborationId', data);
			return;
		}

		const { collaborationTitle } = data;
		if (!collaborationTitle) {
			console.log('Warning: No collaboration title available');
			return;
		}
		const statementCount = data.interactionStats?.statementCount || 1;
		const shortTitle = collaborationTitle ? collaborationTitle.substring(0, 30) : '<pending>';

		const { columns } = Deno.consoleSize();
		const isNarrow = columns < 80;
		const leftPadding = '  ';

		const formatLine = (label: string, value: string, color: (s: string) => string) => {
			return color(`${leftPadding}${label}: ${value}`);
		};

		const lines = [
			formatLine('ID', collaborationId.substring(0, 8), palette.accent),
			formatLine('Title', shortTitle, palette.info),
			formatLine('Statement', statementCount.toString(), palette.success),
		];

		const output = isNarrow ? lines.join('\n') : lines.join('  ');

		console.log(palette.primary(`${leftPadding}${symbols.sparkles} Conversation Started ${symbols.sparkles}`));
		console.log(output);
		console.log('');

		if (expectingMoreInput && this.spinner) {
			this.startSpinner(`${this.assistantName} is thinking...`);
		}
	}

	public async displayCollaborationContinue(
		data: CollaborationContinue,
		collaborationId: CollaborationId,
		expectingMoreInput: boolean = false,
	): Promise<void> {
		// Ensure all optional properties are handled
		const {
			logEntry,
			timestamp,
			interactionStats = {
				statementCount: 1,
				statementTurnCount: 1,
				interactionTurnCount: 1,
			},
			tokenUsageStatsForCollaboration = {
				tokenUsageStatement: DEFAULT_TOKEN_USAGE(),
			},
		} = data;
		collaborationId = data.collaborationId;

		if (!logEntry) {
			console.log('Entry has no content', data);
			return;
		}

		try {
			const formatterResponse = await this.apiClient.post(
				`/api/v1/format_log_entry/console/${logEntry.entryType}`,
				{ logEntry, projectId: this.projectId, collaborationId },
			);

			if (!formatterResponse.ok) {
				throw new Error(`Failed to fetch formatted response: ${formatterResponse.statusText}`);
			} else {
				const responseContent = await formatterResponse.json();
				//console.log('TerminalHandler: responseContent', responseContent);
				const formattedContent = responseContent.formattedContent;
				const formattedResult = responseContent.formattedResult;
				const formattedEntry = await this.formatter.formatLogEntry(
					logEntry.entryType,
					timestamp,
					//this.highlightOutput(formattedContent),
					formattedContent,
					formattedResult,
					interactionStats,
					tokenUsageStatsForCollaboration.tokenUsageStatement,
					logEntry.toolName,
				);

				if (this.spinner) this.hideSpinner();

				console.log(formattedEntry);
			}
		} catch (error) {
			console.error(`Error formatting log entry: ${(error as Error).message}`);
			// Fallback to basic formatting
			console.log(`${logEntry.entryType.toUpperCase()}: ${logEntry.content}`);
		}

		if (expectingMoreInput && this.spinner) {
			this.startSpinner(`${this.assistantName} is thinking...`);
		}
	}

	public async displayCollaborationAnswer(
		data: CollaborationResponse,
		collaborationId?: CollaborationId,
		expectingMoreInput: boolean = false,
	): Promise<void> {
		//logger.debug(`displayCollaborationAnswer called with data: ${JSON.stringify(data)}`);
		this.hideSpinner();
		collaborationId = data.collaborationId;

		if (!data.logEntry) {
			console.log('Entry has no logEntry', data);
			return;
		}

		const {
			collaborationTitle,
			interactionStats = data.interactionStats, //{ statementCount: 1, statementTurnCount: 1, interactionTurnCount: 1 },
			tokenUsageStatsForCollaboration = {
				tokenUsageStatement: {
					inputTokens: data.tokenUsageStatsForCollaboration.tokenUsageStatement.inputTokens,
					outputTokens: data.tokenUsageStatsForCollaboration.tokenUsageStatement.outputTokens,
					totalTokens: data.tokenUsageStatsForCollaboration.tokenUsageStatement.totalTokens,
					thoughtTokens: data.tokenUsageStatsForCollaboration.tokenUsageStatement.thoughtTokens,
					totalAllTokens: data.tokenUsageStatsForCollaboration.tokenUsageStatement.totalAllTokens,
				},
			},
		} = data;

		const timestamp = CollaborationLogFormatter.getTimestamp();
		//const contentPart = data.response.answerContent[0] as LLMMessageContentPartTextBlock;
		const answer = data.logEntry.content as string;
		const content = this.highlightOutput(answer);
		const formattedEntry = await this.formatter.formatLogEntry(
			'assistant',
			timestamp,
			content,
			{ title: '', content },
			interactionStats,
			tokenUsageStatsForCollaboration.tokenUsageStatement,
		);
		console.log(formattedEntry);

		const { columns } = Deno.consoleSize();
		const isNarrow = columns < 100;

		const idShort = collaborationId?.substring(0, 8) || '';
		const titleShort = collaborationTitle?.substring(0, isNarrow ? 10 : 20) || '';

		//logger.debug(`Preparing summary line with interactionStats: ${JSON.stringify(interactionStats)}, tokenUsage: ${JSON.stringify(tokenUsageStatsForCollaboration.tokenUsageStatement)}`);
		const summaryLine = [
			colors.cyan(isNarrow ? 'C' : 'Conv'),
			colors.yellow(isNarrow ? `${idShort}` : `ID:${idShort}`),
			colors.green(isNarrow ? `S${interactionStats.statementCount}` : `St:${interactionStats.statementCount}`),
			colors.magenta(
				isNarrow ? `T${interactionStats.statementTurnCount}` : `Tn:${interactionStats.statementTurnCount}`,
			),
			colors.blue(
				isNarrow ? `TT${interactionStats.interactionTurnCount}` : `TT:${interactionStats.interactionTurnCount}`,
			),
			colors.red(
				isNarrow
					? `↓${tokenUsageStatsForCollaboration.tokenUsageStatement.inputTokens}`
					: `In:${tokenUsageStatsForCollaboration.tokenUsageStatement.inputTokens}`,
			),
			colors.yellow(
				isNarrow
					? `↑${tokenUsageStatsForCollaboration.tokenUsageStatement.outputTokens}`
					: `Out:${tokenUsageStatsForCollaboration.tokenUsageStatement.outputTokens}`,
			),
			colors.green(
				isNarrow
					? `Σ${tokenUsageStatsForCollaboration.tokenUsageStatement.totalTokens}`
					: `Tot:${tokenUsageStatsForCollaboration.tokenUsageStatement.totalTokens}`,
			),
			colors.cyan(isNarrow ? `${titleShort}` : `Title:${titleShort}`),
		].join('  '); // Two spaces between each item

		console.log(summaryLine);

		if (expectingMoreInput && this.spinner) {
			this.startSpinner(`${this.assistantName} is thinking...`);
		}
	}

	public async displayCollaborationComplete(
		response: CollaborationResponse,
		options: { id?: string; json?: boolean },
		_expectingMoreInput: boolean = false,
	): Promise<void> {
		this.hideSpinner();
		const isNewCollaboration = !options.id;
		const { collaborationId, interactionStats, collaborationTitle } = response;
		//const tokenUsageStatement = response.response.usage;
		const tokenUsageInteraction: TokenUsage = {
			inputTokens: response.tokenUsageStatsForCollaboration.tokenUsageStatement.inputTokens,
			outputTokens: response.tokenUsageStatsForCollaboration.tokenUsageStatement.outputTokens,
			totalTokens: response.tokenUsageStatsForCollaboration.tokenUsageStatement.totalTokens,
			thoughtTokens: response.tokenUsageStatsForCollaboration.tokenUsageStatement.thoughtTokens,
			totalAllTokens: response.tokenUsageStatsForCollaboration.tokenUsageStatement.totalAllTokens,
		};

		if (options.json) {
			console.log(JSON.stringify(
				{
					...response,
					isNewCollaboration,
					collaborationId,
					collaborationTitle,
					interactionStats,
					tokenUsageInteraction,
				},
				null,
				2,
			));
		} else {
			//const contentPart = response.response.answerContent[0] as LLMMessageContentPartTextBlock;
			const answer = response.logEntry.content as string;
			console.log(this.highlightOutput(answer));

			console.log(palette.secondary('╭─────────────────────────────────────────────────────╮'));
			console.log(
				palette.secondary('│') +
					palette.primary(` ${symbols.sparkles} Conversation Complete ${symbols.sparkles}`.padEnd(55)) +
					palette.secondary('│'),
			);
			console.log(palette.secondary('├─────────────────────────────────────────────────────┤'));
			console.log(
				palette.secondary('│') + palette.accent(` ID: ${collaborationId}`.padEnd(55)) + palette.secondary('│'),
			);
			console.log(
				palette.secondary('│') + palette.info(` Title: ${collaborationTitle}`.padEnd(55)) +
					palette.secondary('│'),
			);
			console.log(
				palette.secondary('│') +
					palette.success(` ${symbols.info} Statements: ${interactionStats.statementCount}`.padEnd(55)) +
					palette.secondary('│'),
			);
			console.log(
				palette.secondary('│') +
					palette.warning(` ${symbols.radioOn} Turns: ${interactionStats.statementTurnCount}`.padEnd(55)) +
					palette.secondary('│'),
			);
			console.log(
				palette.secondary('│') +
					palette.info(
						` ${symbols.clockwiseRightAndLeftSemicircleArrows} Total Turns: ${interactionStats.interactionTurnCount}`
							.padEnd(53),
					) + palette.secondary('│'),
			);
			console.log(palette.secondary('├─────────────────────────────────────────────────────┤'));
			console.log(
				palette.secondary('│') +
					palette.error(
						` ${symbols.arrowDown} Input Tokens: ${tokenUsageInteraction?.inputTokens}`.padEnd(55),
					) +
					palette.secondary('│'),
			);
			console.log(
				palette.secondary('│') +
					palette.success(
						` ${symbols.arrowUp} Output Tokens: ${tokenUsageInteraction?.outputTokens}`.padEnd(55),
					) +
					palette.secondary('│'),
			);
			console.log(
				palette.secondary('│') +
					palette.primary(
						` ${symbols.radioOn} Total Tokens: ${tokenUsageInteraction?.totalTokens}`.padEnd(55),
					) +
					palette.secondary('│'),
			);
			console.log(palette.secondary('╰─────────────────────────────────────────────────────╯'));
			console.log('');
		}
	}

	public async displayError(data: unknown): Promise<void> {
		let errorMessage: string;

		if (typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string') {
			errorMessage = data.error;
		} else if (typeof data === 'string') {
			errorMessage = data;
		} else {
			console.error('Received invalid error data:', data);
			errorMessage = 'An unknown error occurred';
		}
		this.hideSpinner();
		console.log(palette.error('╭─────────────────────────────────────────────────────╮'));
		console.log(
			palette.error('│') +
				palette.error(` ${symbols.speechBalloon} Error ${symbols.speechBalloon}`.padEnd(55)) +
				palette.error('│'),
		);
		console.log(palette.error('├─────────────────────────────────────────────────────┤'));

		// Split the error message into lines that fit within the box
		const maxLineLength = 53; // 55 - 2 for padding
		const errorLines = [];
		let currentLine = '';
		const words = errorMessage.split(' ');
		for (const word of words) {
			if ((currentLine + word).length > maxLineLength) {
				errorLines.push(currentLine.trim());
				currentLine = '';
			}
			currentLine += word + ' ';
		}
		if (currentLine.trim()) {
			errorLines.push(currentLine.trim());
		}

		// Display each line of the error message
		for (const line of errorLines) {
			console.log(
				palette.error('│') +
					palette.error(` ${line.padEnd(53)}`) +
					palette.error('│'),
			);
		}

		console.log(palette.error('╰─────────────────────────────────────────────────────╯'));
		console.log('');
	}

	private highlightOutput(text: string): string {
		// TODO: Implement syntax highlighting
		//return highlight(text, { language: 'plaintext' }).value;
		return text;
	}

	public isStatementInProgress(): boolean {
		return this.statementInProgress;
	}
	public startStatement(startMessage?: string): void {
		this.statementInProgress = true;
		this.startSpinner(startMessage);
	}
	public cancelStatement(cancelMessage: string = 'Cancelling...'): void {
		this.stopSpinner(cancelMessage);
	}
	public stopStatement(successMessage?: string): void {
		this.statementInProgress = false;
		this.stopSpinner(successMessage);
	}

	public createSpinner(message: string): Spinner {
		return new Kia({
			text: palette.info(message),
			color: 'cyan',
			spinner: SPINNERS.bouncingBar,
		});
	}

	public startSpinner(message?: string): void {
		this.spinner.start(message);
	}
	public stopSpinner(successMessage: string = 'Done'): void {
		this.spinner.stop();
		if (successMessage) {
			console.log(palette.success(successMessage));
		}
	}

	public showSpinner(message?: string): void {
		this.spinner.start(message);
	}
	public hideSpinner(): void {
		this.spinner.stop();
		console.log(ansi.cursorTo(0).eraseLine());
	}
}
