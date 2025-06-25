/**
 * API handlers for validation functionality
 * Provides endpoints for UI to access validation rules and validate parameters
 */

import type { Context } from '@oak/oak';
import { logger } from 'shared/logger.ts';
import { ValidationRuleService } from 'api/llms/validationRuleService.ts';
import { ModelRegistryService } from 'api/llms/modelRegistryService.ts';

/**
 * @openapi
 * /api/v1/validation/rule-sets:
 *   get:
 *     summary: Get validation rule sets
 *     description: Returns all available validation rule sets or filter by context
 *     parameters:
 *       - name: context
 *         in: query
 *         description: Filter rule sets by context (e.g., 'chat_input', 'model_config')
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of validation rule sets
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ruleSets:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       version:
 *                         type: string
 *                       context:
 *                         type: string
 *                       rules:
 *                         type: array
 *       500:
 *         description: Internal server error
 */
export const getValidationRuleSets = async (
	{ request, response }: { request: Context['request']; response: Context['response'] },
) => {
	try {
		logger.info('ValidationHandler: getValidationRuleSets called');

		// Initialize validation rule service
		const validationService = ValidationRuleService.getInstance();
		await validationService.init();

		// Parse query parameters
		const url = new URL(request.url);
		const context = url.searchParams.get('context');

		// Get rule sets
		let ruleSets;
		if (context) {
			ruleSets = validationService.getRuleSetsByContext(context);
		} else {
			ruleSets = validationService.getRuleSets();
		}

		response.status = 200;
		response.body = {
			ruleSets,
		};
	} catch (error) {
		logger.error(`ValidationHandler: Error in getValidationRuleSets: ${error instanceof Error ? error.message : error}`);
		response.status = 500;
		response.body = { 
			error: 'Failed to get validation rule sets', 
			details: error instanceof Error ? error.message : String(error),
		};
	}
};

/**
 * @openapi
 * /api/v1/validation/rule-sets/{ruleSetId}:
 *   get:
 *     summary: Get a specific validation rule set
 *     description: Returns details for a specific validation rule set
 *     parameters:
 *       - name: ruleSetId
 *         in: path
 *         required: true
 *         description: The rule set identifier
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Validation rule set details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ruleSet:
 *                   type: object
 *       404:
 *         description: Rule set not found
 *       500:
 *         description: Internal server error
 */
export const getValidationRuleSet = async (
	{ params, response }: { params: { ruleSetId: string }; response: Context['response'] },
) => {
	try {
		const ruleSetId = params.ruleSetId;
		logger.info(`ValidationHandler: getValidationRuleSet called for ${ruleSetId}`);

		// Initialize validation rule service
		const validationService = ValidationRuleService.getInstance();
		await validationService.init();

		// Get the rule set
		const ruleSet = validationService.getRuleSet(ruleSetId);

		if (!ruleSet) {
			response.status = 404;
			response.body = { error: `Rule set not found: ${ruleSetId}` };
			return;
		}

		response.status = 200;
		response.body = {
			ruleSet,
		};
	} catch (error) {
		logger.error(`ValidationHandler: Error in getValidationRuleSet: ${error instanceof Error ? error.message : error}`);
		response.status = 500;
		response.body = { 
			error: 'Failed to get validation rule set', 
			details: error instanceof Error ? error.message : String(error),
		};
	}
};

/**
 * @openapi
 * /api/v1/validation/validate:
 *   post:
 *     summary: Validate parameters
 *     description: Validates parameters against validation rules
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               model:
 *                 type: string
 *                 description: Model identifier
 *                 example: claude-3-7-sonnet-20250219
 *               parameters:
 *                 type: object
 *                 description: Parameters to validate
 *                 example:
 *                   temperature: 0.7
 *                   maxTokens: 4000
 *                   extendedThinking:
 *                     enabled: true
 *               ruleSetId:
 *                 type: string
 *                 description: Specific rule set to use (optional)
 *                 example: chat_input_validation
 *               context:
 *                 type: string
 *                 description: Context for validation (alternative to ruleSetId)
 *                 example: chat_input
 *               trigger:
 *                 type: string
 *                 enum: [on_change, on_submit, on_load]
 *                 description: When the validation is triggered
 *                 default: on_change
 *               additionalContext:
 *                 type: object
 *                 description: Additional context data for validation
 *             required:
 *               - model
 *               - parameters
 *     responses:
 *       200:
 *         description: Validation results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       valid:
 *                         type: boolean
 *                       triggeredRules:
 *                         type: array
 *                       messages:
 *                         type: object
 *                         properties:
 *                           info:
 *                             type: array
 *                             items:
 *                               type: string
 *                           warnings:
 *                             type: array
 *                             items:
 *                               type: string
 *                           errors:
 *                             type: array
 *                             items:
 *                               type: string
 *                       constraints:
 *                         type: object
 *                       suggestions:
 *                         type: object
 *                       blockSubmission:
 *                         type: boolean
 *       400:
 *         description: Bad request
 *       404:
 *         description: Model or rule set not found
 *       500:
 *         description: Internal server error
 */
