import { MCPServerConfig } from 'shared/config/types.ts';
import { useEffect, useState } from 'preact/hooks';

interface MCPConfigModalProps {
	isOpen: boolean;
	onClose: () => void;
	servers: MCPServerConfig[];
	onSave: (servers: MCPServerConfig[]) => void;
	isGlobal?: boolean;
	projectId?: string | null;
}

/**
 * Modal dialog for configuring MCP servers
 */
export default function MCPConfigModal({
	isOpen,
	onClose,
	servers,
	onSave,
	isGlobal = true,
	projectId = null,
}: MCPConfigModalProps) {
	// State for edited servers list
	const [editedServers, setEditedServers] = useState<MCPServerConfig[]>([]);
	// State for the server currently being edited
	const [editingServer, setEditingServer] = useState<MCPServerConfig | null>(null);
	// State for creating a new server
	const [newServer, setNewServer] = useState<MCPServerConfig | null>(null);
	// Validation errors
	const [errors, setErrors] = useState<Record<string, string>>({});
	// Show sensitive values (for env vars)
	const [showSensitive, setShowSensitive] = useState(false);
	// For managing a new argument
	const [newArgument, setNewArgument] = useState('');
	// For managing a new environment variable
	const [newEnvKey, setNewEnvKey] = useState('');
	const [newEnvValue, setNewEnvValue] = useState('');

	// Initialize edited servers from props
	useEffect(() => {
		if (isOpen) {
			setEditedServers([...servers]);
			setEditingServer(null);
			setNewServer(null);
			setErrors({});
		}
	}, [isOpen, servers]);

	useEffect(() => {
		// Handle escape key to close modal
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && isOpen) {
				onClose();
			}
		};

		document.addEventListener('keydown', handleEscape);
		return () => document.removeEventListener('keydown', handleEscape);
	}, [isOpen, onClose]);

	// Validate a server configuration
	const validateServer = (server: MCPServerConfig): Record<string, string> => {
		const errors: Record<string, string> = {};

		if (!server.id) {
			errors.id = 'Server ID is required';
		}

		if (!server.command) {
			errors.command = 'Command is required';
		}

		// Check for duplicate IDs (only if this is a new server or ID changed)
		if (server.id) {
			const isNewServer = newServer === server;
			const existingServer = editedServers.find((s) => s.id === server.id);

			if (isNewServer && existingServer) {
				errors.id = `Server ID '${server.id}' already exists`;
			} else if (editingServer && editingServer.id !== server.id && existingServer) {
				errors.id = `Server ID '${server.id}' already exists`;
			}
		}

		return errors;
	};

	// Add a new server
	const handleAddServer = () => {
		setNewServer({
			id: '',
			name: '',
			command: '',
			args: [],
			env: {},
		});
	};

	// Edit an existing server
	const handleEditServer = (server: MCPServerConfig) => {
		setEditingServer({ ...server });
	};

	// Delete a server
	const handleDeleteServer = (serverId: string) => {
		setEditedServers(editedServers.filter((server) => server.id !== serverId));
	};

	// Update server being edited
	const handleUpdateServer = (field: keyof MCPServerConfig, value: string | string[] | Record<string, string>) => {
		if (editingServer) {
			const updated = { ...editingServer, [field]: value };
			setEditingServer(updated);
		} else if (newServer) {
			const updated = { ...newServer, [field]: value };
			setNewServer(updated);
		}
	};

	// Add a new argument to the server being edited
	const handleAddArgument = () => {
		if (!newArgument.trim()) return;

		const server = editingServer || newServer;
		if (!server) return;

		const newArgs = [...(server.args || []), newArgument.trim()];
		handleUpdateServer('args', newArgs);
		setNewArgument('');
	};

	// Add a new environment variable
	// Remove an argument at specified index
	const handleRemoveArgument = (index: number) => {
		const server = editingServer || newServer;
		if (!server) return;

		const newArgs = [...(server.args || [])];
		newArgs.splice(index, 1);
		handleUpdateServer('args', newArgs);
	};

	// Update an argument at specified index
	const handleUpdateArgument = (index: number, value: string) => {
		const server = editingServer || newServer;
		if (!server) return;

		const newArgs = [...(server.args || [])];
		newArgs[index] = value;
		handleUpdateServer('args', newArgs);
	};

	// Add a new environment variable
	const handleAddEnvVar = () => {
		if (!newEnvKey.trim()) return;

		const server = editingServer || newServer;
		if (!server) return;

		const newEnv = { ...(server.env || {}) };
		newEnv[newEnvKey.trim()] = newEnvValue;
		handleUpdateServer('env', newEnv);

		// Clear inputs for next entry
		setNewEnvKey('');
		setNewEnvValue('');
	};

	// Remove an environment variable by key
	const handleRemoveEnvVar = (keyToRemove: string) => {
		const server = editingServer || newServer;
		if (!server || !server.env) return;

		const newEnv = { ...server.env };
		delete newEnv[keyToRemove];
		handleUpdateServer('env', newEnv);
	};

	// Update an environment variable value by key
	const handleUpdateEnvValue = (key: string, newValue: string) => {
		const server = editingServer || newServer;
		if (!server || !server.env) return;

		const newEnv = { ...server.env };
		newEnv[key] = newValue;
		handleUpdateServer('env', newEnv);
	};

	// Get a list of environment variables for display
	const getEnvVarsList = (env?: Record<string, string>): Array<{ key: string; value: string }> => {
		if (!env) return [];
		return Object.entries(env).map(([key, value]) => ({ key, value }));
	};

	// Save the edited/new server
	const handleSaveServer = () => {
		const serverToSave = editingServer || newServer;
		if (!serverToSave) return;

		// Check if there's an unsaved argument in the input field and add it
		if (newArgument.trim()) {
			const updatedArgs = [...(serverToSave.args || []), newArgument.trim()];
			if (editingServer) {
				setEditingServer({ ...editingServer, args: updatedArgs });
				serverToSave.args = updatedArgs;
			} else if (newServer) {
				setNewServer({ ...newServer, args: updatedArgs });
				serverToSave.args = updatedArgs;
			}
			setNewArgument('');
		}

		// Check if there's an unsaved environment variable and add it
		if (newEnvKey.trim()) {
			const newEnv = { ...(serverToSave.env || {}) };
			newEnv[newEnvKey.trim()] = newEnvValue;

			if (editingServer) {
				setEditingServer({ ...editingServer, env: newEnv });
				serverToSave.env = newEnv;
			} else if (newServer) {
				setNewServer({ ...newServer, env: newEnv });
				serverToSave.env = newEnv;
			}

			setNewEnvKey('');
			setNewEnvValue('');
		}

		// Check if there's an unsaved environment variable in the input fields and add it
		if (newEnvKey.trim()) {
			const newEnv = { ...(serverToSave.env || {}) };
			newEnv[newEnvKey.trim()] = newEnvValue;
			if (editingServer) {
				setEditingServer({ ...editingServer, env: newEnv });
				serverToSave.env = newEnv;
			} else if (newServer) {
				setNewServer({ ...newServer, env: newEnv });
				serverToSave.env = newEnv;
			}
			setNewEnvKey('');
			setNewEnvValue('');
		}

		const validationErrors = validateServer(serverToSave);
		if (Object.keys(validationErrors).length > 0) {
			setErrors(validationErrors);
			return;
		}

		if (editingServer) {
			// Update existing server
			setEditedServers(editedServers.map((server) => server.id === editingServer.id ? editingServer : server));
			setEditingServer(null);
		} else if (newServer) {
			// Add new server
			setEditedServers([...editedServers, newServer]);
			setNewServer(null);
		}

		setErrors({});
	};

	// Cancel editing/creating server
	const handleCancelServerEdit = () => {
		setEditingServer(null);
		setNewServer(null);
		setErrors({});
	};

	// Save all changes
	const handleSaveChanges = () => {
		onSave(editedServers);
	};

	if (!isOpen) return null;

	return (
		<div className='modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
			<div
				className='modal-content bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-auto'
				onClick={(e) => e.stopPropagation()}
			>
				<div className='modal-header flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700'>
					<h2 className='text-xl font-bold text-gray-900 dark:text-gray-100'>
						{isGlobal ? 'Global' : 'Project'} MCP Server Configuration
					</h2>
					<button
						type='button'
						onClick={onClose}
						className='text-gray-400 hover:text-gray-500 dark:hover:text-gray-300'
					>
						<svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
							<path
								stroke-linecap='round'
								stroke-linejoin='round'
								stroke-width='2'
								d='M6 18L18 6M6 6l12 12'
							/>
						</svg>
					</button>
				</div>

				<div className='modal-body p-4'>
					{(editingServer || newServer)
						? (
							// Edit or create server form
							<div className='bg-white dark:bg-gray-900 rounded-md'>
								<h3 className='text-lg font-medium text-gray-900 dark:text-gray-100 mb-4'>
									{editingServer ? 'Edit Server' : 'Add New Server'}
								</h3>

								<div className='space-y-4'>
									{/* Server ID */}
									<div>
										<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
											Server ID <span className='text-red-500'>*</span>
										</label>
										<input
											type='text'
											value={(editingServer || newServer)?.id}
											onChange={(e) =>
												handleUpdateServer('id', (e.target as HTMLInputElement).value)}
											className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${
												errors.id ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
											}`}
											placeholder='slack'
											readOnly={!!editingServer} // Can't change ID for existing servers
										/>
										{errors.id && (
											<p className='mt-1 text-sm text-red-600 dark:text-red-400'>{errors.id}</p>
										)}
									</div>

									{/* Display Name */}
									<div>
										<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
											Display Name
										</label>
										<input
											type='text'
											value={(editingServer || newServer)?.name || ''}
											onChange={(e) =>
												handleUpdateServer('name', (e.target as HTMLInputElement).value)}
											className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
											placeholder='Slack'
										/>
									</div>

									{/* Command */}
									<div>
										<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
											Command <span className='text-red-500'>*</span>
										</label>
										<input
											type='text'
											value={(editingServer || newServer)?.command}
											onChange={(e) =>
												handleUpdateServer('command', (e.target as HTMLInputElement).value)}
											className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${
												errors.command
													? 'border-red-500'
													: 'border-gray-300 dark:border-gray-600'
											}`}
											placeholder='npx'
										/>
										{errors.command && (
											<p className='mt-1 text-sm text-red-600 dark:text-red-400'>
												{errors.command}
											</p>
										)}
									</div>

									{/* Arguments */}
									<div>
										<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
											Arguments
										</label>

										<div className='space-y-2'>
											{/* Existing arguments */}
											{((editingServer || newServer)?.args || []).map((arg, index) => (
												<div key={index} className='flex items-center space-x-2'>
													<input
														type='text'
														value={arg}
														onChange={(e) =>
															handleUpdateArgument(
																index,
																(e.target as HTMLInputElement).value,
															)}
														className='flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
													/>
													<button
														type='button'
														onClick={() =>
															handleRemoveArgument(index)}
														className='p-2 text-gray-400 hover:text-red-500 focus:outline-none'
														aria-label='Remove argument'
													>
														<svg
															className='h-5 w-5'
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
											<div className='flex items-center space-x-2'>
												<input
													type='text'
													value={newArgument}
													onChange={(e) =>
														setNewArgument((e.target as HTMLInputElement).value)}
													placeholder='Add argument...'
													className='flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
													onKeyDown={(e) => {
														if (e.key === 'Enter' && newArgument.trim()) {
															e.preventDefault();
															handleAddArgument();
														}
													}}
												/>
												<button
													type='button'
													onClick={handleAddArgument}
													className='p-2 text-gray-400 hover:text-blue-500 focus:outline-none'
													aria-label='Add argument'
													disabled={!newArgument.trim()}
												>
													<svg
														className='h-5 w-5'
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

											{/* Helper text */}
											<p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
												Press Enter or click + to add each argument. Each value will be passed
												as a separate argument to the command.
											</p>
										</div>
									</div>

									{/* Environment Variables */}
									<div>
										<div className='flex justify-between items-center mb-1'>
											<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
												Environment Variables
											</label>

											<button
												type='button'
												onClick={() => setShowSensitive(!showSensitive)}
												className='text-xs px-2 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
											>
												{showSensitive ? 'Hide' : 'Show'} Values
											</button>
										</div>

										{/* Existing environment variables */}
										<div className='space-y-2 mb-3'>
											{Object.entries((editingServer || newServer)?.env || {}).map((
												[key, value],
											) => (
												<div key={key} className='flex items-center space-x-2'>
													<input
														type='text'
														value={key}
														readOnly
														className='flex-[0.4] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono'
													/>
													<input
														type={showSensitive ? 'text' : 'password'}
														value={value}
														onChange={(e) =>
															handleUpdateEnvValue(
																key,
																(e.target as HTMLInputElement).value,
															)}
														className='flex-[0.6] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono'
													/>
													<button
														type='button'
														onClick={() => handleRemoveEnvVar(key)}
														className='p-2 text-gray-400 hover:text-red-500 focus:outline-none'
														aria-label='Remove environment variable'
													>
														<svg
															className='h-5 w-5'
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
										<div className='flex items-center space-x-2'>
											<input
												type='text'
												value={newEnvKey}
												onChange={(e) => setNewEnvKey((e.target as HTMLInputElement).value)}
												placeholder='Key'
												className='flex-[0.4] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
												onKeyDown={(e) => {
													if (e.key === 'Enter' && newEnvKey.trim()) {
														e.preventDefault();
														handleAddEnvVar();
													}
												}}
											/>
											<input
												type={showSensitive ? 'text' : 'password'}
												value={newEnvValue}
												onChange={(e) => setNewEnvValue((e.target as HTMLInputElement).value)}
												placeholder='Value'
												className='flex-[0.6] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
												onKeyDown={(e) => {
													if (e.key === 'Enter' && newEnvKey.trim()) {
														e.preventDefault();
														handleAddEnvVar();
													}
												}}
											/>
											<button
												type='button'
												onClick={handleAddEnvVar}
												className='p-2 text-gray-400 hover:text-blue-500 focus:outline-none'
												aria-label='Add environment variable'
												disabled={!newEnvKey.trim()}
											>
												<svg
													className='h-5 w-5'
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

										{/* Helper text */}
										<p className='text-xs text-gray-500 dark:text-gray-400 mt-2'>
											Environment variables are passed to the MCP server when it runs. Use these
											to provide API keys and configuration.
										</p>
									</div>
								</div>

								<div className='mt-6 flex justify-end space-x-3'>
									<button
										type='button'
										onClick={handleCancelServerEdit}
										className='px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
									>
										Cancel
									</button>
									<button
										type='button'
										onClick={handleSaveServer}
										className='px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600'
									>
										{editingServer ? 'Update Server' : 'Add Server'}
									</button>
								</div>
							</div>
						)
						: (
							// Server listing
							<div>
								<div className='flex justify-between items-center mb-4'>
									<h3 className='text-lg font-medium text-gray-900 dark:text-gray-100'>
										{isGlobal ? 'Global' : 'Project'} MCP Servers
									</h3>
									<button
										type='button'
										onClick={handleAddServer}
										className='inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
									>
										<svg
											className='h-4 w-4 mr-1.5'
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
										Add Server
									</button>
								</div>

								{editedServers.length > 0
									? (
										<div className='space-y-4'>
											{editedServers.map((server) => (
												<div
													key={server.id}
													className='bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4'
												>
													<div className='flex justify-between items-start'>
														<div>
															<h4 className='text-base font-medium text-gray-900 dark:text-gray-100'>
																{server.name || server.id}
															</h4>
															<div className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
																<div className='flex items-center'>
																	<span className='font-medium'>ID:</span>
																	<span className='ml-1 font-mono'>{server.id}</span>
																</div>
																<div className='flex items-center'>
																	<span className='font-medium'>Command:</span>
																	<span className='ml-1 font-mono'>
																		{server.command}
																	</span>
																</div>
																{server.args && server.args.length > 0 && (
																	<div className='flex items-start'>
																		<span className='font-medium'>Args:</span>
																		<span className='ml-1 font-mono'>
																			{server.args.join(', ')}
																		</span>
																	</div>
																)}
																{server.env && Object.keys(server.env).length > 0 && (
																	<div>
																		<span className='font-medium'>
																			Environment:
																		</span>
																		<span className='ml-1'>
																			{Object.keys(server.env).length}{' '}
																			variable{Object.keys(server.env).length !==
																					1
																				? 's'
																				: ''}
																		</span>
																	</div>
																)}
															</div>
														</div>

														<div className='flex space-x-2'>
															<button
																type='button'
																onClick={() => handleEditServer(server)}
																className='p-1 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
																title='Edit server'
															>
																<svg
																	className='h-5 w-5'
																	fill='none'
																	stroke='currentColor'
																	viewBox='0 0 24 24'
																>
																	<path
																		strokeLinecap='round'
																		strokeLinejoin='round'
																		strokeWidth={2}
																		d='M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'
																	/>
																</svg>
															</button>

															<button
																type='button'
																onClick={() => handleDeleteServer(server.id)}
																className='p-1 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
																title='Delete server'
															>
																<svg
																	className='h-5 w-5'
																	fill='none'
																	stroke='currentColor'
																	viewBox='0 0 24 24'
																>
																	<path
																		strokeLinecap='round'
																		strokeLinejoin='round'
																		strokeWidth={2}
																		d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
																	/>
																</svg>
															</button>
														</div>
													</div>
												</div>
											))}
										</div>
									)
									: (
										<div className='bg-gray-50 dark:bg-gray-800 rounded-md p-4 text-center text-gray-500 dark:text-gray-400'>
											No MCP servers configured yet.
											<button
												type='button'
												onClick={handleAddServer}
												className='ml-1 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'
											>
												Add your first server
											</button>
										</div>
									)}
							</div>
						)}
				</div>

				<div className='modal-footer flex justify-end p-4 border-t border-gray-200 dark:border-gray-700'>
					<button
						type='button'
						onClick={onClose}
						className='mr-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
					>
						Cancel
					</button>
					<button
						type='button'
						onClick={handleSaveChanges}
						disabled={editingServer !== null || newServer !== null}
						className='px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed'
					>
						Save Changes
					</button>
				</div>
			</div>
		</div>
	);
}
