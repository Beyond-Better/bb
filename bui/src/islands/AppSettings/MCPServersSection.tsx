import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { useAppState } from '../../hooks/useAppState.ts';
import { MCPServerConfig } from 'shared/config/types.ts';
import MCPServerItem from './MCPServerItem.tsx';
import { activeTab } from '../AppSettings.tsx';

// This component used to handle both global and project-level MCP server configs; now it's global only
// It could be simplified, or even lifted into AppSettings, but it's working and not too messy.

interface MCPServersFormState {
	globalServers: MCPServerConfig[];
	//projectId: string | null;
	// Project-level server configuration removed
}

interface MCPServersFormErrors {
	globalServers?: string;
	// Project-level server errors removed
}

const formErrors = signal<MCPServersFormErrors>({});
const loading = signal(true);

const sensitiveEnvVarPatterns = [
	/token/i,
	/key/i,
	/secret/i,
	/password/i,
	/credential/i,
];

export default function MCPServersSection() {
	const appState = useAppState();
	const [formState, setFormState] = useState<MCPServersFormState>({
		globalServers: [],
	});
	const [hasExternalToolsAccess, setHasExternalToolsAccess] = useState<boolean | null>(null);
	const [accessCheckLoading, setAccessCheckLoading] = useState(true);
	const [isEditing, setIsEditing] = useState<{ global: Record<string, boolean> }>({
		global: {},
	});
	const [showNewServerForm, setShowNewServerForm] = useState<{ global: boolean }>({
		global: false,
	});
	// Additional state for structured inputs
	const [newArgument, setNewArgument] = useState('');
	const [newEnvKey, setNewEnvKey] = useState('');
	const [newEnvValue, setNewEnvValue] = useState('');
	const [showSensitiveValues, setShowSensitiveValues] = useState(false);

	const [newServer, setNewServer] = useState<{ global: MCPServerConfig }>({
		global: { id: '', name: '', command: '', args: [], env: {} },
	});

	// Check external tools access
	useEffect(() => {
		const checkAccess = async () => {
			try {
				const accessResult = await appState.value.apiClient?.checkExternalToolsAccess();
				setHasExternalToolsAccess(accessResult?.hasAccess ?? false);
			} catch (error) {
				console.error('Failed to check external tools access:', error);
				setHasExternalToolsAccess(false);
			} finally {
				setAccessCheckLoading(false);
			}
		};

		checkAccess();
	}, [appState.value.apiClient]);

	// Load initial config
	useEffect(() => {
		const loadConfig = async () => {
			try {
				const globalConfig = await appState.value.apiClient?.getGlobalConfig();

				if (globalConfig) {
					setFormState({
						globalServers: globalConfig.api.mcpServers || [],
					});
				}
			} catch (error) {
				console.error('Failed to load MCP server configs:', error);
			} finally {
				loading.value = false;
			}
		};

		loadConfig();
	}, [appState.value.apiClient, appState.value.projectId]);

	const toggleEditMode = (serverId: string) => {
		setIsEditing((prev) => ({
			...prev,
			global: {
				...prev.global,
				[serverId]: !prev.global[serverId],
			},
		}));
	};

	const handleServerUpdate = (updatedServer: MCPServerConfig) => {
		setFormState((prev) => ({
			...prev,
			globalServers: prev.globalServers.map((server) => server.id === updatedServer.id ? updatedServer : server),
		}));
	};

	const handleServerDelete = async (serverId: string) => {
		try {
			// Remove from global servers
			const updatedServers = formState.globalServers.filter((server) => server.id !== serverId);
			await appState.value.apiClient?.updateGlobalConfig('api.mcpServers', JSON.stringify(updatedServers));
			setFormState((prev) => ({ ...prev, globalServers: updatedServers }));
		} catch (error) {
			console.error(`Failed to delete MCP server ${serverId}:`, error);
		}
	};

	const handleNewServerChange = (
		field: keyof MCPServerConfig,
		value: string | string[] | Record<string, string>,
	) => {
		setNewServer((prev) => ({
			...prev,
			global: {
				...prev.global,
				[field]: value,
			},
		}));
	};

	const validateServer = (server: MCPServerConfig): string | undefined => {
		if (!server.id) return 'Server ID is required';
		if (!server.command) return 'Command is required';

		// Check for duplicate IDs
		const existingGlobalIds = formState.globalServers.map((s) => s.id);

		if (existingGlobalIds.includes(server.id)) {
			return `Server ID '${server.id}' already exists`;
		}

		return undefined;
	};

	const handleAddNewServer = async () => {
		const serverToAdd = newServer.global;
		const error = validateServer(serverToAdd);

		if (error) {
			formErrors.value = {
				...formErrors.value,
				globalServers: error,
			};
			return;
		}

		try {
			// Add to global servers
			const updatedServers = [...formState.globalServers, serverToAdd];
			await appState.value.apiClient?.updateGlobalConfig('api.mcpServers', JSON.stringify(updatedServers));
			setFormState((prev) => ({ ...prev, globalServers: updatedServers }));
			setNewServer((prev) => ({
				...prev,
				global: { id: '', name: '', command: '', args: [], env: {} },
			}));

			setShowNewServerForm((prev) => ({
				...prev,
				global: false,
			}));

			formErrors.value = {};
		} catch (error) {
			console.error('Failed to add new MCP server:', error);
		}
	};

	const saveServerChanges = async (server: MCPServerConfig) => {
		try {
			// Update global server
			await appState.value.apiClient?.updateGlobalConfig(
				'api.mcpServers',
				JSON.stringify(formState.globalServers),
			);

			// Turn off edit mode
			toggleEditMode(server.id);
		} catch (error) {
			console.error('Failed to save MCP server changes:', error);
		}
	};

	// Get available servers
	const getAvailableServers = (): MCPServerConfig[] => {
		return formState.globalServers;
	};

	if (loading.value || accessCheckLoading) {
		return (
			<div class='mb-8'>
				<div class='animate-pulse space-y-4'>
					<div class='h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4'></div>
					<div class='space-y-3'>
						<div class='h-8 bg-gray-200 dark:bg-gray-700 rounded'></div>
						<div class='h-8 bg-gray-200 dark:bg-gray-700 rounded w-5/6'></div>
					</div>
				</div>
			</div>
		);
	}

	// Check if user has access to external tools
	const isAccessDenied = hasExternalToolsAccess === false;
	const containerClasses = isAccessDenied ? 'opacity-50 pointer-events-none' : '';

	return (
		<div class='m-8 pt-8'>
			{isAccessDenied && (
				<div class='mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg'>
					<div class='flex items-start space-x-3'>
						<div class='flex-shrink-0'>
							<svg class='h-5 w-5 text-amber-400' fill='currentColor' viewBox='0 0 20 20'>
								<path fillRule='evenodd' d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z' clipRule='evenodd' />
							</svg>
						</div>
						<div class='flex-1'>
							<h3 class='text-sm font-medium text-amber-800 dark:text-amber-200'>
								External Tools Access Required
							</h3>
							<p class='mt-1 text-sm text-amber-700 dark:text-amber-300'>
								MCP (Model Context Protocol) servers require external tools access. Please upgrade your plan to configure and use MCP servers.
							</p>
							<div class='mt-3'>
								<a
									href='/app/settings?tab=plans-credits'
									onClick={(e) => {
										e.preventDefault();
										activeTab.value = 'plans-credits';
										history.pushState(null, '', '/app/settings?tab=plans-credits');
									}}
									class='text-sm font-medium text-amber-800 dark:text-amber-200 hover:text-amber-900 dark:hover:text-amber-100 underline'
								>
									Upgrade Plan →
								</a>
							</div>
						</div>
					</div>
				</div>
			)}

			<div class={containerClasses}>
			{/* Global MCP Servers Section */}
			<div class='mb-6 pt-4'>
				<h3 class='text-base font-medium text-gray-900 dark:text-gray-100 mb-2'>MCP Servers Configuration</h3>
				<p class='text-sm text-gray-500 dark:text-gray-400 mb-4'>
					Configure MCP servers available to all projects. Projects can select which servers to include.
				</p>

				{formState.globalServers.length > 0
					? (
						<div class='space-y-4 mb-4'>
							{formState.globalServers.map((server) => (
								<MCPServerItem
									key={server.id}
									server={server}
									isEditing={isEditing.global[server.id] || false}
									toggleEdit={() => toggleEditMode(server.id)}
									onUpdate={(updatedServer) => handleServerUpdate(updatedServer)}
									onDelete={() => handleServerDelete(server.id)}
									onSave={() => saveServerChanges(server)}
								/>
							))}
						</div>
					)
					: (
						<div class='text-sm text-gray-500 dark:text-gray-400 italic mb-4'>
							No global MCP servers configured
						</div>
					)}

				{showNewServerForm.global
					? (
						<div class='border border-gray-200 dark:border-gray-700 rounded-md p-4 bg-gray-50 dark:bg-gray-800 mb-4'>
							<h4 class='text-sm font-medium text-gray-900 dark:text-gray-100 mb-3'>
								Add New Server
							</h4>

							<div class='space-y-3'>
								<div>
									<label class='block text-sm font-medium text-gray-700 dark:text-gray-300'>
										Server ID
									</label>
									<input
										type='text'
										value={newServer.global.id}
										onChange={(e) =>
											handleNewServerChange('id', (e.target as HTMLInputElement).value)}
										class='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
										placeholder='slack'
									/>
								</div>

								<div>
									<label class='block text-sm font-medium text-gray-700 dark:text-gray-300'>
										Display Name
									</label>
									<input
										type='text'
										value={newServer.global.name || ''}
										onChange={(e) =>
											handleNewServerChange('name', (e.target as HTMLInputElement).value)}
										class='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
										placeholder='Slack'
									/>
								</div>

								<div>
									<label class='block text-sm font-medium text-gray-700 dark:text-gray-300'>
										Command
									</label>
									<input
										type='text'
										value={newServer.global.command}
										onChange={(e) =>
											handleNewServerChange(
												'command',
												(e.target as HTMLInputElement).value,
											)}
										class='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
										placeholder='npx'
									/>
								</div>

								<div>
									<label class='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
										Arguments
									</label>

									<div class='space-y-2'>
										{/* Existing arguments */}
										{(newServer.global.args || []).map((arg, index) => (
											<div key={index} class='flex items-center space-x-2'>
												<input
													type='text'
													value={arg}
													onChange={(e) => {
														const newArgs = [...(newServer.global.args || [])];
														newArgs[index] = (e.target as HTMLInputElement).value;
														handleNewServerChange('args', newArgs);
													}}
													class='flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 dark:text-white text-sm'
												/>
												<button
													type='button'
													onClick={() => {
														const newArgs = [...(newServer.global.args || [])];
														newArgs.splice(index, 1);
														handleNewServerChange('args', newArgs);
													}}
													class='p-2 text-gray-400 hover:text-red-500 focus:outline-none'
													aria-label='Remove argument'
												>
													<svg
														class='h-5 w-5'
														fill='none'
														stroke='currentColor'
														viewBox='0 0 24 24'
													>
														<path
															strokeLinecap='round'
															strokeLinejoin='round'
															strokeWidth={2}
															d='M6 18L18 6M6 6l12 12'
														/>
													</svg>
												</button>
											</div>
										))}

										{/* Add new argument field */}
										<div class='flex items-center space-x-2'>
											<input
												type='text'
												value={newArgument}
												onChange={(e) => setNewArgument((e.target as HTMLInputElement).value)}
												placeholder='Add argument...'
												class='flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 dark:text-white text-sm'
												onBlur={() => {
													if (newArgument.trim()) {
														const newArgs = [
															...(newServer.global.args || []),
															newArgument.trim(),
														];
														handleNewServerChange('args', newArgs);
														setNewArgument('');
													}
												}}
												onKeyDown={(e) => {
													if (e.key === 'Enter' && newArgument.trim()) {
														e.preventDefault();
														const newArgs = [
															...(newServer.global.args || []),
															newArgument.trim(),
														];
														handleNewServerChange('args', newArgs);
														setNewArgument('');
													}
												}}
											/>
											<button
												type='button'
												onClick={() => {
													if (newArgument.trim()) {
														const newArgs = [
															...(newServer.global.args || []),
															newArgument.trim(),
														];
														handleNewServerChange('args', newArgs);
														setNewArgument('');
													}
												}}
												class='p-2 text-gray-400 hover:text-blue-500 focus:outline-none'
												aria-label='Add argument'
												disabled={!newArgument.trim()}
											>
												<svg
													class='h-5 w-5'
													fill='none'
													stroke='currentColor'
													viewBox='0 0 24 24'
												>
													<path
														strokeLinecap='round'
														strokeLinejoin='round'
														strokeWidth={2}
														d='M12 4v16m8-8H4'
													/>
												</svg>
											</button>
										</div>

										<p class='text-xs text-gray-500 dark:text-gray-400 mt-1'>
											Press Enter or click + to add each argument. Each value will be passed as a
											separate argument to the command.
										</p>
									</div>
								</div>

								<div>
									<div class='flex justify-between items-center mb-1'>
										<label class='block text-sm font-medium text-gray-700 dark:text-gray-300'>
											Environment Variables
										</label>

										{Object.keys(newServer.global.env || {}).some((key) =>
											sensitiveEnvVarPatterns.some((pattern) => pattern.test(key))
										) && (
											<button
												type='button'
												onClick={() => setShowSensitiveValues(!showSensitiveValues)}
												class='text-xs px-2 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
											>
												{showSensitiveValues ? 'Hide' : 'Show'} Values
											</button>
										)}
									</div>

									{/* Existing environment variables */}
									<div class='space-y-2 mb-3'>
										{Object.entries(newServer.global.env || {}).map(([key, value]) => (
											<div key={key} class='flex items-center space-x-2'>
												<input
													type='text'
													value={key}
													readOnly
													class='flex-[0.4] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm font-mono'
												/>
												<input
													type={showSensitiveValues ||
															!sensitiveEnvVarPatterns.some((pattern) =>
																pattern.test(key)
															)
														? 'text'
														: 'password'}
													value={value}
													onChange={(e) => {
														const newEnv = { ...(newServer.global.env || {}) };
														newEnv[key] = (e.target as HTMLInputElement).value;
														handleNewServerChange('env', newEnv);
													}}
													class='flex-[0.6] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm font-mono'
												/>
												<button
													type='button'
													onClick={() => {
														const newEnv = { ...(newServer.global.env || {}) };
														delete newEnv[key];
														handleNewServerChange('env', newEnv);
													}}
													class='p-2 text-gray-400 hover:text-red-500 focus:outline-none'
													aria-label='Remove environment variable'
												>
													<svg
														class='h-5 w-5'
														fill='none'
														stroke='currentColor'
														viewBox='0 0 24 24'
													>
														<path
															strokeLinecap='round'
															strokeLinejoin='round'
															strokeWidth={2}
															d='M6 18L18 6M6 6l12 12'
														/>
													</svg>
												</button>
											</div>
										))}
									</div>

									{/* Add new environment variable */}
									<div class='flex items-center space-x-2'>
										<input
											type='text'
											value={newEnvKey}
											onChange={(e) => setNewEnvKey((e.target as HTMLInputElement).value)}
											placeholder='Key'
											class='flex-[0.4] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm'
											onBlur={(e) => {
												// Do not add on blur of key field, only from value field
											}}
											onKeyDown={(e) => {
												if (e.key === 'Enter' && newEnvKey.trim()) {
													e.preventDefault();
													const newEnv = { ...(newServer.global.env || {}) };
													newEnv[newEnvKey.trim()] = newEnvValue;
													handleNewServerChange('env', newEnv);
													setNewEnvKey('');
													setNewEnvValue('');
												}
											}}
										/>
										<input
											type={showSensitiveValues || !newEnvKey ||
													!sensitiveEnvVarPatterns.some((pattern) => pattern.test(newEnvKey))
												? 'text'
												: 'password'}
											value={newEnvValue}
											onChange={(e) => setNewEnvValue((e.target as HTMLInputElement).value)}
											placeholder='Value'
											class='flex-[0.6] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm'
											onBlur={() => {
												if (newEnvKey.trim()) {
													const newEnv = { ...(newServer.global.env || {}) };
													newEnv[newEnvKey.trim()] = newEnvValue;
													handleNewServerChange('env', newEnv);
													setNewEnvKey('');
													setNewEnvValue('');
												}
											}}
											onKeyDown={(e) => {
												if (e.key === 'Enter' && newEnvKey.trim()) {
													e.preventDefault();
													const newEnv = { ...(newServer.global.env || {}) };
													newEnv[newEnvKey.trim()] = newEnvValue;
													handleNewServerChange('env', newEnv);
													setNewEnvKey('');
													setNewEnvValue('');
												}
											}}
										/>
										<button
											type='button'
											onClick={() => {
												if (newEnvKey.trim()) {
													const newEnv = { ...(newServer.global.env || {}) };
													newEnv[newEnvKey.trim()] = newEnvValue;
													handleNewServerChange('env', newEnv);
													setNewEnvKey('');
													setNewEnvValue('');
												}
											}}
											class='p-2 text-gray-400 hover:text-blue-500 focus:outline-none'
											aria-label='Add environment variable'
											disabled={!newEnvKey.trim()}
										>
											<svg class='h-5 w-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													strokeWidth={2}
													d='M12 4v16m8-8H4'
												/>
											</svg>
										</button>
									</div>

									<p class='text-xs text-gray-500 dark:text-gray-400 mt-2'>
										Environment variables are passed to the MCP server when it runs. Use these to
										provide API keys and configuration.
									</p>
								</div>
							</div>

							{formErrors.value.globalServers && (
								<p class='mt-2 text-sm text-red-600 dark:text-red-400'>
									{formErrors.value.globalServers}
								</p>
							)}

							<div class='mt-4 flex justify-end space-x-2'>
								<button
									type='button'
									onClick={() => setShowNewServerForm((prev) => ({ ...prev, global: false }))}
									class='inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
								>
									Cancel
								</button>
								<button
									type='button'
									onClick={() => handleAddNewServer()}
									class='inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
								>
									Add Server
								</button>
							</div>
						</div>
					)
					: (
						<button
							type='button'
							onClick={() => setShowNewServerForm((prev) => ({ ...prev, global: true }))}
							class='inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-blue-700 dark:text-blue-200 bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
						>
							<svg
								xmlns='http://www.w3.org/2000/svg'
								class='h-4 w-4 mr-1.5'
								fill='none'
								viewBox='0 0 24 24'
								stroke='currentColor'
							>
								<path
									stroke-linecap='round'
									stroke-linejoin='round'
									stroke-width='2'
									d='M12 4v16m8-8H4'
								/>
							</svg>
							Add Server
						</button>
					)}
			</div>

			{/* Available Servers Section */}
			<div class='mt-8 border-t border-gray-200 dark:border-gray-700 pt-6 pb-6'>
				<h3 class='text-base font-medium text-gray-900 dark:text-gray-100 mb-2'>
					Available MCP Servers
				</h3>
				<p class='text-sm text-gray-500 dark:text-gray-400 mb-4'>
					The following servers are available for use in projects. Each project can select which servers to
					include.
				</p>

				{getAvailableServers().length > 0
					? (
						<div class='bg-gray-50 dark:bg-gray-800 rounded-md p-4 overflow-auto max-h-60'>
							<pre class='text-xs text-gray-700 dark:text-gray-300'>
							  {getAvailableServers().map(server => (
								<div key={server.id} class='mb-3'>
								  <div class='font-bold'>
									{server.id}
								  </div>
								  <div class='ml-2'>name: {server.name || '<unnamed>'}</div>
								  <div class='ml-2'>command: {server.command}</div>
								  {server.args && server.args.length > 0 && (
									<div class='ml-2'>
									  args: [{server.args.map(arg => `"${arg}"`).join(', ')}]
									</div>
								  )}
								  {server.env && Object.keys(server.env).length > 0 && (
									<div class='ml-2'>
									  env:
									  {Object.entries(server.env).map(([key, value]) => (
										<div class='ml-4' key={key}>
										  {key}: {sensitiveEnvVarPatterns.some(pattern => pattern.test(key)) ? '********' : value}
										</div>
									  ))}
									</div>
								  )}
								</div>
							  ))}
							</pre>
						</div>
					)
					: (
						<div class='text-sm text-gray-500 dark:text-gray-400 italic'>
							No MCP servers configured
						</div>
					)}
			</div>
			</div>
		</div>
	);
}
