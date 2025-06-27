/**
 * React hook for validation in BUI components
 * Integrates with the validation framework to provide real-time parameter validation
 */

import { useCallback, useEffect, useRef } from 'preact/hooks';
import { batch, computed, signal, useSignal, useSignalEffect } from '@preact/signals';
import type { ApiClient } from '../utils/apiClient.utils.ts';
import {
	aggregateValidationResults,
	applyConstraintsToField,
	getFieldMessages,
	getSuggestedValue,
	shouldHighlightField,
	ValidationClient,
	type ValidationPreview,
	type ValidationResult,
} from '../utils/validationClient.utils.ts';

// Shared validation client instance
let validationClientInstance: ValidationClient | null = null;

function getValidationClient(apiClient: ApiClient): ValidationClient {
	if (!validationClientInstance) {
		validationClientInstance = new ValidationClient(apiClient);
	}
	return validationClientInstance;
}

export interface UseValidationOptions {
	/** Context for validation rules (default: 'chat_input') */
	context?: string;
	/** Whether to validate on parameter changes (default: true) */
	validateOnChange?: boolean;
	/** Debounce delay for validation in ms (default: 300) */
	debounceMs?: number;
	/** Whether to fetch initial constraints on load (default: true) */
	fetchInitialConstraints?: boolean;
}

export interface ValidationState {
	/** Current validation result */
	result: ValidationResult | null;
	/** Whether validation is currently running */
	isValidating: boolean;
	/** Any validation errors */
	error: string | null;
	/** Initial constraints and suggestions from the model */
	preview: ValidationPreview | null;
	/** Whether preview is loading */
	isLoadingPreview: boolean;
}

export interface ValidationActions {
	/** Manually trigger validation */
	validate: (trigger?: 'on_change' | 'on_submit' | 'on_load') => Promise<void>;
	/** Clear validation results */
	clear: () => void;
	/** Get constraints for a specific field */
	getFieldConstraints: (fieldName: string) => ReturnType<typeof applyConstraintsToField>;
	/** Get suggested value for a field */
	getFieldSuggestion: (fieldName: string, currentValue: unknown) => unknown;
	/** Get messages for a field */
	getFieldMessages: (fieldName: string) => ReturnType<typeof getFieldMessages>;
	/** Check if a field should be highlighted */
	shouldHighlightField: (fieldName: string) => ReturnType<typeof shouldHighlightField>;
}

/**
 * Hook for parameter validation using the validation framework
 */
export function useValidation(
	apiClient: ApiClient,
	model: string,
	parameters: Record<string, unknown>,
	options: UseValidationOptions = {},
): [ValidationState, ValidationActions] {
	const {
		context = 'chat_input',
		validateOnChange = true,
		debounceMs = 300,
		fetchInitialConstraints = true,
	} = options;

	// State signals
	const result = useSignal<ValidationResult | null>(null);
	const isValidating = useSignal<boolean>(false);
	const error = useSignal<string | null>(null);
	const preview = useSignal<ValidationPreview | null>(null);
	const isLoadingPreview = useSignal<boolean>(false);

	// Refs for debouncing and cleanup
	const validationTimeoutRef = useRef<number | null>(null);
	const validationClient = useRef<ValidationClient | null>(null);

	// Initialize validation client
	useEffect(() => {
		validationClient.current = getValidationClient(apiClient);
	}, [apiClient]);

	// Computed validation state
	const validationState = computed<ValidationState>(() => ({
		result: result.value,
		isValidating: isValidating.value,
		error: error.value,
		preview: preview.value,
		isLoadingPreview: isLoadingPreview.value,
	}));

	// Fetch initial constraints when model changes
	useSignalEffect(() => {
		if (!model || !fetchInitialConstraints || !validationClient.current) return;

		const fetchPreview = async () => {
			try {
				batch(() => {
					isLoadingPreview.value = true;
					error.value = null;
				});

				const previewData = await validationClient.current!.previewConstraints(model, context);

				batch(() => {
					preview.value = previewData;
					isLoadingPreview.value = false;
				});
			} catch (err) {
				batch(() => {
					error.value = err instanceof Error ? err.message : String(err);
					isLoadingPreview.value = false;
				});
				console.error('Failed to fetch validation preview:', err);
			}
		};

		fetchPreview();
	});

	// Validation function
	const validateParameters = useCallback(async (
		trigger: 'on_change' | 'on_submit' | 'on_load' = 'on_change',
	) => {
		if (!validationClient.current || !model) {
			return;
		}

		try {
			batch(() => {
				isValidating.value = true;
				error.value = null;
			});

			const results = await validationClient.current.validateParameters(
				model,
				parameters,
				{
					context,
					trigger,
				},
			);

			const aggregatedResult = aggregateValidationResults(results);

			batch(() => {
				result.value = aggregatedResult;
				isValidating.value = false;
			});
		} catch (err) {
			batch(() => {
				error.value = err instanceof Error ? err.message : String(err);
				isValidating.value = false;
			});
			console.error('Validation failed:', err);
		}
	}, [model, parameters, context]);

	// Debounced validation on parameter changes
	useSignalEffect(() => {
		if (!validateOnChange || !model) return;

		// Clear existing timeout
		if (validationTimeoutRef.current) {
			clearTimeout(validationTimeoutRef.current);
		}

		// Set new timeout for debounced validation
		validationTimeoutRef.current = setTimeout(() => {
			validateParameters('on_change');
		}, debounceMs);
	});

	// Run initial validation on load
	useEffect(() => {
		if (model && validationClient.current) {
			validateParameters('on_load');
		}
	}, [model, validateParameters]);

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (validationTimeoutRef.current) {
				clearTimeout(validationTimeoutRef.current);
			}
		};
	}, []);

	// Actions
	const actions: ValidationActions = {
		validate: validateParameters,
		clear: useCallback(() => {
			batch(() => {
				result.value = null;
				error.value = null;
			});
		}, []),
		getFieldConstraints: useCallback((fieldName: string) => {
			if (!result.value) {
				return {
					disabled: false,
					required: false,
				};
			}
			return applyConstraintsToField(
				fieldName,
				result.value.constraints,
				parameters[fieldName],
			);
		}, [parameters]),
		getFieldSuggestion: useCallback((fieldName: string, currentValue: unknown) => {
			if (!result.value) {
				return currentValue;
			}
			return getSuggestedValue(fieldName, result.value.suggestions, currentValue);
		}, []),
		getFieldMessages: useCallback((fieldName: string) => {
			if (!result.value) {
				return { info: [], warnings: [], errors: [] };
			}
			return getFieldMessages(fieldName, result.value.triggeredRules);
		}, []),
		shouldHighlightField: useCallback((fieldName: string) => {
			if (!result.value) {
				return {
					highlight: false,
					severity: 'info' as const,
				};
			}
			return shouldHighlightField(fieldName, result.value);
		}, []),
	};

	return [validationState.value, actions];
}

