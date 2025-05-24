#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env

/**
 * Model Capabilities Fetcher
 *
 * Script to fetch and update model capabilities from various providers.
 *
 * This script gathers model information including context window sizes, token limits,
 * pricing details, feature support, and parameter constraints. It stores this data
 * in a JSON file that can be used by the API to enforce limits and provide defaults.
 *
 * Usage:
 *   deno run --allow-net --allow-read --allow-write --allow-env api/scripts/update_model_capabilities.ts
 *
 * Options:
 *   --output=PATH                Output file path (default: api/src/data/modelCapabilities.json)
 *   --providers=PROVIDERS        Comma-separated list of providers to fetch (default: all)
 *   --anthropic-key=KEY          Anthropic API key (can also use ANTHROPIC_API_KEY env var)
 *   --openai-key=KEY             OpenAI API key (can also use OPENAI_API_KEY env var)
 *   --google-key=KEY             Google API key (can also use GOOGLE_API_KEY env var)
 */

import { parseArgs } from '@std/cli';
import { ensureDir, exists } from '@std/fs';
import { dirname } from '@std/path';
import { isError } from 'shared/error.ts';

/**
 * Enhanced model capabilities interface that includes pricing nuances
 */
export interface ModelCapabilities {
	// Basic model information
	modelId: string;
	displayName: string;
	provider: string;
	family?: string; // Model family (e.g., "GPT-4", "Claude-3")

	// Context and token limits
	contextWindow: number;
	maxInputTokens?: number;
	maxOutputTokens: number;

	// Pricing - more detailed structure
	pricing: {
		inputTokens: {
			basePrice: number; // Cost per input token
			cachedPrice?: number; // Cost for cached tokens (if different)
			bulkDiscounts?: Array<{ // Any volume-based discounts
				threshold: number; // Tokens per month threshold
				price: number; // Discounted price per token
			}>;
		};
		outputTokens: {
			basePrice: number; // Cost per output token
			bulkDiscounts?: Array<{ // Any volume-based discounts
				threshold: number; // Tokens per month threshold
				price: number; // Discounted price per token
			}>;
		};
		finetuningAvailable?: boolean; // Whether finetuning is available
		finetuningCost?: { // Finetuning costs if available
			trainingPerToken: number;
			inferencePerToken: number;
		};
		billingTier?: string; // Any special billing tier info
		currency: string; // Currency for prices (default USD)
		effectiveDate: string; // Date these prices were effective from
	};

	// Feature support
	supportedFeatures: {
		functionCalling: boolean;
		json: boolean;
		streaming: boolean;
		vision: boolean;
		extendedThinking?: boolean;
		promptCaching?: boolean;
		multimodal?: boolean;
	};

	// Default parameters
	defaults: {
		temperature: number;
		topP?: number;
		frequencyPenalty?: number;
		presencePenalty?: number;
		maxTokens: number;
		responseFormat?: string;
	};

	// Parameter constraints
	constraints: {
		temperature: { min: number; max: number };
		topP?: { min: number; max: number };
		frequencyPenalty?: { min: number; max: number };
		presencePenalty?: { min: number; max: number };
	};

	// System prompt handling
	systemPromptBehavior: 'required' | 'optional' | 'notSupported' | 'fixed';

	// Metadata
	trainingCutoff?: string; // When the model's training data ends
	releaseDate?: string; // When the model was released
	deprecated?: boolean; // Whether the model is deprecated
	responseSpeed?: 'fast' | 'medium' | 'slow'; // Relative speed categorization
	modality: 'text' | 'text-and-vision' | 'multimodal';
	description?: string; // Human-readable description

	// Source of this information
	source: 'api' | 'documentation' | 'manual'; // How we obtained this data
	lastUpdated: string; // When this information was last updated
}

/**
 * Script configuration
 */
interface FetcherConfig {
	outputPath: string;
	providersToFetch: string[];
	apiKeys: Record<string, string>;
}

/**
 * Main capabilities fetcher class
 */
