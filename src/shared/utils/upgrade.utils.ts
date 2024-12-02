import { join } from '@std/path';
import { compare, parse } from '@std/semver';
import { copy, exists } from '@std/fs';
import { ConfigManager } from 'shared/configManager.ts';
import { getVersionInfo } from 'shared/version.ts';
import { logger } from 'shared/logger.ts';
import { ensureUserInstallLocation, getCurrentInstallLocation, type InstallLocation } from 'shared/install.ts';

interface GithubRelease {
	tag_name: string;
	assets: Array<{
		name: string;
		browser_download_url: string;
	}>;
}

export interface UpgradeResult {
	success: boolean;
	error?: string;
	currentVersion: string;
	latestVersion: string;
	needsUpdate: boolean;
	needsSudo: boolean;
}

export async function checkForUpdates(): Promise<UpgradeResult> {
	const { version: currentVersion, canAutoUpdate } = await getVersionInfo();
	const installLocation = await getCurrentInstallLocation();

	if (!canAutoUpdate) {
		//logger.error(`Checking for updates - auto update is not possible`);
		return {
			success: false,
			error: 'System-wide installation requires manual upgrade with sudo',
			currentVersion,
			latestVersion: currentVersion,
			needsUpdate: false,
			needsSudo: true,
		};
	}

	try {
		const latestRelease = await fetchLatestRelease();
		const latestVersion = latestRelease.tag_name.replace(/^v/, '');

		return {
			success: true,
			currentVersion,
			latestVersion,
			needsUpdate: latestVersion > currentVersion,
			needsSudo: installLocation.type === 'system',
		};
	} catch (error) {
		logger.error(`Checking for updates had an error: ${error as Error}`);
		return {
			success: false,
			error: (error as Error).message,
			currentVersion,
			latestVersion: currentVersion,
			needsUpdate: false,
			needsSudo: installLocation.type === 'system',
		};
	}
}

export async function performUpgrade(): Promise<UpgradeResult> {
	const { version: currentVersion, canAutoUpdate } = await getVersionInfo();
	const installLocation = await getCurrentInstallLocation();

	// Check if we need sudo for system installation
	if (!canAutoUpdate) {
		return {
			success: false,
			error: 'System-wide installation requires manual upgrade with sudo',
			currentVersion,
			latestVersion: 'unknown',
			needsUpdate: false,
			needsSudo: true,
		};
	}

	// Ensure user installation directory exists and is writable
	if (!await ensureUserInstallLocation()) {
		return {
			success: false,
			error: 'Cannot create or write to user installation directory',
			currentVersion: (await ConfigManager.globalConfig()).version as string,
			latestVersion: 'unknown',
			needsUpdate: false,
			needsSudo: false,
		};
	}

	try {
		const latestRelease = await fetchLatestRelease();
		const latestVersion = latestRelease.tag_name.replace(/^v/, '');
		// currentVersion already obtained from getVersionInfo()

		// Compare versions using SemVer
		const current = parse(currentVersion);
		const latest = parse(latestVersion);

		// Don't allow downgrades
		if (compare(latest, current) <= 0) {
			return {
				success: false,
				error: 'Already at latest version',
				currentVersion,
				latestVersion,
				needsUpdate: false,
				needsSudo: false,
			};
		}

		// Download and install the new version
		await downloadAndInstall(latestRelease);

		return {
			success: true,
			currentVersion,
			latestVersion,
			needsUpdate: false, // We just updated
			needsSudo: false,
		};
	} catch (error) {
		return {
			success: false,
			error: (error as Error).message,
			currentVersion: (await ConfigManager.globalConfig()).version as string,
			latestVersion: 'unknown',
			needsUpdate: false,
			needsSudo: false,
		};
	}
}

async function fetchLatestRelease(): Promise<GithubRelease> {
	const response = await fetch('https://api.github.com/repos/Beyond-Better/bb/releases/latest');
	if (!response.ok) {
		throw new Error(`Failed to fetch latest release: ${response.statusText}`);
	}
	return await response.json();
}

async function backupCurrentInstallation(installLocation: InstallLocation): Promise<string> {
	const backupDir = await Deno.makeTempDir();
	try {
		// Copy current binaries to backup
		const binaries = ['bb', 'bb-api'];
		for (const binary of binaries) {
			const sourcePath = join(installLocation.path, binary);
			const backupPath = join(backupDir, binary);
			if (await exists(sourcePath)) {
				await copy(sourcePath, backupPath);
				await Deno.chmod(backupPath, 0o755);
			}
		}
		return backupDir;
	} catch (error) {
		// Clean up on error
		try {
			await Deno.remove(backupDir, { recursive: true });
		} catch {}
		throw error;
	}
}

