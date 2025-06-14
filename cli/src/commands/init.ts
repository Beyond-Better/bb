import { Command } from 'cliffy/command';
import { Confirm, Input, prompt } from 'cliffy/prompt';
import { colors } from 'cliffy/ansi/colors';
import { logger } from 'shared/logger.ts';
import { basename } from '@std/path';
import { getProjectId } from 'shared/dataDir.ts';
import { getDataSourceRegistry } from 'api/dataSources/dataSourceRegistry.ts';
// Using ProjectType from v2 types

import { getConfigManager } from 'shared/config/configManager.ts';
import { getProjectPersistenceManager } from 'api/storage/projectPersistenceManager.ts';
import { DefaultModelsConfigDefaults } from 'shared/types/models.ts';
import type { CreateProjectData } from 'shared/types/project.ts';
import { certificateFileExists, generateCertificate } from 'shared/tlsCerts.ts';

async function runWizard(
	workingRoot: string,
): Promise<Omit<CreateProjectData, 'dsConnections' | 'primaryDataSourceRoot'>> {
	// Show password notice if not on Windows
	if (Deno.build.os !== 'windows') {
		console.log(colors.bold('\nImportant Note about Security Setup:'));
		console.log("During the setup process, you may be asked to enter your computer's login password.");
		console.log('This is needed to install security certificates that keep your connection private.');
		console.log('When entering your password:');
		console.log('1. The password will not be visible as you type (this is normal)');
		console.log("2. Press Return/Enter when you're done typing your password");
		console.log('3. This is the same password you use to log into your computer');
		console.log('\nThis is a one-time setup step to ensure secure communication.\n');
	}

	const configManager = await getConfigManager();
	const globalConfig = await configManager.getGlobalConfig();
	console.log('globalConfig', globalConfig);
	const projectId = await getProjectId(workingRoot);
	const projectConfig = projectId ? await configManager.loadProjectConfig(projectId) : null;
	const existingProjectConfig: CreateProjectData = projectConfig
		? {
			name: projectConfig.name || 'unknown project',
			myPersonsName: projectConfig.myPersonsName,
			myAssistantsName: projectConfig.myAssistantsName,
			anthropicApiKey: projectConfig.api?.llmProviders?.anthropic?.apiKey,
			dsConnections: [],
			defaultModels: projectConfig.defaultModels,
		}
		: {
			name: basename(workingRoot),
			myPersonsName: globalConfig.myPersonsName || Deno.env.get('USER') || Deno.env.get('USERNAME') || 'User',
			myAssistantsName: globalConfig.myAssistantsName || 'Assistant',
			anthropicApiKey: '',
			dsConnections: [],
			defaultModels: DefaultModelsConfigDefaults,
		};

	const defaultProjectName = existingProjectConfig.name;
	const defaultPersonName = existingProjectConfig.myPersonsName ||
		'';
	const defaultAssistantName = existingProjectConfig.myAssistantsName;
	const existingApiKey = existingProjectConfig.anthropicApiKey;
	const isApiKeyRequired = !globalConfig.api.llmProviders?.anthropic?.apiKey;

	const answers = await prompt([
		{
			name: 'projectName',
			message: 'Enter your project name:',
			type: Input,
			default: defaultProjectName,
		},
		{
			name: 'myPersonsName',
			message: 'Enter your name:',
			type: Input,
			default: defaultPersonName,
			hint: 'Used in conversation display',
		},
		{
			name: 'myAssistantsName',
			message: "Enter your assistant's name:",
			type: Input,
			default: defaultAssistantName,
			hint: 'Used in conversation display',
		},
		{
			name: 'useTls',
			message: 'Enable secure HTTPS connection?',
			type: Confirm,
			default: false,
			hint: 'Recommended for security',
		},
		{
			name: 'anthropicApiKey',
			message: isApiKeyRequired ? 'Enter your Anthropic API key:' : 'Enter your Anthropic API key (optional):',
			type: Input,
			default: existingApiKey,
			hideDefault: true,
			after: async ({ anthropicApiKey }, next) => {
				//console.log('anthropicApiKey-anthropicApiKey:', anthropicApiKey);
				let continuePrompt = true;
				if (anthropicApiKey?.length === 0) {
					if (isApiKeyRequired) {
						console.warn('API key is required');
						continuePrompt = false;
					}
				} else {
					const { isValid, message } = validateAnthropicApiKey(anthropicApiKey || '');
					if (!isValid) {
						console.warn(message);
						continuePrompt = false;
					}
				}
				if (continuePrompt) {
					await next();
				} else {
					await next('anthropicApiKey');
				}
			},
		},
	]);

	// Detect project type
	//const projectType = existingProjectConfig?.type || await detectProjectType(workingRoot);

	// Remove empty values
	const filteredAnswers: Omit<CreateProjectData, 'dsConnections'> = {
		name: answers.projectName?.trim() || workingRoot,
		//type: projectType,
	};

	if (answers.anthropicApiKey && answers.anthropicApiKey.trim() !== '') {
		filteredAnswers.anthropicApiKey = answers.anthropicApiKey.trim();
	}

	if (answers.myPersonsName && answers.myPersonsName.trim() !== '') {
		filteredAnswers.myPersonsName = answers.myPersonsName.trim();
	}
	if (answers.myAssistantsName && answers.myAssistantsName.trim() !== '') {
		filteredAnswers.myAssistantsName = answers.myAssistantsName.trim();
	}
	filteredAnswers.useTls = answers.useTls;
	//console.log(filteredAnswers);

	return filteredAnswers;
}

