# Configuration Usage Analysis

## Migration Status

Completed Components:
- CLI Commands (12 files)
- CLI Utils (5 files)

Remaining Components:
- API Server (36 files)
- BUI Components (10 files)

## Common Migration Patterns

1. Property Access Updates:
```typescript
// Old pattern:
config.api.apiHostname
config.api.apiPort
config.api.apiUseTls

// New pattern:
config.api.hostname
config.api.port
config.api.tls.useTls
```

2. Method Name Updates:
```typescript
// Old pattern:
await configManager.setGlobalConfigValue('key', 'value');
await configManager.setProjectConfigValue('key', 'value', dir);

// New pattern:
await configManager.updateGlobalConfig({ key: value });
await configManager.updateProjectConfig(dir, { key: value });
```

3. Instance Creation:
```typescript
// Old pattern:
const configManager = await ConfigManager.getInstance();

// New pattern:
const configManager = await getConfigManager();
```

## Summary
- Total files analyzed: 303
- Files with config usage: 63
- Total config usages found: 573

## Pattern Matches
- ConfigManager\.: 36 occurrences
- config\.: 23 occurrences
- fullConfig: 30 occurrences
- globalConfig: 16 occurrences
- projectConfig: 7 occurrences
- \.api\.: 16 occurrences
- \.bui\.: 1 occurrences
- usePromptCaching: 4 occurrences
- ignoreLLMRequestCache: 3 occurrences
- apiHostname: 19 occurrences
- apiPort: 17 occurrences
- apiUseTls: 18 occurrences

## Detailed Usages

### api/src/controllers/orchestratorController.ts
- Line 114 (read)
  Context:
  ```typescript
  	public primaryInteractionId: InteractionId | null = null;
  	private agentControllers: Map<string, AgentController> = new Map();
  	public fullConfig!: FullConfigSchema;
  	public promptManager!: PromptManager;
  	public toolManager!: LLMToolManager;
  ```

- Line 147 (write)
  Context:
  ```typescript
  		this.interactionManager = interactionManager; //new InteractionManager();
  		this.llmProvider = LLMFactory.getProvider(this.getInteractionCallbacks());
  		this.fullConfig = this.projectEditor.fullConfig;
  	}
  
  ```

- Line 151 (write)
  Context:
  ```typescript
  
  	async init(): Promise<OrchestratorController> {
  		this.toolManager = await new LLMToolManager(this.fullConfig, 'core').init(); // Assuming 'core' is the default toolset
  		this.eventManager = EventManager.getInstance();
  		this.promptManager = await new PromptManager().init(this.projectEditor.projectRoot);
  ```

- Line 154 (write)
  Context:
  ```typescript
  		this.eventManager = EventManager.getInstance();
  		this.promptManager = await new PromptManager().init(this.projectEditor.projectRoot);
  		//this.fullConfig = await ConfigManager.fullConfig(this.projectEditor.projectRoot);
  
  		return this;
  ```

- Line 154 (write)
  Context:
  ```typescript
  		this.eventManager = EventManager.getInstance();
  		this.promptManager = await new PromptManager().init(this.projectEditor.projectRoot);
  		//this.fullConfig = await ConfigManager.fullConfig(this.projectEditor.projectRoot);
  
  		return this;
  ```

- Line 410 (read)
  Context:
  ```typescript
  		const systemPrompt = await this.promptManager.getPrompt('system', {
  			userDefinedContent: 'You are an AI assistant helping with code and project management.',
  			fullConfig: this.projectEditor.fullConfig,
  			interaction,
  		});
  ```

- Line 450 (write)
  Config path: api
  Context:
  ```typescript
  
  			// Save system prompt and project info if running in local development
  			if (this.fullConfig.api?.environment === 'localdev') {
  				const system = Array.isArray(currentResponse.messageMeta.system)
  					? currentResponse.messageMeta.system[0].text
  ```

- Line 479 (write)
  Config path: api
  Context:
  ```typescript
  
  			// Save system prompt and project info if running in local development
  			if (this.fullConfig.api?.environment === 'localdev') {
  				const system = Array.isArray(currentResponse.messageMeta.system)
  					? currentResponse.messageMeta.system[0].text
  ```

- Line 562 (write)
  Context:
  ```typescript
  			PROJECT_ROOT: () => this.projectEditor.projectRoot,
  			PROJECT_INFO: () => this.projectEditor.projectInfo,
  			PROJECT_CONFIG: () => this.projectEditor.fullConfig,
  			PROJECT_FILE_CONTENT: async (filePath: string): Promise<string> =>
  				await readProjectFileContent(this.projectEditor.projectRoot, filePath),
  ```

- Line 832 (write)
  Config path: api.maxTurns
  Context:
  ```typescript
  
  		let currentResponse: LLMSpeakWithResponse | null = null;
  		const maxTurns = options.maxTurns ?? this.fullConfig.api.maxTurns ?? 25; // Maximum number of turns for the run loop
  
  		try {
  ```

- Line 832 (write)
  Config path: api.maxTurns
  Context:
  ```typescript
  
  		let currentResponse: LLMSpeakWithResponse | null = null;
  		const maxTurns = options.maxTurns ?? this.fullConfig.api.maxTurns ?? 25; // Maximum number of turns for the run loop
  
  		try {
  ```

- Line 1098 (write)
  Config path: project.type
  Context:
  ```typescript
  		}
  
  		if (this.projectEditor.fullConfig.project.type === 'git') {
  			await stageAndCommitAfterChanging(
  				interaction,
  ```

### api/src/editor/projectEditor.ts
- Line 33 (read)
  Context:
  ```typescript
  	//private fileRevisions: Map<string, string[]> = new Map();
  	public orchestratorController!: OrchestratorController;
  	public fullConfig!: FullConfigSchema;
  	public eventManager!: EventManager;
  	public startDir: string;
  ```

- Line 57 (write)
  Context:
  ```typescript
  		try {
  			this.projectRoot = await this.getProjectRoot();
  			this.fullConfig = await ConfigManager.fullConfig(this.projectRoot);
  			logger.info(
  				`ProjectEditor config for ${this.fullConfig.api.apiHostname}:${this.fullConfig.api.apiPort}`,
  ```

- Line 57 (write)
  Context:
  ```typescript
  		try {
  			this.projectRoot = await this.getProjectRoot();
  			this.fullConfig = await ConfigManager.fullConfig(this.projectRoot);
  			logger.info(
  				`ProjectEditor config for ${this.fullConfig.api.apiHostname}:${this.fullConfig.api.apiPort}`,
  ```

- Line 59 (read)
  Config path: api.apiHostname
  Context:
  ```typescript
  			this.fullConfig = await ConfigManager.fullConfig(this.projectRoot);
  			logger.info(
  				`ProjectEditor config for ${this.fullConfig.api.apiHostname}:${this.fullConfig.api.apiPort}`,
  			);
  			this.eventManager = EventManager.getInstance();
  ```

- Line 59 (read)
  Config path: api.apiHostname
  Context:
  ```typescript
  			this.fullConfig = await ConfigManager.fullConfig(this.projectRoot);
  			logger.info(
  				`ProjectEditor config for ${this.fullConfig.api.apiHostname}:${this.fullConfig.api.apiPort}`,
  			);
  			this.eventManager = EventManager.getInstance();
  ```

- Line 59 (read)
  Config path: api.apiHostname
  Context:
  ```typescript
  			this.fullConfig = await ConfigManager.fullConfig(this.projectRoot);
  			logger.info(
  				`ProjectEditor config for ${this.fullConfig.api.apiHostname}:${this.fullConfig.api.apiPort}`,
  			);
  			this.eventManager = EventManager.getInstance();
  ```

- Line 59 (read)
  Config path: api.apiHostname
  Context:
  ```typescript
  			this.fullConfig = await ConfigManager.fullConfig(this.projectRoot);
  			logger.info(
  				`ProjectEditor config for ${this.fullConfig.api.apiHostname}:${this.fullConfig.api.apiPort}`,
  			);
  			this.eventManager = EventManager.getInstance();
  ```

- Line 113 (write)
  Config path: api.usePromptCaching
  Context:
  ```typescript
  	public async updateProjectInfo(): Promise<void> {
  		// If prompt caching is enabled and we've already generated the file listing, skip regeneration
  		if (this.fullConfig.api.usePromptCaching && this.projectInfo.type === 'file-listing') {
  			return;
  		}
  ```

- Line 113 (write)
  Config path: api.usePromptCaching
  Context:
  ```typescript
  	public async updateProjectInfo(): Promise<void> {
  		// If prompt caching is enabled and we've already generated the file listing, skip regeneration
  		if (this.fullConfig.api.usePromptCaching && this.projectInfo.type === 'file-listing') {
  			return;
  		}
  ```

- Line 113 (write)
  Config path: api.usePromptCaching
  Context:
  ```typescript
  	public async updateProjectInfo(): Promise<void> {
  		// If prompt caching is enabled and we've already generated the file listing, skip regeneration
  		if (this.fullConfig.api.usePromptCaching && this.projectInfo.type === 'file-listing') {
  			return;
  		}
  ```

### api/src/llms/errorHandler.ts
- Line 16 (read)
  Config path: strategy
  Context:
  ```typescript
  
  	async handleError(error: Error, task: Task, retryCount: number): Promise<void> {
  		switch (this.config.strategy) {
  			case 'fail_fast':
  				throw error;
  ```

- Line 22 (write)
  Config path: continueOnErrorThreshold
  Context:
  ```typescript
  				// Log error and continue
  				logger.error(`Error in task ${task.title}:`, error);
  				if (this.config.continueOnErrorThreshold && retryCount >= this.config.continueOnErrorThreshold) {
  					throw new Error(`Exceeded continue on error threshold for task ${task.title}`);
  				}
  ```

- Line 27 (read)
  Config path: maxRetries
  Context:
  ```typescript
  				break;
  			case 'retry':
  				if (retryCount < (this.config.maxRetries || 3)) {
  					// Retry the task
  					logger.warn(`Retrying task ${task.title}. Attempt ${retryCount + 1}`);
  ```

- Line 36 (read)
  Config path: strategy
  Context:
  ```typescript
  				break;
  			default:
  				throw new Error(`Unknown error strategy: ${this.config.strategy}`);
  		}
  	}
  ```

### api/src/llms/interactions/baseInteraction.ts
- Line 77 (read)
  Context:
  ```typescript
  	public interactionPersistence!: InteractionPersistence;
  	public collaborationLogger!: CollaborationLogger;
  	protected fullConfig!: FullConfigSchema;
  
  	private _model: string = '';
  ```

- Line 122 (write)
  Context:
  ```typescript
  			this.collaborationLogger = await new CollaborationLogger(projectRoot, parentInteractionId ?? this.id, logEntryHandler)
  				.init();
  			this.fullConfig = projectEditor.fullConfig;
  		} catch (error) {
  			logger.error('Failed to initialize LLMInteraction:', error as Error);
  ```

### api/src/llms/llmToolManager.ts
- Line 50 (read)
  Context:
  ```typescript
  	private toolMetadata: Map<string, ToolMetadata> = new Map();
  	private loadedTools: Map<string, LLMTool> = new Map();
  	private fullConfig: FullConfigSchema;
  	public toolSet: LLMToolManagerToolSetType | LLMToolManagerToolSetType[];
  
  ```

- Line 54 (read)
  Context:
  ```typescript
  
  	constructor(
  		fullConfig: FullConfigSchema,
  		toolSet: LLMToolManagerToolSetType | LLMToolManagerToolSetType[] = 'core',
  	) {
  ```

- Line 57 (write)
  Context:
  ```typescript
  		toolSet: LLMToolManagerToolSetType | LLMToolManagerToolSetType[] = 'core',
  	) {
  		this.fullConfig = fullConfig;
  		this.toolSet = toolSet;
  	}
  ```

- Line 62 (read)
  Config path: api.userToolDirectories
  Context:
  ```typescript
  
  	async init() {
  		await this.loadToolMetadata(this.fullConfig.api.userToolDirectories);
  
  		return this;
  ```

- Line 62 (read)
  Config path: api.userToolDirectories
  Context:
  ```typescript
  
  	async init() {
  		await this.loadToolMetadata(this.fullConfig.api.userToolDirectories);
  
  		return this;
  ```

- Line 147 (write)
  Config path: api.userToolDirectories.some
  Context:
  ```typescript
  	private shouldReplaceExistingTool(existing: ToolMetadata, newMetadata: ToolMetadata): boolean {
  		// Prefer user-supplied tools
  		if (this.fullConfig.api.userToolDirectories.some((dir) => newMetadata.path!.startsWith(dir))) {
  			if (compareVersions(parseVersion(existing.version), parseVersion(newMetadata.version)) > 0) {
  				logger.warn(
  ```

- Line 147 (write)
  Config path: api.userToolDirectories.some
  Context:
  ```typescript
  	private shouldReplaceExistingTool(existing: ToolMetadata, newMetadata: ToolMetadata): boolean {
  		// Prefer user-supplied tools
  		if (this.fullConfig.api.userToolDirectories.some((dir) => newMetadata.path!.startsWith(dir))) {
  			if (compareVersions(parseVersion(existing.version), parseVersion(newMetadata.version)) > 0) {
  				logger.warn(
  ```

- Line 184 (read)
  Config path: api.toolConfigs
  Context:
  ```typescript
  				metadata.name,
  				metadata.description,
  				this.fullConfig.api.toolConfigs[name] || {},
  			).init();
  			logger.debug(`LLMToolManager: Loaded Tool ${tool.name}`);
  ```

- Line 184 (read)
  Config path: api.toolConfigs
  Context:
  ```typescript
  				metadata.name,
  				metadata.description,
  				this.fullConfig.api.toolConfigs[name] || {},
  			).init();
  			logger.debug(`LLMToolManager: Loaded Tool ${tool.name}`);
  ```

### api/src/llms/providers/anthropicLLM.ts
- Line 62 (read)
  Config path: api
  Context:
  ```typescript
  	private initializeAnthropicClient() {
  		const clientOptions: ClientOptions = {
  			apiKey: this.fullConfig.api?.anthropicApiKey,
  		};
  		this.anthropic = new Anthropic(clientOptions);
  ```

- Line 228 (write)
  Config path: api
  Context:
  ```typescript
  		messages: LLMMessage[],
  	): Anthropic.Beta.PromptCaching.PromptCachingBetaMessageParam[] {
  		const usePromptCaching = this.fullConfig.api?.usePromptCaching ?? true;
  
  		// Find all messages that contain file additions with file metadata part
  ```

- Line 228 (write)
  Config path: api
  Context:
  ```typescript
  		messages: LLMMessage[],
  	): Anthropic.Beta.PromptCaching.PromptCachingBetaMessageParam[] {
  		const usePromptCaching = this.fullConfig.api?.usePromptCaching ?? true;
  
  		// Find all messages that contain file additions with file metadata part
  ```

- Line 256 (write)
  Context:
  ```typescript
  
  			// Add cache_control to the last content part of the last three file-added messages
  			if (m.role === 'user' && usePromptCaching && lastThreeIndices.has(index)) {
  				// Verify this message actually has a tool_result with file content
  				// const hasFileContent = Array.isArray(m.content) &&
  ```

- Line 322 (write)
  Config path: api
  Context:
  ```typescript
  	): Promise<Anthropic.MessageCreateParams> {
  		//logger.debug('llms-anthropic-prepareMessageParams-systemPrompt', interaction.baseSystem);
  		const usePromptCaching = this.fullConfig.api?.usePromptCaching ?? true;
  		const systemPrompt = await this.invoke(
  			LLMCallbackType.PREPARE_SYSTEM_PROMPT,
  ```

- Line 322 (write)
  Config path: api
  Context:
  ```typescript
  	): Promise<Anthropic.MessageCreateParams> {
  		//logger.debug('llms-anthropic-prepareMessageParams-systemPrompt', interaction.baseSystem);
  		const usePromptCaching = this.fullConfig.api?.usePromptCaching ?? true;
  		const systemPrompt = await this.invoke(
  			LLMCallbackType.PREPARE_SYSTEM_PROMPT,
  ```

- Line 333 (read)
  Context:
  ```typescript
  					type: 'text',
  					text: systemPrompt,
  					...(usePromptCaching ? { cache_control: { type: 'ephemeral' } } : {}),
  				} as Anthropic.Beta.PromptCaching.PromptCachingBetaTextBlockParam,
  			]
  ```

- Line 347 (read)
  Context:
  ```typescript
  		);
  		// system cache_control also includes tools
  		//if (tools.length > 0 && usePromptCaching) {
  		//	tools[tools.length - 1].cache_control = { type: 'ephemeral' };
  		//}
  ```

- Line 359 (read)
  Config path: api.logFileHydration
  Context:
  ```typescript
  		);
  		// Log detailed message information
  		if (this.fullConfig.api.logFileHydration) this.logMessageDetails(messages);
  
  		if (!speakOptions?.maxTokens && !interaction.maxTokens) {
  ```

- Line 359 (read)
  Config path: api.logFileHydration
  Context:
  ```typescript
  		);
  		// Log detailed message information
  		if (this.fullConfig.api.logFileHydration) this.logMessageDetails(messages);
  
  		if (!speakOptions?.maxTokens && !interaction.maxTokens) {
  ```

### api/src/llms/providers/baseLLM.ts
- Line 34 (read)
  Context:
  ```typescript
  	public requestCacheExpiry: number = 3 * (1000 * 60 * 60 * 24); // 3 days in milliseconds
  	private callbacks: LLMCallbacks;
  	public fullConfig!: FullConfigSchema;
  
  	constructor(callbacks: LLMCallbacks) {
  ```

- Line 38 (write)
  Context:
  ```typescript
  	constructor(callbacks: LLMCallbacks) {
  		this.callbacks = callbacks;
  		this.fullConfig = this.invokeSync(LLMCallbackType.PROJECT_CONFIG);
  	}
  
  ```

- Line 102 (write)
  Config path: api
  Context:
  ```typescript
  		let llmSpeakWithResponse!: LLMSpeakWithResponse;
  
  		const cacheKey = !this.fullConfig.api?.ignoreLLMRequestCache
  			? this.createRequestCacheKey(llmProviderMessageRequest)
  			: [];
  ```

- Line 102 (write)
  Config path: api
  Context:
  ```typescript
  		let llmSpeakWithResponse!: LLMSpeakWithResponse;
  
  		const cacheKey = !this.fullConfig.api?.ignoreLLMRequestCache
  			? this.createRequestCacheKey(llmProviderMessageRequest)
  			: [];
  ```

- Line 105 (read)
  Config path: api
  Context:
  ```typescript
  			? this.createRequestCacheKey(llmProviderMessageRequest)
  			: [];
  		if (!this.fullConfig.api?.ignoreLLMRequestCache) {
  			const cachedResponse = await kv.get<LLMSpeakWithResponse>(cacheKey);
  
  ```

- Line 105 (read)
  Config path: api
  Context:
  ```typescript
  			? this.createRequestCacheKey(llmProviderMessageRequest)
  			: [];
  		if (!this.fullConfig.api?.ignoreLLMRequestCache) {
  			const cachedResponse = await kv.get<LLMSpeakWithResponse>(cacheKey);
  
  ```

- Line 259 (read)
  Config path: api
  Context:
  ```typescript
  			llmSpeakWithResponse.messageResponse.fromCache = false;
  
  			if (!this.fullConfig.api?.ignoreLLMRequestCache) {
  				await kv.set(cacheKey, llmSpeakWithResponse, { expireIn: this.requestCacheExpiry });
  				//await metricsService.recordCacheMetrics({ operation: 'set' });
  ```

- Line 259 (read)
  Config path: api
  Context:
  ```typescript
  			llmSpeakWithResponse.messageResponse.fromCache = false;
  
  			if (!this.fullConfig.api?.ignoreLLMRequestCache) {
  				await kv.set(cacheKey, llmSpeakWithResponse, { expireIn: this.requestCacheExpiry });
  				//await metricsService.recordCacheMetrics({ operation: 'set' });
  ```

### api/src/llms/providers/openAILLM.ts
- Line 36 (write)
  Config path: api
  Context:
  ```typescript
  
  	private async initializeOpenAIClient() {
  		const apiKey = this.fullConfig.api?.openaiApiKey;
  		if (!apiKey) {
  			throw new Error('OpenAI API key is not set');
  ```

### api/src/llms/tools/applyPatch.tool/tool.ts
- Line 33 (read)
  Config path: ts
  Context:
  ```typescript
  					type: 'string',
  					description:
  						'The path of the file to be patched, relative to project root. Required for single-file patches, optional for multi-file patches that include file paths. Example: "src/config.ts"',
  				},
  				patch: {
  ```

### api/src/llms/tools/conversationSummary.tool/tests/tool.test.ts
- Line 1136 (read)
  Config path: ts
  Context:
  ```typescript
  				{
  					role: 'assistant',
  					content: [{ type: 'tool_use', text: 'Using request_files to get config.ts' }],
  					interactionStats: incrementInteractionStats(interactionStats),
  					providerResponse: { usage: { totalTokens: 2050 } },
  ```

- Line 1144 (read)
  Config path: ts
  Context:
  ```typescript
  					content: [{
  						type: 'tool_result',
  						text: 'Added src/config.ts to the conversation',
  					}, {
  						type: 'text',
  ```

- Line 1148 (write)
  Config path: ts
  Context:
  ```typescript
  						type: 'text',
  						text:
  							'---bb-file-metadata---\n{\n  "path": "src/config.ts",\n  "type": "text",\n  "size": 1000,\n  "last_modified": "2024-01-01T00:00:00.000Z",\n  "revision": "abc123"\n}\n\nconst config = {\n  // Config file contents\n};',
  					}],
  					interactionStats: incrementInteractionStats(interactionStats),
  ```

- Line 1154 (read)
  Config path: ts
  Context:
  ```typescript
  				{
  					role: 'assistant',
  					content: [{ type: 'tool_use', text: 'Using search_and_replace to modify config.ts' }],
  					interactionStats: incrementInteractionStats(interactionStats),
  					providerResponse: { usage: { totalTokens: 1950 } },
  ```

- Line 1162 (read)
  Config path: ts
  Context:
  ```typescript
  					content: [{
  						type: 'tool_result',
  						text: 'Modified src/config.ts successfully',
  					}, {
  						type: 'text',
  ```

- Line 1166 (write)
  Config path: ts
  Context:
  ```typescript
  						type: 'text',
  						text:
  							'---bb-file-metadata---\n{\n  "path": "src/config.ts",\n  "type": "text",\n  "size": 1100,\n  "last_modified": "2024-01-01T00:00:01.000Z",\n  "revision": "def456"\n}\n\nconst config = {\n  // Updated config file contents\n};',
  					}],
  					interactionStats: incrementInteractionStats(interactionStats),
  ```

- Line 1193 (read)
  Config path: ts
  Context:
  ```typescript
  
  ### Files Referenced
  - src/config.ts (revisions: abc123, def456)
    * Retrieved file contents
    * Modified configuration settings
  ```

- Line 1198 (read)
  Config path: ts
  Context:
  ```typescript
  
  ### Tools Used
  - request_files: Retrieved config.ts
  - search_and_replace: Modified config.ts
  
  ```

- Line 1199 (read)
  Config path: ts
  Context:
  ```typescript
  ### Tools Used
  - request_files: Retrieved config.ts
  - search_and_replace: Modified config.ts
  
  ### Key Decisions
  ```

