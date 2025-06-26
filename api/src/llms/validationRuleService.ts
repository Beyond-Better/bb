/**
 * Validation Rule Service
 * Manages validation rule sets and provides them to the API
 */

import { logger } from 'shared/logger.ts';
import { ValidationEngine } from './validationEngine.ts';
import type {
	ValidationRuleSet,
	ValidationResult,
	ValidationContext,
	ValidationEngineConfig,
} from 'api/types/validationRules.ts';
import type { ModelCapabilities } from 'api/types/modelCapabilities.ts';

/**
 * Service for managing validation rules
 */
export class ValidationRuleService {
	private static instance: ValidationRuleService;
	private validationEngine: ValidationEngine;
	private ruleSets: Map<string, ValidationRuleSet> = new Map();
	private initialized = false;

	/**
	 * Private constructor for singleton pattern
	 */
	private constructor(config?: ValidationEngineConfig) {
		this.validationEngine = new ValidationEngine(config);
	}

	/**
	 * Get the singleton instance
	 */
	public static getInstance(config?: ValidationEngineConfig): ValidationRuleService {
		if (!ValidationRuleService.instance) {
			ValidationRuleService.instance = new ValidationRuleService(config);
		}
		return ValidationRuleService.instance;
	}

	/**
	 * Initialize the service with default rule sets
	 */
	public async init(): Promise<void> {
		if (this.initialized) return;

		try {
			// Load built-in rule sets
			await this.loadBuiltinRuleSets();

			// Load user-defined rule sets (from config or external files)
			await this.loadUserRuleSets();

			this.initialized = true;
			logger.info(`ValidationRuleService: Initialized with ${this.ruleSets.size} rule sets`);
		} catch (error) {
			logger.error(`ValidationRuleService: Failed to initialize: ${error instanceof Error ? error.message : error}`);
			throw error;
		}
	}

	/**
	 * Load built-in validation rule sets
	 */
	private async loadBuiltinRuleSets(): Promise<void> {
		// Load the chat input validation rules
		const chatInputRules = await this.createChatInputRuleSet();
		this.ruleSets.set(chatInputRules.id, chatInputRules);

		// Load model configuration validation rules
		const modelConfigRules = await this.createModelConfigRuleSet();
		this.ruleSets.set(modelConfigRules.id, modelConfigRules);

		logger.info(`ValidationRuleService: Loaded ${this.ruleSets.size} built-in rule sets`);
	}

	/**
	 * Load user-defined rule sets from configuration or external files
	 */
	private async loadUserRuleSets(): Promise<void> {
		// TODO: Implement loading from configuration files
		// This could load from:
		// - Project-specific rule files
		// - User configuration directory
		// - External rule repositories
		logger.info('ValidationRuleService: User rule sets loading not yet implemented');
	}

