/**
 * Validation Client Utilities for BUI
 * Provides client-side validation using the API validation framework
 */

import type { ApiClient } from './apiClient.utils.ts';

/**
 * Re-export validation types for BUI use
 */
export interface ValidationCondition {
	field: string;
	operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'matches_pattern' | 'in' | 'not_in' | 'greater_than' | 'less_than' | 'greater_equal' | 'less_equal';
	value: string | number | boolean | Array<string | number | boolean>;
	description?: string;
}

export interface ValidationConditionGroup {
	logic: 'AND' | 'OR' | 'NOT';
	conditions: Array<ValidationCondition | ValidationConditionGroup>;
	description?: string;
}

export interface ValidationRuleAction {
	action: 'set_value' | 'set_constraint' | 'disable_feature' | 'enable_feature' | 'show_warning' | 'show_error' | 'suggest_value' | 'require_feature';
	target: string;
	value?: string | number | boolean | { min?: number; max?: number };
	message?: string;
	severity?: 'info' | 'warning' | 'error';
	blocking?: boolean;
}

export interface ValidationRule {
	id: string;
	name: string;
	description?: string;
	trigger: 'on_change' | 'on_submit' | 'on_load';
	priority?: number;
	condition: ValidationCondition | ValidationConditionGroup;
	actions: ValidationRuleAction[];
	enabled?: boolean;
	tags?: string[];
}

export interface ValidationRuleSet {
	id: string;
	name: string;
	description?: string;
	version: string;
	context: string;
	rules: ValidationRule[];
	metadata?: {
		createdAt: string;
		updatedAt: string;
		author?: string;
		[key: string]: unknown;
	};
}

export interface ValidationResult {
	valid: boolean;
	triggeredRules: Array<{
		ruleId: string;
		ruleName: string;
		actions: ValidationRuleAction[];
	}>;
	messages: {
		info: string[];
		warnings: string[];
		errors: string[];
	};
	constraints: Record<string, {
		min?: number;
		max?: number;
		allowedValues?: Array<string | number | boolean>;
		disallowedValues?: Array<string | number | boolean>;
		required?: boolean;
		disabled?: boolean;
	}>;
	suggestions: Record<string, string | number | boolean>;
	blockSubmission: boolean;
}

export interface ValidationPreview {
	constraints: Record<string, unknown>;
	suggestions: Record<string, unknown>;
	modelCapabilities: {
		supportedFeatures: Record<string, boolean>;
		constraints: Record<string, { min: number; max: number }>;
		defaults: Record<string, unknown>;
	};
}

/**
 * Client for interacting with the validation API
 */
export class ValidationClient {
	private apiClient: ApiClient;

	constructor(apiClient: ApiClient) {
		this.apiClient = apiClient;
	}

	/**
	 * Get all available validation rule sets
	 */
	async getRuleSets(context?: string): Promise<ValidationRuleSet[]> {
		const url = new URL('/api/v1/validation/rule-sets', this.apiClient.baseUrl);
		if (context) {
			url.searchParams.set('context', context);
		}

		const response = await fetch(url.toString(), {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			throw new Error(`Failed to get rule sets: ${response.statusText}`);
		}

		const data = await response.json();
		return data.ruleSets;
	}

	/**
	 * Get a specific validation rule set
	 */
	async getRuleSet(ruleSetId: string): Promise<ValidationRuleSet> {
		const response = await fetch(`${this.apiClient.baseUrl}/api/v1/validation/rule-sets/${ruleSetId}`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			throw new Error(`Failed to get rule set: ${response.statusText}`);
		}

		const data = await response.json();
		return data.ruleSet;
	}

	/**
	 * Validate parameters against validation rules
	 */
	async validateParameters(
		model: string,
		parameters: Record<string, unknown>,
		options: {
			ruleSetId?: string;
			context?: string;
			trigger?: 'on_change' | 'on_submit' | 'on_load';
			additionalContext?: Record<string, unknown>;
		} = {},
	): Promise<ValidationResult[]> {
		const {
			ruleSetId,
			context = 'chat_input',
			trigger = 'on_change',
			additionalContext = {},
		} = options;

		const requestBody = {
			model,
			parameters,
			ruleSetId,
			context,
			trigger,
			additionalContext,
		};

		const response = await fetch(`${this.apiClient.baseUrl}/api/v1/validation/validate`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(requestBody),
		});

		if (!response.ok) {
			throw new Error(`Validation failed: ${response.statusText}`);
		}

		const data = await response.json();
		return data.results;
	}

