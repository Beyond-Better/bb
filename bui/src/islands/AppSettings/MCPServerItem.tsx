import { MCPServerConfig } from 'shared/config/types.ts';
import { useEffect, useState } from 'preact/hooks';

interface MCPServerItemProps {
	server: MCPServerConfig;
	isEditing: boolean;
	toggleEdit: () => void;
	onUpdate: (updatedServer: MCPServerConfig) => void;
	onDelete: () => void;
	onSave: () => void;
}

const sensitiveEnvVarPatterns = [
	/token/i,
	/key/i,
	/secret/i,
	/password/i,
	/credential/i,
];

export default function MCPServerItem({
	server,
	isEditing,
	toggleEdit,
	onUpdate,
	onDelete,
	onSave,
}: MCPServerItemProps) {
	const [showSensitiveValues, setShowSensitiveValues] = useState(false);
	const [newArgument, setNewArgument] = useState('');
	const [newEnvKey, setNewEnvKey] = useState('');
	const [newEnvValue, setNewEnvValue] = useState('');

	const handleInputChange = (field: keyof MCPServerConfig, value: string | string[] | Record<string, string>) => {
		onUpdate({
			...server,
			[field]: value,
		});
	};

	const handleAddArgument = () => {
		if (!newArgument.trim()) return;

		const newArgs = [...(server.args || []), newArgument.trim()];
		handleInputChange('args', newArgs);
		setNewArgument('');
	};

	const handleRemoveArgument = (index: number) => {
		const newArgs = [...(server.args || [])];
		newArgs.splice(index, 1);
		handleInputChange('args', newArgs);
	};

	const handleUpdateArgument = (index: number, value: string) => {
		const newArgs = [...(server.args || [])];
		newArgs[index] = value;
		handleInputChange('args', newArgs);
	};

	const handleAddEnvVar = () => {
		if (!newEnvKey.trim()) return;

		const newEnv = { ...(server.env || {}) };
		newEnv[newEnvKey.trim()] = newEnvValue;
		handleInputChange('env', newEnv);

		// Clear inputs for next entry
		setNewEnvKey('');
		setNewEnvValue('');
	};

	const handleRemoveEnvVar = (keyToRemove: string) => {
		const newEnv = { ...(server.env || {}) };
		delete newEnv[keyToRemove];
		handleInputChange('env', newEnv);
	};

	const handleUpdateEnvValue = (key: string, newValue: string) => {
		const newEnv = { ...(server.env || {}) };
		newEnv[key] = newValue;
		handleInputChange('env', newEnv);
	};

	const hasAnyEnvVars = server.env && Object.keys(server.env).length > 0;
	const hasSensitiveEnvVars = hasAnyEnvVars &&
		Object.keys(server.env || {}).some((key) => sensitiveEnvVarPatterns.some((pattern) => pattern.test(key)));

	if (isEditing) {
		return (
			<div class='border border-gray-200 dark:border-gray-700 rounded-md p-4 bg-gray-50 dark:bg-gray-800'>
				<div class='space-y-3'>
					<div>
						<label class='block text-sm font-medium text-gray-700 dark:text-gray-300'>Server ID</label>
						<input
							type='text'
							value={server.id}
							onChange={(e) => handleInputChange('id', (e.target as HTMLInputElement).value)}
							class='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
							placeholder='slack'
							readOnly // ID shouldn't be changed once set
						/>
					</div>

					<div>
						<label class='block text-sm font-medium text-gray-700 dark:text-gray-300'>Display Name</label>
						<input
							type='text'
							value={server.name || ''}
							onChange={(e) => handleInputChange('name', (e.target as HTMLInputElement).value)}
							class='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
							placeholder='Slack'
						/>
					</div>

					<div>
						<label class='block text-sm font-medium text-gray-700 dark:text-gray-300'>Command</label>
						<input
							type='text'
							value={server.command}
							onChange={(e) => handleInputChange('command', (e.target as HTMLInputElement).value)}
							class='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
							placeholder='npx'
						/>
					</div>

					{/* Arguments - Structured UI */}
					<div>
						<label class='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>Arguments</label>

						<div class='space-y-2'>
							{/* Existing arguments */}
							{(server.args || []).map((arg, index) => (
								<div key={index} class='flex items-center space-x-2'>
									<input
										type='text'
										value={arg}
										onChange={(e) =>
											handleUpdateArgument(index, (e.target as HTMLInputElement).value)}
										class='flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 dark:text-white text-sm'
									/>
									<button
										type='button'
										onClick={() =>
											handleRemoveArgument(index)}
										class='p-2 text-gray-400 hover:text-red-500 focus:outline-none'
										aria-label='Remove argument'
									>
										<svg class='h-5 w-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
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
											handleAddArgument();
										}
									}}
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
									class='p-2 text-gray-400 hover:text-blue-500 focus:outline-none'
									aria-label='Add argument'
									disabled={!newArgument.trim()}
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

							<p class='text-xs text-gray-500 dark:text-gray-400 mt-1'>
								Press Enter or click + to add each argument. Each value will be passed as a separate
								argument to the command.
							</p>
						</div>
					</div>

					{/* Environment Variables - Structured UI */}
					<div>
						<div class='flex justify-between items-center mb-1'>
							<label class='block text-sm font-medium text-gray-700 dark:text-gray-300'>
								Environment Variables
							</label>

							{hasSensitiveEnvVars && (
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
							{Object.entries(server.env || {}).map(([key, value]) => (
								<div key={key} class='flex items-center space-x-2'>
									<input
										type='text'
										value={key}
										readOnly
										class='flex-[0.4] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm font-mono'
									/>
									<input
										type={showSensitiveValues ? 'text' : 'password'}
										value={value}
										onChange={(e) =>
											handleUpdateEnvValue(key, (e.target as HTMLInputElement).value)}
										class='flex-[0.6] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm font-mono'
									/>
									<button
										type='button'
										onClick={() =>
											handleRemoveEnvVar(key)}
										class='p-2 text-gray-400 hover:text-red-500 focus:outline-none'
										aria-label='Remove environment variable'
									>
										<svg class='h-5 w-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
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
										handleAddEnvVar();
									}
								}}
							/>
							<input
								type={showSensitiveValues ? 'text' : 'password'}
								value={newEnvValue}
								onChange={(e) => setNewEnvValue((e.target as HTMLInputElement).value)}
								placeholder='Value'
								class='flex-[0.6] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm'
								onBlur={() => {
									if (newEnvKey.trim()) {
										handleAddEnvVar();
									}
								}}
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
							Environment variables are passed to the MCP server when it runs. Use these to provide API
							keys and configuration.
						</p>
					</div>
				</div>

				<div class='mt-4 flex justify-end space-x-2'>
					<button
						type='button'
						onClick={toggleEdit}
						class='inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
					>
						Cancel
					</button>
					<button
						type='button'
						onClick={onSave}
						class='inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
					>
						Save Changes
					</button>
				</div>
			</div>
		);
	}

	// Non-editing view (remains mostly unchanged)
	return (
		<div class='border border-green-100 dark:border-green-900 rounded-md p-3 bg-white dark:bg-gray-900'>
			<div class='flex items-center justify-between'>
				<div class='flex items-center'>
					<h4 class='text-sm font-medium text-gray-900 dark:text-gray-100'>{server.name || server.id}</h4>
					{server.id !== server.name && (
						<span class='ml-2 text-xs text-gray-500 dark:text-gray-400'>
							ID: {server.id}
						</span>
					)}
				</div>

				<div class='flex space-x-1'>
					<button
						type='button'
						onClick={toggleEdit}
						class='inline-flex items-center p-1 border border-transparent rounded-full text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-500 dark:hover:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
						title='Edit server'
					>
						<svg
							xmlns='http://www.w3.org/2000/svg'
							class='h-4 w-4'
							fill='none'
							viewBox='0 0 24 24'
							stroke='currentColor'
						>
							<path
								stroke-linecap='round'
								stroke-linejoin='round'
								stroke-width='2'
								d='M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'
							/>
						</svg>
					</button>

					<button
						type='button'
						onClick={onDelete}
						class='inline-flex items-center p-1 border border-transparent rounded-full text-gray-400 dark:text-gray-500 hover:bg-red-100 dark:hover:bg-red-900 hover:text-red-500 dark:hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'
						title='Delete server'
					>
						<svg
							xmlns='http://www.w3.org/2000/svg'
							class='h-4 w-4'
							fill='none'
							viewBox='0 0 24 24'
							stroke='currentColor'
						>
							<path
								stroke-linecap='round'
								stroke-linejoin='round'
								stroke-width='2'
								d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
							/>
						</svg>
					</button>
				</div>
			</div>

			<div class='mt-2 text-xs text-gray-500 dark:text-gray-400'>
				<div>
					Command: <span class='font-mono'>{server.command}</span>
				</div>

				{server.args && server.args.length > 0 && (
					<div class='mt-1'>
						Args: <span class='font-mono'>{server.args.join(', ')}</span>
					</div>
				)}

				{hasAnyEnvVars && (
					<div class='mt-1'>
						Env: {Object.keys(server.env || {}).length}{' '}
						variable{Object.keys(server.env || {}).length !== 1 ? 's' : ''}
						{hasSensitiveEnvVars && ' (contains sensitive values)'}
					</div>
				)}
			</div>
		</div>
	);
}