	/**
	 * Create the chat input validation rule set
	 */
	private async createChatInputRuleSet(): Promise<ValidationRuleSet> {
		return {
			id: 'chat_input_validation',
			name: 'Chat Input Validation',
			description: 'Validation rules for chat input parameters',
			version: '1.0.0',
			context: 'chat_input',
			rules: [
				{
					id: 'claude_extended_thinking_temperature',
					name: 'Claude Extended Thinking Temperature Requirement',
					description: 'When Claude Opus or Sonnet models have extended thinking enabled, temperature must be 1.0',
					trigger: 'on_change',
					priority: 100,
					condition: {
						logic: 'AND',
						conditions: [
							{
								field: 'model',
								operator: 'matches_pattern',
								value: 'claude.*(?:opus|sonnet)',
								description: 'Model is Claude Opus or Sonnet',
							},
							{
								field: 'parameters.extendedThinking.enabled',
								operator: 'equals',
								value: true,
								description: 'Extended thinking is enabled',
							},
						],
					},
					actions: [
						{
							action: 'set_value',
							target: 'temperature',
							value: 1.0,
							message: 'Temperature automatically set to 1.0 for Claude models with extended thinking',
							severity: 'info',
						},
						{
							action: 'set_constraint',
							target: 'temperature',
							value: { min: 1.0, max: 1.0 },
						},
					],
					enabled: true,
					tags: ['claude', 'extended_thinking', 'temperature'],
				},
				{
					id: 'vision_model_image_requirement',
					name: 'Vision Model Image Requirement',
					description: 'Models with vision capabilities should have image attachments for optimal performance',
					trigger: 'on_submit',
					priority: 50,
					condition: {
						logic: 'AND',
						conditions: [
							{
								field: 'modelCapabilities.supportedFeatures.vision',
								operator: 'equals',
								value: true,
								description: 'Model supports vision',
							},
							{
								field: 'parameters.attachedFiles.length',
								operator: 'equals',
								value: 0,
								description: 'No files attached',
							},
						],
					},
					actions: [
						{
							action: 'show_warning',
							target: 'attachedFiles',
							message: 'This model supports vision capabilities. Consider attaching images for better results.',
							severity: 'warning',
						},
					],
					enabled: true,
					tags: ['vision', 'attachments'],
				},
				{
					id: 'high_temperature_warning',
					name: 'High Temperature Warning',
					description: 'Warn users when temperature is set very high',
					trigger: 'on_change',
					priority: 10,
					condition: {
						field: 'parameters.temperature',
						operator: 'greater_than',
						value: 0.9,
						description: 'Temperature is greater than 0.9',
					},
					actions: [
						{
							action: 'show_warning',
							target: 'temperature',
							message: 'High temperature values (>0.9) may produce unpredictable results',
							severity: 'warning',
						},
					],
					enabled: true,
					tags: ['temperature', 'warning'],
				},
				{
					id: 'max_tokens_context_limit',
					name: 'Max Tokens Context Limit',
					description: 'Ensure max tokens does not exceed model capabilities',
					trigger: 'on_change',
					priority: 90,
					condition: {
						field: 'parameters.maxTokens',
						operator: 'greater_than',
						value: 100000, // TODO: This should be resolved dynamically from modelCapabilities.maxOutputTokens
						description: 'Max tokens exceeds model limit',
					},
					actions: [
						{
							action: 'set_constraint',
							target: 'maxTokens',
							value: { max: 100000 }, // TODO: This should be resolved dynamically from modelCapabilities.maxOutputTokens
						},
						{
							action: 'show_error',
							target: 'maxTokens',
							message: 'Max tokens cannot exceed model maximum output tokens',
							severity: 'error',
							blocking: true,
						},
					],
					enabled: true,
					tags: ['maxTokens', 'limits'],
				},
				{
					id: 'prompt_caching_feature_check',
					name: 'Prompt Caching Feature Check',
					description: 'Disable prompt caching for models that do not support it',
					trigger: 'on_load',
					priority: 80,
					condition: {
						field: 'modelCapabilities.supportedFeatures.promptCaching',
						operator: 'equals',
						value: false,
						description: 'Model does not support prompt caching',
					},
					actions: [
						{
							action: 'disable_feature',
							target: 'usePromptCaching',
							message: 'Prompt caching is not supported by this model',
						},
						{
							action: 'set_value',
							target: 'usePromptCaching',
							value: false,
						},
					],
					enabled: true,
					tags: ['promptCaching', 'features'],
				},
			],
			metadata: {
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				author: 'system',
			},
		};
	}

	/**
	 * Create the model configuration validation rule set
	 */
	private async createModelConfigRuleSet(): Promise<ValidationRuleSet> {
		return {
			id: 'model_config_validation',
			name: 'Model Configuration Validation',
			description: 'Validation rules for model configuration parameters',
			version: '1.0.0',
			context: 'model_config',
			rules: [
				{
					id: 'function_calling_json_requirement',
					name: 'Function Calling JSON Requirement',
					description: 'Models with function calling should have JSON response format enabled',
					trigger: 'on_change',
					priority: 70,
					condition: {
						logic: 'AND',
						conditions: [
							{
								field: 'modelCapabilities.supportedFeatures.functionCalling',
								operator: 'equals',
								value: true,
							},
							{
								field: 'parameters.responseFormat',
								operator: 'not_equals',
								value: 'json',
							},
						],
					},
					actions: [
						{
							action: 'suggest_value',
							target: 'responseFormat',
							value: 'json',
							message: 'JSON response format is recommended for function calling',
						},
					],
					enabled: true,
					tags: ['functionCalling', 'responseFormat'],
				},
			],
			metadata: {
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				author: 'system',
			},
		};
	}