class ModelCapabilitiesFetcher {
	private config: FetcherConfig;
	private allCapabilities: Record<string, Record<string, ModelCapabilities>> = {};

	constructor(config: FetcherConfig) {
		this.config = config;
	}

	/**
	 * Run the fetcher for all specified providers
	 */
	public async run(): Promise<void> {
		console.log('Starting model capabilities fetcher...');

		// Try to load existing capabilities first
		await this.loadExistingCapabilities();

		// Fetch capabilities for each provider
		for (const provider of this.config.providersToFetch) {
			try {
				console.log(`Fetching capabilities for ${provider}...`);
				await this.fetchProviderCapabilities(provider);
			} catch (error) {
				console.error(`Error fetching capabilities for ${provider}:`, isError(error) ? error.message : error);
			}
		}

		// Save the updated capabilities
		await this.saveCapabilities();

		console.log('Finished fetching model capabilities.');
	}

	/**
	 * Load existing capabilities file if it exists
	 */
	private async loadExistingCapabilities(): Promise<void> {
		try {
			if (await exists(this.config.outputPath)) {
				const content = await Deno.readTextFile(this.config.outputPath);
				this.allCapabilities = JSON.parse(content);
				console.log(`Loaded existing capabilities from ${this.config.outputPath}`);
			}
		} catch (error) {
			console.warn(`Could not load existing capabilities: ${isError(error) ? error.message : error}`);
			this.allCapabilities = {};
		}
	}

	/**
	 * Save the capabilities to the output file
	 */
	private async saveCapabilities(): Promise<void> {
		try {
			// Ensure the directory exists
			await ensureDir(dirname(this.config.outputPath));

			// Save as JSON
			await Deno.writeTextFile(
				this.config.outputPath,
				JSON.stringify(this.allCapabilities, null, 2),
			);

			console.log(`Saved capabilities to ${this.config.outputPath}`);
		} catch (error) {
			console.error(`Error saving capabilities: ${isError(error) ? error.message : error}`);
		}
	}

	/**
	 * Fetch capabilities for a specific provider
	 */
	private async fetchProviderCapabilities(provider: string): Promise<void> {
		switch (provider.toLowerCase()) {
			case 'anthropic':
				await this.fetchAnthropicCapabilities();
				break;
			case 'openai':
				await this.fetchOpenAICapabilities();
				break;
			case 'google':
				await this.fetchGoogleCapabilities();
				break;
			case 'deepseek':
				await this.fetchDeepSeekCapabilities();
				break;
			case 'groq':
				await this.fetchGroqCapabilities();
				break;
			case 'ollama':
				// Ollama is local, so we'll handle it differently
				await this.compileOllamaCapabilities();
				break;
			default:
				console.warn(`Unsupported provider: ${provider}`);
		}
	}

