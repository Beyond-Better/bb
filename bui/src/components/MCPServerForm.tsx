import type { MCPServerConfig } from 'shared/config/types.ts';
import { useState } from 'preact/hooks';
import { mcpLogger } from '../utils/logger.ts';

interface MCPServerFormProps {
	server: MCPServerConfig;
	// deno-lint-ignore no-explicit-any
	onChange: (field: keyof MCPServerConfig, value: any) => void;
	mode: 'new' | 'edit';
	errors?: Record<string, string>;
}

const sensitiveEnvVarPatterns = [
	/token/i,
	/key/i,
	/secret/i,
	/password/i,
	/credential/i,
];

export default function MCPServerForm({ server, onChange, mode, errors = {} }: MCPServerFormProps) {
	const [showSensitiveValues, setShowSensitiveValues] = useState(false);
	const [newArgument, setNewArgument] = useState('');
	const [newEnvKey, setNewEnvKey] = useState('');
	const [newEnvValue, setNewEnvValue] = useState('');

	// Create a logger instance for this server
	const logger = mcpLogger.child({ serverId: server.id, mode });

	const handleAddArgument = () => {
		if (!newArgument.trim()) return;

		const newArgs = [...(server.args || []), newArgument.trim()];
		onChange('args', newArgs);
		setNewArgument('');
	};

	const handleRemoveArgument = (index: number) => {
		const newArgs = [...(server.args || [])];
		newArgs.splice(index, 1);
		onChange('args', newArgs);
	};

	const handleUpdateArgument = (index: number, value: string) => {
		const newArgs = [...(server.args || [])];
		newArgs[index] = value;
		onChange('args', newArgs);
	};

	const handleAddEnvVar = () => {
		if (!newEnvKey.trim()) return;

		const newEnv = { ...(server.env || {}) };
		newEnv[newEnvKey.trim()] = newEnvValue;
		onChange('env', newEnv);

		// Clear inputs for next entry
		setNewEnvKey('');
		setNewEnvValue('');
	};

	const handleRemoveEnvVar = (keyToRemove: string) => {
		const newEnv = { ...(server.env || {}) };
		delete newEnv[keyToRemove];
		onChange('env', newEnv);
	};

	const handleUpdateEnvValue = (key: string, newValue: string) => {
		const newEnv = { ...(server.env || {}) };
		newEnv[key] = newValue;
		onChange('env', newEnv);
	};

	const hasAnyEnvVars = server.env && Object.keys(server.env).length > 0;
	const hasSensitiveEnvVars = hasAnyEnvVars &&
		Object.keys(server.env || {}).some((key) => sensitiveEnvVarPatterns.some((pattern) => pattern.test(key)));

	return (
		<div className='space-y-3'>
			{/* Server ID */}
			<div>
				<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
					Server ID <span className='text-red-500'>*</span>
				</label>
				<input
					type='text'
					value={server.id}
					onChange={(e) => onChange('id', (e.target as HTMLInputElement).value)}
					className='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
					placeholder='slack'
					readOnly={mode === 'edit'} // ID shouldn't be changed once set
				/>
				{errors.id && <p className='mt-1 text-sm text-red-600 dark:text-red-400'>{errors.id}</p>}
			</div>

			{/* Display Name */}
			<div>
				<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
					Display Name
				</label>
				<input
					type='text'
					value={server.name || ''}
					onChange={(e) => onChange('name', (e.target as HTMLInputElement).value)}
					className='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
					placeholder='Slack'
				/>
			</div>

			{/* Transport Type */}
			<div>
				<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
					Transport Type <span className='text-red-500'>*</span>
				</label>
				<div className='space-y-2'>
					<label className='flex items-center'>
						<input
							type='radio'
							name='transport'
							value='stdio'
							checked={server.transport === 'stdio' || !server.transport}
							onChange={(e) => onChange('transport', (e.target as HTMLInputElement).value)}
							className='mr-2 text-blue-600 focus:ring-blue-500'
						/>
						<span className='text-sm text-gray-700 dark:text-gray-300'>
							STDIO (Local Process)
						</span>
					</label>
					<label className='flex items-center'>
						<input
							type='radio'
							name='transport'
							value='http'
							checked={server.transport === 'http'}
							onChange={(e) => onChange('transport', (e.target as HTMLInputElement).value)}
							className='mr-2 text-blue-600 focus:ring-blue-500'
						/>
						<span className='text-sm text-gray-700 dark:text-gray-300'>
							HTTP (Remote Server)
						</span>
					</label>
				</div>
				{errors.transport && <p className='mt-1 text-sm text-red-600 dark:text-red-400'>{errors.transport}</p>}
			</div>

			{/* Conditional Fields Based on Transport Type */}
			{server.transport === 'stdio' || !server.transport
				? (
					<>
						{/* STDIO Transport Configuration */}
						{/* Command */}
						<div>
							<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
								Command <span className='text-red-500'>*</span>
							</label>
							<input
								type='text'
								value={server.command || ''}
								onChange={(e) => onChange('command', (e.target as HTMLInputElement).value)}
								className='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
								placeholder='npx'
							/>
							{errors.command && (
								<p className='mt-1 text-sm text-red-600 dark:text-red-400'>{errors.command}</p>
							)}
						</div>

						{/* Arguments */}
						<div>
							<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
								Arguments
							</label>
							<div className='space-y-2'>
								{/* Existing arguments */}
								{(server.args || []).map((arg, index) => (
									<div key={index} className='flex items-center space-x-2'>
										<input
											type='text'
											value={arg}
											onChange={(e) =>
												handleUpdateArgument(index, (e.target as HTMLInputElement).value)}
											className='flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 dark:text-white text-sm'
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
										onChange={(e) => setNewArgument((e.target as HTMLInputElement).value)}
										placeholder='Add argument...'
										className='flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 dark:text-white text-sm'
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

								<p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
									Press Enter or click + to add each argument. Each value will be passed as a separate
									argument to the command.
								</p>
							</div>
						</div>

						{/* Environment Variables */}
						<div>
							<div className='flex justify-between items-center mb-1'>
								<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
									Environment Variables
								</label>

								{hasSensitiveEnvVars && (
									<button
										type='button'
										onClick={() => setShowSensitiveValues(!showSensitiveValues)}
										className='text-xs px-2 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
									>
										{showSensitiveValues ? 'Hide' : 'Show'} Values
									</button>
								)}
							</div>

							{/* Existing environment variables */}
							<div className='space-y-2 mb-3'>
								{Object.entries(server.env || {}).map(([key, value]) => (
									<div key={key} className='flex items-center space-x-2'>
										<input
											type='text'
											value={key}
											readOnly
											className='flex-[0.4] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm font-mono'
										/>
										<input
											type={showSensitiveValues ? 'text' : 'password'}
											value={value}
											onChange={(e) =>
												handleUpdateEnvValue(key, (e.target as HTMLInputElement).value)}
											className='flex-[0.6] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm font-mono'
										/>
										<button
											type='button'
											onClick={() =>
												handleRemoveEnvVar(key)}
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
									className='flex-[0.4] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm'
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
									className='flex-[0.6] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm'
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
									className='p-2 text-gray-400 hover:text-blue-500 focus:outline-none'
									aria-label='Add environment variable'
									disabled={!newEnvKey.trim()}
								>
									<svg className='h-5 w-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M12 4v16m8-8H4'
										/>
									</svg>
								</button>
							</div>

							<p className='text-xs text-gray-500 dark:text-gray-400 mt-2'>
								Environment variables are passed to the MCP server when it runs. Use these to provide
								API keys and configuration.
							</p>
						</div>
					</>
				)
				: (
					<>
						{/* HTTP Transport Configuration */}
						{/* Server URL */}
						<div>
							<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
								Server URL <span className='text-red-500'>*</span>
							</label>
							<input
								type='url'
								value={server.url || ''}
								onChange={(e) => onChange('url', (e.target as HTMLInputElement).value)}
								className='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
								placeholder='https://your-mcp-server.com/mcp'
							/>
							<p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
								HTTPS is required for remote servers. Localhost is allowed over HTTP.
							</p>
							{errors.url && <p className='mt-1 text-sm text-red-600 dark:text-red-400'>{errors.url}</p>}
						</div>

						{/* OAuth Configuration */}
						<div className='border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800'>
							<div className='flex items-center justify-between mb-3'>
								<h4 className='text-sm font-medium text-gray-900 dark:text-gray-100'>
									OAuth Configuration
								</h4>
								<label className='flex items-center'>
									<input
										type='checkbox'
										checked={!!server.oauth}
										onChange={(e) => {
											const checked = (e.target as HTMLInputElement).checked;
											logger.userAction('OAuth toggle', {
												enabled: checked,
												transportType: server.transport,
											});
											if (checked) {
												logger.oauth('OAuth Enabled', {
													serverId: server.id,
													grantType: 'authorization_code',
													step: 'configuration_start',
												});
												onChange('oauth', {
													grantType: 'authorization_code',
													scopes: [],
												});
											} else {
												logger.oauth('OAuth Disabled', {
													serverId: server.id,
													step: 'configuration_disabled',
												});
												onChange('oauth', undefined);
											}
										}}
										className='mr-2 text-blue-600 focus:ring-blue-500'
									/>
									<span className='text-sm text-gray-700 dark:text-gray-300'>Enable OAuth</span>
								</label>
							</div>

							{server.oauth && (
								<div className='space-y-4'>
									{/* Grant Type */}
									<div>
										<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
											OAuth Flow Type
										</label>

										{/* MCP Server Authentication Context */}
										<div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md p-3 mb-4'>
											<div className='flex items-start space-x-3'>
												<div className='flex-shrink-0'>
													<svg
														className='h-5 w-5 text-blue-400'
														fill='currentColor'
														viewBox='0 0 20 20'
													>
														<path
															fillRule='evenodd'
															d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z'
															clipRule='evenodd'
														/>
													</svg>
												</div>
												<div className='flex-1'>
													<h4 className='text-sm font-medium text-blue-800 dark:text-blue-200'>
														MCP Server Authentication
													</h4>
													<p className='mt-1 text-sm text-blue-700 dark:text-blue-300'>
														Configure how BB authenticates with this MCP server. The MCP
														server separately handles connections to external services (like
														Google, etc.).
													</p>
												</div>
											</div>
										</div>

										<div className='space-y-3'>
											<label className='flex items-start space-x-3 p-3 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer'>
												<input
													type='radio'
													name='grantType'
													value='authorization_code'
													checked={server.oauth.grantType === 'authorization_code'}
													onChange={(e) => {
														const newGrantType = (e.target as HTMLInputElement)
															.value as 'authorization_code';
														logger.oauth('Grant Type Changed', {
															serverId: server.id,
															grantType: newGrantType,
															previousGrantType: server.oauth?.grantType,
															step: 'grant_type_selection',
														});
														onChange('oauth', {
															...server.oauth!,
															grantType: newGrantType,
														});
													}}
													className='mt-1 text-blue-600 focus:ring-blue-500'
												/>
												<div className='flex-1'>
													<div className='font-medium text-sm text-gray-900 dark:text-gray-100'>
														Authorization Code with PKCE (Recommended)
														<span className='ml-2 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-0.5 rounded'>
															MCP Standard
														</span>
													</div>
													<div className='text-xs text-gray-600 dark:text-gray-400 mt-1'>
														Secure user authentication using PKCE (Proof Key for Code
														Exchange). No client secret required. Uses cryptographic
														challenge/response.
													</div>
												</div>
											</label>
											<label className='flex items-start space-x-3 p-3 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer'>
												<input
													type='radio'
													name='grantType'
													value='client_credentials'
													checked={server.oauth.grantType === 'client_credentials'}
													onChange={(e) => {
														const newGrantType = (e.target as HTMLInputElement)
															.value as 'client_credentials';
														logger.oauth('Grant Type Changed', {
															serverId: server.id,
															grantType: newGrantType,
															previousGrantType: server.oauth?.grantType,
															step: 'grant_type_selection',
														});
														onChange('oauth', {
															...server.oauth!,
															grantType: newGrantType,
														});
													}}
													className='mt-1 text-blue-600 focus:ring-blue-500'
												/>
												<div className='flex-1'>
													<div className='font-medium text-sm text-gray-900 dark:text-gray-100'>
														Client Credentials (App-to-App)
													</div>
													<div className='text-xs text-gray-600 dark:text-gray-400 mt-1'>
														Direct server-to-server authentication. Requires both client ID
														and client secret. No user interaction needed.
													</div>
												</div>
											</label>
										</div>
									</div>

									{/* OAuth Configuration Info */}
									<div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md p-3'>
										<div className='flex items-start space-x-3'>
											<div className='flex-shrink-0'>
												<svg
													className='h-5 w-5 text-blue-400'
													fill='currentColor'
													viewBox='0 0 20 20'
												>
													<path
														fillRule='evenodd'
														d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z'
														clipRule='evenodd'
													/>
												</svg>
											</div>
											<div className='flex-1'>
												<h4 className='text-sm font-medium text-blue-800 dark:text-blue-200'>
													Automatic OAuth Discovery
												</h4>
												<p className='mt-1 text-sm text-blue-700 dark:text-blue-300'>
													OAuth endpoints will be discovered automatically from the server's
													<code className='text-xs bg-blue-100 dark:bg-blue-800 px-1 py-0.5 rounded'>
														/.well-known/oauth-authorization-server
													</code>{' '}
													endpoint.
													{server.oauth.grantType === 'authorization_code'
														? 'Client credentials will be registered automatically if supported by the server.'
														: 'Both client ID and secret are required for server-to-server authentication.'}
												</p>
											</div>
										</div>
									</div>

									{/* Scopes */}
									<div>
										<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
											Scopes (optional)
										</label>
										<input
											type='text'
											value={server.oauth.scopes?.join(', ') || ''}
											onChange={(e) => {
												const scopes = (e.target as HTMLInputElement).value
													.split(',')
													.map((s) => s.trim())
													.filter((s) => s.length > 0);
												onChange('oauth', {
													...server.oauth!,
													scopes,
												});
											}}
											className='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
											placeholder='mcp:tools, read, write'
										/>
										<p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
											Comma-separated list of OAuth scopes. Leave empty to use server defaults.
										</p>
									</div>

									{/* Client Credentials Configuration */}
									{server.oauth.grantType === 'authorization_code' && (
										<div className='bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-md p-4'>
											<div className='flex items-center space-x-2 mb-3'>
												<svg
													className='h-5 w-5 text-green-600 dark:text-green-400'
													fill='none'
													stroke='currentColor'
													viewBox='0 0 24 24'
												>
													<path
														strokeLinecap='round'
														strokeLinejoin='round'
														strokeWidth={2}
														d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
													/>
												</svg>
												<h4 className='text-sm font-medium text-green-800 dark:text-green-200'>
													PKCE Configuration (Secure)
												</h4>
											</div>
											<div className='space-y-3'>
												<div>
													<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
														Client ID
														{!server.oauth.clientId && (
															<span className='text-amber-600 dark:text-amber-400 text-xs ml-2'>
																(Will be auto-registered if supported)
															</span>
														)}
													</label>
													<input
														type='text'
														value={server.oauth.clientId || ''}
														onChange={(e) => {
															onChange('oauth', {
																...server.oauth!,
																clientId: (e.target as HTMLInputElement).value,
															});
														}}
														className='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
														placeholder='your-client-id (optional for dynamic registration)'
													/>
													<p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
														Client ID for PKCE flow. Leave empty to use dynamic client
														registration if supported.
													</p>
												</div>
												<div>
													<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
														Client Secret (Optional for Enhanced Security)
													</label>
													<input
														type='password'
														value={server.oauth.clientSecret || ''}
														onChange={(e) => {
															onChange('oauth', {
																...server.oauth!,
																clientSecret: (e.target as HTMLInputElement).value,
															});
														}}
														className='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
														placeholder='your-client-secret (optional for PKCE)'
													/>
													<p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
														Optional: Leave empty for pure PKCE (public client). Include for
														hybrid PKCE + client credentials (confidential client).
													</p>
												</div>
											</div>
										</div>
									)}

									{server.oauth.grantType === 'client_credentials' && (
										<div className='bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-md p-4'>
											<div className='flex items-center space-x-2 mb-3'>
												<svg
													className='h-5 w-5 text-orange-600 dark:text-orange-400'
													fill='none'
													stroke='currentColor'
													viewBox='0 0 24 24'
												>
													<path
														strokeLinecap='round'
														strokeLinejoin='round'
														strokeWidth={2}
														d='M15 7a2 2 0 012 2m0 0a2 2 0 012 2v6a2 2 0 01-2 2h-6a2 2 0 01-2-2V9a2 2 0 012-2m0 0V7a2 2 0 012-2m-2 2V5a2 2 0 012-2m0 0V3a2 2 0 012-2'
													/>
												</svg>
												<h4 className='text-sm font-medium text-orange-800 dark:text-orange-200'>
													Client Credentials Configuration
												</h4>
											</div>
											<div className='grid grid-cols-2 gap-3'>
												<div>
													<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
														Client ID <span className='text-red-500'>*</span>
													</label>
													<input
														type='text'
														value={server.oauth.clientId || ''}
														onChange={(e) => {
															onChange('oauth', {
																...server.oauth!,
																clientId: (e.target as HTMLInputElement).value,
															});
														}}
														className='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
														placeholder='your-client-id'
														required
													/>
												</div>
												<div>
													<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
														Client Secret <span className='text-red-500'>*</span>
													</label>
													<input
														type='password'
														value={server.oauth.clientSecret || ''}
														onChange={(e) => {
															onChange('oauth', {
																...server.oauth!,
																clientSecret: (e.target as HTMLInputElement).value,
															});
														}}
														className='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
														placeholder='your-client-secret'
														required
													/>
												</div>
											</div>
											<p className='text-xs text-gray-500 dark:text-gray-400 mt-2'>
												Both client ID and secret are required for server-to-server
												authentication.
											</p>
										</div>
									)}

									{/* Advanced Configuration (Optional) */}
									<div className='bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md p-4'>
										<details className='group'>
											<summary className='cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 group-open:mb-3'>
												Advanced OAuth Settings (Optional)
												<span className='ml-2 text-xs text-gray-500 dark:text-gray-400'>
													Click to expand
												</span>
											</summary>
											<div className='space-y-3'>
												{/* Authorization Endpoint Override */}
												{server.oauth.grantType === 'authorization_code' && (
													<div>
														<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
															Authorization Endpoint (Override)
														</label>
														<input
															type='url'
															value={server.oauth.authorizationEndpoint || ''}
															onChange={(e) => {
																onChange('oauth', {
																	...server.oauth!,
																	authorizationEndpoint:
																		(e.target as HTMLInputElement).value,
																});
															}}
															className='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
															placeholder='https://your-server.com/oauth/authorize'
														/>
														<p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
															Leave empty for automatic discovery from
															/.well-known/oauth-authorization-server
														</p>
													</div>
												)}

												{/* Token Endpoint Override */}
												<div>
													<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
														Token Endpoint (Override)
													</label>
													<input
														type='url'
														value={server.oauth.tokenEndpoint || ''}
														onChange={(e) => {
															onChange('oauth', {
																...server.oauth!,
																tokenEndpoint: (e.target as HTMLInputElement).value,
															});
														}}
														className='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
														placeholder='https://your-server.com/oauth/token'
													/>
													<p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
														Leave empty for automatic discovery
													</p>
												</div>

												{/* Redirect URI Override */}
												{server.oauth.grantType === 'authorization_code' && (
													<div>
														<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
															Redirect URI (Override)
														</label>
														<input
															type='url'
															value={server.oauth.redirectUri || ''}
															onChange={(e) => {
																onChange('oauth', {
																	...server.oauth!,
																	redirectUri: (e.target as HTMLInputElement).value,
																});
															}}
															className='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
															placeholder='Custom redirect URI (leave empty for auto)'
														/>
														<p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
															Usually auto-configured. Only override if you have a custom
															callback URL.
														</p>
													</div>
												)}
											</div>
										</details>
									</div>
								</div>
							)}
						</div>
					</>
				)}
		</div>
	);
}
