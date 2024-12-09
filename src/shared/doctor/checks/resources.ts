import { DiagnosticResult } from '../types.ts';
import { ConfigManagerV2 } from 'shared/config/v2/configManager.ts';
import { logger } from '../../logger.ts';
import { join } from '@std/path';
import { getGlobalConfigDir } from '../../dataDir.ts';
import { exists } from '@std/fs';

interface DiskSpace {
	total: number;
	free: number;
	used: number;
}

interface ConversationStats {
	count: number;
	totalSize: number;
	largestConversation: {
		id: string;
		size: number;
	};
}

/**
 * Gets available disk space using Deno.statfs
 * Falls back to checking specific directory if statfs fails
 */
async function getDiskSpace(path: string): Promise<DiskSpace> {
	try {
		// Use Deno.statfs when available
		const stats = await Deno.statfs(path);
		return {
			total: stats.blocks * stats.bsize,
			free: stats.bfree * stats.bsize,
			used: (stats.blocks - stats.bfree) * stats.bsize,
		};
	} catch (error) {
		logger.debug('Deno.statfs not available, using directory size check:', error);

		// Fallback to checking directory size
		let totalSize = 0;
		try {
			for await (const entry of Deno.readDir(path)) {
				if (entry.isFile) {
					const stat = await Deno.stat(join(path, entry.name));
					totalSize += stat.size;
				}
			}

			// Estimate total space as 10x current usage
			// This is a rough estimate when we can't get actual disk space
			return {
				total: totalSize * 10,
				free: totalSize * 9,
				used: totalSize,
			};
		} catch (dirError) {
			logger.error('Failed to check directory size:', dirError);
			throw new Error('Could not determine disk space usage');
		}
	}
}

/**
 * Gets statistics about stored conversations
 */
async function getConversationStats(conversationsDir: string): Promise<ConversationStats> {
	const stats: ConversationStats = {
		count: 0,
		totalSize: 0,
		largestConversation: {
			id: '',
			size: 0,
		},
	};

	try {
		if (!await exists(conversationsDir)) {
			return stats;
		}

		for await (const entry of Deno.readDir(conversationsDir)) {
			if (!entry.isFile || !entry.name.endsWith('.json')) continue;

			const path = join(conversationsDir, entry.name);
			const fileStat = await Deno.stat(path);

			stats.count++;
			stats.totalSize += fileStat.size;

			if (fileStat.size > stats.largestConversation.size) {
				stats.largestConversation = {
					id: entry.name.replace('.json', ''),
					size: fileStat.size,
				};
			}
		}
	} catch (error) {
		logger.error('Failed to get conversation stats:', error);
		throw new Error('Could not analyze conversations: ' + error.message);
	}

	return stats;
}

/**
 * Checks if a directory is writable by attempting to create and remove a test file
 */
async function isDirectoryWritable(dir: string): Promise<boolean> {
	const testFile = join(dir, '.bb-write-test');
	try {
		await Deno.writeTextFile(testFile, 'test');
		await Deno.remove(testFile);
		return true;
	} catch {
		return false;
	}
}

export async function checkResources(): Promise<DiagnosticResult[]> {
	const results: DiagnosticResult[] = [];

	try {
		const configManager = await ConfigManagerV2.getInstance();
		const globalConfig = await configManager.getGlobalConfig();

		const globalDir = await getGlobalConfigDir();

		// Check disk space
		const diskSpace = await getDiskSpace(globalDir);
		const freeSpaceGB = diskSpace.free / (1024 * 1024 * 1024);
		const usedSpaceGB = diskSpace.used / (1024 * 1024 * 1024);

		// Warn if less than 1GB free
		if (freeSpaceGB < 1) {
			results.push({
				category: 'resources',
				status: 'warning',
				message: 'Low disk space',
				details: `Only ${freeSpaceGB.toFixed(2)}GB free space available`,
			});
		}

		// Check conversations directory
		const conversationsDir = join(globalDir, 'conversations');
		const convStats = await getConversationStats(conversationsDir);

		// Warn if total conversation size is over 1GB
		const totalSizeGB = convStats.totalSize / (1024 * 1024 * 1024);
		if (totalSizeGB > 1) {
			results.push({
				category: 'resources',
				status: 'warning',
				message: 'Large conversation storage',
				details: `Total size: ${
					totalSizeGB.toFixed(2)
				}GB\nLargest conversation: ${convStats.largestConversation.id} (${
					(convStats.largestConversation.size / (1024 * 1024)).toFixed(2)
				}MB)`,
				fix: {
					description: 'Consider archiving or removing old conversations',
					command: 'bb conversation clean',
					apiEndpoint: '/api/v1/conversations/clean',
				},
			});
		}

		// Check directory permissions
		const isWritable = await isDirectoryWritable(globalDir);
		if (!isWritable) {
			results.push({
				category: 'resources',
				status: 'error',
				message: 'BB directory not writable',
				details: `Cannot write to ${globalDir}`,
				fix: {
					description: 'Fix directory permissions',
					requiresElevated: true,
				},
			});
		}

		// Add OK result if no issues found
		if (results.length === 0) {
			results.push({
				category: 'resources',
				status: 'ok',
				message: 'Resource usage is healthy',
				details: `Free space: ${freeSpaceGB.toFixed(2)}GB\nConversations: ${convStats.count} (${
					totalSizeGB.toFixed(2)
				}GB total)`,
			});
		}
	} catch (error) {
		logger.error('Failed to check resources:', error);
		results.push({
			category: 'resources',
			status: 'error',
			message: 'Failed to check resource usage',
			details: error.message,
		});
	}

	return results;
}