/**
 * Hook specifically for form field validation
 * Provides a simpler interface for individual form fields
 */
export function useFieldValidation(
	apiClient: ApiClient,
	model: string,
	parameters: Record<string, unknown>,
	fieldName: string,
	options: UseValidationOptions = {},
) {
	const [validationState, actions] = useValidation(apiClient, model, parameters, options);

	// Field-specific computed values
	const fieldState = computed(() => {
		const constraints = actions.getFieldConstraints(fieldName);
		const messages = actions.getFieldMessages(fieldName);
		const highlight = actions.shouldHighlightField(fieldName);
		const suggestion = actions.getFieldSuggestion(fieldName, parameters[fieldName]);

		return {
			...constraints,
			messages,
			highlight: highlight.highlight,
			severity: highlight.severity,
			message: highlight.message,
			suggestion,
			hasErrors: messages.errors.length > 0,
			hasWarnings: messages.warnings.length > 0,
			hasInfo: messages.info.length > 0,
		};
	});

	return {
		...validationState,
		field: fieldState.value,
		actions,
	};
}

/**
 * Hook for validating form submission
 * Provides validation specifically for submit events
 */
export function useSubmitValidation(
	apiClient: ApiClient,
	model: string,
	parameters: Record<string, unknown>,
	context: string = 'chat_input',
) {
	const isValidating = useSignal<boolean>(false);
	const validationResult = useSignal<ValidationResult | null>(null);
	const error = useSignal<string | null>(null);

	const validateSubmission = useCallback(async (): Promise<boolean> => {
		if (!model) {
			return false;
		}

		try {
			batch(() => {
				isValidating.value = true;
				error.value = null;
			});

			const validationClient = getValidationClient(apiClient);
			const results = await validationClient.validateParameters(
				model,
				parameters,
				{
					context,
					trigger: 'on_submit',
				},
			);

			const aggregatedResult = aggregateValidationResults(results);

			batch(() => {
				validationResult.value = aggregatedResult;
				isValidating.value = false;
			});

			return aggregatedResult.valid && !aggregatedResult.blockSubmission;
		} catch (err) {
			batch(() => {
				error.value = err instanceof Error ? err.message : String(err);
				isValidating.value = false;
			});
			console.error('Submit validation failed:', err);
			return false;
		}
	}, [apiClient, model, parameters, context]);

	return {
		isValidating: isValidating.value,
		validationResult: validationResult.value,
		error: error.value,
		validateSubmission,
	};
}