async function restoreFromBackup(backupDir: string, installLocation: InstallLocation): Promise<void> {
	try {
		// Restore binaries from backup
		const binaries = ['bb', 'bb-api'];
		for (const binary of binaries) {
			const backupPath = join(backupDir, binary);
			const targetPath = join(installLocation.path, binary);
			if (await exists(backupPath)) {
				await copy(backupPath, targetPath);
				await Deno.chmod(targetPath, 0o755);
			}
		}
	} finally {
		// Clean up backup directory
		try {
			await Deno.remove(backupDir, { recursive: true });
		} catch {}
	}
}

async function downloadAndInstall(release: GithubRelease): Promise<void> {
	const config = await ConfigManager.globalConfig();
	const installLocation = await getCurrentInstallLocation();

	// Determine platform-specific asset name
	const os = Deno.build.os === 'windows'
		? 'windows'
		: Deno.build.os === 'darwin'
		? 'apple-darwin'
		: 'unknown-linux-gnu';
	const arch = Deno.build.arch;
	const version = release.tag_name;

	// Find matching asset
	const assetName = `bb-${arch}-${os}-${version}.tar.gz`;
	const asset = release.assets.find((a) => a.name === assetName);
	if (!asset) {
		throw new Error(`No compatible release found for ${arch}-${os}`);
	}

	logger.info(`Downloading ${asset.name}...`);

	// Create a temporary directory
	// Create backup of current installation
	let backupDir: string | undefined;
	try {
		backupDir = await backupCurrentInstallation(installLocation);
		logger.info('Created backup of current installation');
	} catch (error) {
		logger.error('Failed to create backup:', error);
		throw new Error('Failed to create backup before update');
	}

	const tempDir = await Deno.makeTempDir();
	const tarballPath = join(tempDir, 'bb.tar.gz');

	try {
		// Download the asset
		const response = await fetch(asset.browser_download_url);
		if (!response.ok) {
			throw new Error(`Failed to download: ${response.statusText}`);
		}

		// Save the tarball
		const fileData = new Uint8Array(await response.arrayBuffer());
		await Deno.writeFile(tarballPath, fileData);

		// Extract the tarball
		const command = new Deno.Command('tar', {
			args: ['xzf', tarballPath, '-C', tempDir],
		});
		const { success } = await command.output();
		if (!success) {
			throw new Error('Failed to extract release archive');
		}

		// Make binaries executable
		const binaries = ['bb', 'bb-api'];
		for (const binary of binaries) {
			const binaryPath = join(tempDir, binary);
			await Deno.chmod(binaryPath, 0o755);

			// Move to installation location
			const targetPath = join(installLocation.path, binary);
			await Deno.rename(binaryPath, targetPath);
		}

		// // Handle BB Manager installation
		// if (Deno.build.os === 'darwin') {
		// 	const appSource = join(tempDir, 'BB Manager.app');
		// 	if (await exists(appSource)) {
		// 		const appTarget = '/Applications/BB Manager.app';
		// 		// Note: This will fail without sudo, which is expected
		// 		try {
		// 			await copy(appSource, appTarget, { overwrite: true });
		// 		} catch {
		// 			logger.info('Note: BB Manager.app update requires sudo');
		// 		}
		// 	}
		// } else {
		// 	const scriptSource = join(tempDir, 'bb-manager.sh');
		// 	if (await exists(scriptSource)) {
		// 		const scriptTarget = join(installLocation.path, 'bb-manager.sh');
		// 		await Deno.rename(scriptSource, scriptTarget);
		// 		await Deno.chmod(scriptTarget, 0o755);
		// 	}
		// }

		logger.info('New version installed successfully');
	} catch (error) {
		// Clean up temp directory
		try {
			await Deno.remove(tempDir, { recursive: true });
		} catch {}

		// Restore from backup if it exists
		if (backupDir) {
			logger.info('Update failed, restoring from backup...');
			await restoreFromBackup(backupDir, installLocation);
			logger.info('Restored previous version');
		}

		throw error;
	}

	// Clean up temp and backup directories on success
	try {
		await Deno.remove(tempDir, { recursive: true });
		if (backupDir) {
			await Deno.remove(backupDir, { recursive: true });
		}
	} catch {}
}