	/**
	 * Preview validation constraints for a model
	 */
	async previewConstraints(
		model: string,
		context: string = 'chat_input',
	): Promise<ValidationPreview> {
		const requestBody = {
			model,
			context,
		};

		const response = await fetch(`${this.apiClient.baseUrl}/api/v1/validation/preview`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(requestBody),
		});

		if (!response.ok) {
			throw new Error(`Failed to preview constraints: ${response.statusText}`);
		}

		return await response.json();
	}
}

/**
 * Aggregate multiple validation results into a single result
 */
export function aggregateValidationResults(results: ValidationResult[]): ValidationResult {
	const aggregated: ValidationResult = {
		valid: true,
		triggeredRules: [],
		messages: {
			info: [],
			warnings: [],
			errors: [],
		},
		constraints: {},
		suggestions: {},
		blockSubmission: false,
	};

	for (const result of results) {
		// Aggregate validity
		if (!result.valid) {
			aggregated.valid = false;
		}

		// Aggregate triggered rules
		aggregated.triggeredRules.push(...result.triggeredRules);

		// Aggregate messages
		aggregated.messages.info.push(...result.messages.info);
		aggregated.messages.warnings.push(...result.messages.warnings);
		aggregated.messages.errors.push(...result.messages.errors);

		// Aggregate constraints (later constraints override earlier ones)
		Object.assign(aggregated.constraints, result.constraints);

		// Aggregate suggestions (later suggestions override earlier ones)
		Object.assign(aggregated.suggestions, result.suggestions);

		// Aggregate submission blocking
		if (result.blockSubmission) {
			aggregated.blockSubmission = true;
		}
	}

	return aggregated;
}

/**
 * Apply validation constraints to form field properties
 */
export function applyConstraintsToField(
	fieldName: string,
	constraints: ValidationResult['constraints'],
	currentValue: unknown,
): {
	disabled: boolean;
	required: boolean;
	min?: number;
	max?: number;
	step?: number;
	pattern?: string;
} {
	const constraint = constraints[fieldName];
	
	if (!constraint) {
		return {
			disabled: false,
			required: false,
		};
	}

	const result = {
		disabled: constraint.disabled || false,
		required: constraint.required || false,
		min: constraint.min,
		max: constraint.max,
	};

	// Add step for numeric fields
	if (typeof currentValue === 'number' && constraint.min !== undefined && constraint.max !== undefined) {
		// Calculate a reasonable step based on the range
		const range = constraint.max - constraint.min;
		if (range <= 1) {
			result.step = 0.1;
		} else if (range <= 10) {
			result.step = 0.5;
		} else {
			result.step = 1;
		}
	}

	return result;
}

/**
 * Get suggested value for a field from validation results
 */
export function getSuggestedValue(
	fieldName: string,
	suggestions: ValidationResult['suggestions'],
	currentValue: unknown,
): unknown {
	if (fieldName in suggestions) {
		return suggestions[fieldName];
	}
	return currentValue;
}

/**
 * Get validation messages for a specific field
 */
export function getFieldMessages(
	fieldName: string,
	triggeredRules: ValidationResult['triggeredRules'],
): {
	info: string[];
	warnings: string[];
	errors: string[];
} {
	const messages = {
		info: [],
		warnings: [],
		errors: [],
	};

	for (const rule of triggeredRules) {
		for (const action of rule.actions) {
			if (action.target === fieldName && action.message) {
				const severity = action.severity || 'info';
				messages[severity].push(action.message);
			}
		}
	}

	return messages;
}

/**
 * Check if a field should be highlighted based on validation results
 */
export function shouldHighlightField(
	fieldName: string,
	validationResult: ValidationResult,
): {
	highlight: boolean;
	severity: 'info' | 'warning' | 'error';
	message?: string;
} {
	const fieldMessages = getFieldMessages(fieldName, validationResult.triggeredRules);
	
	if (fieldMessages.errors.length > 0) {
		return {
			highlight: true,
			severity: 'error',
			message: fieldMessages.errors[0],
		};
	}
	
	if (fieldMessages.warnings.length > 0) {
		return {
			highlight: true,
			severity: 'warning',
			message: fieldMessages.warnings[0],
		};
	}
	
	if (fieldMessages.info.length > 0) {
		return {
			highlight: true,
			severity: 'info',
			message: fieldMessages.info[0],
		};
	}

	return {
		highlight: false,
		severity: 'info',
	};
}