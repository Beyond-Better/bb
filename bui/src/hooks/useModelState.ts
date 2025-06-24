import { signal } from '@preact/signals';
import type { LLMRolesModelConfig } from '../types/llm.types.ts';
import type { ApiClient, ModelDetails } from '../utils/apiClient.utils.ts';

// Cache duration: 24 hours
const CACHE_DURATION = 24 * 60 * 60 * 1000;

interface ModelCapabilitiesCache {
	data: ModelDetails;
	timestamp: number;
}

interface ModelState {
	// Cache of model capabilities by model ID
	modelCapabilities: Record<string, ModelDetails>;
	// Default role-based model configuration from API
	defaultRolesModelConfig: LLMRolesModelConfig | null;
	// Loading states
	isLoadingDefaults: boolean;
	isLoadingCapabilities: Record<string, boolean>;
	// Error states
	error: string | null;
	// Internal cache with timestamps
	capabilitiesCache: Record<string, ModelCapabilitiesCache>;
	// Timestamp when defaults were loaded
	defaultsTimestamp: number | null;
}

// Initialize model state
const modelState = signal<ModelState>({
	modelCapabilities: {},
	defaultRolesModelConfig: null,
	isLoadingDefaults: false,
	isLoadingCapabilities: {},
	error: null,
	capabilitiesCache: {},
	defaultsTimestamp: null,
});

// Track API client and project ID
let apiClient: ApiClient | null = null;
let currentProjectId: string | null = null;

// Track pending capability requests to avoid duplicate API calls
const pendingCapabilityRequests: Map<string, Promise<ModelDetails | null>> = new Map();

/**
 * Check if cached data is still valid
 */
function isCacheValid(timestamp: number): boolean {
	return Date.now() - timestamp < CACHE_DURATION;
}

/**
 * Initialize model state with API client and project
 */
export function initializeModelState(client: ApiClient, projectId: string): void {
	console.log('useModelState: Initializing with project:', projectId);

	apiClient = client;
	currentProjectId = projectId;

	// Reset error state
	modelState.value = {
		...modelState.value,
		error: null,
	};

	// Load defaults immediately
	loadDefaultModels();
}

/**
 * Load default models from API
 */
async function loadDefaultModels(): Promise<void> {
	if (!apiClient || !currentProjectId) {
		console.warn('useModelState: Cannot load defaults - API client or project ID not set');
		return;
	}

	// Check if we have valid cached defaults
	if (
		modelState.value.defaultRolesModelConfig &&
		modelState.value.defaultsTimestamp &&
		isCacheValid(modelState.value.defaultsTimestamp)
	) {
		console.log('useModelState: Using cached default models');
		return;
	}

	console.log('useModelState: Loading default models from API');

	modelState.value = {
		...modelState.value,
		isLoadingDefaults: true,
		error: null,
	};

	try {
		const defaults = await apiClient.getCollaborationDefaults(currentProjectId);

		if (!defaults) {
			throw new Error('Failed to load default models from API');
		}

		// Extract the rolesModelConfig from the CollaborationValues response
		const rolesModelConfig: LLMRolesModelConfig = defaults.collaborationParams.rolesModelConfig;

		modelState.value = {
			...modelState.value,
			defaultRolesModelConfig: rolesModelConfig,
			defaultsTimestamp: Date.now(),
			isLoadingDefaults: false,
			error: null,
		};

		console.log('useModelState: Successfully loaded default models:', rolesModelConfig);

		// Preload capabilities for default models
		const defaultModelIds = [
			rolesModelConfig.orchestrator?.model,
			rolesModelConfig.agent?.model,
			rolesModelConfig.chat?.model,
		].filter((model): model is string => Boolean(model));

		// Remove duplicates
		const uniqueModelIds = [...new Set(defaultModelIds)];

		// Load capabilities for default models in background
		uniqueModelIds.forEach((modelId) => {
			loadModelCapabilities(modelId).catch((error) => {
				console.warn(`useModelState: Failed to preload capabilities for ${modelId}:`, error);
			});
		});
	} catch (error) {
		console.error('useModelState: Failed to load default models:', error);

		modelState.value = {
			...modelState.value,
			isLoadingDefaults: false,
			error: `Failed to load default models: ${error instanceof Error ? error.message : 'Unknown error'}`,
		};
	}
}

/**
 * Load model capabilities from API with caching and promise-based deduplication
 */