// async function detectProjectType(workingRoot: string): Promise<ProjectType> {
// 	//try {
// 	//	const gitSimpleCheck = new Deno.Command('git', {
// 	//		args: ['--version'],
// 	//	});
// 	//	const { code } = await gitSimpleCheck.output();
// 	//	if (code === 0) {
// 	//		return 'git';
// 	//	} else {
// 	//		return 'local';
// 	//	}
// 	//} catch (_) {
// 	//	return 'local';
// 	//}
// 	// findGitRoot calls getGit which throws if git isn't installed, so just do the above manual check instead.
// 	const gitRoot = await GitUtils.findGitRoot(workingRoot);
// 	if (!gitRoot) await GitUtils.initGit(workingRoot);
// 	// [TODO] type 'git' is deprecated, so return 'local' for both
// 	//return gitRoot ? 'git' : 'local';
// 	return 'local';
// }

async function printProjectDetails(
	projectName: string,
	//projectType: string,
	createProjectData: Omit<CreateProjectData, 'dsConnections'>,
	useTlsCert: boolean,
) {
	const configManager = await getConfigManager();
	const globalConfig = await configManager.getGlobalConfig();
	console.log(`\n${colors.bold.blue.underline('BB Project Details:')}`);
	console.log(`  ${colors.bold('Name:')} ${colors.green(projectName)}`);
	//console.log(`  ${colors.bold('Type:')} ${colors.green(projectType)}`);
	console.log(`  ${colors.bold('Your Name:')} ${colors.green(createProjectData.myPersonsName || 'Not set')}`);
	console.log(`  ${colors.bold('Assistant Name:')} ${colors.green(createProjectData.myAssistantsName || 'Not set')}`);
	console.log(
		`  ${colors.bold('API Key:')} ${
			colors.green(createProjectData.anthropicApiKey ? 'Set in project config' : 'Not set in project config')
		}`,
	);
	console.log(`  ${colors.bold('Using TLS Certificate:')} ${colors.green(useTlsCert ? 'Yes' : 'No')}`);

	console.log(`\n${colors.bold('Configuration Instructions:')}`);
	console.log('1. To modify project-level config:');
	console.log(`   Use ${colors.bold.green(`'${globalConfig.bbExeName} config set --project <key> <value>'`)}`);
	console.log('   OR - manually edit the .bb/config.yaml file in your project directory');
	console.log('2. To modify system/user level config:');
	console.log(`   Use ${colors.bold.green(`'${globalConfig.bbExeName} config set --global <key> <value>'`)}`);
	console.log('   OR - manually edit the config.yaml file in your user home directory');
	console.log('   (usually ~/.config/bb/config.yaml on Unix-like systems)');
	console.log('3. To view the current config:');
	console.log(`   Use ${colors.bold.green(`'${globalConfig.bbExeName} config view'`)}`);
	console.log(
		`\n${
			colors.bold('Note:')
		} Your Anthropic API key is stored in configuration. Ensure to keep your config files secure.`,
	);
	console.log(
		`\nTo start using BB, try running: ${colors.bold.green(`'${globalConfig.bbExeName} start'`)} or ${
			colors.bold.green(`'${globalConfig.bbExeName} chat'`)
		}`,
	);
}

