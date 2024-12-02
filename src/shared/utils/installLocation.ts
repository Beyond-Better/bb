import { InstallLocationType } from '../types/version.types.ts';

/**
 * Detects whether BB is installed in a system location or user directory
 * @returns Promise<InstallLocationType> 'system' or 'user'
 */
export async function detectInstallLocation(): Promise<InstallLocationType> {
	try {
		// Get the path to the bb executable
		const bbPath = await Deno.realPath(Deno.execPath());

		// Check if the path starts with /usr/local/bin or C:\Program Files
		const isSystemPath = bbPath.startsWith('/usr/local/bin') ||
			bbPath.startsWith('C:\\Program Files') ||
			bbPath.startsWith('/opt/');

		// If not in system path, check if in user directory
		const isUserPath = bbPath.includes('/.bb/') || // Unix-like
			bbPath.includes('\\.bb\\'); // Windows

		// If neither, check if the directory is writable
		if (!isSystemPath && !isUserPath) {
			try {
				const testFile = `${bbPath}.test`;
				await Deno.writeTextFile(testFile, '');
				await Deno.remove(testFile);
				return 'user'; // Directory is writable
			} catch (_error) {
				//console.error('Error with write test:', error);
				return 'system'; // Directory is not writable
			}
		}

		return isSystemPath ? 'system' : 'user';
	} catch (error) {
		console.error('Error detecting install location:', error);
		return 'system'; // Default to system if detection fails
	}
}

/**
 * Checks if automatic updates are possible based on installation location and permissions
 * @returns Promise<boolean>
 */
export async function canAutoUpdate(): Promise<boolean> {
	try {
		const location = await detectInstallLocation();
		if (location === 'system') {
			return false; // Never allow auto-update for system installations
		}

		// For user installations, verify we can write to the directory
		const bbPath = await Deno.realPath(Deno.execPath());
		const testFile = `${bbPath}.test`;
		try {
			await Deno.writeTextFile(testFile, '');
			await Deno.remove(testFile);
			return true;
		} catch {
			return false;
		}
	} catch (error) {
		console.error('Error checking auto-update capability:', error);
		return false; // Default to false for safety
	}
}
