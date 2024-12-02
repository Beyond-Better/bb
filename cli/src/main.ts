import { Command } from 'cliffy/command/mod.ts';
import { ConfigManager } from 'shared/configManager.ts';

import { init } from './commands/init.ts';
import { apiStart } from './commands/apiStart.ts';
import { apiStop } from './commands/apiStop.ts';
import { apiStatus } from './commands/apiStatus.ts';
import { apiRestart } from './commands/apiRestart.ts';
import { conversationChat } from './commands/conversationChat.ts';
import { conversationList } from './commands/conversationList.ts';
import { viewLogs } from './commands/viewLogs.ts';
import { config as configCommand } from './commands/config.ts';
import { secure } from './commands/secure.ts';
import { upgrade } from './commands/upgrade.ts';
import { migrate } from './commands/migrate.ts';
import { doctor } from './commands/doctor.ts';
//import { logger } from 'shared/logger.ts';

const globalConfig = await ConfigManager.globalConfig();
//logger.debug('CLI Config:', globalConfig.cli);

const cli = new Command()
	.name(globalConfig.bbExeName) // 'bb' or 'bb.exe'
	.version(globalConfig.version as string)
	.description('CLI tool for BB')
	.command('init', init)
	//
	// conversation commands
	.command('chat', conversationChat)
	.command('list', conversationList)
	// list should be sub-commnds of chat
	// but only the 'chat' command has --prompt - does Cliffy support a sub-command of `` (empty) command name to use as default??
	//
	// log commands
	.command('logs', viewLogs)
	// the api commands are all a group, but they should have top-level entries
	.command('start', apiStart)
	.command('stop', apiStop)
	.command('status', apiStatus)
	.command('restart', apiRestart)
	.command('config', configCommand)
	.command('secure', secure)
	.command('upgrade', upgrade)
	.command('migrate', migrate)
	.command('doctor', doctor);

export const main = async () => {
	await cli.parse(Deno.args);
};

if (import.meta.main) {
	main();
}