//async function validateAnthropicApiKey(key: string): Promise<{ isValid: boolean; message: string }> {
function validateAnthropicApiKey(key: string): { isValid: boolean; message: string } {
	//console.log(`Validating Anthropic API key: ${key}`);

	// Basic format check (this is a placeholder and may not reflect actual Anthropic API key format)
	const keyRegex = /^sk-[-_a-zA-Z0-9]{48,}$/;

	if (!key.match(keyRegex)) {
		//logger.debug('API key validation failed: Invalid format');
		return {
			isValid: false,
			message: 'Invalid API key format. It should start with "sk-" followed by alphanumeric characters.',
		};
	}

	// TODO: Implement actual API call to validate the key
	// For now, we'll assume the key is valid if it matches the format
	//logger.debug('API key validation passed (placeholder)');
	return {
		isValid: true,
		message: 'API key format is valid. Note: Actual validation against Anthropic API is not implemented yet.',
	};
}

export const init = new Command()
	.name('init')
	.description('Initialize BB in the current directory')
	.action(async () => {
		const startDir = Deno.cwd();
		const workingRoot = startDir; //await getWorkingRootFromStartDir(startDir);
		//const projectId = await getProjectId(workingRoot);

		try {
			console.log(`${colors.bold('Initializing BB for: ')} ${colors.green(workingRoot)}`);

			// Create or update config with wizard answers and project info
			const configManager = await getConfigManager();
			await configManager.ensureGlobalConfig();

			// Run the wizard
			const createProjectData = await runWizard(workingRoot);

			const dataSourceRegistry = await getDataSourceRegistry();
			const provider = dataSourceRegistry.getProvider('filesystem', 'bb');
			if (!provider) throw new Error('Could not load provider');

			const primaryDsConnection = dataSourceRegistry.createConnection(
				provider,
				'local',
				{ dataSourceRoot: workingRoot },
				{ isPrimary: true },
			);

			const projectPersistenceManager = await getProjectPersistenceManager();
			const projectData = await projectPersistenceManager.createProject({
				...createProjectData,
				//primaryDataSourceRoot: workingRoot,
				dsConnections: [
					primaryDsConnection,
				],
			});

			// Verify that API key is set either in user config or project config
			const finalGlobalConfig = await configManager.getGlobalConfig();
			const projectId = projectData.projectId; //await getProjectId(workingRoot);
			//await configManager.ensureLatestProjectConfig(projectId);
			const finalProjectConfig = projectId ? await configManager.getProjectConfig(projectId) : undefined;

			if (
				!finalGlobalConfig.api?.llmProviders?.anthropic?.apiKey &&
				!finalProjectConfig?.api?.llmProviders?.anthropic?.apiKey
			) {
				throw new Error(
					'Anthropic API key is required. Please set it in either user or project configuration.',
				);
			}

			let useTlsCert = createProjectData.useTls ?? true;
			const certFileName = finalGlobalConfig.api.tls?.certFile || 'localhost.pem';
			if (useTlsCert && !await certificateFileExists(certFileName)) {
				const domain = finalGlobalConfig.api.hostname || 'localhost';
				const validityDays = 365;
				const certCreated = await generateCertificate(domain, validityDays);
				if (!certCreated) {
					console.warn(
						`${colors.bold.yellow('Warning:')} ${colors.yellow('Could not create TLS certificate')}\n` +
							`${colors.yellow('TLS will be disabled for the API server.')}`,
					);
					// Continue without cert - we'll set apiUseTls to false
					await configManager.updateGlobalConfig({
						api: {
							...finalGlobalConfig.api,
							tls: { ...finalGlobalConfig.api.tls, useTls: false },
						},
					});
					useTlsCert = false;

					//console.log(`  ${colors.bold.read('No TLS certificate exists and could not be created.')}`);
					//throw new Error(
					//	'No TLS certificate exists and could not be created.',
					//);
				}
			}

			//logger.debug('Printing project details...');
			await printProjectDetails(
				createProjectData.name,
				//createProjectData.type,
				createProjectData,
				useTlsCert,
			);

			//logger.info('BB initialization complete');
		} catch (error) {
			logger.error(`Error during BB initialization: ${(error as Error).message}`);
			if (error instanceof Deno.errors.PermissionDenied) {
				console.error('Error: Permission denied. Please check your file system permissions and try again.');
			} else if (error instanceof Deno.errors.NotFound) {
				console.error(
					"Error: File or directory not found. Please ensure you're in the correct directory and try again.",
				);
			} else if (error instanceof Error && error.message.includes('API key')) {
				console.error('Error: Invalid API key. Please check your Anthropic API key and try again.');
			} else if (error instanceof Error && error.message.includes('No TLS certificate')) {
				console.error('Error: No TLS certificate exists and could not be created.');
			} else {
				console.error('An unexpected error occurred. Please check the logs for more information.');
			}
			Deno.exit(1);
		}
	});