- Line 1249 (read)
  Config path: ts
  Context:
  ```typescript
  				// Verify Files Referenced section
  				const fileSection = data.summary.split('### Files Referenced')[1].split('###')[0];
  				assert(fileSection.includes('src/config.ts'), 'Files section should list config.ts');
  				assert(fileSection.includes('abc123'), 'Files section should include first revision');
  				assert(fileSection.includes('def456'), 'Files section should include second revision');
  ```

- Line 1259 (read)
  Config path: ts
  Context:
  ```typescript
  				assert(toolSection.includes('request_files'), 'Tools section should list request_files');
  				assert(toolSection.includes('search_and_replace'), 'Tools section should list search_and_replace');
  				assert(toolSection.includes('Retrieved config.ts'), 'Tools section should describe file retrieval');
  				assert(toolSection.includes('Modified config.ts'), 'Tools section should describe file modification');
  
  ```

- Line 1260 (read)
  Config path: ts
  Context:
  ```typescript
  				assert(toolSection.includes('search_and_replace'), 'Tools section should list search_and_replace');
  				assert(toolSection.includes('Retrieved config.ts'), 'Tools section should describe file retrieval');
  				assert(toolSection.includes('Modified config.ts'), 'Tools section should describe file modification');
  
  				// Verify Key Decisions section
  ```

### api/src/llms/tools/requestFiles.tool/tool.ts
- Line 56 (read)
  Config path: ts
  Context:
  ```typescript
  
  Examples:
  * ["src/config.ts"]
  * ["src/handler.ts", "tests/handler.test.ts"]
  * ["package.json", "package-lock.json"]
  ```

### api/src/llms/tools/searchAndReplace.tool/tool.ts
- Line 34 (read)
  Config path: ts
  Context:
  ```typescript
  					type: 'string',
  					description:
  						'The path of the file to be modified or created, relative to the project root. Example: "src/config.ts"',
  				},
  				operations: {
  ```

### api/src/llms/tools/searchAndReplaceMultilineCode.tool/tool.ts
- Line 387 (write)
  Config path: heredocStart
  Context:
  ```typescript
  			for (let i = 0; i < line.length; i++) {
  				if (!inString && !inMultiLine && !inHeredoc) {
  					const heredocMatch = line.slice(i).match(config.heredocStart);
  					if (heredocMatch != null && heredocMatch.length > 1) {
  						inHeredoc = true;
  ```

- Line 398 (write)
  Config path: heredocEnd
  Context:
  ```typescript
  
  				if (inHeredoc) {
  					const heredocEndMatch = line.match(config.heredocEnd);
  					if (heredocEndMatch && heredocEndMatch.length > 1 && heredocEndMatch[1] === heredocEndMarker) {
  						inHeredoc = false;
  ```

- Line 407 (read)
  Config path: stringDelimiters.includes
  Context:
  ```typescript
  				}
  
  				if (config.stringDelimiters.includes(line[i])) {
  					if (!inString && !inMultiLine) {
  						inString = true;
  ```

- Line 415 (write)
  Config path: multiLineDelimiters.some
  Context:
  ```typescript
  					}
  					result += line[i];
  				} else if (config.multiLineDelimiters.some((delim) => line.startsWith(delim, i))) {
  					const delimiter = config.multiLineDelimiters.find((delim) => line.startsWith(delim, i))!;
  					inMultiLine = !inMultiLine;
  ```

- Line 416 (write)
  Config path: multiLineDelimiters.find
  Context:
  ```typescript
  					result += line[i];
  				} else if (config.multiLineDelimiters.some((delim) => line.startsWith(delim, i))) {
  					const delimiter = config.multiLineDelimiters.find((delim) => line.startsWith(delim, i))!;
  					inMultiLine = !inMultiLine;
  					currentDelimiter = delimiter;
  ```

### api/src/logEntries/logEntryFormatterManager.ts
- Line 25 (read)
  Context:
  ```typescript
  
  	constructor(
  		private fullConfig: FullConfigSchema,
  	) {}
  
  ```

- Line 29 (write)
  Context:
  ```typescript
  
  	public async init(): Promise<LogEntryFormatterManager> {
  		this.toolManager = await new LLMToolManager(this.fullConfig).init();
  		//logger.debug(`LogEntryFormatterManager: Initialized toolManager:`, this.toolManager.getAllToolsMetadata());
  		return this;
  ```

- Line 44 (read)
  Config path: myPersonsName
  Context:
  ```typescript
  			case 'user':
  				formatted = destination === 'console'
  					? this.formatLogEntryBasicConsole(logEntry, this.fullConfig.myPersonsName || 'User')
  					: this.formatLogEntryBasicBrowser(logEntry, this.fullConfig.myPersonsName || 'User');
  				break;
  ```

- Line 45 (read)
  Config path: myPersonsName
  Context:
  ```typescript
  				formatted = destination === 'console'
  					? this.formatLogEntryBasicConsole(logEntry, this.fullConfig.myPersonsName || 'User')
  					: this.formatLogEntryBasicBrowser(logEntry, this.fullConfig.myPersonsName || 'User');
  				break;
  			case 'assistant':
  ```

- Line 49 (read)
  Config path: myAssistantsName
  Context:
  ```typescript
  			case 'assistant':
  				formatted = destination === 'console'
  					? this.formatLogEntryBasicConsole(logEntry, this.fullConfig.myAssistantsName || 'Assistant')
  					: this.formatLogEntryBasicBrowser(logEntry, this.fullConfig.myAssistantsName || 'Assistant');
  				break;
  ```

- Line 50 (read)
  Config path: myAssistantsName
  Context:
  ```typescript
  				formatted = destination === 'console'
  					? this.formatLogEntryBasicConsole(logEntry, this.fullConfig.myAssistantsName || 'Assistant')
  					: this.formatLogEntryBasicBrowser(logEntry, this.fullConfig.myAssistantsName || 'Assistant');
  				break;
  			case 'answer':
  ```

- Line 56 (read)
  Config path: myAssistantsName
  Context:
  ```typescript
  					? this.formatLogEntryBasicConsole(
  						logEntry,
  						`Answer from ${this.fullConfig.myAssistantsName || 'Assistant'}`,
  					)
  					: this.formatLogEntryBasicBrowser(
  ```

- Line 60 (read)
  Config path: myAssistantsName
  Context:
  ```typescript
  					: this.formatLogEntryBasicBrowser(
  						logEntry,
  						`Answer from ${this.fullConfig.myAssistantsName || 'Assistant'}`,
  					);
  				break;
  ```

### api/src/main.ts
- Line 16 (write)
  Context:
  ```typescript
  // CWD is set by `bb` in Deno.Command, or implicitly set by user if calling bb-api directly
  const startDir = Deno.cwd();
  const fullConfig = await ConfigManager.fullConfig(startDir);
  const redactedFullConfig = await ConfigManager.redactedFullConfig(startDir);
  const { environment, apiHostname, apiPort, apiUseTls } = fullConfig.api;
  ```

- Line 16 (write)
  Context:
  ```typescript
  // CWD is set by `bb` in Deno.Command, or implicitly set by user if calling bb-api directly
  const startDir = Deno.cwd();
  const fullConfig = await ConfigManager.fullConfig(startDir);
  const redactedFullConfig = await ConfigManager.redactedFullConfig(startDir);
  const { environment, apiHostname, apiPort, apiUseTls } = fullConfig.api;
  ```

- Line 17 (write)
  Context:
  ```typescript
  const startDir = Deno.cwd();
  const fullConfig = await ConfigManager.fullConfig(startDir);
  const redactedFullConfig = await ConfigManager.redactedFullConfig(startDir);
  const { environment, apiHostname, apiPort, apiUseTls } = fullConfig.api;
  
  ```

- Line 18 (write)
  Config path: api
  Context:
  ```typescript
  const fullConfig = await ConfigManager.fullConfig(startDir);
  const redactedFullConfig = await ConfigManager.redactedFullConfig(startDir);
  const { environment, apiHostname, apiPort, apiUseTls } = fullConfig.api;
  
  // Parse command line arguments
  ```

- Line 18 (write)
  Config path: api
  Context:
  ```typescript
  const fullConfig = await ConfigManager.fullConfig(startDir);
  const redactedFullConfig = await ConfigManager.redactedFullConfig(startDir);
  const { environment, apiHostname, apiPort, apiUseTls } = fullConfig.api;
  
  // Parse command line arguments
  ```

- Line 18 (write)
  Config path: api
  Context:
  ```typescript
  const fullConfig = await ConfigManager.fullConfig(startDir);
  const redactedFullConfig = await ConfigManager.redactedFullConfig(startDir);
  const { environment, apiHostname, apiPort, apiUseTls } = fullConfig.api;
  
  // Parse command line arguments
  ```

- Line 18 (write)
  Config path: api
  Context:
  ```typescript
  const fullConfig = await ConfigManager.fullConfig(startDir);
  const redactedFullConfig = await ConfigManager.redactedFullConfig(startDir);
  const { environment, apiHostname, apiPort, apiUseTls } = fullConfig.api;
  
  // Parse command line arguments
  ```

- Line 29 (read)
  Config path: bbApiExeName
  Context:
  ```typescript
  if (args.help) {
  	console.log(`
  Usage: ${fullConfig.bbApiExeName} [options]
  
  Options:
  ```

- Line 34 (read)
  Context:
  ```typescript
    -h, --help                Show this help message
    -V, --version             Show version information
    -H, --hostname <string>   Specify the hostname to run the API server (default: ${apiHostname})
    -p, --port <number>       Specify the port to run the API server (default: ${apiPort})
    -t, --use-tls <boolean>    Specify whether the API server should use TLS (default: ${apiUseTls})
  ```

- Line 35 (read)
  Context:
  ```typescript
    -V, --version             Show version information
    -H, --hostname <string>   Specify the hostname to run the API server (default: ${apiHostname})
    -p, --port <number>       Specify the port to run the API server (default: ${apiPort})
    -t, --use-tls <boolean>    Specify whether the API server should use TLS (default: ${apiUseTls})
    -l, --log-file <file>     Specify a log file to write output
  ```

- Line 36 (read)
  Context:
  ```typescript
    -H, --hostname <string>   Specify the hostname to run the API server (default: ${apiHostname})
    -p, --port <number>       Specify the port to run the API server (default: ${apiPort})
    -t, --use-tls <boolean>    Specify whether the API server should use TLS (default: ${apiUseTls})
    -l, --log-file <file>     Specify a log file to write output
    `);
  ```

- Line 43 (read)
  Config path: version
  Context:
  ```typescript
  
  if (args.version) {
  	console.log(`BB API version ${fullConfig.version}`);
  	Deno.exit(0);
  }
  ```

- Line 51 (write)
  Context:
  ```typescript
  if (apiLogFile) await apiFileLogger(apiLogFile);
  
  const customHostname = args.hostname ? args.hostname : apiHostname;
  const customPort: number = args.port ? parseInt(args.port, 10) : apiPort as number;
  const customUseTls: boolean = typeof args['use-tls'] !== 'undefined'
  ```

- Line 52 (write)
  Context:
  ```typescript
  
  const customHostname = args.hostname ? args.hostname : apiHostname;
  const customPort: number = args.port ? parseInt(args.port, 10) : apiPort as number;
  const customUseTls: boolean = typeof args['use-tls'] !== 'undefined'
  	? (args['use-tls'] === 'true' ? true : false)
  ```

- Line 55 (read)
  Context:
  ```typescript
  const customUseTls: boolean = typeof args['use-tls'] !== 'undefined'
  	? (args['use-tls'] === 'true' ? true : false)
  	: !!apiUseTls;
  //console.debug(`BB API starting at ${customHostname}:${customPort}`);
  
  ```

- Line 73 (read)
  Config path: api
  Context:
  ```typescript
  app.addEventListener('listen', ({ hostname, port, secure }: { hostname: string; port: number; secure: boolean }) => {
  	logger.info(`Starting API with config:`, redactedFullConfig);
  	if (fullConfig.api?.ignoreLLMRequestCache) {
  		logger.warn('Cache for LLM requests is disabled!');
  	}
  ```

- Line 73 (read)
  Config path: api
  Context:
  ```typescript
  app.addEventListener('listen', ({ hostname, port, secure }: { hostname: string; port: number; secure: boolean }) => {
  	logger.info(`Starting API with config:`, redactedFullConfig);
  	if (fullConfig.api?.ignoreLLMRequestCache) {
  		logger.warn('Cache for LLM requests is disabled!');
  	}
  ```

- Line 86 (write)
  Config path: api.tlsCertPem
  Context:
  ```typescript
  	let listenOpts: ListenOptions = { hostname: customHostname, port: customPort };
  	if (customUseTls) {
  		const cert = fullConfig.api.tlsCertPem ||
  			await readFromBbDir(startDir, fullConfig.api.tlsCertFile || 'localhost.pem') ||
  			await readFromGlobalConfigDir(fullConfig.api.tlsCertFile || 'localhost.pem') || '';
  ```

- Line 86 (write)
  Config path: api.tlsCertPem
  Context:
  ```typescript
  	let listenOpts: ListenOptions = { hostname: customHostname, port: customPort };
  	if (customUseTls) {
  		const cert = fullConfig.api.tlsCertPem ||
  			await readFromBbDir(startDir, fullConfig.api.tlsCertFile || 'localhost.pem') ||
  			await readFromGlobalConfigDir(fullConfig.api.tlsCertFile || 'localhost.pem') || '';
  ```

- Line 87 (read)
  Config path: api.tlsCertFile
  Context:
  ```typescript
  	if (customUseTls) {
  		const cert = fullConfig.api.tlsCertPem ||
  			await readFromBbDir(startDir, fullConfig.api.tlsCertFile || 'localhost.pem') ||
  			await readFromGlobalConfigDir(fullConfig.api.tlsCertFile || 'localhost.pem') || '';
  		const key = fullConfig.api.tlsKeyPem ||
  ```

- Line 87 (read)
  Config path: api.tlsCertFile
  Context:
  ```typescript
  	if (customUseTls) {
  		const cert = fullConfig.api.tlsCertPem ||
  			await readFromBbDir(startDir, fullConfig.api.tlsCertFile || 'localhost.pem') ||
  			await readFromGlobalConfigDir(fullConfig.api.tlsCertFile || 'localhost.pem') || '';
  		const key = fullConfig.api.tlsKeyPem ||
  ```

- Line 88 (read)
  Config path: api.tlsCertFile
  Context:
  ```typescript
  		const cert = fullConfig.api.tlsCertPem ||
  			await readFromBbDir(startDir, fullConfig.api.tlsCertFile || 'localhost.pem') ||
  			await readFromGlobalConfigDir(fullConfig.api.tlsCertFile || 'localhost.pem') || '';
  		const key = fullConfig.api.tlsKeyPem ||
  			await readFromBbDir(startDir, fullConfig.api.tlsKeyFile || 'localhost-key.pem') ||
  ```

- Line 88 (read)
  Config path: api.tlsCertFile
  Context:
  ```typescript
  		const cert = fullConfig.api.tlsCertPem ||
  			await readFromBbDir(startDir, fullConfig.api.tlsCertFile || 'localhost.pem') ||
  			await readFromGlobalConfigDir(fullConfig.api.tlsCertFile || 'localhost.pem') || '';
  		const key = fullConfig.api.tlsKeyPem ||
  			await readFromBbDir(startDir, fullConfig.api.tlsKeyFile || 'localhost-key.pem') ||
  ```

- Line 89 (write)
  Config path: api.tlsKeyPem
  Context:
  ```typescript
  			await readFromBbDir(startDir, fullConfig.api.tlsCertFile || 'localhost.pem') ||
  			await readFromGlobalConfigDir(fullConfig.api.tlsCertFile || 'localhost.pem') || '';
  		const key = fullConfig.api.tlsKeyPem ||
  			await readFromBbDir(startDir, fullConfig.api.tlsKeyFile || 'localhost-key.pem') ||
  			await readFromGlobalConfigDir(fullConfig.api.tlsKeyFile || 'localhost-key.pem') || '';
  ```

- Line 89 (write)
  Config path: api.tlsKeyPem
  Context:
  ```typescript
  			await readFromBbDir(startDir, fullConfig.api.tlsCertFile || 'localhost.pem') ||
  			await readFromGlobalConfigDir(fullConfig.api.tlsCertFile || 'localhost.pem') || '';
  		const key = fullConfig.api.tlsKeyPem ||
  			await readFromBbDir(startDir, fullConfig.api.tlsKeyFile || 'localhost-key.pem') ||
  			await readFromGlobalConfigDir(fullConfig.api.tlsKeyFile || 'localhost-key.pem') || '';
  ```

- Line 90 (read)
  Config path: api.tlsKeyFile
  Context:
  ```typescript
  			await readFromGlobalConfigDir(fullConfig.api.tlsCertFile || 'localhost.pem') || '';
  		const key = fullConfig.api.tlsKeyPem ||
  			await readFromBbDir(startDir, fullConfig.api.tlsKeyFile || 'localhost-key.pem') ||
  			await readFromGlobalConfigDir(fullConfig.api.tlsKeyFile || 'localhost-key.pem') || '';
  
  ```

- Line 90 (read)
  Config path: api.tlsKeyFile
  Context:
  ```typescript
  			await readFromGlobalConfigDir(fullConfig.api.tlsCertFile || 'localhost.pem') || '';
  		const key = fullConfig.api.tlsKeyPem ||
  			await readFromBbDir(startDir, fullConfig.api.tlsKeyFile || 'localhost-key.pem') ||
  			await readFromGlobalConfigDir(fullConfig.api.tlsKeyFile || 'localhost-key.pem') || '';
  
  ```

- Line 91 (read)
  Config path: api.tlsKeyFile
  Context:
  ```typescript
  		const key = fullConfig.api.tlsKeyPem ||
  			await readFromBbDir(startDir, fullConfig.api.tlsKeyFile || 'localhost-key.pem') ||
  			await readFromGlobalConfigDir(fullConfig.api.tlsKeyFile || 'localhost-key.pem') || '';
  
  		listenOpts = { ...listenOpts, secure: true, cert, key } as ListenOptionsTls;
  ```

- Line 91 (read)
  Config path: api.tlsKeyFile
  Context:
  ```typescript
  		const key = fullConfig.api.tlsKeyPem ||
  			await readFromBbDir(startDir, fullConfig.api.tlsKeyFile || 'localhost-key.pem') ||
  			await readFromGlobalConfigDir(fullConfig.api.tlsKeyFile || 'localhost-key.pem') || '';
  
  		listenOpts = { ...listenOpts, secure: true, cert, key } as ListenOptionsTls;
  ```

### api/src/middlewares/error.middleware.ts
- Line 23 (write)
  Context:
  ```typescript
  		await next();
  	} catch (err) {
  		const globalConfig = await ConfigManager.globalConfig();
  		if (isAPIError(err)) {
  			const error: APIError = err;
  ```

- Line 23 (write)
  Context:
  ```typescript
  		await next();
  	} catch (err) {
  		const globalConfig = await ConfigManager.globalConfig();
  		if (isAPIError(err)) {
  			const error: APIError = err;
  ```

- Line 33 (write)
  Config path: api
  Context:
  ```typescript
  			};
  
  			if (globalConfig.api?.environment === 'production') { // || globalConfig.api?.environment === 'docker'
  				responseBody.message = message;
  			} else {
  ```

- Line 41 (write)
  Config path: api
  Context:
  ```typescript
  
  				if (
  					globalConfig.api?.environment === 'local' || globalConfig.api?.environment === 'localdev'
  				) {
  					logger.error(error.message, args);
  ```

- Line 61 (write)
  Config path: api
  Context:
  ```typescript
  			 * end user in non "development" mode
  			 */
  			const message = globalConfig.api?.environment === 'local' ||
  					globalConfig.api?.environment === 'localdev'
  				? ((err as Error).message ?? 'Unknown error occurred')
  ```

- Line 62 (write)
  Config path: api
  Context:
  ```typescript
  			 */
  			const message = globalConfig.api?.environment === 'local' ||
  					globalConfig.api?.environment === 'localdev'
  				? ((err as Error).message ?? 'Unknown error occurred')
  				: 'Internal Server Error';
  ```

### api/src/middlewares/metrics.middleware.ts
- Line 3 (read)
  Config path: ts
  Context:
  ```typescript
  import type { Context, Next } from '@oak/oak';
  import { metricsService } from '../services/metrics.service.ts';
  import config from '../config/config.ts';
  
  export async function metricsHandler(ctx: Context, next: Next) {
  ```

- Line 6 (read)
  Config path: metricsEnabled
  Context:
  ```typescript
  
  export async function metricsHandler(ctx: Context, next: Next) {
  	if (!config.metricsEnabled) {
  		await next();
  		return;
  ```

### api/src/prompts/defaultPrompts.ts
- Line 26 (write)
  Context:
  ```typescript
  		version: '1.0.0',
  	},
  	getContent: async ({ userDefinedContent = '', fullConfig, interaction }) => {
  		let guidelines;
  		const guidelinesPath = (fullConfig as GlobalConfigSchema).project.llmGuidelinesFile;
  ```

- Line 28 (write)
  Context:
  ```typescript
  	getContent: async ({ userDefinedContent = '', fullConfig, interaction }) => {
  		let guidelines;
  		const guidelinesPath = (fullConfig as GlobalConfigSchema).project.llmGuidelinesFile;
  		if (guidelinesPath) {
  			try {
  ```

- Line 38 (write)
  Context:
  ```typescript
  		}
  
  		const myPersonsName = (fullConfig as GlobalConfigSchema).myPersonsName;
  		const myAssistantsName = (fullConfig as GlobalConfigSchema).myAssistantsName;
  		const promptCachingEnabled = (fullConfig as GlobalConfigSchema).api?.usePromptCaching ?? true;
  ```

- Line 39 (write)
  Context:
  ```typescript
  
  		const myPersonsName = (fullConfig as GlobalConfigSchema).myPersonsName;
  		const myAssistantsName = (fullConfig as GlobalConfigSchema).myAssistantsName;
  		const promptCachingEnabled = (fullConfig as GlobalConfigSchema).api?.usePromptCaching ?? true;
  		const projectRoot = await (interaction as LLMInteraction).llm.invoke(LLMCallbackType.PROJECT_ROOT);
  ```

- Line 40 (write)
  Context:
  ```typescript
  		const myPersonsName = (fullConfig as GlobalConfigSchema).myPersonsName;
  		const myAssistantsName = (fullConfig as GlobalConfigSchema).myAssistantsName;
  		const promptCachingEnabled = (fullConfig as GlobalConfigSchema).api?.usePromptCaching ?? true;
  		const projectRoot = await (interaction as LLMInteraction).llm.invoke(LLMCallbackType.PROJECT_ROOT);
  		const projectEditor = await (interaction as LLMInteraction).llm.invoke(LLMCallbackType.PROJECT_EDITOR);
  ```

- Line 40 (write)
  Context:
  ```typescript
  		const myPersonsName = (fullConfig as GlobalConfigSchema).myPersonsName;
  		const myAssistantsName = (fullConfig as GlobalConfigSchema).myAssistantsName;
  		const promptCachingEnabled = (fullConfig as GlobalConfigSchema).api?.usePromptCaching ?? true;
  		const projectRoot = await (interaction as LLMInteraction).llm.invoke(LLMCallbackType.PROJECT_ROOT);
  		const projectEditor = await (interaction as LLMInteraction).llm.invoke(LLMCallbackType.PROJECT_EDITOR);
  ```

