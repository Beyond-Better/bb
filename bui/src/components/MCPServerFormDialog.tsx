import type { MCPServerConfig } from 'shared/config/types.ts';
import { useEffect, useState } from 'preact/hooks';
import { useAppState } from '../hooks/useAppState.ts';
import MCPServerForm from './MCPServerForm.tsx';
import { getFirstErrorMessage, hasValidationErrors, validateMCPServer } from '../utils/mcpServerValidation.ts';

interface MCPServerFormDialogProps {
	mode: 'new' | 'edit';
	server?: MCPServerConfig;
	existingServerIds: string[];
	onSave: (server: MCPServerConfig) => void;
	onCancel: () => void;
	isOpen: boolean;
}

export default function MCPServerFormDialog({
	mode,
	server,
	existingServerIds,
	onSave,
	onCancel,
	isOpen,
}: MCPServerFormDialogProps) {
	const appState = useAppState();
	const [formData, setFormData] = useState<MCPServerConfig>(() => ({
		id: '',
		name: '',
		transport: 'stdio',
		command: '',
		args: [],
		env: {},
		...server,
	}));

	const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	// Reset form when dialog opens/closes or server changes
	useEffect(() => {
		if (isOpen) {
			if (mode === 'new') {
				setFormData({
					id: '',
					name: '',
					transport: 'stdio',
					command: '',
					args: [],
					env: {},
				});
			} else if (server) {
				setFormData({ ...server });
			}
			setValidationErrors({});
			setSaveError(null);
		}
	}, [isOpen, mode, server]);

	// Validate on form data changes
	useEffect(() => {
		if (isOpen) {
			const errors = validateMCPServer(
				formData,
				mode === 'new' ? existingServerIds : existingServerIds.filter((id) => id !== formData.id),
			);
			setValidationErrors(errors);
		}
	}, [formData, existingServerIds, mode, isOpen]);

	const handleFieldChange = (
		field: keyof MCPServerConfig,
		value: string | string[] | Record<string, string> | undefined,
	) => {
		setFormData((prev) => ({
			...prev,
			[field]: value,
		}));
		setSaveError(null); // Clear error when user makes changes
	};

	const handleSave = async () => {
		if (hasValidationErrors(validationErrors)) {
			setSaveError(getFirstErrorMessage(validationErrors));
			return;
		}

		setIsSaving(true);
		setSaveError(null);

		try {
			if (mode === 'new') {
				// Ensure required fields for new server
				if (!formData.name?.trim()) {
					setSaveError('Server name is required');
					return;
				}
				if (!formData.id?.trim()) {
					setSaveError('Server ID is required');
					return;
				}

				const result = await appState.value.apiClient?.addMCPServer(formData);
				if (result?.success) {
					onSave(formData);
				} else {
					setSaveError(result?.message || 'Failed to add server');
				}
			} else {
				// For updates, exclude ID field since API expects Omit<MCPServerConfig, 'id'>
				const { id, ...serverConfigWithoutId } = formData;
				const result = await appState.value.apiClient?.updateMCPServer(formData.id, serverConfigWithoutId);
				if (result?.success) {
					onSave(formData);
				} else {
					setSaveError(result?.message || 'Failed to update server');
				}
			}
		} catch (error) {
			setSaveError(error instanceof Error ? error.message : 'Unknown error occurred');
		} finally {
			setIsSaving(false);
		}
	};

	const handleCancel = () => {
		onCancel();
	};

	if (!isOpen) return null;

	return (
		<div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
			<div className='bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden'>
				{/* Header */}
				<div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
					<h3 className='text-lg font-medium text-gray-900 dark:text-gray-100'>
						{mode === 'new' ? 'Add New MCP Server' : `Edit ${formData.name || formData.id}`}
					</h3>
				</div>

				{/* Form Content */}
				<div className='px-6 py-4 max-h-[60vh] overflow-y-auto'>
					<MCPServerForm
						server={formData}
						onChange={handleFieldChange}
						mode={mode}
						errors={validationErrors}
					/>

					{/* Error Display */}
					{saveError && (
						<div className='mt-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md'>
							<p className='text-sm text-red-800 dark:text-red-200'>{saveError}</p>
						</div>
					)}
				</div>

				{/* Footer */}
				<div className='px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3'>
					<button
						type='button'
						onClick={handleCancel}
						disabled={isSaving}
						className='px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50'
					>
						Cancel
					</button>
					<button
						type='button'
						onClick={handleSave}
						disabled={isSaving || hasValidationErrors(validationErrors)}
						className={`px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
							isSaving || hasValidationErrors(validationErrors)
								? 'bg-gray-400 cursor-not-allowed'
								: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
						}`}
					>
						{isSaving ? 'Saving...' : mode === 'new' ? 'Add Server' : 'Save Changes'}
					</button>
				</div>
			</div>
		</div>
	);
}
