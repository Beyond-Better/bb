//import { type ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { useComputed } from '@preact/signals';
import type { ClientDataSourceConnection } from 'shared/types/project.ts';
import type { Signal } from '@preact/signals';
import type { AppState } from '../hooks/useAppState.ts';
import { CustomSelect, type SelectOption } from './CustomSelect.tsx';
import { FileBrowser } from './FileBrowser.tsx';
import { GoogleOAuthFlow } from './GoogleOAuthFlow.tsx';
import { generateId } from 'shared/projectData.ts';
import type { DataSourceProviderInfo } from 'shared/types/dataSource.ts';
import type { AuthConfig } from 'api/dataSources/interfaces/authentication.ts';

interface DataSourceModalProps {
	dsConnection?: ClientDataSourceConnection;
	onClose: () => void;
	onSave: (dsConnection: ClientDataSourceConnection) => void;
	appState: Signal<AppState>;
	dsProviders: Signal<DataSourceProviderInfo[]>; // Add data source types prop
}

const DEFAULT_DATA_SOURCE = (): ClientDataSourceConnection => ({
	id: `ds-${generateId()}`,
	name: '',
	providerType: 'filesystem',
	accessMethod: 'bb',
	enabled: true,
	isPrimary: false,
	priority: 50,
	capabilities: ['read'],
	description: '',
	config: {},
});

/**
 * Modal component for creating or editing a data source
 */