### api/src/prompts/promptManager.ts
- Line 23 (read)
  Context:
  ```typescript
  class PromptManager {
  	private userPromptsDir: string;
  	private fullConfig!: FullConfigSchema;
  
  	constructor() {
  ```

- Line 32 (write)
  Context:
  ```typescript
  		const bbDir = await getBbDir(projectRoot);
  		this.userPromptsDir = join(bbDir, 'prompts');
  		this.fullConfig = await ConfigManager.fullConfig(projectRoot);
  		return this;
  	}
  ```

- Line 32 (write)
  Context:
  ```typescript
  		const bbDir = await getBbDir(projectRoot);
  		this.userPromptsDir = join(bbDir, 'prompts');
  		this.fullConfig = await ConfigManager.fullConfig(projectRoot);
  		return this;
  	}
  ```

- Line 37 (write)
  Config path: project.llmGuidelinesFile
  Context:
  ```typescript
  
  	public async loadGuidelines(): Promise<string | null> {
  		const guidelinesPath = this.fullConfig.project.llmGuidelinesFile;
  		if (!guidelinesPath) {
  			return null;
  ```

### api/src/routes/api/doctor.handlers.ts
- Line 75 (write)
  Context:
  ```typescript
  	//const { startDir } = await request.body.json();
  
  	const configManager = await ConfigManager.getInstance();
  	try {
  		switch (fixType) {
  ```

- Line 80 (write)
  Context:
  ```typescript
  			case 'api-port': {
  				// Example fix implementation
  				//const fullConfig = await ConfigManager.fullConfig(startDir);
  				await configManager.setGlobalConfigValue('api.apiPort', '3162');
  				response.body = { message: 'API port reset to default' };
  ```

- Line 80 (write)
  Context:
  ```typescript
  			case 'api-port': {
  				// Example fix implementation
  				//const fullConfig = await ConfigManager.fullConfig(startDir);
  				await configManager.setGlobalConfigValue('api.apiPort', '3162');
  				response.body = { message: 'API port reset to default' };
  ```

- Line 81 (write)
  Context:
  ```typescript
  				// Example fix implementation
  				//const fullConfig = await ConfigManager.fullConfig(startDir);
  				await configManager.setGlobalConfigValue('api.apiPort', '3162');
  				response.body = { message: 'API port reset to default' };
  				break;
  ```

- Line 86 (write)
  Context:
  ```typescript
  			}
  			case 'api-hostname': {
  				await configManager.setGlobalConfigValue('api.apiHostname', 'localhost');
  				response.body = { message: 'API hostname reset to default' };
  				break;
  ```

### api/src/routes/api/logEntryFormatter.handlers.ts
- Line 28 (write)
  Context:
  ```typescript
  		// 		);
  
  		const fullConfig = await ConfigManager.fullConfig(startDir);
  		const logEntryFormatterManager = await new LogEntryFormatterManager(fullConfig).init();
  
  ```

- Line 28 (write)
  Context:
  ```typescript
  		// 		);
  
  		const fullConfig = await ConfigManager.fullConfig(startDir);
  		const logEntryFormatterManager = await new LogEntryFormatterManager(fullConfig).init();
  
  ```

- Line 29 (write)
  Context:
  ```typescript
  
  		const fullConfig = await ConfigManager.fullConfig(startDir);
  		const logEntryFormatterManager = await new LogEntryFormatterManager(fullConfig).init();
  
  		if (!logEntry || !logEntry.entryType || !logEntry.content) {
  ```

### api/src/routes/api/project.handlers.ts
- Line 47 (read)
  Config path: json
  Context:
  ```typescript
  			await ensureDir(bbDir);
  			await Deno.writeTextFile(
  				join(bbDir, 'config.json'),
  				JSON.stringify(
  					{
  ```

### api/src/routes/api/status.handlers.ts
- Line 503 (read)
  Config path: api.tlsCertPem
  Context:
  ```typescript
  	let certPath: string | undefined;
  
  	if (config.api.tlsCertPem) {
  		certContent = config.api.tlsCertPem;
  		certSource = 'config';
  ```

- Line 503 (read)
  Config path: api.tlsCertPem
  Context:
  ```typescript
  	let certPath: string | undefined;
  
  	if (config.api.tlsCertPem) {
  		certContent = config.api.tlsCertPem;
  		certSource = 'config';
  ```

- Line 504 (write)
  Config path: api.tlsCertPem
  Context:
  ```typescript
  
  	if (config.api.tlsCertPem) {
  		certContent = config.api.tlsCertPem;
  		certSource = 'config';
  	} else {
  ```

- Line 504 (write)
  Config path: api.tlsCertPem
  Context:
  ```typescript
  
  	if (config.api.tlsCertPem) {
  		certContent = config.api.tlsCertPem;
  		certSource = 'config';
  	} else {
  ```

- Line 507 (write)
  Config path: api.tlsCertFile
  Context:
  ```typescript
  		certSource = 'config';
  	} else {
  		const certFile = config.api.tlsCertFile || 'localhost.pem';
  		certPath = certFile;
  
  ```

- Line 507 (write)
  Config path: api.tlsCertFile
  Context:
  ```typescript
  		certSource = 'config';
  	} else {
  		const certFile = config.api.tlsCertFile || 'localhost.pem';
  		certPath = certFile;
  
  ```

- Line 548 (write)
  Context:
  ```typescript
  	const dirParam = ctx.request.url.searchParams.get('startDir');
  	const startDir = dirParam || undefined;
  	const config = startDir ? await ConfigManager.fullConfig(startDir) : await ConfigManager.globalConfig();
  
  	const tlsInfo = config.api.apiUseTls ? await getTlsInfo(config, startDir) : {};
  ```

- Line 548 (write)
  Context:
  ```typescript
  	const dirParam = ctx.request.url.searchParams.get('startDir');
  	const startDir = dirParam || undefined;
  	const config = startDir ? await ConfigManager.fullConfig(startDir) : await ConfigManager.globalConfig();
  
  	const tlsInfo = config.api.apiUseTls ? await getTlsInfo(config, startDir) : {};
  ```

- Line 548 (write)
  Context:
  ```typescript
  	const dirParam = ctx.request.url.searchParams.get('startDir');
  	const startDir = dirParam || undefined;
  	const config = startDir ? await ConfigManager.fullConfig(startDir) : await ConfigManager.globalConfig();
  
  	const tlsInfo = config.api.apiUseTls ? await getTlsInfo(config, startDir) : {};
  ```

- Line 550 (write)
  Config path: api.apiUseTls
  Context:
  ```typescript
  	const config = startDir ? await ConfigManager.fullConfig(startDir) : await ConfigManager.globalConfig();
  
  	const tlsInfo = config.api.apiUseTls ? await getTlsInfo(config, startDir) : {};
  
  	const statusData: StatusData = {
  ```

- Line 550 (write)
  Config path: api.apiUseTls
  Context:
  ```typescript
  	const config = startDir ? await ConfigManager.fullConfig(startDir) : await ConfigManager.globalConfig();
  
  	const tlsInfo = config.api.apiUseTls ? await getTlsInfo(config, startDir) : {};
  
  	const statusData: StatusData = {
  ```

- Line 550 (write)
  Config path: api.apiUseTls
  Context:
  ```typescript
  	const config = startDir ? await ConfigManager.fullConfig(startDir) : await ConfigManager.globalConfig();
  
  	const tlsInfo = config.api.apiUseTls ? await getTlsInfo(config, startDir) : {};
  
  	const statusData: StatusData = {
  ```

- Line 567 (read)
  Config path: api.apiUseTls
  Context:
  ```typescript
  		} as Record<SupportedPlatform, string>)[Deno.build.os as SupportedPlatform],
  		tls: {
  			enabled: config.api.apiUseTls || false,
  			...tlsInfo,
  		},
  ```

- Line 567 (read)
  Config path: api.apiUseTls
  Context:
  ```typescript
  		} as Record<SupportedPlatform, string>)[Deno.build.os as SupportedPlatform],
  		tls: {
  			enabled: config.api.apiUseTls || false,
  			...tlsInfo,
  		},
  ```

- Line 567 (read)
  Config path: api.apiUseTls
  Context:
  ```typescript
  		} as Record<SupportedPlatform, string>)[Deno.build.os as SupportedPlatform],
  		tls: {
  			enabled: config.api.apiUseTls || false,
  			...tlsInfo,
  		},
  ```

- Line 571 (read)
  Config path: project.name
  Context:
  ```typescript
  		},
  		configType: startDir ? 'project' : 'global',
  		projectName: startDir ? config.project.name : undefined,
  	};
  
  ```

### api/src/routes/api/upgrade.handlers.ts
- Line 63 (write)
  Context:
  ```typescript
  
  			// Get current API configuration
  			const config = await ConfigManager.fullConfig(cwd);
  			const {
  				apiHostname = 'localhost',
  ```

- Line 63 (write)
  Context:
  ```typescript
  
  			// Get current API configuration
  			const config = await ConfigManager.fullConfig(cwd);
  			const {
  				apiHostname = 'localhost',
  ```

- Line 65 (write)
  Context:
  ```typescript
  			const config = await ConfigManager.fullConfig(cwd);
  			const {
  				apiHostname = 'localhost',
  				apiPort = 3162,
  				apiUseTls = true,
  ```

- Line 66 (write)
  Context:
  ```typescript
  			const {
  				apiHostname = 'localhost',
  				apiPort = 3162,
  				apiUseTls = true,
  				logLevel,
  ```

- Line 67 (write)
  Context:
  ```typescript
  				apiHostname = 'localhost',
  				apiPort = 3162,
  				apiUseTls = true,
  				logLevel,
  				logFile,
  ```

- Line 70 (write)
  Config path: api
  Context:
  ```typescript
  				logLevel,
  				logFile,
  			} = config.api;
  
  			// Construct restart command with current settings
  ```

- Line 74 (read)
  Context:
  ```typescript
  			// Construct restart command with current settings
  			const cmd = ['bb', 'restart'];
  			if (apiHostname) cmd.push('--hostname', String(apiHostname));
  			if (apiPort) cmd.push('--port', String(apiPort));
  			if (typeof apiUseTls !== 'undefined') cmd.push('--use-tls', String(apiUseTls));
  ```

- Line 75 (read)
  Context:
  ```typescript
  			const cmd = ['bb', 'restart'];
  			if (apiHostname) cmd.push('--hostname', String(apiHostname));
  			if (apiPort) cmd.push('--port', String(apiPort));
  			if (typeof apiUseTls !== 'undefined') cmd.push('--use-tls', String(apiUseTls));
  			if (logLevel) cmd.push('--log-level', logLevel);
  ```

- Line 76 (write)
  Context:
  ```typescript
  			if (apiHostname) cmd.push('--hostname', String(apiHostname));
  			if (apiPort) cmd.push('--port', String(apiPort));
  			if (typeof apiUseTls !== 'undefined') cmd.push('--use-tls', String(apiUseTls));
  			if (logLevel) cmd.push('--log-level', logLevel);
  			if (logFile) cmd.push('--log-file', logFile);
  ```

