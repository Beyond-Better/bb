/**
 * Example of ChatInput with integrated validation framework
 * This demonstrates how to integrate the validation system into the existing ChatInput component
 */

import { useEffect, useRef } from 'preact/hooks';
import { batch, type Signal, signal, useComputed, useSignal, useSignalEffect } from '@preact/signals';
import type { TargetedEvent } from 'preact/compat';
import type { LLMRequestParams } from '../types/llm.types.ts';
import { useValidation, useFieldValidation, useSubmitValidation } from '../hooks/useValidation.ts';
import type { ApiClient } from '../utils/apiClient.utils.ts';

interface ValidationExampleProps {
	apiClient: ApiClient;
	chatInputOptions: Signal<LLMRequestParams>;
	selectedModelRole: Signal<'orchestrator' | 'agent' | 'chat'>;
	onSend: () => Promise<void>;
}

export function ChatInputValidationExample({
	apiClient,
	chatInputOptions,
	selectedModelRole,
	onSend,
}: ValidationExampleProps) {
	// Get current model and parameters for validation
	const currentModel = useComputed(() => 
		chatInputOptions.value.rolesModelConfig?.[selectedModelRole.value]?.model || ''
	);

	const currentParameters = useComputed(() => {
		const modelConfig = chatInputOptions.value.rolesModelConfig?.[selectedModelRole.value];
		return {
			temperature: modelConfig?.temperature || 0.7,
			maxTokens: modelConfig?.maxTokens || 4000,
			extendedThinking: {
				enabled: modelConfig?.extendedThinking?.enabled || false,
				budgetTokens: modelConfig?.extendedThinking?.budgetTokens || 4096,
			},
			usePromptCaching: modelConfig?.usePromptCaching !== false,
			attachedFiles: [], // This would come from actual attached files
		};
	});

	// Main validation hook for the entire form
	const [validationState, validationActions] = useValidation(
		apiClient,
		currentModel.value,
		currentParameters.value,
		{
			context: 'chat_input',
			validateOnChange: true,
			debounceMs: 300,
			fetchInitialConstraints: true,
		}
	);

	// Field-specific validation hooks for individual parameters
	const temperatureValidation = useFieldValidation(
		apiClient,
		currentModel.value,
		currentParameters.value,
		'temperature'
	);

	const maxTokensValidation = useFieldValidation(
		apiClient,
		currentModel.value,
		currentParameters.value,
		'maxTokens'
	);

	const extendedThinkingValidation = useFieldValidation(
		apiClient,
		currentModel.value,
		currentParameters.value,
		'extendedThinking.enabled'
	);

	// Submit validation hook
	const submitValidation = useSubmitValidation(
		apiClient,
		currentModel.value,
		currentParameters.value,
		'chat_input'
	);

	// Handle form submission with validation
	const handleSend = async () => {
		// Run submit validation
		const isValid = await submitValidation.validateSubmission();
		
		if (!isValid) {
			console.warn('Form submission blocked by validation');
			return;
		}

		// Proceed with sending if validation passes
		await onSend();
	};

	// Apply validation suggestions automatically for critical rules
	useSignalEffect(() => {
		if (!validationState.result) return;

		// Auto-apply temperature suggestion for Claude models with extended thinking
		const tempSuggestion = validationActions.getFieldSuggestion('temperature', currentParameters.value.temperature);
		if (tempSuggestion !== currentParameters.value.temperature) {
			// Update the temperature in the options
			const newOptions = { ...chatInputOptions.value };
			const currentModelConfig = newOptions.rolesModelConfig?.[selectedModelRole.value];
			if (currentModelConfig) {
				currentModelConfig.temperature = tempSuggestion as number;
				chatInputOptions.value = newOptions;
			}
		}
	});

	return (
		<div className='bg-white dark:bg-gray-900 w-full relative'>
			{/* Validation Status Display */}
			{validationState.error && (
				<div className='bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 mb-4'>
					<div className='text-red-800 dark:text-red-200 text-sm'>
						Validation Error: {validationState.error}
					</div>
				</div>
			)}

			{/* Global validation messages */}
			{validationState.result && (
				<div className='space-y-2 mb-4'>
					{validationState.result.messages.errors.map((error, index) => (
						<div key={index} className='bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-2'>
							<div className='text-red-800 dark:text-red-200 text-sm'>{error}</div>
						</div>
					))}
					{validationState.result.messages.warnings.map((warning, index) => (
						<div key={index} className='bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-2'>
							<div className='text-yellow-800 dark:text-yellow-200 text-sm'>{warning}</div>
						</div>
					))}
					{validationState.result.messages.info.map((info, index) => (
						<div key={index} className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-2'>
							<div className='text-blue-800 dark:text-blue-200 text-sm'>{info}</div>
						</div>
					))}
				</div>
			)}

			<div className='space-y-4 p-4'>
				{/* Temperature Slider with Validation */}
				<div className='space-y-2'>
					<div className='flex justify-between items-center'>
						<label className={`text-sm ${
							temperatureValidation.field.disabled 
								? 'text-gray-400 dark:text-gray-500' 
								: 'text-gray-700 dark:text-gray-300'
						}`}>
							Temperature: {currentParameters.value.temperature.toFixed(1)}
							{temperatureValidation.field.suggestion !== currentParameters.value.temperature && (
								<span className='ml-2 text-blue-600 dark:text-blue-400 text-xs'>
									(Suggested: {(temperatureValidation.field.suggestion as number).toFixed(1)})
								</span>
							)}
						</label>
						{temperatureValidation.field.highlight && (
							<span className={`text-xs px-2 py-1 rounded ${
								temperatureValidation.field.severity === 'error' 
									? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
									: temperatureValidation.field.severity === 'warning'
									? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
									: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
							}`}>
								{temperatureValidation.field.severity}
							</span>
						)}
					</div>
					
					<input
						type='range'
						min={temperatureValidation.field.min ?? 0}
						max={temperatureValidation.field.max ?? 1}
						step={temperatureValidation.field.step ?? 0.1}
						value={currentParameters.value.temperature}
						disabled={temperatureValidation.field.disabled}
						onChange={(e: TargetedEvent<HTMLInputElement, Event>) => {
							if (!e.target) return;
							const input = e.target as HTMLInputElement;
							const newOptions = { ...chatInputOptions.value };
							const currentModelConfig = newOptions.rolesModelConfig?.[selectedModelRole.value];
							if (currentModelConfig) {
								currentModelConfig.temperature = parseFloat(input.value);
								chatInputOptions.value = newOptions;
							}
						}}
						className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${
							temperatureValidation.field.disabled 
								? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed' 
								: temperatureValidation.field.highlight
								? temperatureValidation.field.severity === 'error'
									? 'bg-red-200 dark:bg-red-800'
									: temperatureValidation.field.severity === 'warning'
									? 'bg-yellow-200 dark:bg-yellow-800'
									: 'bg-blue-200 dark:bg-blue-800'
								: 'bg-gray-200 dark:bg-gray-700'
						}`}
					/>
					
					{/* Field-specific messages */}
					{temperatureValidation.field.message && (
						<div className={`text-xs ${
							temperatureValidation.field.severity === 'error' 
								? 'text-red-600 dark:text-red-400'
								: temperatureValidation.field.severity === 'warning'
								? 'text-yellow-600 dark:text-yellow-400'
								: 'text-blue-600 dark:text-blue-400'
						}`}>
							{temperatureValidation.field.message}
						</div>
					)}
				</div>

				{/* Max Tokens Slider with Validation */}
				<div className='space-y-2'>
					<div className='flex justify-between items-center'>
						<label className={`text-sm ${
							maxTokensValidation.field.disabled 
								? 'text-gray-400 dark:text-gray-500' 
								: 'text-gray-700 dark:text-gray-300'
						}`}>
							Max Tokens: {currentParameters.value.maxTokens}
						</label>
						{maxTokensValidation.field.highlight && (
							<span className={`text-xs px-2 py-1 rounded ${
								maxTokensValidation.field.severity === 'error' 
									? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
									: maxTokensValidation.field.severity === 'warning'
									? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
									: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
							}`}>
								{maxTokensValidation.field.severity}
							</span>
						)}
					</div>
					
					<input
						type='range'
						min={maxTokensValidation.field.min ?? 1000}
						max={maxTokensValidation.field.max ?? 100000}
						step={maxTokensValidation.field.step ?? 1000}
						value={currentParameters.value.maxTokens}
						disabled={maxTokensValidation.field.disabled}
						onChange={(e: TargetedEvent<HTMLInputElement, Event>) => {
							if (!e.target) return;
							const input = e.target as HTMLInputElement;
							const newOptions = { ...chatInputOptions.value };
							const currentModelConfig = newOptions.rolesModelConfig?.[selectedModelRole.value];
							if (currentModelConfig) {
								currentModelConfig.maxTokens = parseInt(input.value, 10);
								chatInputOptions.value = newOptions;
							}
						}}
						className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${
							maxTokensValidation.field.disabled 
								? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed' 
								: maxTokensValidation.field.highlight
								? maxTokensValidation.field.severity === 'error'
									? 'bg-red-200 dark:bg-red-800'
									: maxTokensValidation.field.severity === 'warning'
									? 'bg-yellow-200 dark:bg-yellow-800'
									: 'bg-blue-200 dark:bg-blue-800'
								: 'bg-gray-200 dark:bg-gray-700'
						}`}
					/>
					
					{maxTokensValidation.field.message && (
						<div className={`text-xs ${
							maxTokensValidation.field.severity === 'error' 
								? 'text-red-600 dark:text-red-400'
								: maxTokensValidation.field.severity === 'warning'
								? 'text-yellow-600 dark:text-yellow-400'
								: 'text-blue-600 dark:text-blue-400'
						}`}>
							{maxTokensValidation.field.message}
						</div>
					)}
				</div>

				{/* Extended Thinking Toggle with Validation */}
				<div className='space-y-2'>
					<div className='flex items-center justify-between'>
						<label className={`text-sm ${
							extendedThinkingValidation.field.disabled 
								? 'text-gray-400 dark:text-gray-500' 
								: 'text-gray-700 dark:text-gray-300'
						}`}>
							Extended Thinking
						</label>
						<div className='flex items-center space-x-2'>
							{extendedThinkingValidation.field.highlight && (
								<span className={`text-xs px-2 py-1 rounded ${
									extendedThinkingValidation.field.severity === 'error' 
										? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
										: extendedThinkingValidation.field.severity === 'warning'
										? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
										: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
								}`}>
									{extendedThinkingValidation.field.severity}
								</span>
							)}
							<div className='relative inline-block w-12 align-middle select-none'>
								<input
									type='checkbox'
									checked={currentParameters.value.extendedThinking.enabled}
									disabled={extendedThinkingValidation.field.disabled}
									onChange={(e) => {
										if (!e.target) return;
										const input = e.target as HTMLInputElement;
										const newOptions = { ...chatInputOptions.value };
										const currentModelConfig = newOptions.rolesModelConfig?.[selectedModelRole.value];
										if (currentModelConfig) {
											if (!currentModelConfig.extendedThinking) {
												currentModelConfig.extendedThinking = {
													enabled: input.checked,
													budgetTokens: 4096,
												};
											} else {
												currentModelConfig.extendedThinking.enabled = input.checked;
											}
											chatInputOptions.value = newOptions;
										}
									}}
									className='sr-only'
									id='toggle-extended-thinking-validation'
								/>
								<label
									htmlFor='toggle-extended-thinking-validation'
									className={`block overflow-hidden h-6 rounded-full transition-colors duration-200 ease-in-out ${
										extendedThinkingValidation.field.disabled
											? 'cursor-not-allowed opacity-50'
											: 'cursor-pointer'
									} ${
										currentParameters.value.extendedThinking.enabled
											? extendedThinkingValidation.field.highlight && extendedThinkingValidation.field.severity === 'error'
												? 'bg-red-500'
												: 'bg-blue-500'
											: 'bg-gray-300 dark:bg-gray-600'
									}`}
								>
									<span
										className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${
											currentParameters.value.extendedThinking.enabled
												? 'translate-x-6'
												: 'translate-x-0'
										}`}
									/>
								</label>
							</div>
						</div>
					</div>
					
					{extendedThinkingValidation.field.message && (
						<div className={`text-xs ${
							extendedThinkingValidation.field.severity === 'error' 
								? 'text-red-600 dark:text-red-400'
								: extendedThinkingValidation.field.severity === 'warning'
								? 'text-yellow-600 dark:text-yellow-400'
								: 'text-blue-600 dark:text-blue-400'
						}`}>
							{extendedThinkingValidation.field.message}
						</div>
					)}
				</div>

				{/* Submit Button with Validation */}
				<div className='flex justify-end'>
					<button
						type='button'
						onClick={handleSend}
						disabled={
							submitValidation.isValidating || 
							validationState.isValidating ||
							(validationState.result && validationState.result.blockSubmission)
						}
						className={`px-4 py-2 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 ${
							validationState.result && validationState.result.blockSubmission
								? 'bg-red-300 dark:bg-red-700 text-red-800 dark:text-red-200 cursor-not-allowed'
								: submitValidation.isValidating || validationState.isValidating
								? 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed'
								: 'bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700'
						}`}
					>
						{submitValidation.isValidating || validationState.isValidating ? 'Validating...' : 'Send'}
					</button>
				</div>

				{/* Validation Debug Info (for development) */}
				{process.env.NODE_ENV === 'development' && validationState.result && (
					<details className='mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-md'>
						<summary className='cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300'>
							Validation Debug Info
						</summary>
						<pre className='mt-2 text-xs text-gray-600 dark:text-gray-400 overflow-auto'>
							{JSON.stringify(validationState.result, null, 2)}
						</pre>
					</details>
				)}
			</div>
		</div>
	);
}