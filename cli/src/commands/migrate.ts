import { Command } from 'cliffy/command';
import { logger } from 'shared/logger.ts';
import { ensureUserInstallLocation, getCurrentInstallLocation } from 'shared/install.ts';
import { dirname, join } from '@std/path';
import { copy, exists } from '@std/fs';

async function detectShellProfile(): Promise<string> {
	const shell = Deno.env.get('SHELL');
	const home = Deno.env.get('HOME') || '~';

	if (!shell) {
		return join(home, '.profile');
	}

	const shellName = shell.split('/').pop();
	switch (shellName) {
		case 'bash': {
			const bashProfile = join(home, '.bash_profile');
			return await exists(bashProfile) ? bashProfile : join(home, '.bashrc');
		}
		case 'zsh':
			return join(home, '.zshrc');
		default:
			return join(home, '.profile');
	}
}

async function updatePath(profileFile: string, pathDir: string): Promise<void> {
	const pathLine = `export PATH="${pathDir}:$PATH"`;

	try {
		const content = await Deno.readTextFile(profileFile);
		if (!content.includes(pathLine)) {
			const update = `\n# Add BB to PATH\n${pathLine}\n`;
			await Deno.writeTextFile(profileFile, content + update);
			logger.info(`Added BB directory to PATH in ${profileFile}`);
			logger.info(`Please run: source ${profileFile}`);
		} else {
			logger.info(`BB directory already in PATH (${profileFile})`);
		}
	} catch (error) {
		logger.error(`Failed to update PATH: ${(error as Error).message}`);
	}
}

export const migrate = new Command()
	.name('migrate')
	.description('Migrate BB installation between system and user locations')
	.option('--to <location:string>', 'Target installation location', {
		required: true,
		default: 'user', // Only support system -> user for now
	})
	.option('--update-path', 'Update PATH in shell profile', {
		default: true,
	})
	.action(async ({ to, updatePath: shouldUpdatePath }) => {
		if (to !== 'user') {
			logger.error('Only migration to user installation is currently supported');
			Deno.exit(1);
		}

		const currentLocation = await getCurrentInstallLocation();
		if (currentLocation.type === 'user') {
			logger.info('Already using user installation');
			Deno.exit(0);
		}

		// Ensure user installation directory exists and is writable
		logger.info('Preparing user installation directory...');
		if (!await ensureUserInstallLocation()) {
			logger.error('Cannot create or write to user installation directory');
			Deno.exit(1);
		}

		// Get paths of current executables
		const bbPath = await Deno.realPath(Deno.execPath());
		const bbDir = dirname(bbPath);
		const isWindows = Deno.build.os === 'windows';
		const bbApiName = isWindows ? 'bb-api.exe' : 'bb-api';
		const bbName = isWindows ? 'bb.exe' : 'bb';

		// Construct source and target paths
		const userBinPath = join(Deno.env.get('HOME') || '~', '.bb', 'bin');
		const bbSourcePath = join(bbDir, bbName);
		const bbApiSourcePath = join(bbDir, bbApiName);
		const bbTargetPath = join(userBinPath, bbName);
		const bbApiTargetPath = join(userBinPath, bbApiName);

		try {
			logger.info(`Copying BB executables to ${userBinPath}...`);
			// Copy bb executable
			await copy(bbSourcePath, bbTargetPath, { overwrite: true });
			await Deno.chmod(bbTargetPath, 0o755);

			// Copy bb-api executable
			await copy(bbApiSourcePath, bbApiTargetPath, { overwrite: true });
			await Deno.chmod(bbApiTargetPath, 0o755);

			logger.info('Migration successful! Both bb and bb-api executables were copied.');
			logger.info('');

			let step = 1;
			logger.info('To complete the migration:');

			if (shouldUpdatePath) {
				const profileFile = await detectShellProfile();
				await updatePath(profileFile, userBinPath);
			} else {
				logger.info(`${step}. Add ${userBinPath} to your PATH if not already present`);
				logger.info('   For example, add this line to your shell profile:');
				logger.info(`   export PATH="${userBinPath}:$PATH"`);
				logger.info('');
				step++;

				logger.info(`${step}. Restart your terminal or reload your shell profile`);
				logger.info('');
				step++;
			}

			logger.info(`${step}. Verify the new installation with:`);
			logger.info('   which bb');
			logger.info('');
			step++;

			logger.info(`${step}. Once verified, you may remove the system installation`);
			logger.info('   (requires sudo):');
			logger.info('   sudo rm /usr/local/bin/bb /usr/local/bin/bb-api');
		} catch (error) {
			logger.error(`Migration failed: ${(error as Error).message}`);
			Deno.exit(1);
		}
	});