### api/src/routes/swaggerRouter.ts
- Line 10 (read)
  Context:
  ```typescript
  	info: {
  		title: 'BB API',
  		version: (await ConfigManager.globalConfig()).version,
  		description:
  			`BB (Beyond Better) is an advanced AI-powered assistant designed to revolutionize how you work with text-based projects. Whether you're coding, writing, or managing complex documentation, BB is here to help you "be better" at every step.`,
  ```

- Line 10 (read)
  Context:
  ```typescript
  	info: {
  		title: 'BB API',
  		version: (await ConfigManager.globalConfig()).version,
  		description:
  			`BB (Beyond Better) is an advanced AI-powered assistant designed to revolutionize how you work with text-based projects. Whether you're coding, writing, or managing complex documentation, BB is here to help you "be better" at every step.`,
  ```

### api/src/storage/collaborationLogger.ts
- Line 47 (write)
  Context:
  ```typescript
  }
  
  const globalConfig = await ConfigManager.globalConfig();
  
  export default class CollaborationLogger {
  ```

- Line 47 (write)
  Context:
  ```typescript
  }
  
  const globalConfig = await ConfigManager.globalConfig();
  
  export default class CollaborationLogger {
  ```

- Line 59 (read)
  Config path: myPersonsName
  Context:
  ```typescript
  		string
  	> = {
  		user: globalConfig.myPersonsName || 'Person',
  		assistant: globalConfig.myAssistantsName || 'Assistant',
  		answer: `Answer from ${globalConfig.myAssistantsName || 'Assistant'}`,
  ```

- Line 60 (read)
  Config path: myAssistantsName
  Context:
  ```typescript
  	> = {
  		user: globalConfig.myPersonsName || 'Person',
  		assistant: globalConfig.myAssistantsName || 'Assistant',
  		answer: `Answer from ${globalConfig.myAssistantsName || 'Assistant'}`,
  		tool_use: 'Tool Input',
  ```

- Line 61 (read)
  Config path: myAssistantsName
  Context:
  ```typescript
  		user: globalConfig.myPersonsName || 'Person',
  		assistant: globalConfig.myAssistantsName || 'Assistant',
  		answer: `Answer from ${globalConfig.myAssistantsName || 'Assistant'}`,
  		tool_use: 'Tool Input',
  		tool_result: 'Tool Output',
  ```

- Line 83 (write)
  Context:
  ```typescript
  
  	async init(): Promise<CollaborationLogger> {
  		const fullConfig = await ConfigManager.fullConfig(this.startDir);
  		this.logEntryFormatterManager = await new LogEntryFormatterManager(fullConfig).init();
  
  ```

- Line 83 (write)
  Context:
  ```typescript
  
  	async init(): Promise<CollaborationLogger> {
  		const fullConfig = await ConfigManager.fullConfig(this.startDir);
  		this.logEntryFormatterManager = await new LogEntryFormatterManager(fullConfig).init();
  
  ```

- Line 84 (write)
  Context:
  ```typescript
  	async init(): Promise<CollaborationLogger> {
  		const fullConfig = await ConfigManager.fullConfig(this.startDir);
  		this.logEntryFormatterManager = await new LogEntryFormatterManager(fullConfig).init();
  
  		this.collaborationLogsDir = await CollaborationLogger.getLogFileDirPath(this.startDir, this.conversationId);
  ```

- Line 91 (write)
  Config path: myPersonsName
  Context:
  ```typescript
  		this.logFileJson = await CollaborationLogger.getLogFileJsonPath(this.startDir, this.conversationId);
  
  		CollaborationLogger.entryTypeLabels.user = fullConfig.myPersonsName || 'Person';
  		CollaborationLogger.entryTypeLabels.assistant = fullConfig.myAssistantsName || 'Assistant';
  
  ```

- Line 92 (write)
  Config path: myAssistantsName
  Context:
  ```typescript
  
  		CollaborationLogger.entryTypeLabels.user = fullConfig.myPersonsName || 'Person';
  		CollaborationLogger.entryTypeLabels.assistant = fullConfig.myAssistantsName || 'Assistant';
  
  		return this;
  ```

### api/src/utils/ctags.utils.ts
- Line 118 (write)
  Context:
  ```typescript
  
  export async function generateCtags(bbDir: string, projectRoot: string): Promise<string | null> {
  	const repoInfoConfig = (await ConfigManager.projectConfig(projectRoot)).repoInfo;
  
  	if (repoInfoConfig?.ctagsAutoGenerate === false) {
  ```

- Line 118 (write)
  Context:
  ```typescript
  
  export async function generateCtags(bbDir: string, projectRoot: string): Promise<string | null> {
  	const repoInfoConfig = (await ConfigManager.projectConfig(projectRoot)).repoInfo;
  
  	if (repoInfoConfig?.ctagsAutoGenerate === false) {
  ```

- Line 142 (write)
  Context:
  ```typescript
  
  export async function readCtagsFile(bbDir: string): Promise<string | null> {
  	const repoInfoConfig = (await ConfigManager.projectConfig(bbDir)).repoInfo;
  
  	const ctagsFilePath = repoInfoConfig?.ctagsFilePath
  ```

- Line 142 (write)
  Context:
  ```typescript
  
  export async function readCtagsFile(bbDir: string): Promise<string | null> {
  	const repoInfoConfig = (await ConfigManager.projectConfig(bbDir)).repoInfo;
  
  	const ctagsFilePath = repoInfoConfig?.ctagsFilePath
  ```

### api/src/utils/projectListing.utils.ts
- Line 23 (write)
  Context:
  ```typescript
  
  export async function generateFileListing(projectRoot: string): Promise<{ listing: string; tier: number } | null> {
  	const projectConfig = await ConfigManager.projectConfig(projectRoot);
  	const repoInfoConfig = projectConfig.repoInfo;
  	const tokenLimit = repoInfoConfig?.tokenLimit || 1024;
  ```

- Line 23 (write)
  Context:
  ```typescript
  
  export async function generateFileListing(projectRoot: string): Promise<{ listing: string; tier: number } | null> {
  	const projectConfig = await ConfigManager.projectConfig(projectRoot);
  	const repoInfoConfig = projectConfig.repoInfo;
  	const tokenLimit = repoInfoConfig?.tokenLimit || 1024;
  ```

- Line 24 (write)
  Context:
  ```typescript
  export async function generateFileListing(projectRoot: string): Promise<{ listing: string; tier: number } | null> {
  	const projectConfig = await ConfigManager.projectConfig(projectRoot);
  	const repoInfoConfig = projectConfig.repoInfo;
  	const tokenLimit = repoInfoConfig?.tokenLimit || 1024;
  
  ```

### api/tests/lib/testSetup.ts
- Line 16 (write)
  Context:
  ```typescript
  
  	const wizardAnswers: WizardAnswers = { project: { name: 'TestProject', type: 'local' } };
  	const configManager = await ConfigManager.getInstance();
  	await configManager.ensureGlobalConfig();
  	await configManager.ensureProjectConfig(testProjectRoot, wizardAnswers);
  ```

- Line 45 (write)
  Config path: api.toolConfigs
  Context:
  ```typescript
  	toolConfig?: Record<string, unknown>,
  ): Promise<LLMToolManager> {
  	if (toolName && toolConfig) projectEditor.fullConfig.api.toolConfigs[toolName] = toolConfig;
  
  	const toolManager = await new LLMToolManager(projectEditor.fullConfig, 'core').init(); // Assuming 'core' is the default toolset
  ```

- Line 45 (write)
  Config path: api.toolConfigs
  Context:
  ```typescript
  	toolConfig?: Record<string, unknown>,
  ): Promise<LLMToolManager> {
  	if (toolName && toolConfig) projectEditor.fullConfig.api.toolConfigs[toolName] = toolConfig;
  
  	const toolManager = await new LLMToolManager(projectEditor.fullConfig, 'core').init(); // Assuming 'core' is the default toolset
  ```

- Line 47 (write)
  Context:
  ```typescript
  	if (toolName && toolConfig) projectEditor.fullConfig.api.toolConfigs[toolName] = toolConfig;
  
  	const toolManager = await new LLMToolManager(projectEditor.fullConfig, 'core').init(); // Assuming 'core' is the default toolset
  
  	assert(toolManager, 'Failed to get LLMToolManager');
  ```

### api/tests/t/fileSuggestions.test.ts
- Line 27 (read)
  Config path: test.ts.bak
  Context:
  ```typescript
  	// Add files with special characters and multiple extensions
  	Deno.writeTextFileSync(join(testProjectRoot, 'docs', 'special chars & symbols.md'), 'Special chars');
  	Deno.writeTextFileSync(join(testProjectRoot, 'docs', 'development', 'config.test.ts.bak'), 'Backup file');
  
  	// Add hidden directory with contents
  ```

- Line 209 (write)
  Config path: test.ts.bak
  Context:
  ```typescript
  			});
  			assert(
  				result.suggestions.some((s) => s.path === 'docs/development/config.test.ts.bak'),
  				'Should match files with multiple extensions',
  			);
  ```

### bui/src/_fresh/island-chat.js
- Line 1646 (read)
  Context:
  ```typescript
  var $e = class {
  		socket = null;
  		apiHostname;
  		apiPort;
  		apiUseTls;
  ```

- Line 1647 (read)
  Context:
  ```typescript
  		socket = null;
  		apiHostname;
  		apiPort;
  		apiUseTls;
  		conversationId = null;
  ```

- Line 1648 (read)
  Context:
  ```typescript
  		apiHostname;
  		apiPort;
  		apiUseTls;
  		conversationId = null;
  		startDir;
  ```

- Line 1660 (write)
  Context:
  ```typescript
  		error = j(null);
  		constructor(e, t, r, n) {
  			this.apiHostname = e, this.apiPort = t, this.apiUseTls = r, this.startDir = n;
  		}
  		setConversationId(e) {
  ```

- Line 1660 (write)
  Context:
  ```typescript
  		error = j(null);
  		constructor(e, t, r, n) {
  			this.apiHostname = e, this.apiPort = t, this.apiUseTls = r, this.startDir = n;
  		}
  		setConversationId(e) {
  ```

- Line 1660 (write)
  Context:
  ```typescript
  		error = j(null);
  		constructor(e, t, r, n) {
  			this.apiHostname = e, this.apiPort = t, this.apiUseTls = r, this.startDir = n;
  		}
  		setConversationId(e) {
  ```

- Line 1678 (read)
  Context:
  ```typescript
  			this.socket = new WebSocket(
  				`${
  					this.apiUseTls
  						? 'wss'
  						: 'ws'
  ```

- Line 1681 (read)
  Context:
  ```typescript
  						? 'wss'
  						: 'ws'
  				}://${this.apiHostname}:${this.apiPort}/api/v1/ws/conversation/${this.conversationId}`,
  			),
  				this.socket.onopen = () => {
  ```

- Line 1681 (read)
  Context:
  ```typescript
  						? 'wss'
  						: 'ws'
  				}://${this.apiHostname}:${this.apiPort}/api/v1/ws/conversation/${this.conversationId}`,
  			),
  				this.socket.onopen = () => {
  ```

- Line 1798 (read)
  Context:
  ```typescript
  			if (_) {
  				let l = window.location.hash.slice(1), p = new URLSearchParams(l);
  				return console.log('Chat component: Received apiHostname:', p.get('apiHostname')), p.get('apiHostname');
  			}
  			return null;
  ```

- Line 1805 (read)
  Context:
  ```typescript
  			if (_) {
  				let l = window.location.hash.slice(1), p = new URLSearchParams(l);
  				return console.log('Chat component: Received apiPort:', p.get('apiPort')), p.get('apiPort');
  			}
  			return null;
  ```

- Line 1813 (write)
  Context:
  ```typescript
  				let l = window.location.hash.slice(1),
  					p = new URLSearchParams(l),
  					d = p.get('apiUseTls') === '' ? !0 : p.get('apiUseTls') === 'true';
  				return console.log('Chat component: Received apiUseTls:', d), d;
  			}
  ```

- Line 1814 (read)
  Context:
  ```typescript
  					p = new URLSearchParams(l),
  					d = p.get('apiUseTls') === '' ? !0 : p.get('apiUseTls') === 'true';
  				return console.log('Chat component: Received apiUseTls:', d), d;
  			}
  			return !0;
  ```

- Line 1884 (read)
  Context:
  ```typescript
  	Z(() => {
  		if (
  			console.log('Chat component useEffect. apiHostname:', R),
  				console.log('Chat component useEffect. apiPort:', E),
  				console.debug(
  ```

- Line 1885 (read)
  Context:
  ```typescript
  		if (
  			console.log('Chat component useEffect. apiHostname:', R),
  				console.log('Chat component useEffect. apiPort:', E),
  				console.debug(
  					'Chat component mounted. IS_BROWSER:',
  ```

- Line 1889 (read)
  Context:
  ```typescript
  					'Chat component mounted. IS_BROWSER:',
  					_,
  					'apiHostname:',
  					R,
  					'apiPort:',
  ```

- Line 1891 (read)
  Context:
  ```typescript
  					'apiHostname:',
  					R,
  					'apiPort:',
  					E,
  					'apiUseTls:',
  ```

- Line 1893 (read)
  Context:
  ```typescript
  					'apiPort:',
  					E,
  					'apiUseTls:',
  					O,
  					'startDir:',
  ```

- Line 1901 (read)
  Context:
  ```typescript
  				_ && !w.value && R && E && I
  		) {
  			console.log('Initializing chat with apiHostname:', R),
  				console.log('Initializing chat with apiPort:', E),
  				console.log('Initializing chat with apiUseTls:', O),
  ```

- Line 1902 (read)
  Context:
  ```typescript
  		) {
  			console.log('Initializing chat with apiHostname:', R),
  				console.log('Initializing chat with apiPort:', E),
  				console.log('Initializing chat with apiUseTls:', O),
  				console.log('Initializing chat with startDir:', I),
  ```

- Line 1903 (read)
  Context:
  ```typescript
  			console.log('Initializing chat with apiHostname:', R),
  				console.log('Initializing chat with apiPort:', E),
  				console.log('Initializing chat with apiUseTls:', O),
  				console.log('Initializing chat with startDir:', I),
  				(async () => {
  ```

### bui/src/dev.ts
- Line 4 (read)
  Config path: ts
  Context:
  ```typescript
  
  import dev from '$fresh/dev.ts';
  import config from './fresh.config.ts';
  
  import '$std/dotenv/load.ts';
  ```

### bui/src/fresh.config.ts
- Line 8 (write)
  Context:
  ```typescript
  // CWD is set by `bb` in Deno.Command, or implicitly set by user if calling bb-api directly
  const startDir = Deno.cwd();
  const fullConfig = await ConfigManager.fullConfig(startDir);
  const redactedFullConfig = await ConfigManager.redactedFullConfig(startDir);
  const { buiHostname, buiPort, buiUseTls } = fullConfig.bui;
  ```

- Line 8 (write)
  Context:
  ```typescript
  // CWD is set by `bb` in Deno.Command, or implicitly set by user if calling bb-api directly
  const startDir = Deno.cwd();
  const fullConfig = await ConfigManager.fullConfig(startDir);
  const redactedFullConfig = await ConfigManager.redactedFullConfig(startDir);
  const { buiHostname, buiPort, buiUseTls } = fullConfig.bui;
  ```

- Line 9 (write)
  Context:
  ```typescript
  const startDir = Deno.cwd();
  const fullConfig = await ConfigManager.fullConfig(startDir);
  const redactedFullConfig = await ConfigManager.redactedFullConfig(startDir);
  const { buiHostname, buiPort, buiUseTls } = fullConfig.bui;
  
  ```

- Line 10 (write)
  Config path: bui
  Context:
  ```typescript
  const fullConfig = await ConfigManager.fullConfig(startDir);
  const redactedFullConfig = await ConfigManager.redactedFullConfig(startDir);
  const { buiHostname, buiPort, buiUseTls } = fullConfig.bui;
  
  // it appears that Deno Fresh doesn't honour the `hostname` option - it's always 'localhost'
  ```

- Line 16 (write)
  Config path: bui.tlsCertPem
  Context:
  ```typescript
  
  if (buiUseTls) {
  	const cert = fullConfig.bui.tlsCertPem ||
  		await readFromBbDir(startDir, fullConfig.bui.tlsCertFile || 'localhost.pem') ||
  		await readFromGlobalConfigDir(fullConfig.bui.tlsCertFile || 'localhost.pem') || '';
  ```

- Line 16 (write)
  Config path: bui.tlsCertPem
  Context:
  ```typescript
  
  if (buiUseTls) {
  	const cert = fullConfig.bui.tlsCertPem ||
  		await readFromBbDir(startDir, fullConfig.bui.tlsCertFile || 'localhost.pem') ||
  		await readFromGlobalConfigDir(fullConfig.bui.tlsCertFile || 'localhost.pem') || '';
  ```

- Line 17 (read)
  Config path: bui.tlsCertFile
  Context:
  ```typescript
  if (buiUseTls) {
  	const cert = fullConfig.bui.tlsCertPem ||
  		await readFromBbDir(startDir, fullConfig.bui.tlsCertFile || 'localhost.pem') ||
  		await readFromGlobalConfigDir(fullConfig.bui.tlsCertFile || 'localhost.pem') || '';
  	const key = fullConfig.bui.tlsKeyPem ||
  ```

- Line 17 (read)
  Config path: bui.tlsCertFile
  Context:
  ```typescript
  if (buiUseTls) {
  	const cert = fullConfig.bui.tlsCertPem ||
  		await readFromBbDir(startDir, fullConfig.bui.tlsCertFile || 'localhost.pem') ||
  		await readFromGlobalConfigDir(fullConfig.bui.tlsCertFile || 'localhost.pem') || '';
  	const key = fullConfig.bui.tlsKeyPem ||
  ```

- Line 18 (read)
  Config path: bui.tlsCertFile
  Context:
  ```typescript
  	const cert = fullConfig.bui.tlsCertPem ||
  		await readFromBbDir(startDir, fullConfig.bui.tlsCertFile || 'localhost.pem') ||
  		await readFromGlobalConfigDir(fullConfig.bui.tlsCertFile || 'localhost.pem') || '';
  	const key = fullConfig.bui.tlsKeyPem ||
  		await readFromBbDir(startDir, fullConfig.bui.tlsKeyFile || 'localhost-key.pem') ||
  ```

- Line 18 (read)
  Config path: bui.tlsCertFile
  Context:
  ```typescript
  	const cert = fullConfig.bui.tlsCertPem ||
  		await readFromBbDir(startDir, fullConfig.bui.tlsCertFile || 'localhost.pem') ||
  		await readFromGlobalConfigDir(fullConfig.bui.tlsCertFile || 'localhost.pem') || '';
  	const key = fullConfig.bui.tlsKeyPem ||
  		await readFromBbDir(startDir, fullConfig.bui.tlsKeyFile || 'localhost-key.pem') ||
  ```

- Line 19 (write)
  Config path: bui.tlsKeyPem
  Context:
  ```typescript
  		await readFromBbDir(startDir, fullConfig.bui.tlsCertFile || 'localhost.pem') ||
  		await readFromGlobalConfigDir(fullConfig.bui.tlsCertFile || 'localhost.pem') || '';
  	const key = fullConfig.bui.tlsKeyPem ||
  		await readFromBbDir(startDir, fullConfig.bui.tlsKeyFile || 'localhost-key.pem') ||
  		await readFromGlobalConfigDir(fullConfig.bui.tlsKeyFile || 'localhost-key.pem') || '';
  ```

- Line 19 (write)
  Config path: bui.tlsKeyPem
  Context:
  ```typescript
  		await readFromBbDir(startDir, fullConfig.bui.tlsCertFile || 'localhost.pem') ||
  		await readFromGlobalConfigDir(fullConfig.bui.tlsCertFile || 'localhost.pem') || '';
  	const key = fullConfig.bui.tlsKeyPem ||
  		await readFromBbDir(startDir, fullConfig.bui.tlsKeyFile || 'localhost-key.pem') ||
  		await readFromGlobalConfigDir(fullConfig.bui.tlsKeyFile || 'localhost-key.pem') || '';
  ```

- Line 20 (read)
  Config path: bui.tlsKeyFile
  Context:
  ```typescript
  		await readFromGlobalConfigDir(fullConfig.bui.tlsCertFile || 'localhost.pem') || '';
  	const key = fullConfig.bui.tlsKeyPem ||
  		await readFromBbDir(startDir, fullConfig.bui.tlsKeyFile || 'localhost-key.pem') ||
  		await readFromGlobalConfigDir(fullConfig.bui.tlsKeyFile || 'localhost-key.pem') || '';
  
  ```

- Line 20 (read)
  Config path: bui.tlsKeyFile
  Context:
  ```typescript
  		await readFromGlobalConfigDir(fullConfig.bui.tlsCertFile || 'localhost.pem') || '';
  	const key = fullConfig.bui.tlsKeyPem ||
  		await readFromBbDir(startDir, fullConfig.bui.tlsKeyFile || 'localhost-key.pem') ||
  		await readFromGlobalConfigDir(fullConfig.bui.tlsKeyFile || 'localhost-key.pem') || '';
  
  ```

- Line 21 (read)
  Config path: bui.tlsKeyFile
  Context:
  ```typescript
  	const key = fullConfig.bui.tlsKeyPem ||
  		await readFromBbDir(startDir, fullConfig.bui.tlsKeyFile || 'localhost-key.pem') ||
  		await readFromGlobalConfigDir(fullConfig.bui.tlsKeyFile || 'localhost-key.pem') || '';
  
  	listenOpts = { ...listenOpts, secure: true, cert, key } as Deno.TcpListenOptions;
  ```

- Line 21 (read)
  Config path: bui.tlsKeyFile
  Context:
  ```typescript
  	const key = fullConfig.bui.tlsKeyPem ||
  		await readFromBbDir(startDir, fullConfig.bui.tlsKeyFile || 'localhost-key.pem') ||
  		await readFromGlobalConfigDir(fullConfig.bui.tlsKeyFile || 'localhost-key.pem') || '';
  
  	listenOpts = { ...listenOpts, secure: true, cert, key } as Deno.TcpListenOptions;
  ```

### bui/src/hooks/useChatState.ts
- Line 39 (write)
  Config path: apiUrl
  Context:
  ```typescript
  ): Promise<InitializationResult> {
  	// Create API client first
  	const apiClient = createApiClientManager(config.apiUrl);
  
  	// Create WebSocket manager last
  ```

- Line 43 (read)
  Config path: wsUrl
  Context:
  ```typescript
  	// Create WebSocket manager last
  	const wsManager = createWebSocketManager({
  		url: config.wsUrl,
  		startDir: config.startDir,
  		onMessage: config.onMessage,
  ```

- Line 44 (read)
  Config path: startDir
  Context:
  ```typescript
  	const wsManager = createWebSocketManager({
  		url: config.wsUrl,
  		startDir: config.startDir,
  		onMessage: config.onMessage,
  		onError: config.onError,
  ```

- Line 45 (read)
  Config path: onMessage
  Context:
  ```typescript
  		url: config.wsUrl,
  		startDir: config.startDir,
  		onMessage: config.onMessage,
  		onError: config.onError,
  		onClose: config.onClose,
  ```

- Line 46 (read)
  Config path: onError
  Context:
  ```typescript
  		startDir: config.startDir,
  		onMessage: config.onMessage,
  		onError: config.onError,
  		onClose: config.onClose,
  		onOpen: config.onOpen,
  ```

- Line 47 (read)
  Config path: onClose
  Context:
  ```typescript
  		onMessage: config.onMessage,
  		onError: config.onError,
  		onClose: config.onClose,
  		onOpen: config.onOpen,
  	});
  ```

- Line 48 (read)
  Config path: onOpen
  Context:
  ```typescript
  		onError: config.onError,
  		onClose: config.onClose,
  		onOpen: config.onOpen,
  	});
  
  ```

- Line 96 (write)
  Config path: startDir
  Context:
  ```typescript
  
  				// Load conversation list before WebSocket setup
  				const conversationResponse = await apiClient.getConversations(config.startDir);
  				if (!conversationResponse) {
  					throw new Error('Failed to load conversations');
  ```

- Line 108 (write)
  Config path: startDir
  Context:
  ```typescript
  
  				// Load conversation data first
  				const conversation = await apiClient.getConversation(conversationId, config.startDir);
  				const logDataEntries = conversation?.logDataEntries || [];
  
  ```

- Line 186 (read)
  Config path: apiUrl
  Context:
  ```typescript
  			}
  		};
  	}, [config.apiUrl, config.wsUrl, config.startDir]);
  
  	// WebSocket event handlers
  ```

- Line 525 (write)
  Config path: startDir
  Context:
  ```typescript
  					throw new Error('Chat API client was lost during conversation load');
  				}
  				const conversation = await chatState.value.apiClient.getConversation(id, config.startDir);
  				console.log(`useChatState: selectConversation for ${id}: loaded`);
  
  ```

### bui/src/islands/Chat.tsx
- Line 57 (read)
  Context:
  ```typescript
  const getApiHostname = () => {
  	const params = getUrlParams();
  	return params?.get('apiHostname') || 'localhost';
  };
  
  ```

- Line 62 (read)
  Context:
  ```typescript
  const getApiPort = () => {
  	const params = getUrlParams();
  	return params?.get('apiPort') || '3162';
  };
  
  ```

- Line 67 (write)
  Context:
  ```typescript
  const getApiUseTls = () => {
  	const params = getUrlParams();
  	return params?.get('apiUseTls') === 'true';
  };
  
  ```

- Line 110 (write)
  Context:
  ```typescript
  
  	// Initialize chat configuration
  	const apiHostname = getApiHostname();
  	const apiPort = getApiPort();
  	const apiUseTls = getApiUseTls();
  ```

- Line 111 (write)
  Context:
  ```typescript
  	// Initialize chat configuration
  	const apiHostname = getApiHostname();
  	const apiPort = getApiPort();
  	const apiUseTls = getApiUseTls();
  
  ```

- Line 112 (write)
  Context:
  ```typescript
  	const apiHostname = getApiHostname();
  	const apiPort = getApiPort();
  	const apiUseTls = getApiUseTls();
  
  	if (!apiHostname || !apiPort) {
  ```

- Line 114 (read)
  Context:
  ```typescript
  	const apiUseTls = getApiUseTls();
  
  	if (!apiHostname || !apiPort) {
  		return (
  			<div className='flex items-center justify-center h-screen'>
  ```

- Line 114 (read)
  Context:
  ```typescript
  	const apiUseTls = getApiUseTls();
  
  	if (!apiHostname || !apiPort) {
  		return (
  			<div className='flex items-center justify-center h-screen'>
  ```

- Line 121 (write)
  Context:
  ```typescript
  					type='error'
  				>
  					<span>Missing required URL parameters. Expected format: #apiHostname=host&apiPort=port</span>
  				</AnimatedNotification>
  			</div>
  ```

- Line 121 (write)
  Context:
  ```typescript
  					type='error'
  				>
  					<span>Missing required URL parameters. Expected format: #apiHostname=host&apiPort=port</span>
  				</AnimatedNotification>
  			</div>
  ```

- Line 128 (read)
  Context:
  ```typescript
  
  	const config: ChatConfig = {
  		apiUrl: getApiUrl(apiHostname, apiPort, apiUseTls),
  		wsUrl: getWsUrl(apiHostname, apiPort, apiUseTls),
  		startDir,
  ```

- Line 128 (read)
  Context:
  ```typescript
  
  	const config: ChatConfig = {
  		apiUrl: getApiUrl(apiHostname, apiPort, apiUseTls),
  		wsUrl: getWsUrl(apiHostname, apiPort, apiUseTls),
  		startDir,
  ```

- Line 128 (read)
  Context:
  ```typescript
  
  	const config: ChatConfig = {
  		apiUrl: getApiUrl(apiHostname, apiPort, apiUseTls),
  		wsUrl: getWsUrl(apiHostname, apiPort, apiUseTls),
  		startDir,
  ```

- Line 129 (read)
  Context:
  ```typescript
  	const config: ChatConfig = {
  		apiUrl: getApiUrl(apiHostname, apiPort, apiUseTls),
  		wsUrl: getWsUrl(apiHostname, apiPort, apiUseTls),
  		startDir,
  
  ```

- Line 129 (read)
  Context:
  ```typescript
  	const config: ChatConfig = {
  		apiUrl: getApiUrl(apiHostname, apiPort, apiUseTls),
  		wsUrl: getWsUrl(apiHostname, apiPort, apiUseTls),
  		startDir,
  
  ```

- Line 129 (read)
  Context:
  ```typescript
  	const config: ChatConfig = {
  		apiUrl: getApiUrl(apiHostname, apiPort, apiUseTls),
  		wsUrl: getWsUrl(apiHostname, apiPort, apiUseTls),
  		startDir,
  
  ```

### bui/src/main.ts
- Line 12 (read)
  Config path: ts
  Context:
  ```typescript
  import { start } from '$fresh/server.ts';
  import manifest from './fresh.gen.ts';
  import config from './fresh.config.ts';
  
  await start(manifest, config);
  ```

### bui/src/routes/index.tsx
- Line 5 (read)
  Context:
  ```typescript
  
  interface HomeProps {
  	//apiHostname: string;
  	//apiPort: number;
  }
  ```

- Line 6 (read)
  Context:
  ```typescript
  interface HomeProps {
  	//apiHostname: string;
  	//apiPort: number;
  }
  
  ```

- Line 11 (write)
  Context:
  ```typescript
  export default function Home(props: PageProps<HomeProps>) {
  	//console.log("index.tsx: props =", props);
  	//const { apiHostname, apiPort } = props.state;
  	//console.log("index.tsx: apiHostname:apiPort =", apiHostname, apiPort);
  	return (
  ```

- Line 11 (write)
  Context:
  ```typescript
  export default function Home(props: PageProps<HomeProps>) {
  	//console.log("index.tsx: props =", props);
  	//const { apiHostname, apiPort } = props.state;
  	//console.log("index.tsx: apiHostname:apiPort =", apiHostname, apiPort);
  	return (
  ```

- Line 12 (write)
  Context:
  ```typescript
  	//console.log("index.tsx: props =", props);
  	//const { apiHostname, apiPort } = props.state;
  	//console.log("index.tsx: apiHostname:apiPort =", apiHostname, apiPort);
  	return (
  		<div class='h-screen bg-gray-100'>
  ```

- Line 12 (write)
  Context:
  ```typescript
  	//console.log("index.tsx: props =", props);
  	//const { apiHostname, apiPort } = props.state;
  	//console.log("index.tsx: apiHostname:apiPort =", apiHostname, apiPort);
  	return (
  		<div class='h-screen bg-gray-100'>
  ```

### bui/src/utils/websocketManager.utils.ts
- Line 143 (read)
  Config path: url
  Context:
  ```typescript
  
  	constructor(config: WebSocketManagerConfig) {
  		if (!config.url) throw new Error('WebSocket URL is required');
  		if (!config.startDir) throw new Error('Start directory is required');
  
  ```

- Line 144 (read)
  Config path: startDir
  Context:
  ```typescript
  	constructor(config: WebSocketManagerConfig) {
  		if (!config.url) throw new Error('WebSocket URL is required');
  		if (!config.startDir) throw new Error('Start directory is required');
  
  		this.wsUrl = config.url;
  ```

- Line 146 (write)
  Config path: url
  Context:
  ```typescript
  		if (!config.startDir) throw new Error('Start directory is required');
  
  		this.wsUrl = config.url;
  		this.startDir = config.startDir;
  
  ```

- Line 147 (write)
  Config path: startDir
  Context:
  ```typescript
  
  		this.wsUrl = config.url;
  		this.startDir = config.startDir;
  
  		if (config.onMessage) this.on('message', config.onMessage);
  ```

- Line 149 (read)
  Config path: onMessage
  Context:
  ```typescript
  		this.startDir = config.startDir;
  
  		if (config.onMessage) this.on('message', config.onMessage);
  		if (config.onError) this.on('error', config.onError);
  		if (config.onClose) this.on('statusChange', (status: boolean) => !status && config.onClose?.());
  ```

- Line 150 (read)
  Config path: onError
  Context:
  ```typescript
  
  		if (config.onMessage) this.on('message', config.onMessage);
  		if (config.onError) this.on('error', config.onError);
  		if (config.onClose) this.on('statusChange', (status: boolean) => !status && config.onClose?.());
  		if (config.onOpen) this.on('statusChange', (status: boolean) => status && config.onOpen?.());
  ```

- Line 151 (write)
  Config path: onClose
  Context:
  ```typescript
  		if (config.onMessage) this.on('message', config.onMessage);
  		if (config.onError) this.on('error', config.onError);
  		if (config.onClose) this.on('statusChange', (status: boolean) => !status && config.onClose?.());
  		if (config.onOpen) this.on('statusChange', (status: boolean) => status && config.onOpen?.());
  
  ```

- Line 152 (write)
  Config path: onOpen
  Context:
  ```typescript
  		if (config.onError) this.on('error', config.onError);
  		if (config.onClose) this.on('statusChange', (status: boolean) => !status && config.onClose?.());
  		if (config.onOpen) this.on('statusChange', (status: boolean) => status && config.onOpen?.());
  
  		// Initialize browser event handlers
  ```

### cli/src/commands/apiRestart.ts
- Line 19 (write)
  Context:
  ```typescript
  	.action(async ({ logLevel: apiLogLevel, logFile: apiLogFile, hostname, port, useTls }) => {
  		const startDir = Deno.cwd();
  		const fullConfig = await ConfigManager.fullConfig(startDir);
  
  		const apiHostname = `${hostname || fullConfig.api?.apiHostname || 'localhost'}`;
  ```

- Line 19 (write)
  Context:
  ```typescript
  	.action(async ({ logLevel: apiLogLevel, logFile: apiLogFile, hostname, port, useTls }) => {
  		const startDir = Deno.cwd();
  		const fullConfig = await ConfigManager.fullConfig(startDir);
  
  		const apiHostname = `${hostname || fullConfig.api?.apiHostname || 'localhost'}`;
  ```

- Line 21 (write)
  Config path: api
  Context:
  ```typescript
  		const fullConfig = await ConfigManager.fullConfig(startDir);
  
  		const apiHostname = `${hostname || fullConfig.api?.apiHostname || 'localhost'}`;
  		const apiPort = `${port || fullConfig.api?.apiPort || 3162}`; // cast as string
  		const apiUseTls = typeof useTls !== 'undefined'
  ```

- Line 21 (write)
  Config path: api
  Context:
  ```typescript
  		const fullConfig = await ConfigManager.fullConfig(startDir);
  
  		const apiHostname = `${hostname || fullConfig.api?.apiHostname || 'localhost'}`;
  		const apiPort = `${port || fullConfig.api?.apiPort || 3162}`; // cast as string
  		const apiUseTls = typeof useTls !== 'undefined'
  ```

- Line 22 (write)
  Config path: api
  Context:
  ```typescript
  
  		const apiHostname = `${hostname || fullConfig.api?.apiHostname || 'localhost'}`;
  		const apiPort = `${port || fullConfig.api?.apiPort || 3162}`; // cast as string
  		const apiUseTls = typeof useTls !== 'undefined'
  			? !!useTls
  ```

- Line 22 (write)
  Config path: api
  Context:
  ```typescript
  
  		const apiHostname = `${hostname || fullConfig.api?.apiHostname || 'localhost'}`;
  		const apiPort = `${port || fullConfig.api?.apiPort || 3162}`; // cast as string
  		const apiUseTls = typeof useTls !== 'undefined'
  			? !!useTls
  ```

- Line 23 (write)
  Context:
  ```typescript
  		const apiHostname = `${hostname || fullConfig.api?.apiHostname || 'localhost'}`;
  		const apiPort = `${port || fullConfig.api?.apiPort || 3162}`; // cast as string
  		const apiUseTls = typeof useTls !== 'undefined'
  			? !!useTls
  			: typeof fullConfig.api.apiUseTls !== 'undefined'
  ```

- Line 25 (write)
  Config path: api.apiUseTls
  Context:
  ```typescript
  		const apiUseTls = typeof useTls !== 'undefined'
  			? !!useTls
  			: typeof fullConfig.api.apiUseTls !== 'undefined'
  			? fullConfig.api.apiUseTls
  			: true;
  ```

- Line 25 (write)
  Config path: api.apiUseTls
  Context:
  ```typescript
  		const apiUseTls = typeof useTls !== 'undefined'
  			? !!useTls
  			: typeof fullConfig.api.apiUseTls !== 'undefined'
  			? fullConfig.api.apiUseTls
  			: true;
  ```

- Line 25 (write)
  Config path: api.apiUseTls
  Context:
  ```typescript
  		const apiUseTls = typeof useTls !== 'undefined'
  			? !!useTls
  			: typeof fullConfig.api.apiUseTls !== 'undefined'
  			? fullConfig.api.apiUseTls
  			: true;
  ```

- Line 26 (read)
  Config path: api.apiUseTls
  Context:
  ```typescript
  			? !!useTls
  			: typeof fullConfig.api.apiUseTls !== 'undefined'
  			? fullConfig.api.apiUseTls
  			: true;
  		try {
  ```

- Line 26 (read)
  Config path: api.apiUseTls
  Context:
  ```typescript
  			? !!useTls
  			: typeof fullConfig.api.apiUseTls !== 'undefined'
  			? fullConfig.api.apiUseTls
  			: true;
  		try {
  ```

- Line 26 (read)
  Config path: api.apiUseTls
  Context:
  ```typescript
  			? !!useTls
  			: typeof fullConfig.api.apiUseTls !== 'undefined'
  			? fullConfig.api.apiUseTls
  			: true;
  		try {
  ```

- Line 33 (read)
  Context:
  ```typescript
  			const { pid, apiLogFilePath } = await restartApiServer(
  				startDir,
  				apiHostname,
  				apiPort,
  				apiUseTls,
  ```

- Line 34 (read)
  Context:
  ```typescript
  				startDir,
  				apiHostname,
  				apiPort,
  				apiUseTls,
  				apiLogLevel,
  ```

- Line 35 (read)
  Context:
  ```typescript
  				apiHostname,
  				apiPort,
  				apiUseTls,
  				apiLogLevel,
  				apiLogFile,
  ```

### cli/src/commands/apiStart.ts
- Line 23 (write)
  Context:
  ```typescript
  		) => {
  			const startDir = Deno.cwd();
  			const fullConfig = await ConfigManager.fullConfig(startDir);
  			const apiHostname = `${hostname || fullConfig.api.apiHostname || 'localhost'}`;
  			const apiPort = `${port || fullConfig.api.apiPort || 3162}`; // cast as string
  ```

- Line 23 (write)
  Context:
  ```typescript
  		) => {
  			const startDir = Deno.cwd();
  			const fullConfig = await ConfigManager.fullConfig(startDir);
  			const apiHostname = `${hostname || fullConfig.api.apiHostname || 'localhost'}`;
  			const apiPort = `${port || fullConfig.api.apiPort || 3162}`; // cast as string
  ```

- Line 24 (write)
  Config path: api.apiHostname
  Context:
  ```typescript
  			const startDir = Deno.cwd();
  			const fullConfig = await ConfigManager.fullConfig(startDir);
  			const apiHostname = `${hostname || fullConfig.api.apiHostname || 'localhost'}`;
  			const apiPort = `${port || fullConfig.api.apiPort || 3162}`; // cast as string
  			const apiUseTls = typeof useTls !== 'undefined'
  ```

- Line 24 (write)
  Config path: api.apiHostname
  Context:
  ```typescript
  			const startDir = Deno.cwd();
  			const fullConfig = await ConfigManager.fullConfig(startDir);
  			const apiHostname = `${hostname || fullConfig.api.apiHostname || 'localhost'}`;
  			const apiPort = `${port || fullConfig.api.apiPort || 3162}`; // cast as string
  			const apiUseTls = typeof useTls !== 'undefined'
  ```

- Line 24 (write)
  Config path: api.apiHostname
  Context:
  ```typescript
  			const startDir = Deno.cwd();
  			const fullConfig = await ConfigManager.fullConfig(startDir);
  			const apiHostname = `${hostname || fullConfig.api.apiHostname || 'localhost'}`;
  			const apiPort = `${port || fullConfig.api.apiPort || 3162}`; // cast as string
  			const apiUseTls = typeof useTls !== 'undefined'
  ```

- Line 25 (write)
  Config path: api.apiPort
  Context:
  ```typescript
  			const fullConfig = await ConfigManager.fullConfig(startDir);
  			const apiHostname = `${hostname || fullConfig.api.apiHostname || 'localhost'}`;
  			const apiPort = `${port || fullConfig.api.apiPort || 3162}`; // cast as string
  			const apiUseTls = typeof useTls !== 'undefined'
  				? !!useTls
  ```

- Line 25 (write)
  Config path: api.apiPort
  Context:
  ```typescript
  			const fullConfig = await ConfigManager.fullConfig(startDir);
  			const apiHostname = `${hostname || fullConfig.api.apiHostname || 'localhost'}`;
  			const apiPort = `${port || fullConfig.api.apiPort || 3162}`; // cast as string
  			const apiUseTls = typeof useTls !== 'undefined'
  				? !!useTls
  ```

- Line 25 (write)
  Config path: api.apiPort
  Context:
  ```typescript
  			const fullConfig = await ConfigManager.fullConfig(startDir);
  			const apiHostname = `${hostname || fullConfig.api.apiHostname || 'localhost'}`;
  			const apiPort = `${port || fullConfig.api.apiPort || 3162}`; // cast as string
  			const apiUseTls = typeof useTls !== 'undefined'
  				? !!useTls
  ```

- Line 26 (write)
  Context:
  ```typescript
  			const apiHostname = `${hostname || fullConfig.api.apiHostname || 'localhost'}`;
  			const apiPort = `${port || fullConfig.api.apiPort || 3162}`; // cast as string
  			const apiUseTls = typeof useTls !== 'undefined'
  				? !!useTls
  				: typeof fullConfig.api.apiUseTls !== 'undefined'
  ```

- Line 28 (write)
  Config path: api.apiUseTls
  Context:
  ```typescript
  			const apiUseTls = typeof useTls !== 'undefined'
  				? !!useTls
  				: typeof fullConfig.api.apiUseTls !== 'undefined'
  				? fullConfig.api.apiUseTls
  				: true;
  ```

- Line 28 (write)
  Config path: api.apiUseTls
  Context:
  ```typescript
  			const apiUseTls = typeof useTls !== 'undefined'
  				? !!useTls
  				: typeof fullConfig.api.apiUseTls !== 'undefined'
  				? fullConfig.api.apiUseTls
  				: true;
  ```

- Line 28 (write)
  Config path: api.apiUseTls
  Context:
  ```typescript
  			const apiUseTls = typeof useTls !== 'undefined'
  				? !!useTls
  				: typeof fullConfig.api.apiUseTls !== 'undefined'
  				? fullConfig.api.apiUseTls
  				: true;
  ```

- Line 29 (read)
  Config path: api.apiUseTls
  Context:
  ```typescript
  				? !!useTls
  				: typeof fullConfig.api.apiUseTls !== 'undefined'
  				? fullConfig.api.apiUseTls
  				: true;
  
  ```

- Line 29 (read)
  Config path: api.apiUseTls
  Context:
  ```typescript
  				? !!useTls
  				: typeof fullConfig.api.apiUseTls !== 'undefined'
  				? fullConfig.api.apiUseTls
  				: true;
  
  ```

- Line 29 (read)
  Config path: api.apiUseTls
  Context:
  ```typescript
  				? !!useTls
  				: typeof fullConfig.api.apiUseTls !== 'undefined'
  				? fullConfig.api.apiUseTls
  				: true;
  
  ```

- Line 33 (write)
  Config path: noBrowser
  Context:
  ```typescript
  
  			const startNoBrowser = noBrowser ||
  				(typeof fullConfig.noBrowser !== 'undefined' ? fullConfig.noBrowser : false);
  
  			// Start the server
  ```

- Line 38 (read)
  Context:
  ```typescript
  			const { pid, apiLogFilePath } = await startApiServer(
  				startDir,
  				apiHostname,
  				apiPort,
  				apiUseTls,
  ```

- Line 39 (read)
  Context:
  ```typescript
  				startDir,
  				apiHostname,
  				apiPort,
  				apiUseTls,
  				apiLogLevel,
  ```

- Line 40 (read)
  Context:
  ```typescript
  				apiHostname,
  				apiPort,
  				apiUseTls,
  				apiLogLevel,
  				apiLogFile,
  ```

- Line 46 (write)
  Context:
  ```typescript
  			);
  
  			const chatUrl = `https://chat.beyondbetter.dev/#apiHostname=${
  				encodeURIComponent(apiHostname)
  			}&apiPort=${apiPort}&apiUseTls=${apiUseTls ? 'true' : 'false'}&startDir=${encodeURIComponent(startDir)}`;
  ```

- Line 47 (read)
  Context:
  ```typescript
  
  			const chatUrl = `https://chat.beyondbetter.dev/#apiHostname=${
  				encodeURIComponent(apiHostname)
  			}&apiPort=${apiPort}&apiUseTls=${apiUseTls ? 'true' : 'false'}&startDir=${encodeURIComponent(startDir)}`;
  
  ```

- Line 48 (write)
  Context:
  ```typescript
  			const chatUrl = `https://chat.beyondbetter.dev/#apiHostname=${
  				encodeURIComponent(apiHostname)
  			}&apiPort=${apiPort}&apiUseTls=${apiUseTls ? 'true' : 'false'}&startDir=${encodeURIComponent(startDir)}`;
  
  			// Check if the API is running with enhanced status checking
  ```

- Line 48 (write)
  Context:
  ```typescript
  			const chatUrl = `https://chat.beyondbetter.dev/#apiHostname=${
  				encodeURIComponent(apiHostname)
  			}&apiPort=${apiPort}&apiUseTls=${apiUseTls ? 'true' : 'false'}&startDir=${encodeURIComponent(startDir)}`;
  
  			// Check if the API is running with enhanced status checking
  ```

- Line 114 (read)
  Config path: bbExeName
  Context:
  ```typescript
  				console.log(`Logs are being written to: ${colors.green(apiLogFilePath)}`);
  				console.log(`Chat URL: ${colors.bold.cyan(chatUrl)}`);
  				console.log(`Use ${colors.bold.green(`'${fullConfig.bbExeName} stop'`)} to stop the server.`);
  				if (!startNoBrowser) console.log('\nAttempting to open the chat in your default browser...');
  				Deno.exit(0);
  ```

### cli/src/commands/config.ts
- Line 47 (read)
  Config path: showHelp
  Context:
  ```typescript
  	.description('View or update BB configuration')
  	.action(() => {
  		config.showHelp();
  		Deno.exit(1);
  	})
  ```

- Line 62 (write)
  Context:
  ```typescript
  			let config: unknown;
  			if (global) {
  				config = await ConfigManager.globalConfig();
  				console.log(colors.bold('Global configuration:'));
  			} else if (project) {
  ```

- Line 62 (write)
  Context:
  ```typescript
  			let config: unknown;
  			if (global) {
  				config = await ConfigManager.globalConfig();
  				console.log(colors.bold('Global configuration:'));
  			} else if (project) {
  ```

- Line 65 (write)
  Context:
  ```typescript
  				console.log(colors.bold('Global configuration:'));
  			} else if (project) {
  				config = await ConfigManager.projectConfig(Deno.cwd());
  				console.log(colors.bold('Project configuration:'));
  			} else {
  ```

- Line 65 (write)
  Context:
  ```typescript
  				console.log(colors.bold('Global configuration:'));
  			} else if (project) {
  				config = await ConfigManager.projectConfig(Deno.cwd());
  				console.log(colors.bold('Project configuration:'));
  			} else {
  ```

- Line 68 (write)
  Context:
  ```typescript
  				console.log(colors.bold('Project configuration:'));
  			} else {
  				config = await ConfigManager.redactedFullConfig(Deno.cwd());
  				console.log(colors.bold('Current configuration:'));
  			}
  ```

- Line 90 (write)
  Context:
  ```typescript
  			let value: unknown;
  			if (global) {
  				const config = await ConfigManager.globalConfig();
  				value = await getConfigValue(key, config);
  			} else if (project) {
  ```

- Line 90 (write)
  Context:
  ```typescript
  			let value: unknown;
  			if (global) {
  				const config = await ConfigManager.globalConfig();
  				value = await getConfigValue(key, config);
  			} else if (project) {
  ```

- Line 93 (write)
  Context:
  ```typescript
  				value = await getConfigValue(key, config);
  			} else if (project) {
  				const config = await ConfigManager.projectConfig(Deno.cwd());
  				value = await getConfigValue(key, config);
  			} else {
  ```

- Line 93 (write)
  Context:
  ```typescript
  				value = await getConfigValue(key, config);
  			} else if (project) {
  				const config = await ConfigManager.projectConfig(Deno.cwd());
  				value = await getConfigValue(key, config);
  			} else {
  ```

- Line 96 (write)
  Context:
  ```typescript
  				value = await getConfigValue(key, config);
  			} else {
  				const config = await ConfigManager.redactedFullConfig(Deno.cwd());
  				value = await getConfigValue(key, config);
  			}
  ```

- Line 123 (write)
  Context:
  ```typescript
  			}
  
  			const configManager = await ConfigManager.getInstance();
  			if (global) {
  				await configManager.setGlobalConfigValue(key, value);
  ```

### cli/src/commands/conversationChat.ts
- Line 36 (write)
  Context:
  ```typescript
  	.action(async (options) => {
  		let apiStartedByUs = false;
  		const fullConfig = await ConfigManager.fullConfig(startDir);
  		const bbDir = await getBbDir(startDir);
  		const projectRoot = await getProjectRoot(startDir);
  ```

- Line 36 (write)
  Context:
  ```typescript
  	.action(async (options) => {
  		let apiStartedByUs = false;
  		const fullConfig = await ConfigManager.fullConfig(startDir);
  		const bbDir = await getBbDir(startDir);
  		const projectRoot = await getProjectRoot(startDir);
  ```

- Line 40 (write)
  Config path: api
  Context:
  ```typescript
  		const projectRoot = await getProjectRoot(startDir);
  
  		const apiHostname = fullConfig.api?.apiHostname || 'localhost';
  		const apiPort = fullConfig.api?.apiPort || 3162; // cast as string
  		const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  ```

- Line 40 (write)
  Config path: api
  Context:
  ```typescript
  		const projectRoot = await getProjectRoot(startDir);
  
  		const apiHostname = fullConfig.api?.apiHostname || 'localhost';
  		const apiPort = fullConfig.api?.apiPort || 3162; // cast as string
  		const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  ```

- Line 41 (write)
  Config path: api
  Context:
  ```typescript
  
  		const apiHostname = fullConfig.api?.apiHostname || 'localhost';
  		const apiPort = fullConfig.api?.apiPort || 3162; // cast as string
  		const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  		const apiClient = await ApiClient.create(startDir, apiHostname, apiPort, apiUseTls);
  ```

- Line 41 (write)
  Config path: api
  Context:
  ```typescript
  
  		const apiHostname = fullConfig.api?.apiHostname || 'localhost';
  		const apiPort = fullConfig.api?.apiPort || 3162; // cast as string
  		const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  		const apiClient = await ApiClient.create(startDir, apiHostname, apiPort, apiUseTls);
  ```

- Line 42 (write)
  Config path: api.apiUseTls
  Context:
  ```typescript
  		const apiHostname = fullConfig.api?.apiHostname || 'localhost';
  		const apiPort = fullConfig.api?.apiPort || 3162; // cast as string
  		const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  		const apiClient = await ApiClient.create(startDir, apiHostname, apiPort, apiUseTls);
  		const websocketManager = new WebsocketManager();
  ```

- Line 42 (write)
  Config path: api.apiUseTls
  Context:
  ```typescript
  		const apiHostname = fullConfig.api?.apiHostname || 'localhost';
  		const apiPort = fullConfig.api?.apiPort || 3162; // cast as string
  		const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  		const apiClient = await ApiClient.create(startDir, apiHostname, apiPort, apiUseTls);
  		const websocketManager = new WebsocketManager();
  ```

- Line 42 (write)
  Config path: api.apiUseTls
  Context:
  ```typescript
  		const apiHostname = fullConfig.api?.apiHostname || 'localhost';
  		const apiPort = fullConfig.api?.apiPort || 3162; // cast as string
  		const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  		const apiClient = await ApiClient.create(startDir, apiHostname, apiPort, apiUseTls);
  		const websocketManager = new WebsocketManager();
  ```

- Line 43 (write)
  Context:
  ```typescript
  		const apiPort = fullConfig.api?.apiPort || 3162; // cast as string
  		const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  		const apiClient = await ApiClient.create(startDir, apiHostname, apiPort, apiUseTls);
  		const websocketManager = new WebsocketManager();
  
  ```

- Line 43 (write)
  Context:
  ```typescript
  		const apiPort = fullConfig.api?.apiPort || 3162; // cast as string
  		const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  		const apiClient = await ApiClient.create(startDir, apiHostname, apiPort, apiUseTls);
  		const websocketManager = new WebsocketManager();
  
  ```

- Line 43 (write)
  Context:
  ```typescript
  		const apiPort = fullConfig.api?.apiPort || 3162; // cast as string
  		const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  		const apiClient = await ApiClient.create(startDir, apiHostname, apiPort, apiUseTls);
  		const websocketManager = new WebsocketManager();
  
  ```

- Line 91 (read)
  Context:
  ```typescript
  				const { pid: _pid, apiLogFilePath: _apiLogFilePath, listen: _listen } = await startApiServer(
  					projectRoot,
  					apiHostname,
  					`${apiPort}`,
  				);
  ```

- Line 92 (read)
  Context:
  ```typescript
  					projectRoot,
  					apiHostname,
  					`${apiPort}`,
  				);
  				// Check if the API is running with enhanced status checking
  ```

- Line 210 (write)
  Context:
  ```typescript
  				// 				console.log(`Waiting for 2 mins.`);
  				// 	await new Promise((resolve) => setTimeout(resolve, 120000));
  				await websocketManager.setupWebsocket(conversationId, startDir, apiHostname, apiPort);
  
  				// Set up event listeners
  ```

- Line 210 (write)
  Context:
  ```typescript
  				// 				console.log(`Waiting for 2 mins.`);
  				// 	await new Promise((resolve) => setTimeout(resolve, 120000));
  				await websocketManager.setupWebsocket(conversationId, startDir, apiHostname, apiPort);
  
  				// Set up event listeners
  ```

### cli/src/commands/conversationList.ts
- Line 19 (write)
  Context:
  ```typescript
  		try {
  			const startDir = resolve(directory);
  			const fullConfig = await ConfigManager.fullConfig(startDir);
  			const apiClient = await ApiClient.create(startDir);
  			const response = await apiClient.get(
  ```

- Line 19 (write)
  Context:
  ```typescript
  		try {
  			const startDir = resolve(directory);
  			const fullConfig = await ConfigManager.fullConfig(startDir);
  			const apiClient = await ApiClient.create(startDir);
  			const response = await apiClient.get(
  ```

- Line 52 (read)
  Config path: bbExeName
  Context:
  ```typescript
  					if (pagination.page < pagination.totalPages) {
  						console.log(
  							`To view the next page, use: ${fullConfig.bbExeName} conversation list --page ${
  								pagination.page + 1
  							} --limit ${limit}`,
  ```

- Line 59 (read)
  Config path: bbExeName
  Context:
  ```typescript
  					if (pagination.page > 1) {
  						console.log(
  							`To view the previous page, use: ${fullConfig.bbExeName} conversation list --page ${
  								pagination.page - 1
  							} --limit ${limit}`,
  ```

- Line 66 (read)
  Config path: bbExeName
  Context:
  ```typescript
  					console.log(`Current items per page: ${limit}`);
  					console.log(`To change the number of items per page, use the --limit option. For example:`);
  					console.log(`${fullConfig.bbExeName} conversation list --page ${pagination.page} --limit 20`);
  				}
  			} else {
  ```

### cli/src/commands/init.ts
- Line 36 (write)
  Context:
  ```typescript
  	}
  
  	const configManager = await ConfigManager.getInstance();
  	const existingProjectConfig = await configManager.getExistingProjectConfig(startDir);
  	const globalConfig = await configManager.loadGlobalConfig();
  ```

- Line 38 (write)
  Context:
  ```typescript
  	const configManager = await ConfigManager.getInstance();
  	const existingProjectConfig = await configManager.getExistingProjectConfig(startDir);
  	const globalConfig = await configManager.loadGlobalConfig();
  
  	const defaultProjectName = existingProjectConfig.project?.name || basename(startDir);
  ```

- Line 45 (write)
  Config path: api
  Context:
  ```typescript
  	const defaultAssistantName = existingProjectConfig.myAssistantsName || 'Claude';
  	const existingApiKey = existingProjectConfig.api?.anthropicApiKey || '';
  	const isApiKeyRequired = !globalConfig.api?.anthropicApiKey;
  
  	const answers = await prompt([
  ```

- Line 157 (write)
  Context:
  ```typescript
  	useTlsCert: boolean,
  ) {
  	const configManager = await ConfigManager.getInstance();
  	const globalConfig = await configManager.loadGlobalConfig();
  	console.log(`\n${colors.bold.blue.underline('BB Project Details:')}`);
  ```

- Line 158 (write)
  Context:
  ```typescript
  ) {
  	const configManager = await ConfigManager.getInstance();
  	const globalConfig = await configManager.loadGlobalConfig();
  	console.log(`\n${colors.bold.blue.underline('BB Project Details:')}`);
  	console.log(`  ${colors.bold('Name:')} ${colors.green(projectName)}`);
  ```

- Line 173 (write)
  Config path: bbExeName
  Context:
  ```typescript
  	console.log(`\n${colors.bold('Configuration Instructions:')}`);
  	console.log('1. To modify project-level config:');
  	console.log(`   Use ${colors.bold.green(`'${globalConfig.bbExeName} config set --project <key> <value>'`)}`);
  	console.log('   OR - manually edit the .bb/config.yaml file in your project directory');
  	console.log('2. To modify system/user level config:');
  ```

- Line 174 (read)
  Config path: yaml
  Context:
  ```typescript
  	console.log('1. To modify project-level config:');
  	console.log(`   Use ${colors.bold.green(`'${globalConfig.bbExeName} config set --project <key> <value>'`)}`);
  	console.log('   OR - manually edit the .bb/config.yaml file in your project directory');
  	console.log('2. To modify system/user level config:');
  	console.log(`   Use ${colors.bold.green(`'${globalConfig.bbExeName} config set --global <key> <value>'`)}`);
  ```

- Line 176 (write)
  Config path: bbExeName
  Context:
  ```typescript
  	console.log('   OR - manually edit the .bb/config.yaml file in your project directory');
  	console.log('2. To modify system/user level config:');
  	console.log(`   Use ${colors.bold.green(`'${globalConfig.bbExeName} config set --global <key> <value>'`)}`);
  	console.log('   OR - manually edit the config.yaml file in your user home directory');
  	console.log('   (usually ~/.config/bb/config.yaml on Unix-like systems)');
  ```

- Line 177 (read)
  Config path: yaml
  Context:
  ```typescript
  	console.log('2. To modify system/user level config:');
  	console.log(`   Use ${colors.bold.green(`'${globalConfig.bbExeName} config set --global <key> <value>'`)}`);
  	console.log('   OR - manually edit the config.yaml file in your user home directory');
  	console.log('   (usually ~/.config/bb/config.yaml on Unix-like systems)');
  	console.log('3. To view the current config:');
  ```

- Line 178 (read)
  Config path: yaml
  Context:
  ```typescript
  	console.log(`   Use ${colors.bold.green(`'${globalConfig.bbExeName} config set --global <key> <value>'`)}`);
  	console.log('   OR - manually edit the config.yaml file in your user home directory');
  	console.log('   (usually ~/.config/bb/config.yaml on Unix-like systems)');
  	console.log('3. To view the current config:');
  	console.log(`   Use ${colors.bold.green(`'${globalConfig.bbExeName} config view'`)}`);
  ```

- Line 180 (read)
  Config path: bbExeName
  Context:
  ```typescript
  	console.log('   (usually ~/.config/bb/config.yaml on Unix-like systems)');
  	console.log('3. To view the current config:');
  	console.log(`   Use ${colors.bold.green(`'${globalConfig.bbExeName} config view'`)}`);
  	console.log(
  		`\n${
  ```

- Line 187 (read)
  Config path: bbExeName
  Context:
  ```typescript
  	);
  	console.log(
  		`\nTo start using BB, try running: ${colors.bold.green(`'${globalConfig.bbExeName} start'`)} or ${
  			colors.bold.green(`'${globalConfig.bbExeName} chat'`)
  		}`,
  ```

- Line 188 (read)
  Config path: bbExeName
  Context:
  ```typescript
  	console.log(
  		`\nTo start using BB, try running: ${colors.bold.green(`'${globalConfig.bbExeName} start'`)} or ${
  			colors.bold.green(`'${globalConfig.bbExeName} chat'`)
  		}`,
  	);
  ```

- Line 232 (write)
  Context:
  ```typescript
  
  			// Create or update config with wizard answers and project info
  			const configManager = await ConfigManager.getInstance();
  			await configManager.ensureGlobalConfig();
  			await configManager.ensureProjectConfig(startDir, wizardAnswers);
  ```

- Line 250 (write)
  Context:
  ```typescript
  
  			let useTlsCert = wizardAnswers.useTls ?? true;
  			const certFileName = finalGlobalConfig.api.tlsCertFile || 'localhost.pem';
  			if (useTlsCert && !await certificateFileExists(certFileName)) {
  				const domain = finalGlobalConfig.api.apiHostname || 'localhost';
  ```

- Line 252 (write)
  Context:
  ```typescript
  			const certFileName = finalGlobalConfig.api.tlsCertFile || 'localhost.pem';
  			if (useTlsCert && !await certificateFileExists(certFileName)) {
  				const domain = finalGlobalConfig.api.apiHostname || 'localhost';
  				const validityDays = 365;
  				const certCreated = await generateCertificate(domain, validityDays);
  ```

- Line 252 (write)
  Context:
  ```typescript
  			const certFileName = finalGlobalConfig.api.tlsCertFile || 'localhost.pem';
  			if (useTlsCert && !await certificateFileExists(certFileName)) {
  				const domain = finalGlobalConfig.api.apiHostname || 'localhost';
  				const validityDays = 365;
  				const certCreated = await generateCertificate(domain, validityDays);
  ```

- Line 260 (write)
  Context:
  ```typescript
  							`${colors.yellow('TLS will be disabled for the API server.')}`,
  					);
  					// Continue without cert - we'll set apiUseTls to false
  					await configManager.setGlobalConfigValue('api.apiUseTls', 'false');
  					useTlsCert = false;
  ```

- Line 261 (write)
  Context:
  ```typescript
  					);
  					// Continue without cert - we'll set apiUseTls to false
  					await configManager.setGlobalConfigValue('api.apiUseTls', 'false');
  					useTlsCert = false;
  
  ```

### cli/src/commands/secure.ts
- Line 19 (write)
  Context:
  ```typescript
  
  	try {
  		const globalConfig = await configManager.loadGlobalConfig();
  		const certFileName = globalConfig.api.tlsCertFile || 'localhost.pem';
  
  ```

- Line 20 (write)
  Config path: api.tlsCertFile
  Context:
  ```typescript
  	try {
  		const globalConfig = await configManager.loadGlobalConfig();
  		const certFileName = globalConfig.api.tlsCertFile || 'localhost.pem';
  
  		if (!await certificateFileExists(certFileName)) {
  ```

- Line 20 (write)
  Config path: api.tlsCertFile
  Context:
  ```typescript
  	try {
  		const globalConfig = await configManager.loadGlobalConfig();
  		const certFileName = globalConfig.api.tlsCertFile || 'localhost.pem';
  
  		if (!await certificateFileExists(certFileName)) {
  ```

- Line 23 (write)
  Config path: api.apiHostname
  Context:
  ```typescript
  
  		if (!await certificateFileExists(certFileName)) {
  			const domain = globalConfig.api.apiHostname || 'localhost';
  			const validityDays = 365;
  			await generateCertificateMkcert(domain, validityDays);
  ```

- Line 23 (write)
  Config path: api.apiHostname
  Context:
  ```typescript
  
  		if (!await certificateFileExists(certFileName)) {
  			const domain = globalConfig.api.apiHostname || 'localhost';
  			const validityDays = 365;
  			await generateCertificateMkcert(domain, validityDays);
  ```

- Line 23 (write)
  Config path: api.apiHostname
  Context:
  ```typescript
  
  		if (!await certificateFileExists(certFileName)) {
  			const domain = globalConfig.api.apiHostname || 'localhost';
  			const validityDays = 365;
  			await generateCertificateMkcert(domain, validityDays);
  ```

- Line 39 (write)
  Context:
  ```typescript
  		if (await certificateFileExists(certFileName)) {
  			// Update configuration
  			await configManager.setGlobalConfigValue('api.apiUseTls', 'true');
  			await configManager.setProjectConfigValue('api.apiUseTls', 'true', startDir);
  
  ```

- Line 40 (write)
  Context:
  ```typescript
  			// Update configuration
  			await configManager.setGlobalConfigValue('api.apiUseTls', 'true');
  			await configManager.setProjectConfigValue('api.apiUseTls', 'true', startDir);
  
  			console.log(colors.green('TLS has been enabled successfully.'));
  ```

- Line 44 (write)
  Context:
  ```typescript
  			console.log(colors.green('TLS has been enabled successfully.'));
  		} else {
  			await configManager.setGlobalConfigValue('api.apiUseTls', 'false');
  			await configManager.setProjectConfigValue('api.apiUseTls', 'false', startDir);
  
  ```

- Line 45 (write)
  Context:
  ```typescript
  		} else {
  			await configManager.setGlobalConfigValue('api.apiUseTls', 'false');
  			await configManager.setProjectConfigValue('api.apiUseTls', 'false', startDir);
  
  			console.log(colors.red('TLS has been disabled since no certificate file exists.'));
  ```

- Line 63 (write)
  Context:
  ```typescript
  	try {
  		// Update configuration
  		await configManager.setGlobalConfigValue('api.apiUseTls', 'false');
  		await configManager.setProjectConfigValue('api.apiUseTls', 'false', startDir);
  
  ```

- Line 64 (write)
  Context:
  ```typescript
  		// Update configuration
  		await configManager.setGlobalConfigValue('api.apiUseTls', 'false');
  		await configManager.setProjectConfigValue('api.apiUseTls', 'false', startDir);
  
  		console.log(colors.yellow('TLS has been disabled.'));
  ```

- Line 88 (write)
  Context:
  ```typescript
  		const startDir = Deno.cwd();
  		try {
  			const configManager = await ConfigManager.getInstance();
  			await enableTls(startDir, configManager);
  		} catch (error) {
  ```

- Line 99 (write)
  Context:
  ```typescript
  		const startDir = Deno.cwd();
  		try {
  			const configManager = await ConfigManager.getInstance();
  			await disableTls(startDir, configManager);
  		} catch (error) {
  ```

- Line 110 (write)
  Context:
  ```typescript
  		const startDir = Deno.cwd();
  		try {
  			const config = await ConfigManager.fullConfig(startDir);
  			const tlsEnabled = config.api.apiUseTls;
  			const globalDir = await getGlobalConfigDir();
  ```

- Line 110 (write)
  Context:
  ```typescript
  		const startDir = Deno.cwd();
  		try {
  			const config = await ConfigManager.fullConfig(startDir);
  			const tlsEnabled = config.api.apiUseTls;
  			const globalDir = await getGlobalConfigDir();
  ```

- Line 111 (write)
  Config path: api.apiUseTls
  Context:
  ```typescript
  		try {
  			const config = await ConfigManager.fullConfig(startDir);
  			const tlsEnabled = config.api.apiUseTls;
  			const globalDir = await getGlobalConfigDir();
  
  ```

- Line 111 (write)
  Config path: api.apiUseTls
  Context:
  ```typescript
  		try {
  			const config = await ConfigManager.fullConfig(startDir);
  			const tlsEnabled = config.api.apiUseTls;
  			const globalDir = await getGlobalConfigDir();
  
  ```

- Line 111 (write)
  Config path: api.apiUseTls
  Context:
  ```typescript
  		try {
  			const config = await ConfigManager.fullConfig(startDir);
  			const tlsEnabled = config.api.apiUseTls;
  			const globalDir = await getGlobalConfigDir();
  
  ```

- Line 123 (write)
  Config path: api.tlsCertFile
  Context:
  ```typescript
  			console.log(`TLS Status: ${colors.green('Enabled')}`);
  
  			const certFile = config.api.tlsCertFile || 'localhost.pem';
  			const keyFile = config.api.tlsKeyFile || 'localhost-key.pem';
  			const certPath = join(globalDir, certFile);
  ```

- Line 123 (write)
  Config path: api.tlsCertFile
  Context:
  ```typescript
  			console.log(`TLS Status: ${colors.green('Enabled')}`);
  
  			const certFile = config.api.tlsCertFile || 'localhost.pem';
  			const keyFile = config.api.tlsKeyFile || 'localhost-key.pem';
  			const certPath = join(globalDir, certFile);
  ```

- Line 124 (write)
  Config path: api.tlsKeyFile
  Context:
  ```typescript
  
  			const certFile = config.api.tlsCertFile || 'localhost.pem';
  			const keyFile = config.api.tlsKeyFile || 'localhost-key.pem';
  			const certPath = join(globalDir, certFile);
  			const keyPath = join(globalDir, keyFile);
  ```

- Line 124 (write)
  Config path: api.tlsKeyFile
  Context:
  ```typescript
  
  			const certFile = config.api.tlsCertFile || 'localhost.pem';
  			const keyFile = config.api.tlsKeyFile || 'localhost-key.pem';
  			const certPath = join(globalDir, certFile);
  			const keyPath = join(globalDir, keyFile);
  ```

### cli/src/collaborationLogs/collaborationLogFormatter.ts
- Line 13 (read)
  Context:
  ```typescript
  import { ConfigManager } from 'shared/configManager.ts';
  
  // [TODO] this needs to be projectConfig (or fullConfig), which means startDir needs to get passed in
  const globalConfig = await ConfigManager.globalConfig();
  
  ```

- Line 13 (read)
  Context:
  ```typescript
  import { ConfigManager } from 'shared/configManager.ts';
  
  // [TODO] this needs to be projectConfig (or fullConfig), which means startDir needs to get passed in
  const globalConfig = await ConfigManager.globalConfig();
  
  ```

- Line 14 (write)
  Context:
  ```typescript
  
  // [TODO] this needs to be projectConfig (or fullConfig), which means startDir needs to get passed in
  const globalConfig = await ConfigManager.globalConfig();
  
  // Define theme colors.
  ```

- Line 14 (write)
  Context:
  ```typescript
  
  // [TODO] this needs to be projectConfig (or fullConfig), which means startDir needs to get passed in
  const globalConfig = await ConfigManager.globalConfig();
  
  // Define theme colors.
  ```

- Line 38 (read)
  Config path: myPersonsName
  Context:
  ```typescript
  		{ icon: string; color: (text: string) => string; label: string }
  	> = {
  		user: { icon: USER_ICON, color: colors.green, label: globalConfig.myPersonsName || 'Person' },
  		assistant: { icon: ASSISTANT_ICON, color: colors.blue, label: globalConfig.myAssistantsName || 'Assistant' },
  		answer: {
  ```

- Line 39 (read)
  Config path: myAssistantsName
  Context:
  ```typescript
  	> = {
  		user: { icon: USER_ICON, color: colors.green, label: globalConfig.myPersonsName || 'Person' },
  		assistant: { icon: ASSISTANT_ICON, color: colors.blue, label: globalConfig.myAssistantsName || 'Assistant' },
  		answer: {
  			icon: ASSISTANT_ICON,
  ```

- Line 43 (read)
  Config path: myAssistantsName
  Context:
  ```typescript
  			icon: ASSISTANT_ICON,
  			color: colors.blue,
  			label: `Answer from ${globalConfig.myAssistantsName || 'Assistant'}`,
  		},
  		tool_use: { icon: TOOL_ICON, color: colors.yellow, label: 'Tool Input' },
  ```

### cli/src/main.ts
- Line 12 (read)
  Config path: ts
  Context:
  ```typescript
  import { conversationList } from './commands/conversationList.ts';
  import { viewLogs } from './commands/viewLogs.ts';
  import { config as configCommand } from './commands/config.ts';
  import { secure } from './commands/secure.ts';
  import { upgrade } from './commands/upgrade.ts';
  ```

- Line 19 (write)
  Context:
  ```typescript
  //import { logger } from 'shared/logger.ts';
  
  const globalConfig = await ConfigManager.globalConfig();
  //logger.debug('CLI Config:', globalConfig.cli);
  
  ```

- Line 19 (write)
  Context:
  ```typescript
  //import { logger } from 'shared/logger.ts';
  
  const globalConfig = await ConfigManager.globalConfig();
  //logger.debug('CLI Config:', globalConfig.cli);
  
  ```

- Line 20 (read)
  Config path: cli
  Context:
  ```typescript
  
  const globalConfig = await ConfigManager.globalConfig();
  //logger.debug('CLI Config:', globalConfig.cli);
  
  const cli = new Command()
  ```

- Line 23 (read)
  Config path: bbExeName
  Context:
  ```typescript
  
  const cli = new Command()
  	.name(globalConfig.bbExeName) // 'bb' or 'bb.exe'
  	.version(globalConfig.version as string)
  	.description('CLI tool for BB')
  ```

- Line 24 (read)
  Config path: version
  Context:
  ```typescript
  const cli = new Command()
  	.name(globalConfig.bbExeName) // 'bb' or 'bb.exe'
  	.version(globalConfig.version as string)
  	.description('CLI tool for BB')
  	.command('init', init)
  ```

### cli/src/utils/apiClient.utils.ts
- Line 26 (write)
  Context:
  ```typescript
  		useTls?: boolean,
  	): Promise<ApiClient> {
  		const fullConfig = await ConfigManager.fullConfig(startDir);
  		const apiHostname = hostname || fullConfig.api.apiHostname || 'localhost';
  		const apiPort = port || fullConfig.api.apiPort || 3162;
  ```

- Line 26 (write)
  Context:
  ```typescript
  		useTls?: boolean,
  	): Promise<ApiClient> {
  		const fullConfig = await ConfigManager.fullConfig(startDir);
  		const apiHostname = hostname || fullConfig.api.apiHostname || 'localhost';
  		const apiPort = port || fullConfig.api.apiPort || 3162;
  ```

- Line 27 (write)
  Config path: api.apiHostname
  Context:
  ```typescript
  	): Promise<ApiClient> {
  		const fullConfig = await ConfigManager.fullConfig(startDir);
  		const apiHostname = hostname || fullConfig.api.apiHostname || 'localhost';
  		const apiPort = port || fullConfig.api.apiPort || 3162;
  		const apiUseTls = typeof useTls !== 'undefined'
  ```

- Line 27 (write)
  Config path: api.apiHostname
  Context:
  ```typescript
  	): Promise<ApiClient> {
  		const fullConfig = await ConfigManager.fullConfig(startDir);
  		const apiHostname = hostname || fullConfig.api.apiHostname || 'localhost';
  		const apiPort = port || fullConfig.api.apiPort || 3162;
  		const apiUseTls = typeof useTls !== 'undefined'
  ```

- Line 27 (write)
  Config path: api.apiHostname
  Context:
  ```typescript
  	): Promise<ApiClient> {
  		const fullConfig = await ConfigManager.fullConfig(startDir);
  		const apiHostname = hostname || fullConfig.api.apiHostname || 'localhost';
  		const apiPort = port || fullConfig.api.apiPort || 3162;
  		const apiUseTls = typeof useTls !== 'undefined'
  ```

- Line 28 (write)
  Config path: api.apiPort
  Context:
  ```typescript
  		const fullConfig = await ConfigManager.fullConfig(startDir);
  		const apiHostname = hostname || fullConfig.api.apiHostname || 'localhost';
  		const apiPort = port || fullConfig.api.apiPort || 3162;
  		const apiUseTls = typeof useTls !== 'undefined'
  			? useTls
  ```

- Line 28 (write)
  Config path: api.apiPort
  Context:
  ```typescript
  		const fullConfig = await ConfigManager.fullConfig(startDir);
  		const apiHostname = hostname || fullConfig.api.apiHostname || 'localhost';
  		const apiPort = port || fullConfig.api.apiPort || 3162;
  		const apiUseTls = typeof useTls !== 'undefined'
  			? useTls
  ```

- Line 28 (write)
  Config path: api.apiPort
  Context:
  ```typescript
  		const fullConfig = await ConfigManager.fullConfig(startDir);
  		const apiHostname = hostname || fullConfig.api.apiHostname || 'localhost';
  		const apiPort = port || fullConfig.api.apiPort || 3162;
  		const apiUseTls = typeof useTls !== 'undefined'
  			? useTls
  ```

- Line 29 (write)
  Context:
  ```typescript
  		const apiHostname = hostname || fullConfig.api.apiHostname || 'localhost';
  		const apiPort = port || fullConfig.api.apiPort || 3162;
  		const apiUseTls = typeof useTls !== 'undefined'
  			? useTls
  			: typeof fullConfig.api.apiUseTls !== 'undefined'
  ```

- Line 31 (write)
  Config path: api.apiUseTls
  Context:
  ```typescript
  		const apiUseTls = typeof useTls !== 'undefined'
  			? useTls
  			: typeof fullConfig.api.apiUseTls !== 'undefined'
  			? fullConfig.api.apiUseTls
  			: true;
  ```

- Line 31 (write)
  Config path: api.apiUseTls
  Context:
  ```typescript
  		const apiUseTls = typeof useTls !== 'undefined'
  			? useTls
  			: typeof fullConfig.api.apiUseTls !== 'undefined'
  			? fullConfig.api.apiUseTls
  			: true;
  ```

- Line 31 (write)
  Config path: api.apiUseTls
  Context:
  ```typescript
  		const apiUseTls = typeof useTls !== 'undefined'
  			? useTls
  			: typeof fullConfig.api.apiUseTls !== 'undefined'
  			? fullConfig.api.apiUseTls
  			: true;
  ```

- Line 32 (read)
  Config path: api.apiUseTls
  Context:
  ```typescript
  			? useTls
  			: typeof fullConfig.api.apiUseTls !== 'undefined'
  			? fullConfig.api.apiUseTls
  			: true;
  		const baseUrl = `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}`;
  ```

- Line 32 (read)
  Config path: api.apiUseTls
  Context:
  ```typescript
  			? useTls
  			: typeof fullConfig.api.apiUseTls !== 'undefined'
  			? fullConfig.api.apiUseTls
  			: true;
  		const baseUrl = `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}`;
  ```

- Line 32 (read)
  Config path: api.apiUseTls
  Context:
  ```typescript
  			? useTls
  			: typeof fullConfig.api.apiUseTls !== 'undefined'
  			? fullConfig.api.apiUseTls
  			: true;
  		const baseUrl = `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}`;
  ```

- Line 34 (write)
  Context:
  ```typescript
  			? fullConfig.api.apiUseTls
  			: true;
  		const baseUrl = `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}`;
  		const wsUrl = `${apiUseTls ? 'wss' : 'ws'}://${apiHostname}:${apiPort}`;
  		const rootCert = fullConfig.api.tlsRootCaPem ||
  ```

- Line 34 (write)
  Context:
  ```typescript
  			? fullConfig.api.apiUseTls
  			: true;
  		const baseUrl = `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}`;
  		const wsUrl = `${apiUseTls ? 'wss' : 'ws'}://${apiHostname}:${apiPort}`;
  		const rootCert = fullConfig.api.tlsRootCaPem ||
  ```

- Line 34 (write)
  Context:
  ```typescript
  			? fullConfig.api.apiUseTls
  			: true;
  		const baseUrl = `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}`;
  		const wsUrl = `${apiUseTls ? 'wss' : 'ws'}://${apiHostname}:${apiPort}`;
  		const rootCert = fullConfig.api.tlsRootCaPem ||
  ```

- Line 35 (write)
  Context:
  ```typescript
  			: true;
  		const baseUrl = `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}`;
  		const wsUrl = `${apiUseTls ? 'wss' : 'ws'}://${apiHostname}:${apiPort}`;
  		const rootCert = fullConfig.api.tlsRootCaPem ||
  			await readFromBbDir(startDir, fullConfig.api.tlsRootCaFile || 'rootCA.pem') ||
  ```

- Line 35 (write)
  Context:
  ```typescript
  			: true;
  		const baseUrl = `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}`;
  		const wsUrl = `${apiUseTls ? 'wss' : 'ws'}://${apiHostname}:${apiPort}`;
  		const rootCert = fullConfig.api.tlsRootCaPem ||
  			await readFromBbDir(startDir, fullConfig.api.tlsRootCaFile || 'rootCA.pem') ||
  ```

- Line 35 (write)
  Context:
  ```typescript
  			: true;
  		const baseUrl = `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}`;
  		const wsUrl = `${apiUseTls ? 'wss' : 'ws'}://${apiHostname}:${apiPort}`;
  		const rootCert = fullConfig.api.tlsRootCaPem ||
  			await readFromBbDir(startDir, fullConfig.api.tlsRootCaFile || 'rootCA.pem') ||
  ```

- Line 36 (write)
  Config path: api.tlsRootCaPem
  Context:
  ```typescript
  		const baseUrl = `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}`;
  		const wsUrl = `${apiUseTls ? 'wss' : 'ws'}://${apiHostname}:${apiPort}`;
  		const rootCert = fullConfig.api.tlsRootCaPem ||
  			await readFromBbDir(startDir, fullConfig.api.tlsRootCaFile || 'rootCA.pem') ||
  			await readFromGlobalConfigDir(fullConfig.api.tlsRootCaFile || 'rootCA.pem') || '';
  ```

- Line 36 (write)
  Config path: api.tlsRootCaPem
  Context:
  ```typescript
  		const baseUrl = `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}`;
  		const wsUrl = `${apiUseTls ? 'wss' : 'ws'}://${apiHostname}:${apiPort}`;
  		const rootCert = fullConfig.api.tlsRootCaPem ||
  			await readFromBbDir(startDir, fullConfig.api.tlsRootCaFile || 'rootCA.pem') ||
  			await readFromGlobalConfigDir(fullConfig.api.tlsRootCaFile || 'rootCA.pem') || '';
  ```

- Line 37 (read)
  Config path: api.tlsRootCaFile
  Context:
  ```typescript
  		const wsUrl = `${apiUseTls ? 'wss' : 'ws'}://${apiHostname}:${apiPort}`;
  		const rootCert = fullConfig.api.tlsRootCaPem ||
  			await readFromBbDir(startDir, fullConfig.api.tlsRootCaFile || 'rootCA.pem') ||
  			await readFromGlobalConfigDir(fullConfig.api.tlsRootCaFile || 'rootCA.pem') || '';
  
  ```

- Line 37 (read)
  Config path: api.tlsRootCaFile
  Context:
  ```typescript
  		const wsUrl = `${apiUseTls ? 'wss' : 'ws'}://${apiHostname}:${apiPort}`;
  		const rootCert = fullConfig.api.tlsRootCaPem ||
  			await readFromBbDir(startDir, fullConfig.api.tlsRootCaFile || 'rootCA.pem') ||
  			await readFromGlobalConfigDir(fullConfig.api.tlsRootCaFile || 'rootCA.pem') || '';
  
  ```

- Line 38 (read)
  Config path: api.tlsRootCaFile
  Context:
  ```typescript
  		const rootCert = fullConfig.api.tlsRootCaPem ||
  			await readFromBbDir(startDir, fullConfig.api.tlsRootCaFile || 'rootCA.pem') ||
  			await readFromGlobalConfigDir(fullConfig.api.tlsRootCaFile || 'rootCA.pem') || '';
  
  		Deno.env.set('DENO_TLS_CA_STORE', 'system');
  ```

- Line 38 (read)
  Config path: api.tlsRootCaFile
  Context:
  ```typescript
  		const rootCert = fullConfig.api.tlsRootCaPem ||
  			await readFromBbDir(startDir, fullConfig.api.tlsRootCaFile || 'rootCA.pem') ||
  			await readFromGlobalConfigDir(fullConfig.api.tlsRootCaFile || 'rootCA.pem') || '';
  
  		Deno.env.set('DENO_TLS_CA_STORE', 'system');
  ```

### cli/src/utils/apiControl.utils.ts
- Line 22 (read)
  Context:
  ```typescript
  export async function startApiServer(
  	startDir: string,
  	apiHostname?: string,
  	apiPort?: string,
  	apiUseTls?: boolean,
  ```

- Line 23 (read)
  Context:
  ```typescript
  	startDir: string,
  	apiHostname?: string,
  	apiPort?: string,
  	apiUseTls?: boolean,
  	apiLogLevel?: string,
  ```

- Line 24 (read)
  Context:
  ```typescript
  	apiHostname?: string,
  	apiPort?: string,
  	apiUseTls?: boolean,
  	apiLogLevel?: string,
  	apiLogFile?: string,
  ```

- Line 31 (write)
  Context:
  ```typescript
  	// First reconcile any existing state
  	await reconcilePidState(startDir);
  	const fullConfig = await ConfigManager.fullConfig(startDir);
  	const status = await checkApiStatus(startDir);
  	if (status.apiResponds) {
  ```

- Line 31 (write)
  Context:
  ```typescript
  	// First reconcile any existing state
  	await reconcilePidState(startDir);
  	const fullConfig = await ConfigManager.fullConfig(startDir);
  	const status = await checkApiStatus(startDir);
  	if (status.apiResponds) {
  ```

- Line 37 (write)
  Config path: api
  Context:
  ```typescript
  		const pid = await getPid(startDir);
  		const bbDir = await getBbDir(startDir);
  		const apiLogFileName = apiLogFile || fullConfig.api?.logFile || 'api.log';
  		const apiLogFilePath = join(bbDir, apiLogFileName);
  		const apiHostname = fullConfig.api.apiHostname || 'localhost';
  ```

- Line 39 (write)
  Config path: api.apiHostname
  Context:
  ```typescript
  		const apiLogFileName = apiLogFile || fullConfig.api?.logFile || 'api.log';
  		const apiLogFilePath = join(bbDir, apiLogFileName);
  		const apiHostname = fullConfig.api.apiHostname || 'localhost';
  		const apiPort = fullConfig.api.apiPort || 3162;
  		const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  ```

- Line 39 (write)
  Config path: api.apiHostname
  Context:
  ```typescript
  		const apiLogFileName = apiLogFile || fullConfig.api?.logFile || 'api.log';
  		const apiLogFilePath = join(bbDir, apiLogFileName);
  		const apiHostname = fullConfig.api.apiHostname || 'localhost';
  		const apiPort = fullConfig.api.apiPort || 3162;
  		const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  ```

- Line 39 (write)
  Config path: api.apiHostname
  Context:
  ```typescript
  		const apiLogFileName = apiLogFile || fullConfig.api?.logFile || 'api.log';
  		const apiLogFilePath = join(bbDir, apiLogFileName);
  		const apiHostname = fullConfig.api.apiHostname || 'localhost';
  		const apiPort = fullConfig.api.apiPort || 3162;
  		const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  ```

- Line 40 (write)
  Config path: api.apiPort
  Context:
  ```typescript
  		const apiLogFilePath = join(bbDir, apiLogFileName);
  		const apiHostname = fullConfig.api.apiHostname || 'localhost';
  		const apiPort = fullConfig.api.apiPort || 3162;
  		const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  		return { pid: pid || 0, apiLogFilePath, listen: `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}` };
  ```

- Line 40 (write)
  Config path: api.apiPort
  Context:
  ```typescript
  		const apiLogFilePath = join(bbDir, apiLogFileName);
  		const apiHostname = fullConfig.api.apiHostname || 'localhost';
  		const apiPort = fullConfig.api.apiPort || 3162;
  		const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  		return { pid: pid || 0, apiLogFilePath, listen: `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}` };
  ```

- Line 40 (write)
  Config path: api.apiPort
  Context:
  ```typescript
  		const apiLogFilePath = join(bbDir, apiLogFileName);
  		const apiHostname = fullConfig.api.apiHostname || 'localhost';
  		const apiPort = fullConfig.api.apiPort || 3162;
  		const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  		return { pid: pid || 0, apiLogFilePath, listen: `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}` };
  ```

- Line 41 (write)
  Config path: api.apiUseTls
  Context:
  ```typescript
  		const apiHostname = fullConfig.api.apiHostname || 'localhost';
  		const apiPort = fullConfig.api.apiPort || 3162;
  		const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  		return { pid: pid || 0, apiLogFilePath, listen: `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}` };
  	}
  ```

- Line 41 (write)
  Config path: api.apiUseTls
  Context:
  ```typescript
  		const apiHostname = fullConfig.api.apiHostname || 'localhost';
  		const apiPort = fullConfig.api.apiPort || 3162;
  		const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  		return { pid: pid || 0, apiLogFilePath, listen: `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}` };
  	}
  ```

- Line 41 (write)
  Config path: api.apiUseTls
  Context:
  ```typescript
  		const apiHostname = fullConfig.api.apiHostname || 'localhost';
  		const apiPort = fullConfig.api.apiPort || 3162;
  		const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  		return { pid: pid || 0, apiLogFilePath, listen: `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}` };
  	}
  ```

- Line 42 (read)
  Context:
  ```typescript
  		const apiPort = fullConfig.api.apiPort || 3162;
  		const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  		return { pid: pid || 0, apiLogFilePath, listen: `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}` };
  	}
  
  ```

- Line 42 (read)
  Context:
  ```typescript
  		const apiPort = fullConfig.api.apiPort || 3162;
  		const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  		return { pid: pid || 0, apiLogFilePath, listen: `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}` };
  	}
  
  ```

- Line 42 (read)
  Context:
  ```typescript
  		const apiPort = fullConfig.api.apiPort || 3162;
  		const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  		return { pid: pid || 0, apiLogFilePath, listen: `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}` };
  	}
  
  ```

- Line 47 (write)
  Config path: api
  Context:
  ```typescript
  	const bbDir = await getBbDir(startDir);
  	const projectRoot = await getProjectRoot(startDir);
  	const apiLogFileName = apiLogFile || fullConfig.api?.logFile || 'api.log';
  	const apiLogFilePath = join(bbDir, apiLogFileName);
  	const logLevel = apiLogLevel || fullConfig.api?.logLevel || 'info';
  ```

- Line 49 (write)
  Config path: api
  Context:
  ```typescript
  	const apiLogFileName = apiLogFile || fullConfig.api?.logFile || 'api.log';
  	const apiLogFilePath = join(bbDir, apiLogFileName);
  	const logLevel = apiLogLevel || fullConfig.api?.logLevel || 'info';
  	if (!apiHostname) apiHostname = `${fullConfig.api.apiHostname}`;
  	if (!apiPort) apiPort = `${fullConfig.api.apiPort}`;
  ```

- Line 50 (write)
  Config path: api.apiHostname
  Context:
  ```typescript
  	const apiLogFilePath = join(bbDir, apiLogFileName);
  	const logLevel = apiLogLevel || fullConfig.api?.logLevel || 'info';
  	if (!apiHostname) apiHostname = `${fullConfig.api.apiHostname}`;
  	if (!apiPort) apiPort = `${fullConfig.api.apiPort}`;
  	if (typeof apiUseTls === 'undefined') {
  ```

- Line 50 (write)
  Config path: api.apiHostname
  Context:
  ```typescript
  	const apiLogFilePath = join(bbDir, apiLogFileName);
  	const logLevel = apiLogLevel || fullConfig.api?.logLevel || 'info';
  	if (!apiHostname) apiHostname = `${fullConfig.api.apiHostname}`;
  	if (!apiPort) apiPort = `${fullConfig.api.apiPort}`;
  	if (typeof apiUseTls === 'undefined') {
  ```

- Line 50 (write)
  Config path: api.apiHostname
  Context:
  ```typescript
  	const apiLogFilePath = join(bbDir, apiLogFileName);
  	const logLevel = apiLogLevel || fullConfig.api?.logLevel || 'info';
  	if (!apiHostname) apiHostname = `${fullConfig.api.apiHostname}`;
  	if (!apiPort) apiPort = `${fullConfig.api.apiPort}`;
  	if (typeof apiUseTls === 'undefined') {
  ```

- Line 51 (write)
  Config path: api.apiPort
  Context:
  ```typescript
  	const logLevel = apiLogLevel || fullConfig.api?.logLevel || 'info';
  	if (!apiHostname) apiHostname = `${fullConfig.api.apiHostname}`;
  	if (!apiPort) apiPort = `${fullConfig.api.apiPort}`;
  	if (typeof apiUseTls === 'undefined') {
  		apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  ```

- Line 51 (write)
  Config path: api.apiPort
  Context:
  ```typescript
  	const logLevel = apiLogLevel || fullConfig.api?.logLevel || 'info';
  	if (!apiHostname) apiHostname = `${fullConfig.api.apiHostname}`;
  	if (!apiPort) apiPort = `${fullConfig.api.apiPort}`;
  	if (typeof apiUseTls === 'undefined') {
  		apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  ```

- Line 51 (write)
  Config path: api.apiPort
  Context:
  ```typescript
  	const logLevel = apiLogLevel || fullConfig.api?.logLevel || 'info';
  	if (!apiHostname) apiHostname = `${fullConfig.api.apiHostname}`;
  	if (!apiPort) apiPort = `${fullConfig.api.apiPort}`;
  	if (typeof apiUseTls === 'undefined') {
  		apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  ```

- Line 52 (write)
  Context:
  ```typescript
  	if (!apiHostname) apiHostname = `${fullConfig.api.apiHostname}`;
  	if (!apiPort) apiPort = `${fullConfig.api.apiPort}`;
  	if (typeof apiUseTls === 'undefined') {
  		apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  	}
  ```

- Line 53 (write)
  Config path: api.apiUseTls
  Context:
  ```typescript
  	if (!apiPort) apiPort = `${fullConfig.api.apiPort}`;
  	if (typeof apiUseTls === 'undefined') {
  		apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  	}
  	const apiHostnameArgs = apiHostname ? ['--hostname', apiHostname] : [];
  ```

- Line 53 (write)
  Config path: api.apiUseTls
  Context:
  ```typescript
  	if (!apiPort) apiPort = `${fullConfig.api.apiPort}`;
  	if (typeof apiUseTls === 'undefined') {
  		apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  	}
  	const apiHostnameArgs = apiHostname ? ['--hostname', apiHostname] : [];
  ```

- Line 53 (write)
  Config path: api.apiUseTls
  Context:
  ```typescript
  	if (!apiPort) apiPort = `${fullConfig.api.apiPort}`;
  	if (typeof apiUseTls === 'undefined') {
  		apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  	}
  	const apiHostnameArgs = apiHostname ? ['--hostname', apiHostname] : [];
  ```

- Line 55 (write)
  Context:
  ```typescript
  		apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  	}
  	const apiHostnameArgs = apiHostname ? ['--hostname', apiHostname] : [];
  	const apiPortArgs = apiPort ? ['--port', apiPort] : [];
  	const apiUseTlsArgs = typeof apiUseTls !== 'undefined' ? ['--use-tls', apiUseTls ? 'true' : 'false'] : [];
  ```

- Line 56 (write)
  Context:
  ```typescript
  	}
  	const apiHostnameArgs = apiHostname ? ['--hostname', apiHostname] : [];
  	const apiPortArgs = apiPort ? ['--port', apiPort] : [];
  	const apiUseTlsArgs = typeof apiUseTls !== 'undefined' ? ['--use-tls', apiUseTls ? 'true' : 'false'] : [];
  
  ```

- Line 57 (write)
  Context:
  ```typescript
  	const apiHostnameArgs = apiHostname ? ['--hostname', apiHostname] : [];
  	const apiPortArgs = apiPort ? ['--port', apiPort] : [];
  	const apiUseTlsArgs = typeof apiUseTls !== 'undefined' ? ['--use-tls', apiUseTls ? 'true' : 'false'] : [];
  
  	//const redactedFullConfig = await ConfigManager.redactedFullConfig(startDir);
  ```

- Line 59 (write)
  Context:
  ```typescript
  	const apiUseTlsArgs = typeof apiUseTls !== 'undefined' ? ['--use-tls', apiUseTls ? 'true' : 'false'] : [];
  
  	//const redactedFullConfig = await ConfigManager.redactedFullConfig(startDir);
  	//logger.debug(`Starting API with config:`, redactedFullConfig);
  	logger.debug(
  ```

- Line 62 (read)
  Context:
  ```typescript
  	//logger.debug(`Starting API with config:`, redactedFullConfig);
  	logger.debug(
  		`Starting BB API server from ${startDir} on ${apiHostname}:${apiPort}, logging to ${apiLogFilePath}`,
  	);
  
  ```

- Line 62 (read)
  Context:
  ```typescript
  	//logger.debug(`Starting API with config:`, redactedFullConfig);
  	logger.debug(
  		`Starting BB API server from ${startDir} on ${apiHostname}:${apiPort}, logging to ${apiLogFilePath}`,
  	);
  
  ```

- Line 68 (write)
  Config path: bbApiExeName
  Context:
  ```typescript
  
  	if (isCompiledBinary()) {
  		const bbApiExecFile = await Deno.realPath(join(dirname(Deno.execPath()), fullConfig.bbApiExeName));
  		logger.debug(`Starting BB API as compiled binary using ${bbApiExecFile}`);
  		command = new Deno.Command(bbApiExecFile, {
  ```

- Line 71 (read)
  Context:
  ```typescript
  		logger.debug(`Starting BB API as compiled binary using ${bbApiExecFile}`);
  		command = new Deno.Command(bbApiExecFile, {
  			args: ['--log-file', apiLogFilePath, ...apiHostnameArgs, ...apiPortArgs, ...apiUseTlsArgs],
  			cwd: startDir,
  			stdout: 'null',
  ```

- Line 71 (read)
  Context:
  ```typescript
  		logger.debug(`Starting BB API as compiled binary using ${bbApiExecFile}`);
  		command = new Deno.Command(bbApiExecFile, {
  			args: ['--log-file', apiLogFilePath, ...apiHostnameArgs, ...apiPortArgs, ...apiUseTlsArgs],
  			cwd: startDir,
  			stdout: 'null',
  ```

- Line 71 (read)
  Context:
  ```typescript
  		logger.debug(`Starting BB API as compiled binary using ${bbApiExecFile}`);
  		command = new Deno.Command(bbApiExecFile, {
  			args: ['--log-file', apiLogFilePath, ...apiHostnameArgs, ...apiPortArgs, ...apiUseTlsArgs],
  			cwd: startDir,
  			stdout: 'null',
  ```

- Line 98 (read)
  Context:
  ```typescript
  				'--log-file',
  				apiLogFilePath,
  				...apiHostnameArgs,
  				...apiPortArgs,
  			],
  ```

- Line 99 (read)
  Context:
  ```typescript
  				apiLogFilePath,
  				...apiHostnameArgs,
  				...apiPortArgs,
  			],
  			cwd: join(projectRoot, 'api'),
  ```

- Line 126 (read)
  Context:
  ```typescript
  	}
  
  	return { pid, apiLogFilePath, listen: `${apiHostname}:${apiPort}` };
  }
  
  ```

- Line 126 (read)
  Context:
  ```typescript
  	}
  
  	return { pid, apiLogFilePath, listen: `${apiHostname}:${apiPort}` };
  }
  
  ```

- Line 161 (read)
  Context:
  ```typescript
  export async function restartApiServer(
  	startDir: string,
  	apiHostname?: string,
  	apiPort?: string,
  	apiUseTls?: boolean,
  ```

- Line 162 (read)
  Context:
  ```typescript
  	startDir: string,
  	apiHostname?: string,
  	apiPort?: string,
  	apiUseTls?: boolean,
  	apiLogLevel?: string,
  ```

- Line 163 (read)
  Context:
  ```typescript
  	apiHostname?: string,
  	apiPort?: string,
  	apiUseTls?: boolean,
  	apiLogLevel?: string,
  	apiLogFile?: string,
  ```

- Line 171 (read)
  Context:
  ```typescript
  	await delay(1000);
  
  	return await startApiServer(startDir, apiHostname, apiPort, apiUseTls, apiLogLevel, apiLogFile);
  }
  
  ```

- Line 171 (read)
  Context:
  ```typescript
  	await delay(1000);
  
  	return await startApiServer(startDir, apiHostname, apiPort, apiUseTls, apiLogLevel, apiLogFile);
  }
  
  ```

- Line 171 (read)
  Context:
  ```typescript
  	await delay(1000);
  
  	return await startApiServer(startDir, apiHostname, apiPort, apiUseTls, apiLogLevel, apiLogFile);
  }
  
  ```

- Line 209 (write)
  Context:
  ```typescript
  	error?: string;
  }> {
  	const fullConfig = await ConfigManager.fullConfig(startDir);
  	const apiHostname = fullConfig.api.apiHostname || 'localhost';
  	const apiPort = fullConfig.api.apiPort || 3162;
  ```

- Line 209 (write)
  Context:
  ```typescript
  	error?: string;
  }> {
  	const fullConfig = await ConfigManager.fullConfig(startDir);
  	const apiHostname = fullConfig.api.apiHostname || 'localhost';
  	const apiPort = fullConfig.api.apiPort || 3162;
  ```

- Line 210 (write)
  Config path: api.apiHostname
  Context:
  ```typescript
  }> {
  	const fullConfig = await ConfigManager.fullConfig(startDir);
  	const apiHostname = fullConfig.api.apiHostname || 'localhost';
  	const apiPort = fullConfig.api.apiPort || 3162;
  	const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  ```

- Line 210 (write)
  Config path: api.apiHostname
  Context:
  ```typescript
  }> {
  	const fullConfig = await ConfigManager.fullConfig(startDir);
  	const apiHostname = fullConfig.api.apiHostname || 'localhost';
  	const apiPort = fullConfig.api.apiPort || 3162;
  	const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  ```

- Line 210 (write)
  Config path: api.apiHostname
  Context:
  ```typescript
  }> {
  	const fullConfig = await ConfigManager.fullConfig(startDir);
  	const apiHostname = fullConfig.api.apiHostname || 'localhost';
  	const apiPort = fullConfig.api.apiPort || 3162;
  	const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  ```

- Line 211 (write)
  Config path: api.apiPort
  Context:
  ```typescript
  	const fullConfig = await ConfigManager.fullConfig(startDir);
  	const apiHostname = fullConfig.api.apiHostname || 'localhost';
  	const apiPort = fullConfig.api.apiPort || 3162;
  	const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  	const processStatus = await checkApiStatus(startDir);
  ```

- Line 211 (write)
  Config path: api.apiPort
  Context:
  ```typescript
  	const fullConfig = await ConfigManager.fullConfig(startDir);
  	const apiHostname = fullConfig.api.apiHostname || 'localhost';
  	const apiPort = fullConfig.api.apiPort || 3162;
  	const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  	const processStatus = await checkApiStatus(startDir);
  ```

- Line 211 (write)
  Config path: api.apiPort
  Context:
  ```typescript
  	const fullConfig = await ConfigManager.fullConfig(startDir);
  	const apiHostname = fullConfig.api.apiHostname || 'localhost';
  	const apiPort = fullConfig.api.apiPort || 3162;
  	const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  	const processStatus = await checkApiStatus(startDir);
  ```

- Line 212 (write)
  Config path: api.apiUseTls
  Context:
  ```typescript
  	const apiHostname = fullConfig.api.apiHostname || 'localhost';
  	const apiPort = fullConfig.api.apiPort || 3162;
  	const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  	const processStatus = await checkApiStatus(startDir);
  	const status: {
  ```

- Line 212 (write)
  Config path: api.apiUseTls
  Context:
  ```typescript
  	const apiHostname = fullConfig.api.apiHostname || 'localhost';
  	const apiPort = fullConfig.api.apiPort || 3162;
  	const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  	const processStatus = await checkApiStatus(startDir);
  	const status: {
  ```

- Line 212 (write)
  Config path: api.apiUseTls
  Context:
  ```typescript
  	const apiHostname = fullConfig.api.apiHostname || 'localhost';
  	const apiPort = fullConfig.api.apiPort || 3162;
  	const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  	const processStatus = await checkApiStatus(startDir);
  	const status: {
  ```

- Line 229 (write)
  Context:
  ```typescript
  		const pid = await getPid(startDir);
  		status.pid = pid !== null ? pid : undefined;
  		status.apiUrl = `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}`;
  
  		try {
  ```

- Line 229 (write)
  Context:
  ```typescript
  		const pid = await getPid(startDir);
  		status.pid = pid !== null ? pid : undefined;
  		status.apiUrl = `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}`;
  
  		try {
  ```

- Line 229 (write)
  Context:
  ```typescript
  		const pid = await getPid(startDir);
  		status.pid = pid !== null ? pid : undefined;
  		status.apiUrl = `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}`;
  
  		try {
  ```

- Line 232 (write)
  Context:
  ```typescript
  
  		try {
  			const apiClient = await ApiClient.create(startDir, apiHostname, apiPort, apiUseTls);
  			const response = await apiClient.get('/api/v1/status');
  			if (response.ok) {
  ```

- Line 232 (write)
  Context:
  ```typescript
  
  		try {
  			const apiClient = await ApiClient.create(startDir, apiHostname, apiPort, apiUseTls);
  			const response = await apiClient.get('/api/v1/status');
  			if (response.ok) {
  ```

- Line 232 (write)
  Context:
  ```typescript
  
  		try {
  			const apiClient = await ApiClient.create(startDir, apiHostname, apiPort, apiUseTls);
  			const response = await apiClient.get('/api/v1/status');
  			if (response.ok) {
  ```

### cli/src/utils/apiStatus.utils.ts
- Line 70 (write)
  Context:
  ```typescript
  	if (status.pidExists) {
  		try {
  			const fullConfig = await ConfigManager.fullConfig(startDir);
  			const apiHostname = fullConfig.api.apiHostname || 'localhost';
  			const apiPort = fullConfig.api.apiPort || 3162;
  ```

- Line 70 (write)
  Context:
  ```typescript
  	if (status.pidExists) {
  		try {
  			const fullConfig = await ConfigManager.fullConfig(startDir);
  			const apiHostname = fullConfig.api.apiHostname || 'localhost';
  			const apiPort = fullConfig.api.apiPort || 3162;
  ```

- Line 71 (write)
  Config path: api.apiHostname
  Context:
  ```typescript
  		try {
  			const fullConfig = await ConfigManager.fullConfig(startDir);
  			const apiHostname = fullConfig.api.apiHostname || 'localhost';
  			const apiPort = fullConfig.api.apiPort || 3162;
  			const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  ```

- Line 71 (write)
  Config path: api.apiHostname
  Context:
  ```typescript
  		try {
  			const fullConfig = await ConfigManager.fullConfig(startDir);
  			const apiHostname = fullConfig.api.apiHostname || 'localhost';
  			const apiPort = fullConfig.api.apiPort || 3162;
  			const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  ```

- Line 71 (write)
  Config path: api.apiHostname
  Context:
  ```typescript
  		try {
  			const fullConfig = await ConfigManager.fullConfig(startDir);
  			const apiHostname = fullConfig.api.apiHostname || 'localhost';
  			const apiPort = fullConfig.api.apiPort || 3162;
  			const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  ```

- Line 72 (write)
  Config path: api.apiPort
  Context:
  ```typescript
  			const fullConfig = await ConfigManager.fullConfig(startDir);
  			const apiHostname = fullConfig.api.apiHostname || 'localhost';
  			const apiPort = fullConfig.api.apiPort || 3162;
  			const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  
  ```

- Line 72 (write)
  Config path: api.apiPort
  Context:
  ```typescript
  			const fullConfig = await ConfigManager.fullConfig(startDir);
  			const apiHostname = fullConfig.api.apiHostname || 'localhost';
  			const apiPort = fullConfig.api.apiPort || 3162;
  			const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  
  ```

- Line 72 (write)
  Config path: api.apiPort
  Context:
  ```typescript
  			const fullConfig = await ConfigManager.fullConfig(startDir);
  			const apiHostname = fullConfig.api.apiHostname || 'localhost';
  			const apiPort = fullConfig.api.apiPort || 3162;
  			const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  
  ```

- Line 73 (write)
  Config path: api.apiUseTls
  Context:
  ```typescript
  			const apiHostname = fullConfig.api.apiHostname || 'localhost';
  			const apiPort = fullConfig.api.apiPort || 3162;
  			const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  
  			const apiClient = await ApiClient.create(startDir, apiHostname, apiPort, apiUseTls);
  ```

- Line 73 (write)
  Config path: api.apiUseTls
  Context:
  ```typescript
  			const apiHostname = fullConfig.api.apiHostname || 'localhost';
  			const apiPort = fullConfig.api.apiPort || 3162;
  			const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  
  			const apiClient = await ApiClient.create(startDir, apiHostname, apiPort, apiUseTls);
  ```

- Line 73 (write)
  Config path: api.apiUseTls
  Context:
  ```typescript
  			const apiHostname = fullConfig.api.apiHostname || 'localhost';
  			const apiPort = fullConfig.api.apiPort || 3162;
  			const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  
  			const apiClient = await ApiClient.create(startDir, apiHostname, apiPort, apiUseTls);
  ```

- Line 75 (write)
  Context:
  ```typescript
  			const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  
  			const apiClient = await ApiClient.create(startDir, apiHostname, apiPort, apiUseTls);
  			const response = await apiClient.get('/api/v1/status');
  			status.apiResponds = response.ok;
  ```

- Line 75 (write)
  Context:
  ```typescript
  			const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  
  			const apiClient = await ApiClient.create(startDir, apiHostname, apiPort, apiUseTls);
  			const response = await apiClient.get('/api/v1/status');
  			status.apiResponds = response.ok;
  ```

- Line 75 (write)
  Context:
  ```typescript
  			const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
  
  			const apiClient = await ApiClient.create(startDir, apiHostname, apiPort, apiUseTls);
  			const response = await apiClient.get('/api/v1/status');
  			status.apiResponds = response.ok;
  ```

### cli/src/utils/init.utils.ts
- Line 84 (write)
  Context:
  ```typescript
  /*
  export async function createDefaultConfig(startDir: string, wizardAnswers: WizardAnswers): Promise<void> {
  	const configManager = await ConfigManager.getInstance();
  	await configManager.ensureUserConfig();
  
  ```

- Line 87 (write)
  Context:
  ```typescript
  	await configManager.ensureUserConfig();
  
  	const projectConfig = {
  		...wizardAnswers,
  	};
  ```

- Line 91 (read)
  Context:
  ```typescript
  	};
  
  	await configManager.ensureProjectConfig(startDir, projectConfig);
  	logger.info('Created default config files');
  }
  ```

### dui/src/components/ApiControl/ApiControl.tsx
- Line 139 (read)
  Config path: apiHostname
  Context:
  ```typescript
        <div class="config-info">
          <div>API Configuration:</div>
          <div>Host: {config.apiHostname || 'localhost'}</div>
          <div>Port: {config.apiPort || 3162}</div>
          <div>TLS: {config.apiUseTls !== undefined ? (config.apiUseTls ? 'Enabled' : 'Disabled') : 'Default'}</div>
  ```

- Line 139 (read)
  Config path: apiHostname
  Context:
  ```typescript
        <div class="config-info">
          <div>API Configuration:</div>
          <div>Host: {config.apiHostname || 'localhost'}</div>
          <div>Port: {config.apiPort || 3162}</div>
          <div>TLS: {config.apiUseTls !== undefined ? (config.apiUseTls ? 'Enabled' : 'Disabled') : 'Default'}</div>
  ```

- Line 140 (read)
  Config path: apiPort
  Context:
  ```typescript
          <div>API Configuration:</div>
          <div>Host: {config.apiHostname || 'localhost'}</div>
          <div>Port: {config.apiPort || 3162}</div>
          <div>TLS: {config.apiUseTls !== undefined ? (config.apiUseTls ? 'Enabled' : 'Disabled') : 'Default'}</div>
        </div>
  ```

- Line 140 (read)
  Config path: apiPort
  Context:
  ```typescript
          <div>API Configuration:</div>
          <div>Host: {config.apiHostname || 'localhost'}</div>
          <div>Port: {config.apiPort || 3162}</div>
          <div>TLS: {config.apiUseTls !== undefined ? (config.apiUseTls ? 'Enabled' : 'Disabled') : 'Default'}</div>
        </div>
  ```

- Line 141 (write)
  Config path: apiUseTls
  Context:
  ```typescript
          <div>Host: {config.apiHostname || 'localhost'}</div>
          <div>Port: {config.apiPort || 3162}</div>
          <div>TLS: {config.apiUseTls !== undefined ? (config.apiUseTls ? 'Enabled' : 'Disabled') : 'Default'}</div>
        </div>
        {startupPhase && isLoading && (
  ```

- Line 141 (write)
  Config path: apiUseTls
  Context:
  ```typescript
          <div>Host: {config.apiHostname || 'localhost'}</div>
          <div>Port: {config.apiPort || 3162}</div>
          <div>TLS: {config.apiUseTls !== undefined ? (config.apiUseTls ? 'Enabled' : 'Disabled') : 'Default'}</div>
        </div>
        {startupPhase && isLoading && (
  ```

### dui/src/types/api.ts
- Line 8 (read)
  Context:
  ```typescript
  
  export interface ApiConfig {
    apiHostname?: string;
    apiPort?: number;
    apiUseTls?: boolean;
  ```

- Line 9 (read)
  Context:
  ```typescript
  export interface ApiConfig {
    apiHostname?: string;
    apiPort?: number;
    apiUseTls?: boolean;
    environment?: string;
  ```

- Line 10 (read)
  Context:
  ```typescript
    apiHostname?: string;
    apiPort?: number;
    apiUseTls?: boolean;
    environment?: string;
    logLevel?: string;
  ```

### scripts/analyze_config_usage.ts
- Line 27 (read)
  Context:
  ```typescript
    'ConfigManager\\.',
    'config\\.',
    'fullConfig',
    'globalConfig',
    'projectConfig',
  ```

- Line 28 (read)
  Context:
  ```typescript
    'config\\.',
    'fullConfig',
    'globalConfig',
    'projectConfig',
    '\\.api\\.',
  ```

- Line 29 (read)
  Context:
  ```typescript
    'fullConfig',
    'globalConfig',
    'projectConfig',
    '\\.api\\.',
    '\\.bui\\.',
  ```

- Line 33 (read)
  Context:
  ```typescript
    '\\.bui\\.',
    '\\.cli\\.',
    'usePromptCaching',
    'ignoreLLMRequestCache',
    'apiHostname',
  ```

- Line 34 (read)
  Context:
  ```typescript
    '\\.cli\\.',
    'usePromptCaching',
    'ignoreLLMRequestCache',
    'apiHostname',
    'apiPort',
  ```

- Line 35 (read)
  Context:
  ```typescript
    'usePromptCaching',
    'ignoreLLMRequestCache',
    'apiHostname',
    'apiPort',
    'apiUseTls'
  ```

- Line 36 (read)
  Context:
  ```typescript
    'ignoreLLMRequestCache',
    'apiHostname',
    'apiPort',
    'apiUseTls'
  ];
  ```

- Line 37 (read)
  Context:
  ```typescript
    'apiHostname',
    'apiPort',
    'apiUseTls'
  ];
  
  ```

- Line 100 (read)
  Config path: api.hostname
  Context:
  ```typescript
    const path: string[] = [];
    
    // Match patterns like: config.api.hostname or fullConfig.api.port
    const matches = line.match(/(?:config|fullConfig|globalConfig)\.([a-zA-Z.]+)/);
    if (matches && matches[1]) {
  ```

- Line 100 (read)
  Config path: api.hostname
  Context:
  ```typescript
    const path: string[] = [];
    
    // Match patterns like: config.api.hostname or fullConfig.api.port
    const matches = line.match(/(?:config|fullConfig|globalConfig)\.([a-zA-Z.]+)/);
    if (matches && matches[1]) {
  ```

- Line 100 (read)
  Config path: api.hostname
  Context:
  ```typescript
    const path: string[] = [];
    
    // Match patterns like: config.api.hostname or fullConfig.api.port
    const matches = line.match(/(?:config|fullConfig|globalConfig)\.([a-zA-Z.]+)/);
    if (matches && matches[1]) {
  ```

- Line 101 (write)
  Context:
  ```typescript
    
    // Match patterns like: config.api.hostname or fullConfig.api.port
    const matches = line.match(/(?:config|fullConfig|globalConfig)\.([a-zA-Z.]+)/);
    if (matches && matches[1]) {
      path.push(...matches[1].split('.'));
  ```

- Line 101 (write)
  Context:
  ```typescript
    
    // Match patterns like: config.api.hostname or fullConfig.api.port
    const matches = line.match(/(?:config|fullConfig|globalConfig)\.([a-zA-Z.]+)/);
    if (matches && matches[1]) {
      path.push(...matches[1].split('.'));
  ```

### scripts/verify_dui_setup.ts
- Line 78 (read)
  Config path: json
  Context:
  ```typescript
    const configFiles = [
      "dui/package.json",
      "dui/tsconfig.json",
      "dui/vite.config.ts",
      "dui/tailwind.config.js",
  ```

- Line 79 (read)
  Config path: ts
  Context:
  ```typescript
      "dui/package.json",
      "dui/tsconfig.json",
      "dui/vite.config.ts",
      "dui/tailwind.config.js",
      "dui/src-tauri/Cargo.toml",
  ```

- Line 80 (read)
  Config path: js
  Context:
  ```typescript
      "dui/tsconfig.json",
      "dui/vite.config.ts",
      "dui/tailwind.config.js",
      "dui/src-tauri/Cargo.toml",
      "dui/src-tauri/tauri.conf.json",
  ```

### src/shared/doctor/checks/config.ts
- Line 7 (read)
  Context:
  ```typescript
  
  interface ConfigValidationRule {
  	path: string[]; // Config path (e.g., ['api', 'apiPort'])
  	required?: boolean; // Is this setting required?
  	type?: string; // Expected type
  ```

- Line 21 (read)
  Context:
  ```typescript
  const CONFIG_RULES: ConfigValidationRule[] = [
  	{
  		path: ['api', 'apiPort'],
  		required: true,
  		type: 'number',
  ```

- Line 34 (write)
  Context:
  ```typescript
  			description: 'Reset to default port (3162)',
  			value: 3162,
  			command: 'bb config set --global api.apiPort 3162',
  			apiEndpoint: '/api/v1/config/fix/api-port',
  		},
  ```

- Line 39 (read)
  Context:
  ```typescript
  	},
  	{
  		path: ['api', 'apiHostname'],
  		required: true,
  		type: 'string',
  ```

- Line 45 (write)
  Context:
  ```typescript
  			description: 'Set default hostname (localhost)',
  			value: 'localhost',
  			command: 'bb config set --global api.apiHostname localhost',
  			apiEndpoint: '/api/v1/config/fix/api-hostname',
  		},
  ```

- Line 50 (read)
  Context:
  ```typescript
  	},
  	{
  		path: ['api', 'apiUseTls'],
  		type: 'boolean',
  	},
  ```

- Line 135 (write)
  Context:
  ```typescript
  
  	try {
  		const configManager = await ConfigManager.getInstance();
  		const globalConfig = await configManager.loadGlobalConfig();
  		const projectConfig = await configManager.loadProjectConfig(Deno.cwd());
  ```

- Line 136 (write)
  Context:
  ```typescript
  	try {
  		const configManager = await ConfigManager.getInstance();
  		const globalConfig = await configManager.loadGlobalConfig();
  		const projectConfig = await configManager.loadProjectConfig(Deno.cwd());
  
  ```

- Line 137 (write)
  Context:
  ```typescript
  		const configManager = await ConfigManager.getInstance();
  		const globalConfig = await configManager.loadGlobalConfig();
  		const projectConfig = await configManager.loadProjectConfig(Deno.cwd());
  
  		// Check global config rules
  ```

- Line 141 (write)
  Context:
  ```typescript
  		// Check global config rules
  		for (const rule of CONFIG_RULES) {
  			const validationResult = validateConfigValue(rule, globalConfig);
  			if (validationResult) {
  				results.push(validationResult);
  ```

- Line 149 (read)
  Context:
  ```typescript
  		// Add project-specific config checks here if needed
  		// For now, just verify we can load it
  		if (!projectConfig.project?.name || !projectConfig.project?.type) {
  			results.push({
  				category: 'config',
  ```

### src/shared/doctor/checks/resources.ts
- Line 123 (write)
  Context:
  ```typescript
  
  	try {
  		const configManager = await ConfigManager.getInstance();
  		const globalConfig = await configManager.loadGlobalConfig();
  		const globalDir = await getGlobalConfigDir();
  ```

- Line 124 (write)
  Context:
  ```typescript
  	try {
  		const configManager = await ConfigManager.getInstance();
  		const globalConfig = await configManager.loadGlobalConfig();
  		const globalDir = await getGlobalConfigDir();
  
  ```

### src/shared/doctor/checks/tls.ts
- Line 11 (read)
  Context:
  ```typescript
  interface TlsCheckContext {
  	configManager: ConfigManager;
  	globalConfig: GlobalConfigSchema;
  	globalDir: string;
  }
  ```

- Line 148 (write)
  Context:
  ```typescript
  
  	try {
  		const configManager = await ConfigManager.getInstance();
  		const globalConfig = await configManager.loadGlobalConfig();
  		const globalDir = await getGlobalConfigDir();
  ```

- Line 149 (write)
  Context:
  ```typescript
  	try {
  		const configManager = await ConfigManager.getInstance();
  		const globalConfig = await configManager.loadGlobalConfig();
  		const globalDir = await getGlobalConfigDir();
  
  ```

- Line 154 (read)
  Context:
  ```typescript
  		const context: TlsCheckContext = {
  			configManager,
  			globalConfig,
  			globalDir,
  		};
  ```

- Line 159 (write)
  Config path: api
  Context:
  ```typescript
  
  		// Check if TLS is enabled
  		const tlsEnabled = globalConfig.api?.apiUseTls;
  		if (!tlsEnabled) {
  			results.push({
  ```

- Line 159 (write)
  Config path: api
  Context:
  ```typescript
  
  		// Check if TLS is enabled
  		const tlsEnabled = globalConfig.api?.apiUseTls;
  		if (!tlsEnabled) {
  			results.push({
  ```

### src/shared/doctor/doctorService.ts
- Line 2 (read)
  Config path: ts
  Context:
  ```typescript
  import { DiagnosticResult, DoctorReport, SystemResources } from './types.ts';
  import { checkConfig } from './checks/config.ts';
  import { checkTls } from './checks/tls.ts';
  import { generateReport } from './utils/report.ts';
  ```

- Line 34 (write)
  Context:
  ```typescript
  	async init(): Promise<void> {
  		try {
  			this.configManager = await ConfigManager.getInstance();
  		} catch (error) {
  			logger.error('Failed to initialize DoctorService:', error);
  ```

### src/shared/utils/dataDir.utils.ts
- Line 31 (write)
  Context:
  ```typescript
  }
  export async function getGlobalConfigDir(): Promise<string> {
  	const globalConfigDir = Deno.build.os === 'windows' ? (join(Deno.env.get('APPDATA') || '', 'bb')) : (
  		join(Deno.env.get('HOME') || '', '.config', 'bb')
  	);
  ```

- Line 34 (read)
  Context:
  ```typescript
  		join(Deno.env.get('HOME') || '', '.config', 'bb')
  	);
  	await ensureDir(globalConfigDir);
  	return globalConfigDir;
  }
  ```

- Line 35 (read)
  Context:
  ```typescript
  	);
  	await ensureDir(globalConfigDir);
  	return globalConfigDir;
  }
  
  ```

- Line 140 (read)
  Context:
  ```typescript
  /*
  export async function loadConfig(startDir?: string): Promise<Record<string, any>> {
  	return await ConfigManager.fullConfig(startDir);
  }
   */
  ```

- Line 140 (read)
  Context:
  ```typescript
  /*
  export async function loadConfig(startDir?: string): Promise<Record<string, any>> {
  	return await ConfigManager.fullConfig(startDir);
  }
   */
  ```

### src/shared/utils/logViewer.utils.ts
- Line 61 (write)
  Context:
  ```typescript
  
  export async function getLogFilePath(startDir: string, isApiLog: boolean, conversationId?: string): Promise<string> {
  	const fullConfig = await ConfigManager.fullConfig(startDir);
  	return !isApiLog && conversationId
  		? await CollaborationLogger.getLogFileRawPath(startDir, conversationId)
  ```

- Line 61 (write)
  Context:
  ```typescript
  
  export async function getLogFilePath(startDir: string, isApiLog: boolean, conversationId?: string): Promise<string> {
  	const fullConfig = await ConfigManager.fullConfig(startDir);
  	return !isApiLog && conversationId
  		? await CollaborationLogger.getLogFileRawPath(startDir, conversationId)
  ```

- Line 64 (read)
  Config path: api
  Context:
  ```typescript
  	return !isApiLog && conversationId
  		? await CollaborationLogger.getLogFileRawPath(startDir, conversationId)
  		: join(await getBbDir(startDir), fullConfig.api?.logFile ?? 'api.log');
  }
  
  ```

### src/shared/utils/logger.utils.ts
- Line 3 (write)
  Context:
  ```typescript
  import { ConfigManager } from 'shared/configManager.ts';
  
  const globalConfig = await ConfigManager.globalConfig();
  
  const logLevels = ['debug', 'info', 'warn', 'error'] as const;
  ```

- Line 3 (write)
  Context:
  ```typescript
  import { ConfigManager } from 'shared/configManager.ts';
  
  const globalConfig = await ConfigManager.globalConfig();
  
  const logLevels = ['debug', 'info', 'warn', 'error'] as const;
  ```

- Line 14 (read)
  Config path: api
  Context:
  ```typescript
  	}
  
  	if (globalConfig.api?.logLevel && logLevels.includes(globalConfig.api?.logLevel as LogLevel)) {
  		return globalConfig.api?.logLevel as LogLevel;
  	}
  ```

- Line 15 (read)
  Config path: api
  Context:
  ```typescript
  
  	if (globalConfig.api?.logLevel && logLevels.includes(globalConfig.api?.logLevel as LogLevel)) {
  		return globalConfig.api?.logLevel as LogLevel;
  	}
  
  ```

### src/shared/utils/upgrade.utils.ts
- Line 87 (read)
  Context:
  ```typescript
  			success: false,
  			error: 'Cannot create or write to user installation directory',
  			currentVersion: (await ConfigManager.globalConfig()).version as string,
  			latestVersion: 'unknown',
  			needsUpdate: false,
  ```

- Line 87 (read)
  Context:
  ```typescript
  			success: false,
  			error: 'Cannot create or write to user installation directory',
  			currentVersion: (await ConfigManager.globalConfig()).version as string,
  			latestVersion: 'unknown',
  			needsUpdate: false,
  ```

- Line 129 (read)
  Context:
  ```typescript
  			success: false,
  			error: (error as Error).message,
  			currentVersion: (await ConfigManager.globalConfig()).version as string,
  			latestVersion: 'unknown',
  			needsUpdate: false,
  ```

- Line 129 (read)
  Context:
  ```typescript
  			success: false,
  			error: (error as Error).message,
  			currentVersion: (await ConfigManager.globalConfig()).version as string,
  			latestVersion: 'unknown',
  			needsUpdate: false,
  ```

- Line 189 (write)
  Context:
  ```typescript
  
  async function downloadAndInstall(release: GithubRelease): Promise<void> {
  	const config = await ConfigManager.globalConfig();
  	const installLocation = await getCurrentInstallLocation();
  
  ```

- Line 189 (write)
  Context:
  ```typescript
  
  async function downloadAndInstall(release: GithubRelease): Promise<void> {
  	const config = await ConfigManager.globalConfig();
  	const installLocation = await getCurrentInstallLocation();
  
  ```


## Ignored Patterns
The following patterns were ignored during analysis:
- /playground/
- /node_modules/
- /configManager\.ts$/
- /configSchema\.ts$/
- /\.git\//
- /\.bb\//
- /dist\//
- /build\//