	/**
	 * Get all available rule sets
	 */
	public getRuleSets(): ValidationRuleSet[] {
		if (!this.initialized) {
			logger.warn('ValidationRuleService: Service not initialized, returning empty array');
			return [];
		}

		return Array.from(this.ruleSets.values());
	}

	/**
	 * Get a specific rule set by ID
	 */
	public getRuleSet(id: string): ValidationRuleSet | undefined {
		if (!this.initialized) {
			logger.warn('ValidationRuleService: Service not initialized, returning undefined');
			return undefined;
		}

		return this.ruleSets.get(id);
	}

	/**
	 * Get rule sets by context
	 */
	public getRuleSetsByContext(context: string): ValidationRuleSet[] {
		if (!this.initialized) {
			logger.warn('ValidationRuleService: Service not initialized, returning empty array');
			return [];
		}

		return Array.from(this.ruleSets.values()).filter(ruleSet => ruleSet.context === context);
	}

	/**
	 * Validate parameters against a specific rule set
	 */
	public validate(
		ruleSetId: string,
		model: string,
		modelCapabilities: ModelCapabilities,
		parameters: Record<string, unknown>,
		trigger: 'on_change' | 'on_submit' | 'on_load' = 'on_change',
		additionalContext?: Record<string, unknown>,
	): ValidationResult {
		const ruleSet = this.getRuleSet(ruleSetId);
		if (!ruleSet) {
			throw new Error(`Rule set not found: ${ruleSetId}`);
		}

		const context = ValidationEngine.createContext(
			model,
			modelCapabilities,
			parameters,
			additionalContext,
		);

		return this.validationEngine.evaluateRuleSet(ruleSet, context, trigger);
	}

	/**
	 * Validate parameters against all rule sets for a context
	 */
	public validateByContext(
		context: string,
		model: string,
		modelCapabilities: ModelCapabilities,
		parameters: Record<string, unknown>,
		trigger: 'on_change' | 'on_submit' | 'on_load' = 'on_change',
		additionalContext?: Record<string, unknown>,
	): ValidationResult[] {
		const ruleSets = this.getRuleSetsByContext(context);
		
		return ruleSets.map(ruleSet => 
			this.validate(ruleSet.id, model, modelCapabilities, parameters, trigger, additionalContext)
		);
	}

	/**
	 * Add a new rule set
	 */
	public addRuleSet(ruleSet: ValidationRuleSet): void {
		this.ruleSets.set(ruleSet.id, ruleSet);
		logger.info(`ValidationRuleService: Added rule set "${ruleSet.name}" (${ruleSet.id})`);
	}

	/**
	 * Update an existing rule set
	 */
	public updateRuleSet(ruleSet: ValidationRuleSet): void {
		if (!this.ruleSets.has(ruleSet.id)) {
			throw new Error(`Rule set not found: ${ruleSet.id}`);
		}

		this.ruleSets.set(ruleSet.id, {
			...ruleSet,
			metadata: {
				createdAt: ruleSet.metadata?.createdAt || new Date().toISOString(),
				author: ruleSet.metadata?.author,
				...ruleSet.metadata,
				updatedAt: new Date().toISOString(),
			},
		});

		logger.info(`ValidationRuleService: Updated rule set "${ruleSet.name}" (${ruleSet.id})`);
	}

	/**
	 * Remove a rule set
	 */
	public removeRuleSet(id: string): boolean {
		const removed = this.ruleSets.delete(id);
		if (removed) {
			logger.info(`ValidationRuleService: Removed rule set ${id}`);
		}
		return removed;
	}
}