export function DataSourceModal({ dsConnection, onClose, onSave, appState, dsProviders }: DataSourceModalProps) {
	const [formData, setFormData] = useState<ClientDataSourceConnection>(
		dsConnection ? { ...dsConnection } : { ...DEFAULT_DATA_SOURCE(), config: { strictRoot: true } },
	);
	// Initialize isCustomDescription based on whether dsConnection has a description
	const [isCustomDescription, setIsCustomDescription] = useState<boolean>(Boolean(dsConnection?.description));
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [dsProvider, setDsProvider] = useState<DataSourceProviderInfo | null>(null);

	console.log('DataSourceModal: dsConnection', dsConnection);
	console.log('DataSourceModal: dsProviders', dsProviders.value);
	const dsProviderMap = useComputed(() =>
		new Map(
			dsProviders.value ? dsProviders.value.map((item) => [item.providerType, item]) : [],
		)
	);
	console.log('DataSourceModal: dsProviderMap', dsProviderMap.value);

	// Validate the form data
	const validate = (): boolean => {
		const newErrors: Record<string, string> = {};

		if (!formData.name?.trim()) {
			newErrors.name = 'Name is required';
		}

		// Type-specific validation
		if (formData.providerType === 'filesystem') {
			if (!formData.config.dataSourceRoot) {
				newErrors.dataSourceRoot = 'Path is required';
			}
		} else if (formData.providerType === 'notion') {
			if (!formData.config.apiKey) {
				newErrors.apiKey = 'API Key is required';
			}
			if (!formData.config.workspace) {
				newErrors.workspace = 'Workspace is required';
			}
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	// Handle form field changes
	const handleChange = (field: keyof ClientDataSourceConnection, value: unknown) => {
		// Mark description as custom when user edits it directly
		if (field === 'description') {
			setIsCustomDescription(true);
		}
		setFormData((prev: ClientDataSourceConnection) => {
			// If changing the providerType, reset the config
			if (field === 'providerType' && prev.providerType !== value) {
				const newDsProvider = dsProviderMap.value.get(value as string) || null;
				setDsProvider(newDsProvider);
				console.log(`DataSourceModal: using dsProvider for ${value}`, newDsProvider);

				// Only use the default description if user hasn't customized it
				const newDescription = isCustomDescription ? prev.description : (newDsProvider?.description || '');

				// Type assertion to ensure the field is properly typed
				return {
					...prev,
					providerType: value as string, // We know 'providerType' is a string
					accessMethod: newDsProvider?.accessMethod || 'bb',
					capabilities: newDsProvider?.capabilities || [],
					description: newDescription,
					config: {},
				};
			}
			return {
				...prev,
				[field]: value,
			};
		});
	};

	// Handle config field changes
	const handleConfigChange = (configField: string, value: unknown) => {
		const newName = configField === 'dataSourceRoot' || configField === 'workspace' ? String(value) : null;
		if ((!dsConnection || !dsConnection?.name) && newName) {
			setFormData((prev: ClientDataSourceConnection) => ({
				...prev,
				name: newName,
			}));
		}
		setFormData((prev: ClientDataSourceConnection) => ({
			...prev,
			config: {
				...prev.config,
				[configField]: value,
			},
		}));
	};

	// Handle form submission
	const handleSubmit = (e: Event) => {
		e.preventDefault();

		if (validate()) {
			onSave(formData);
		}
	};

	const dsProviderOptions = useComputed(() => {
		const bbTypeOptions = dsProviders.value
			.filter((dsProvider) => dsProvider.accessMethod === 'bb')
			.map((dsProvider) => ({
				value: dsProvider.providerType,
				label: dsProvider.name,
			} as SelectOption));
		const mcpTypeOptions = dsProviders.value
			.filter((dsProvider) => dsProvider.accessMethod === 'mcp')
			.map((dsProvider) => ({
				value: dsProvider.providerType,
				//label: `${dsProvider.name} (MCP)`,
				label: dsProvider.name,
			} as SelectOption));

		if (mcpTypeOptions.length > 0) {
			bbTypeOptions.unshift({
				value: 'bb',
				label: 'BB internal data sources',
				isHeader: true,
			});
			mcpTypeOptions.unshift({
				value: 'mcp',
				label: 'MCP Server data sources',
				isHeader: true,
			});
		}
		return [
			...bbTypeOptions,
			...mcpTypeOptions,
		];
	});

	// Render different config fields based on the data source providerType
	const renderConfigFields = () => {
		switch (formData.providerType) {
			case 'googledocs':
				return (
					<div className='space-y-4 col-span-2'>
						{/* Google OAuth Authentication */}
						<GoogleOAuthFlow
							onAuth={(authConfig: AuthConfig) => {
								setFormData((prev) => ({
									...prev,
									config: {
										...prev.config,
										authConfig
									}
								}));
							}}
							onError={(error: string) => {
								setErrors((prev) => ({ ...prev, auth: error }));
							}}
							authConfig={formData.config.authConfig as AuthConfig}
							className='mb-4'
						/>
						{errors.auth && (
							<div className='text-red-500 text-xs mt-1'>{errors.auth}</div>
						)}

						{/* Optional Configuration Fields */}
						<div className='grid grid-cols-2 gap-4'>
							<div className='space-y-2'>
								<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
									Display Name (Optional)
								</label>
								<input
									type='text'
									value={formData.config.displayName as string || ''}
									onChange={(e) => handleConfigChange('displayName', (e.target as HTMLInputElement).value)}
									placeholder='My Google Docs'
									className='w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100'
								/>
								<div className='text-xs text-gray-500 dark:text-gray-400'>
									Friendly name for this Google connection
								</div>
							</div>

							<div className='space-y-2'>
								<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
									Default Drive/Folder ID (Optional)
								</label>
								<input
									type='text'
									value={formData.config.defaultFolderId as string || ''}
									onChange={(e) => handleConfigChange('defaultFolderId', (e.target as HTMLInputElement).value)}
									placeholder='1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
									className='w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100'
								/>
								<div className='text-xs text-gray-500 dark:text-gray-400'>
									Restrict access to a specific Drive folder (leave empty for full access)
								</div>
							</div>
						</div>
					</div>
				);

			case 'filesystem':
				return (
					<div className='space-y-4 col-span-2'>
						<div className='space-y-2'>
							<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>Path</label>
							<FileBrowser
								value={formData.config.dataSourceRoot as string || ''}
								onChange={(value: string) => handleConfigChange('dataSourceRoot', value)}
								type='directory'
								className='w-full'
								appState={appState}
								strictRoot={formData.config.strictRoot !== false}
							/>
							{errors.dataSourceRoot &&
								<div className='text-red-500 text-xs mt-1'>{errors.dataSourceRoot}</div>}
						</div>
						<div className='space-y-2'>
							<label className='flex items-center text-sm text-gray-600 dark:text-gray-400'>
								<input
									type='checkbox'
									checked={formData.config.strictRoot !== false}
									onChange={(e) =>
										handleConfigChange('strictRoot', (e.target as HTMLInputElement).checked)}
									class='mr-2'
								/>
								Deny External Symlinks
							</label>
							<div className='text-xs text-gray-500 dark:text-gray-400 ml-6'>
								When checked, restricts file access to your home directory and hides symlinks that point
								outside it. When unchecked, allows following symlinks to any accessible location on the
								system.
							</div>
						</div>
					</div>
				);

			case 'notion':
				return (
					<div className='grid grid-cols-2 gap-4 col-span-2'>
						<div className='space-y-2'>
							<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
								API Key
							</label>
							<input
								type='password'
								value={formData.config.apiKey as string || ''}
								onChange={(e) => handleConfigChange('apiKey', (e.target as HTMLInputElement).value)}
								className='w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100'
							/>
							{errors.apiKey &&
								<div className='text-red-500 text-xs mt-1'>{errors.apiKey}</div>}
						</div>
						<div className='space-y-2'>
							<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
								Workspace
							</label>
							<input
								type='text'
								value={formData.config.workspace as string || ''}
								onChange={(e) => handleConfigChange('workspace', (e.target as HTMLInputElement).value)}
								className='w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100'
							/>
							{errors.workspace &&
								<div className='text-red-500 text-xs mt-1'>{errors.workspace}</div>}
						</div>
					</div>
				);

			// Add more cases for other data source types

			default:
				return (
					<p className='text-gray-600 dark:text-gray-400 col-span-2'>
						{dsProvider?.name || 'MCP Server'} is configured in{' '}
						<a
							href='/app/settings?tab=mcpservers'
							className='text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300'
						>
							MCP Server settings
						</a>
					</p>
				);
		}
	};

	return (
		<div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'>
			<div className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto'>
				<div className='flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
					<h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
						{dsConnection ? 'Edit' : 'Add'} Data Source
					</h3>
					<button
						type='button'
						className='text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl font-bold'
						onClick={onClose}
					>
						×
					</button>
				</div>

				<form onSubmit={handleSubmit}>
					<div className='px-6 py-4 space-y-6'>
						{/* Basic Info Section - 2-column layout */}
						<div className='grid grid-cols-2 gap-6'>
							<div className='space-y-2'>
								<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
									Name
								</label>
								<input
									type='text'
									value={formData.name}
									onChange={(e) => handleChange('name', (e.target as HTMLInputElement).value)}
									placeholder='My Data Source'
									className='w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100'
								/>
								{errors.name && <div className='text-red-500 text-xs mt-1'>{errors.name}</div>}
							</div>

							<div className='space-y-2'>
								<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
									Type
								</label>
								<CustomSelect
									options={dsProviderOptions.value}
									value={formData.providerType}
									onChange={(value) => handleChange('providerType', value)}
									className='w-full'
								/>
							</div>
						</div>

						<div className='grid grid-cols-1 gap-6'>
							<div className='space-y-2'>
								<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
									Description
								</label>
								<input
									type='text'
									value={formData.description}
									onChange={(e) => handleChange('description', (e.target as HTMLInputElement).value)}
									placeholder='description'
									className='w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100'
								/>
								{isCustomDescription && (
									<div className='text-blue-500 text-xs mt-1'>Custom description</div>
								)}
								{errors.description && (
									<div className='text-red-500 text-xs mt-1'>{errors.description}</div>
								)}
							</div>
						</div>

						<div className='grid grid-cols-1 gap-6'>
							<div className='space-y-2'>
								<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
									Capabilities
								</label>
								<div className='flex flex-wrap gap-1.5 pt-2 ml-3'>
									{formData.capabilities.map((cap) => (
										<span
											key={cap}
											className='px-2 py-0.5 text-sm rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
										>
											{cap}
										</span>
									))}
								</div>
							</div>
						</div>

						{/* Settings Section - 2-column layout */}
						{
							/*<div className='grid grid-cols-2 gap-6'>
							<div className='space-y-2'>
								<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
									Default Data Source
								</label>
								<div className='flex items-center h-10'>
									<input
										id='isprimary-checkbox'
										type='checkbox'
										checked={formData.isPrimary}
										onChange={(e) =>
											handleChange('isPrimary', (e.target as HTMLInputElement).checked)}
										className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
									/>
									<label
										for='isprimary-checkbox'
										className='ml-2 block text-sm font-medium text-gray-700 dark:text-gray-300'
									>
										Primary Data Source
									</label>
								</div>
							</div>
							<div className='space-y-2'>
								<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
									Priority
								</label>
								<input
									type='number'
									value={formData.priority}
									onChange={(e) =>
										handleChange('priority', parseInt((e.target as HTMLInputElement).value, 10))}
									min='0'
									max='100'
									className='w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100'
								/>
							</div>
						</div>*/
						}

						{/* Capabilities Section */}
						{
							/*<div className='grid grid-cols-2 gap-6'>
							<div className='space-y-2'>
								<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
									Status
								</label>
								<div className='flex items-center h-10'>
									<input
										id='enabled-checkbox'
										type='checkbox'
										checked={formData.enabled}
										onChange={(e) =>
											handleChange('enabled', (e.target as HTMLInputElement).checked)}
										className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
									/>
									<label
										for='enabled-checkbox'
										className='ml-2 block text-sm font-medium text-gray-700 dark:text-gray-300'
									>
										Enabled
									</label>
								</div>
							</div>
							<div className='space-y-2'>
								<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
									Capabilities
								</label>
								<div className='grid grid-cols-4 gap-4'>
									{['read', 'write', 'list', 'search'].map((cap) => (
										<label key={cap} className='inline-flex items-center h-10'>
											<input
												type='checkbox'
												checked={formData.capabilities.includes(cap)}
												onChange={(e) => {
													const checked = (e.target as HTMLInputElement).checked;
													const newCaps = checked
														? [...formData.capabilities, cap]
														: formData.capabilities.filter((c) =>
															c !== cap
														);
													handleChange('capabilities', newCaps);
												}}
												className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
											/>
											<span className='ml-2 text-sm text-gray-700 dark:text-gray-300'>{cap}</span>
										</label>
									))}
								</div>
							</div>
						</div>*/
						}

						{/* Configuration Section */}
						<div className='pt-2'>
							<h4 className='text-md font-medium text-gray-800 dark:text-gray-200 mb-4'>Configuration</h4>
							<div className='grid grid-cols-2 gap-6'>
								{renderConfigFields()}
							</div>
						</div>
					</div>

					<div className='border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end space-x-2'>
						<button
							type='button'
							className='px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
							onClick={onClose}
						>
							Cancel
						</button>
						<button
							type='submit'
							className='px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed'
							disabled={!formData.name.trim()}
						>
							Save
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