async function loadModelCapabilities(modelId: string): Promise<ModelDetails | null> {
	if (!apiClient) {
		console.warn('useModelState: Cannot load model capabilities - API client not set');
		return null;
	}

	// Check cache first
	const cached = modelState.value.capabilitiesCache[modelId];
	if (cached && isCacheValid(cached.timestamp)) {
		console.log(`useModelState: Using cached capabilities for ${modelId}`);
		return cached.data;
	}

	// Implement promise-based locking to prevent duplicate requests
	let capabilityRequest = pendingCapabilityRequests.get(modelId);

	if (!capabilityRequest) {
		// Only create a new request if one doesn't exist yet
		console.log(`useModelState: Loading capabilities for ${modelId}`);
		capabilityRequest = loadModelCapabilitiesWithLock(modelId);
		pendingCapabilityRequests.set(modelId, capabilityRequest);

		// Set up cleanup for the promise
		const cleanup = async () => {
			try {
				await capabilityRequest;
			} finally {
				// Only delete if our promise is still the one in the map
				if (pendingCapabilityRequests.get(modelId) === capabilityRequest) {
					pendingCapabilityRequests.delete(modelId);
				}
			}
		};
		// Start cleanup process but don't wait for it
		cleanup();
	} else {
		console.log(`useModelState: Using existing request for capabilities for ${modelId}`);
	}

	// Everyone waits on the same promise, whether we just created it or found an existing one
	return await capabilityRequest;
}

/**
 * Internal function to load model capabilities with proper state management
 */
async function loadModelCapabilitiesWithLock(modelId: string): Promise<ModelDetails | null> {
	// Set loading state
	modelState.value = {
		...modelState.value,
		isLoadingCapabilities: {
			...modelState.value.isLoadingCapabilities,
			[modelId]: true,
		},
	};

	try {
		const response = await apiClient!.getModelCapabilities(modelId);

		if (!response || !response.model) {
			throw new Error(`No model data returned for ${modelId}`);
		}

		const modelDetails = response.model;

		// Update cache and state
		modelState.value = {
			...modelState.value,
			modelCapabilities: {
				...modelState.value.modelCapabilities,
				[modelId]: modelDetails,
			},
			capabilitiesCache: {
				...modelState.value.capabilitiesCache,
				[modelId]: {
					data: modelDetails,
					timestamp: Date.now(),
				},
			},
			isLoadingCapabilities: {
				...modelState.value.isLoadingCapabilities,
				[modelId]: false,
			},
		};

		console.log(`useModelState: Successfully loaded capabilities for ${modelId}`);
		return modelDetails;
	} catch (error) {
		console.error(`useModelState: Failed to load capabilities for ${modelId}:`, error);

		// Clear loading state
		modelState.value = {
			...modelState.value,
			isLoadingCapabilities: {
				...modelState.value.isLoadingCapabilities,
				[modelId]: false,
			},
			error: `Failed to load model capabilities for ${modelId}: ${
				error instanceof Error ? error.message : 'Unknown error'
			}`,
		};

		return null;
	}
}

/**
 * Hook for components to access model state and operations
 */
export function useModelState() {
	return {
		modelState,

		/**
		 * Get model capabilities, loading if necessary
		 */
		getModelCapabilities: async (modelId: string): Promise<ModelDetails | null> => {
			// loadModelCapabilities now handles caching and deduplication internally
			return await loadModelCapabilities(modelId);
		},

		/**
		 * Get default model configuration for a specific role
		 */
		getDefaultModelConfig: (role: 'orchestrator' | 'agent' | 'chat') => {
			return modelState.value.defaultRolesModelConfig?.[role] || null;
		},

		/**
		 * Get complete default roles model configuration
		 */
		getDefaultRolesModelConfig: () => {
			return modelState.value.defaultRolesModelConfig;
		},

		/**
		 * Ensure model capabilities are loaded for multiple models
		 */
		ensureModelCapabilities: async (modelIds: string[]): Promise<void> => {
			const promises = modelIds.map((modelId) => loadModelCapabilities(modelId));
			await Promise.allSettled(promises);
		},

		/**
		 * Check if model capabilities are available (cached)
		 */
		hasModelCapabilities: (modelId: string): boolean => {
			const cached = modelState.value.capabilitiesCache[modelId];
			return cached ? isCacheValid(cached.timestamp) : false;
		},

		/**
		 * Clear all cached data and reload defaults
		 */
		refreshCache: async (): Promise<void> => {
			console.log('useModelState: Refreshing cache');

			// Clear pending requests
			pendingCapabilityRequests.clear();

			modelState.value = {
				...modelState.value,
				modelCapabilities: {},
				capabilitiesCache: {},
				defaultsTimestamp: null,
				defaultRolesModelConfig: null,
			};

			await loadDefaultModels();
		},

		/**
		 * Clear error state
		 */
		clearError: (): void => {
			modelState.value = {
				...modelState.value,
				error: null,
			};
		},

		/**
		 * Get loading state for a specific model
		 */
		isLoadingModel: (modelId: string): boolean => {
			return modelState.value.isLoadingCapabilities[modelId] || false;
		},
	};
}