	/**
	 * Fetch Anthropic model capabilities using their API
	 */
	private async fetchAnthropicCapabilities(): Promise<void> {
		const apiKey = this.config.apiKeys.anthropic;
		if (!apiKey) {
			throw new Error('Anthropic API key not provided');
		}

		try {
			// Anthropic doesn't have a models endpoint yet, so we'll use known models
			// with info from their documentation

			// Claude 3.5 Haiku
			this.registerModel({
				modelId: 'claude-3-5-haiku-20241022',
				displayName: 'Claude 3.5 Haiku',
				provider: 'anthropic',
				family: 'Claude-3',
				contextWindow: 200000,
				maxOutputTokens: 4096,
				pricing: {
					inputTokens: {
						basePrice: 0.00000080,
						cachedPrice: 0.00000100, // 5% of base price for cached input tokens
					},
					outputTokens: {
						basePrice: 0.00000400,
					},
					currency: 'USD',
					effectiveDate: '2024-10-22',
				},
				supportedFeatures: {
					functionCalling: true,
					json: true,
					streaming: true,
					vision: true,
					promptCaching: true,
				},
				defaults: {
					temperature: 0.7,
					maxTokens: 4096,
				},
				constraints: {
					temperature: { min: 0.0, max: 1.0 },
				},
				systemPromptBehavior: 'optional',
				trainingCutoff: '2023-08-01',
				releaseDate: '2024-10-22',
				responseSpeed: 'fast',
				modality: 'text-and-vision',
				description: 'Fast and cost-effective model for routine tasks',
				source: 'documentation',
				lastUpdated: new Date().toISOString(),
			});

			// Claude 3.5 Sonnet
			this.registerModel({
				modelId: 'claude-3-5-sonnet-20241022',
				displayName: 'Claude 3.5 Sonnet',
				provider: 'anthropic',
				family: 'Claude-3',
				contextWindow: 200000,
				maxOutputTokens: 128000,
				pricing: {
					inputTokens: {
						basePrice: 0.000003,
						cachedPrice: 0.00000375, // 5% of base price for cached input tokens
					},
					outputTokens: {
						basePrice: 0.000015,
					},
					currency: 'USD',
					effectiveDate: '2024-10-22',
				},
				supportedFeatures: {
					functionCalling: true,
					json: true,
					streaming: true,
					vision: true,
					promptCaching: true,
				},
				defaults: {
					temperature: 0.7,
					maxTokens: 8192,
				},
				constraints: {
					temperature: { min: 0.0, max: 1.0 },
				},
				systemPromptBehavior: 'optional',
				trainingCutoff: '2023-08-01',
				releaseDate: '2024-10-22',
				responseSpeed: 'medium',
				modality: 'text-and-vision',
				description: "Anthropic's flagship model balancing quality, speed, and cost",
				source: 'documentation',
				lastUpdated: new Date().toISOString(),
			});

			// Claude 3.7 Sonnet
			this.registerModel({
				modelId: 'claude-3-7-sonnet-20250219',
				displayName: 'Claude 3.7 Sonnet',
				provider: 'anthropic',
				family: 'Claude-3',
				contextWindow: 200000,
				maxOutputTokens: 128000,
				pricing: {
					inputTokens: {
						basePrice: 0.000003,
						cachedPrice: 0.00000375, // 5% of base price for cached input tokens
					},
					outputTokens: {
						basePrice: 0.000015,
					},
					currency: 'USD',
					effectiveDate: '2024-04-25',
				},
				supportedFeatures: {
					functionCalling: true,
					json: true,
					streaming: true,
					vision: true,
					extendedThinking: true,
					promptCaching: true,
				},
				defaults: {
					temperature: 0.7,
					maxTokens: 8192,
				},
				constraints: {
					temperature: { min: 0.0, max: 1.0 },
				},
				systemPromptBehavior: 'optional',
				trainingCutoff: '2023-10-01',
				releaseDate: '2024-04-25',
				responseSpeed: 'medium',
				modality: 'text-and-vision',
				description: "Anthropic's most advanced model with extended thinking capabilities",
				source: 'documentation',
				lastUpdated: new Date().toISOString(),
			});

			// Claude 4.0 Sonnet
			this.registerModel({
				modelId: 'claude-sonnet-4-20250514',
				displayName: 'Claude 4.0 Sonnet',
				provider: 'anthropic',
				family: 'Claude-4',
				contextWindow: 200000,
				maxOutputTokens: 128000,
				pricing: {
					inputTokens: {
						basePrice: 0.000003,
						cachedPrice: 0.00000375, // 5% of base price for cached input tokens
					},
					outputTokens: {
						basePrice: 0.000015,
					},
					currency: 'USD',
					effectiveDate: '2025-05-23',
				},
				supportedFeatures: {
					functionCalling: true,
					json: true,
					streaming: true,
					vision: true,
					extendedThinking: true,
					promptCaching: true,
				},
				defaults: {
					temperature: 0.7,
					maxTokens: 8192,
				},
				constraints: {
					temperature: { min: 0.0, max: 1.0 },
				},
				systemPromptBehavior: 'optional',
				trainingCutoff: '2025-03-01',
				releaseDate: '2025-05-23',
				responseSpeed: 'medium',
				modality: 'text-and-vision',
				description: "Anthropic's advanced model with extended thinking capabilities",
				source: 'documentation',
				lastUpdated: new Date().toISOString(),
			});

			// Claude 4.0 Opus
			this.registerModel({
				modelId: 'claude-opus-4-20250514',
				displayName: 'Claude 4.0 Opus',
				provider: 'anthropic',
				family: 'Claude-4',
				contextWindow: 200000,
				maxOutputTokens: 128000,
				pricing: {
					inputTokens: {
						basePrice: 0.000015,
						cachedPrice: 0.00001875, // 5% of base price for cached input tokens
					},
					outputTokens: {
						basePrice: 0.000075,
					},
					currency: 'USD',
					effectiveDate: '2025-05-23',
				},
				supportedFeatures: {
					functionCalling: true,
					json: true,
					streaming: true,
					vision: true,
					extendedThinking: true,
					promptCaching: true,
				},
				defaults: {
					temperature: 0.7,
					maxTokens: 8192,
				},
				constraints: {
					temperature: { min: 0.0, max: 1.0 },
				},
				systemPromptBehavior: 'optional',
				trainingCutoff: '2025-03-01',
				releaseDate: '2025-05-23',
				responseSpeed: 'medium',
				modality: 'text-and-vision',
				description: "Anthropic's advanced model with extended thinking capabilities",
				source: 'documentation',
				lastUpdated: new Date().toISOString(),
			});

			// Try to validate the models by making a sample API call
			const response = await fetch('https://api.anthropic.com/v1/messages', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': apiKey,
					'anthropic-version': '2023-06-01',
				},
				body: JSON.stringify({
					model: 'claude-3-5-sonnet-20241022',
					max_tokens: 10,
					messages: [{ role: 'user', content: 'Say hi' }],
				}),
			});