export const validateParameters = async (
	{ request, response }: { request: Context['request']; response: Context['response'] },
) => {
	try {
		logger.info('ValidationHandler: validateParameters called');

		// Parse request body
		const body = await request.body.json();

		// Validate required fields
		if (!body.model || !body.parameters) {
			response.status = 400;
			response.body = { error: `Missing required fields: model, parameters` };
			return;
		}

		const {
			model,
			parameters,
			ruleSetId,
			context,
			trigger = 'on_change',
			additionalContext = {},
		} = body;

		// Initialize services
		const validationService = ValidationRuleService.getInstance();
		await validationService.init();

		const modelRegistryService = await ModelRegistryService.getInstance();

		// Get model capabilities
		const modelCapabilities = modelRegistryService.getModelCapabilities(model);
		if (!modelCapabilities) {
			response.status = 404;
			response.body = { error: `Model not found: ${model}` };
			return;
		}

		// Validate parameters
		let results;
		if (ruleSetId) {
			// Validate against specific rule set
			const result = validationService.validate(
				ruleSetId,
				model,
				modelCapabilities,
				parameters,
				trigger,
				additionalContext,
			);
			results = [result];
		} else if (context) {
			// Validate against all rule sets for context
			results = validationService.validateByContext(
				context,
				model,
				modelCapabilities,
				parameters,
				trigger,
				additionalContext,
			);
		} else {
			response.status = 400;
			response.body = { error: `Either ruleSetId or context must be provided` };
			return;
		}

		response.status = 200;
		response.body = {
			results,
		};
	} catch (error) {
		logger.error(`ValidationHandler: Error in validateParameters: ${error instanceof Error ? error.message : error}`);
		
		if (error instanceof Error && 'status' in error) {
			response.status = (error as unknown as { status: number }).status;
			response.body = { 
				error: error.message,
			};
		} else {
			response.status = 500;
			response.body = { 
				error: 'Failed to validate parameters', 
				details: error instanceof Error ? error.message : String(error),
			};
		}
	}
};

/**
 * @openapi
 * /api/v1/validation/preview:
 *   post:
 *     summary: Preview validation constraints
 *     description: Get validation constraints and suggestions for UI without full validation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               model:
 *                 type: string
 *                 description: Model identifier
 *               context:
 *                 type: string
 *                 description: Validation context
 *                 default: chat_input
 *             required:
 *               - model
 *     responses:
 *       200:
 *         description: Preview of validation constraints and suggestions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 constraints:
 *                   type: object
 *                   description: Parameter constraints for the model
 *                 suggestions:
 *                   type: object
 *                   description: Suggested default values
 *                 modelCapabilities:
 *                   type: object
 *                   description: Model capabilities for reference
 *       400:
 *         description: Bad request
 *       404:
 *         description: Model not found
 *       500:
 *         description: Internal server error
 */
export const previewValidationConstraints = async (
	{ request, response }: { request: Context['request']; response: Context['response'] },
) => {
	try {
		logger.info('ValidationHandler: previewValidationConstraints called');

		// Parse request body
		const body = await request.body.json();

		// Validate required fields
		if (!body.model) {
			response.status = 400
			response.body = { error: `Missing required field: model` };
			return;
		}

		const { model, context = 'chat_input' } = body;

		// Initialize services
		const validationService = ValidationRuleService.getInstance();
		await validationService.init();

		const modelRegistryService = await ModelRegistryService.getInstance();

		// Get model capabilities
		const modelCapabilities = modelRegistryService.getModelCapabilities(model);
		if (!modelCapabilities) {
			response.status = 404;
			response.body = { error: `Model not found: ${model}` };
			return;
		}

		// Run validation with empty parameters to get initial constraints
		const results = validationService.validateByContext(
			context,
			model,
			modelCapabilities,
			{}, // Empty parameters to get initial state
			'on_load',
		);

		// Aggregate results
		const aggregatedConstraints: Record<string, unknown> = {};
		const aggregatedSuggestions: Record<string, unknown> = {};

		for (const result of results) {
			Object.assign(aggregatedConstraints, result.constraints);
			Object.assign(aggregatedSuggestions, result.suggestions);
		}

		response.status = 200;
		response.body = {
			constraints: aggregatedConstraints,
			suggestions: aggregatedSuggestions,
			modelCapabilities: {
				supportedFeatures: modelCapabilities.supportedFeatures,
				constraints: modelCapabilities.constraints,
				defaults: modelCapabilities.defaults,
			},
		};
	} catch (error) {
		logger.error(`ValidationHandler: Error in previewValidationConstraints: ${error instanceof Error ? error.message : error}`);
		
		if (error instanceof Error && 'status' in error) {
			response.status = (error as unknown as { status: number }).status;
			response.body = { 
				error: error.message,
			};
		} else {
			response.status = 500;
			response.body = { 
				error: 'Failed to preview validation constraints', 
				details: error instanceof Error ? error.message : String(error),
			};
		}
	}
};