			if (!response.ok) {
				const error = await response.json();
				console.warn(`Could not validate Anthropic models: ${JSON.stringify(error)}`);
			} else {
				console.log('Successfully validated Anthropic API access');
			}
		} catch (error) {
			console.error('Error fetching Anthropic capabilities:', error);
		}
	}

	/**
	 * Fetch OpenAI model capabilities
	 */
	private async fetchOpenAICapabilities(): Promise<void> {
		const apiKey = this.config.apiKeys.openai;
		if (!apiKey) {
			throw new Error('OpenAI API key not provided');
		}

		try {
			// First, get the list of available models
			const response = await fetch('https://api.openai.com/v1/models', {
				headers: {
					'Authorization': `Bearer ${apiKey}`,
				},
			});

			if (!response.ok) {
				throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
			}

			const data = await response.json();
			const models = data.data;

			// Filter to get the main models we're interested in
			const relevantModels = models.filter((model: { id: string }) => {
				const id = model.id.toLowerCase();
				return (id.includes('gpt-4') || id.includes('gpt-3.5')) &&
					!id.includes('vision') && // We'll handle vision models separately
					!id.includes('instruct');
			});

			// Build capabilities for each model
			for (const model of relevantModels) {
				// Fetch more detailed model information
				// Note: OpenAI API doesn't provide detailed capabilities, so we'll use hardcoded info
				// based on documentation plus the model information from the API
				await this.registerOpenAIModel(model.id);
			}

			console.log(`Registered ${relevantModels.length} OpenAI models`);
		} catch (error) {
			console.error('Error fetching OpenAI capabilities:', error);
		}
	}

	/**
	 * Register an OpenAI model with its capabilities
	 */
	// deno-lint-ignore require-await
	private async registerOpenAIModel(modelId: string): Promise<void> {
		// Map of known models to their capabilities
		const modelInfo: Partial<Record<string, Partial<ModelCapabilities>>> = {
			'gpt-4o': {
				displayName: 'GPT-4o',
				family: 'GPT-4',
				contextWindow: 128000,
				maxOutputTokens: 4096,
				pricing: {
					inputTokens: {
						basePrice: 0.00001,
					},
					outputTokens: {
						basePrice: 0.00003,
					},
					currency: 'USD',
					effectiveDate: '2024-05-13',
				},
				supportedFeatures: {
					functionCalling: true,
					json: true,
					streaming: true,
					vision: true,
					multimodal: true,
					promptCaching: false,
				},
				defaults: {
					temperature: 0.7,
					maxTokens: 4096,
				},
				constraints: {
					temperature: { min: 0.0, max: 2.0 },
				},
				systemPromptBehavior: 'optional',
				trainingCutoff: '2023-10-01',
				releaseDate: '2024-05-13',
				responseSpeed: 'medium',
				modality: 'multimodal',
			},
			'gpt-4-turbo': {
				displayName: 'GPT-4 Turbo',
				family: 'GPT-4',
				contextWindow: 128000,
				maxOutputTokens: 4096,
				pricing: {
					inputTokens: {
						basePrice: 0.00001,
					},
					outputTokens: {
						basePrice: 0.00003,
					},
					currency: 'USD',
					effectiveDate: '2023-11-06',
				},
				supportedFeatures: {
					functionCalling: true,
					json: true,
					streaming: true,
					vision: false,
					promptCaching: false,
				},
				defaults: {
					temperature: 0.7,
					maxTokens: 4096,
				},
				constraints: {
					temperature: { min: 0.0, max: 2.0 },
				},
				systemPromptBehavior: 'optional',
				trainingCutoff: '2023-04-01',
				releaseDate: '2023-11-06',
				modality: 'text',
			},
			'gpt-3.5-turbo': {
				displayName: 'GPT-3.5 Turbo',
				family: 'GPT-3.5',
				contextWindow: 16385,
				maxOutputTokens: 4096,
				pricing: {
					inputTokens: {
						basePrice: 0.0000005,
					},
					outputTokens: {
						basePrice: 0.0000015,
					},
					currency: 'USD',
					effectiveDate: '2023-11-06',
				},
				supportedFeatures: {
					functionCalling: true,
					json: true,
					streaming: true,
					vision: false,
					promptCaching: false,
				},
				defaults: {
					temperature: 0.7,
					maxTokens: 4096,
				},
				constraints: {
					temperature: { min: 0.0, max: 2.0 },
				},
				systemPromptBehavior: 'optional',
				trainingCutoff: '2021-09-01',
				releaseDate: '2022-11-28',
				responseSpeed: 'fast',
				modality: 'text',
			},
		};

		// Get the base model from the model ID (removing version suffixes)
		const baseModelId = modelId.split('-').slice(0, 2).join('-');
		const info = modelInfo[baseModelId] || modelInfo[modelId] || {
			displayName: `OpenAI ${modelId}`,
			contextWindow: 4096,
			maxOutputTokens: 4096,
			pricing: {
				inputTokens: {
					basePrice: 0.0001, // Default price, should be updated when known
				},
				outputTokens: {
					basePrice: 0.0002, // Default price, should be updated when known
				},
				currency: 'USD',
				effectiveDate: new Date().toISOString().split('T')[0],
			},
			supportedFeatures: {
				functionCalling: false,
				json: false,
				streaming: true,
				vision: false,
				promptCaching: false,
			},
			defaults: {
				temperature: 0.7,
				maxTokens: 2048,
			},
			constraints: {
				temperature: { min: 0.0, max: 1.0 },
			},
			systemPromptBehavior: 'optional',
			modality: 'text',
		};

		if (info) {
			// Create base object with defaults that will be overridden by info
			const baseModelData = {
				modelId,
				provider: 'openai',
				source: 'api+documentation',
				lastUpdated: new Date().toISOString(),
			};

			// Then merge, allowing info to override defaults
			this.registerModel({ ...baseModelData, ...info } as ModelCapabilities);
		} else {
			console.warn(`No predefined capabilities for OpenAI model: ${modelId}`);
		}
	}

	/**
	 * Fetch Google model capabilities
	 */
	private async fetchGoogleCapabilities(): Promise<void> {
		const apiKey = this.config.apiKeys.google;

		// Even without an API key, we can register known models based on documentation
		this.registerModel({
			modelId: 'gemini-1.5-flash',
			displayName: 'Gemini 1.5 Flash',
			provider: 'google',
			family: 'Gemini',
			contextWindow: 1000000,
			maxOutputTokens: 8192,
			pricing: {
				inputTokens: {
					basePrice: 0.00000035,
				},
				outputTokens: {
					basePrice: 0.0000014,
				},
				currency: 'USD',
				effectiveDate: '2024-03-15',
			},
			supportedFeatures: {
				functionCalling: true,
				json: true,
				streaming: true,
				vision: true,
				multimodal: true,
				promptCaching: false,
			},
			defaults: {
				temperature: 0.7,
				maxTokens: 8192,
			},
			constraints: {
				temperature: { min: 0.0, max: 1.0 },
			},
			systemPromptBehavior: 'optional',
			trainingCutoff: '2023-08-01',
			releaseDate: '2024-03-15',
			responseSpeed: 'fast',
			modality: 'multimodal',
			description: 'Fast and cost-effective multimodal model from Google',
			source: 'documentation',
			lastUpdated: new Date().toISOString(),
		});

		this.registerModel({
			modelId: 'gemini-2.0-flash',
			displayName: 'Gemini 2.0 Flash',
			provider: 'google',
			family: 'Gemini',
			contextWindow: 1000000,
			maxOutputTokens: 8192,
			pricing: {
				inputTokens: {
					basePrice: 0.00000035,
				},
				outputTokens: {
					basePrice: 0.0000014,
				},
				currency: 'USD',
				effectiveDate: '2024-08-15',
			},
			supportedFeatures: {
				functionCalling: true,
				json: true,
				streaming: true,
				vision: true,
				multimodal: true,
				promptCaching: false,
			},
			defaults: {
				temperature: 0.7,
				maxTokens: 8192,
			},
			constraints: {
				temperature: { min: 0.0, max: 1.0 },
			},
			systemPromptBehavior: 'optional',
			trainingCutoff: '2024-03-01',
			releaseDate: '2024-08-15',
			responseSpeed: 'fast',
			modality: 'multimodal',
			description: 'Latest multimodal model from Google with improved reasoning',
			source: 'documentation',
			lastUpdated: new Date().toISOString(),
		});

		// If API key is available, try to validate the models
		if (apiKey) {
			try {
				const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);

				if (response.ok) {
					const data = await response.json();
					console.log(
						`Successfully validated Google AI API access, found ${data.models?.length || 0} models`,
					);
				} else {
					console.warn(`Could not validate Google AI models: ${response.statusText}`);
				}
			} catch (error) {
				console.warn(`Error validating Google AI access: ${isError(error) ? error.message : error}`);
			}
		}
	}

	/**
	 * Register model capabilities for DeepSeek
	 */
	// deno-lint-ignore require-await
	private async fetchDeepSeekCapabilities(): Promise<void> {
		// DeepSeek models based on documentation
		this.registerModel({
			modelId: 'deepseek-chat',
			displayName: 'DeepSeek Chat',
			provider: 'deepseek',
			family: 'DeepSeek',
			contextWindow: 32768,
			maxOutputTokens: 8192,
			pricing: {
				inputTokens: {
					basePrice: 0.000001,
				},
				outputTokens: {
					basePrice: 0.000005,
				},
				currency: 'USD',
				effectiveDate: '2024-02-01',
			},
			supportedFeatures: {
				functionCalling: true,
				json: true,
				streaming: true,
				vision: false,
				promptCaching: false,
			},
			defaults: {
				temperature: 0.7,
				maxTokens: 8192,
			},
			constraints: {
				temperature: { min: 0.0, max: 1.0 },
			},
			systemPromptBehavior: 'optional',
			releaseDate: '2024-02-01',
			responseSpeed: 'medium',
			modality: 'text',
			description: 'General purpose text model from DeepSeek',
			source: 'documentation',
			lastUpdated: new Date().toISOString(),
		});

		this.registerModel({
			modelId: 'deepseek-reasoner',
			displayName: 'DeepSeek Reasoner',
			provider: 'deepseek',
			family: 'DeepSeek',
			contextWindow: 128000,
			maxOutputTokens: 16384,
			pricing: {
				inputTokens: {
					basePrice: 0.000002,
				},
				outputTokens: {
					basePrice: 0.000008,
				},
				currency: 'USD',
				effectiveDate: '2024-05-01',
			},
			supportedFeatures: {
				functionCalling: true,
				json: true,
				streaming: true,
				vision: false,
				promptCaching: false,
			},
			defaults: {
				temperature: 0.5,
				maxTokens: 8192,
			},
			constraints: {
				temperature: { min: 0.0, max: 1.0 },
			},
			systemPromptBehavior: 'optional',
			releaseDate: '2024-05-01',
			responseSpeed: 'medium',
			modality: 'text',
			description: 'Advanced reasoning model from DeepSeek',
			source: 'documentation',
			lastUpdated: new Date().toISOString(),
		});
	}

	/**
	 * Register model capabilities for Groq
	 */
	// deno-lint-ignore require-await
	private async fetchGroqCapabilities(): Promise<void> {
		// Groq models based on documentation
		this.registerModel({
			modelId: 'llama3-8b-8192',
			displayName: 'LLaMA 3 8B',
			provider: 'groq',
			family: 'LLaMA',
			contextWindow: 8192,
			maxOutputTokens: 4096,
			pricing: {
				inputTokens: {
					basePrice: 0.0000001,
				},
				outputTokens: {
					basePrice: 0.0000002,
				},
				currency: 'USD',
				effectiveDate: '2024-04-18',
			},
			supportedFeatures: {
				functionCalling: true,
				json: true,
				streaming: true,
				vision: false,
				promptCaching: false,
			},
			defaults: {
				temperature: 0.7,
				maxTokens: 4096,
			},
			constraints: {
				temperature: { min: 0.0, max: 1.0 },
			},
			systemPromptBehavior: 'optional',
			releaseDate: '2024-04-18',
			responseSpeed: 'fast',
			modality: 'text',
			description: 'Fast LLaMA 3 8B model on Groq infrastructure',
			source: 'documentation',
			lastUpdated: new Date().toISOString(),
		});

		this.registerModel({
			modelId: 'llama3-70b-8192',
			displayName: 'LLaMA 3 70B',
			provider: 'groq',
			family: 'LLaMA',
			contextWindow: 8192,
			maxOutputTokens: 4096,
			pricing: {
				inputTokens: {
					basePrice: 0.0000003,
				},
				outputTokens: {
					basePrice: 0.0000009,
				},
				currency: 'USD',
				effectiveDate: '2024-04-18',
			},
			supportedFeatures: {
				functionCalling: true,
				json: true,
				streaming: true,
				vision: false,
				promptCaching: false,
			},
			defaults: {
				temperature: 0.7,
				maxTokens: 4096,
			},
			constraints: {
				temperature: { min: 0.0, max: 1.0 },
			},
			systemPromptBehavior: 'optional',
			releaseDate: '2024-04-18',
			responseSpeed: 'medium',
			modality: 'text',
			description: "LLaMA 3 70B model on Groq's hardware",
			source: 'documentation',
			lastUpdated: new Date().toISOString(),
		});

		this.registerModel({
			modelId: 'mixtral-8x7b-32768',
			displayName: 'Mixtral 8x7B',
			provider: 'groq',
			family: 'Mixtral',
			contextWindow: 32768,
			maxOutputTokens: 4096,
			pricing: {
				inputTokens: {
					basePrice: 0.0000002,
				},
				outputTokens: {
					basePrice: 0.0000006,
				},
				currency: 'USD',
				effectiveDate: '2024-01-10',
			},
			supportedFeatures: {
				functionCalling: true,
				json: true,
				streaming: true,
				vision: false,
				promptCaching: false,
			},
			defaults: {
				temperature: 0.7,
				maxTokens: 4096,
			},
			constraints: {
				temperature: { min: 0.0, max: 1.0 },
			},
			systemPromptBehavior: 'optional',
			releaseDate: '2024-01-10',
			responseSpeed: 'medium',
			modality: 'text',
			description: "Mixtral model on Groq's hardware",
			source: 'documentation',
			lastUpdated: new Date().toISOString(),
		});
	}

	/**
	 * Compile capabilities for Ollama models
	 */
	// deno-lint-ignore require-await
	private async compileOllamaCapabilities(): Promise<void> {
		// Ollama models - note these run locally so prices are effectively zero
		// but we maintain the structure for consistency
		this.registerModel({
			modelId: 'mistral',
			displayName: 'Mistral 7B',
			provider: 'ollama',
			family: 'Mistral',
			contextWindow: 8192,
			maxOutputTokens: 4096,
			pricing: {
				inputTokens: { basePrice: 0 },
				outputTokens: { basePrice: 0 },
				currency: 'USD',
				effectiveDate: '2023-10-01',
			},
			supportedFeatures: {
				functionCalling: false,
				json: true,
				streaming: true,
				vision: false,
				promptCaching: false,
			},
			defaults: {
				temperature: 0.7,
				maxTokens: 4096,
			},
			constraints: {
				temperature: { min: 0.0, max: 1.0 },
			},
			systemPromptBehavior: 'optional',
			releaseDate: '2023-10-01',
			responseSpeed: 'medium',
			modality: 'text',
			description: 'Mistral 7B model running locally via Ollama',
			source: 'documentation',
			lastUpdated: new Date().toISOString(),
		});

		// Add more Ollama models
		this.registerModel({
			modelId: 'llama3-3',
			displayName: 'LLaMA 3 (8B)',
			provider: 'ollama',
			family: 'LLaMA',
			contextWindow: 8192,
			maxOutputTokens: 4096,
			pricing: {
				inputTokens: { basePrice: 0 },
				outputTokens: { basePrice: 0 },
				currency: 'USD',
				effectiveDate: '2024-04-18',
			},
			supportedFeatures: {
				functionCalling: false,
				json: true,
				streaming: true,
				vision: false,
				promptCaching: false,
			},
			defaults: {
				temperature: 0.7,
				maxTokens: 4096,
			},
			constraints: {
				temperature: { min: 0.0, max: 1.0 },
			},
			systemPromptBehavior: 'optional',
			releaseDate: '2024-04-18',
			responseSpeed: 'medium',
			modality: 'text',
			description: "Meta's LLaMA 3 8B model running locally via Ollama",
			source: 'documentation',
			lastUpdated: new Date().toISOString(),
		});
	}

	/**
	 * Register a model with its capabilities
	 */
	private registerModel(modelCapabilities: ModelCapabilities): void {
		const { provider, modelId } = modelCapabilities;

		// Initialize provider object if it doesn't exist
		if (!this.allCapabilities[provider]) {
			this.allCapabilities[provider] = {};
		}

		// Add the model capabilities
		this.allCapabilities[provider][modelId] = modelCapabilities;
		console.log(`Registered ${provider}/${modelId}`);
	}
}

/**
 * Main function to run the script
 */
async function main() {
	// Parse command line arguments
	const args = parseArgs(Deno.args, {
		string: ['output', 'providers', 'anthropic-key', 'openai-key', 'google-key'],
		default: {
			output: './api/src/data/modelCapabilities.json',
			providers: 'anthropic,openai,google,deepseek,groq,ollama',
		},
	});

	// Setup configuration
	const config: FetcherConfig = {
		outputPath: args.output,
		providersToFetch: args.providers.split(',').map((p) => p.trim()),
		apiKeys: {
			anthropic: args['anthropic-key'] || Deno.env.get('ANTHROPIC_API_KEY') || '',
			openai: args['openai-key'] || Deno.env.get('OPENAI_API_KEY') || '',
			google: args['google-key'] || Deno.env.get('GOOGLE_API_KEY') || '',
		},
	};

	// Create and run the fetcher
	const fetcher = new ModelCapabilitiesFetcher(config);
	await fetcher.run();
}

// Run the script
if (import.meta.main) {
	main().catch((err) => {
		console.error('Fatal error:', err);
		Deno.exit(1);
	});
}
