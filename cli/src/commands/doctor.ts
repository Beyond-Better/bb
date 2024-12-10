import { Command } from 'cliffy/command/mod.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { Confirm } from 'cliffy/prompt/mod.ts';
import { DoctorService } from 'shared/doctor/doctorService.ts';
import { DiagnosticResult, DiagnosticStatus } from 'shared/doctor/types.ts';
import { logger } from 'shared/logger.ts';
//import { join } from '@std/path';

// Status icons and colors
const STATUS_FORMAT: Record<DiagnosticStatus, { icon: string; color: (str: string) => string }> = {
  ok: { icon: '✓', color: colors.green },
  warning: { icon: '⚠', color: colors.yellow },
  error: { icon: '✗', color: colors.red }
};

/**
 * Formats and displays a diagnostic result
 */
function displayResult(result: DiagnosticResult, verbose = false): void {
  const { icon, color } = STATUS_FORMAT[result.status];
  const status = color(result.status.toUpperCase().padEnd(7));
  
  console.log(`${icon} ${status} ${result.message}`);
  
  if (result.details) {
    const details = result.details.split('\n')
      .map((line:string) => '  ' + line)
      .join('\n');
    console.log(colors.dim(details));
  }

  if (result.fix) {
    console.log(colors.blue(`  Fix: ${result.fix.description}`));
    if (verbose && result.fix.command) {
      console.log(colors.dim(`  Command: ${result.fix.command}`));
    }
  }

  console.log(); // Empty line for readability
}

/**
 * Attempts to apply a fix for a diagnostic result
 */
async function applyFix(result: DiagnosticResult): Promise<boolean> {
  if (!result.fix?.command) {
    console.log(colors.yellow('No automatic fix available'));
    return false;
  }

  if (result.fix.requiresElevated) {
    console.log(colors.yellow('⚠ This fix requires elevated permissions'));
  }

  if (result.fix.requiresRestart) {
    console.log(colors.yellow('⚠ BB will need to be restarted after this fix'));
  }

  const proceed = await Confirm.prompt({
    message: `Apply fix: ${result.fix.description}?`,
    default: false
  });

  if (!proceed) {
    return false;
  }

  try {
    const cmd = result.fix.command.split(' ');
    const p = new Deno.Command(cmd[0], {
      args: cmd.slice(1)
    });
    
    const output = await p.output();
    
    if (output.success) {
      console.log(colors.green('✓ Fix applied successfully'));
      return true;
    } else {
      const error = new TextDecoder().decode(output.stderr);
      console.log(colors.red(`✗ Fix failed: ${error}`));
      return false;
    }
  } catch (error) {
    console.log(colors.red(`✗ Failed to apply fix: ${(error as Error).message}`));
    return false;
  }
}

/**
 * Saves diagnostic report to a file
 */
async function saveReport(report: unknown, filePath: string): Promise<void> {
  try {
    const json = JSON.stringify(report, null, 2);
    await Deno.writeTextFile(filePath, json);
    console.log(colors.green(`Report saved to ${filePath}`));
  } catch (error) {
    console.error(colors.red(`Failed to save report: ${(error as Error).message}`));
    throw error;
  }
}

export const doctor = new Command()
  .name('doctor')
  .description('Check BB system health and generate diagnostic reports')
  .option('-f, --fix', 'Attempt to fix identified issues')
  .option('-v, --verbose', 'Show detailed output')
  .option('--report', 'Generate a full diagnostic report')
  .option('--output <file:string>', 'Save report to file')
  .option('--no-tls', 'Skip TLS checks', { default: true })
  .option('--no-resources', 'Skip resource usage checks')
  .action(async (options) => {
    const service = new DoctorService();
    
    try {
      if (options.report) {
        // Generate and output full report
        const report = await service.generateReport(true);
        
        if (options.output) {
          await saveReport(report, options.output);
        } else {
          console.log(JSON.stringify(report, null, 2));
        }
        return;
      }

      // Run diagnostics
      console.log(colors.bold('Running BB diagnostics...\n'));

      const results = await service.runDiagnostics({
        includeTls: options.tls,
        includeApi: false // API check not needed for CLI
      });

      // Group results by category
      const categories = new Map<string, DiagnosticResult[]>();
      for (const result of results) {
        const category = result.category;
        if (!categories.has(category)) {
          categories.set(category, []);
        }
        categories.get(category)!.push(result);
      }

      // Display results by category
      for (const [category, categoryResults] of categories) {
        console.log(colors.bold(category.toUpperCase()));
        console.log(colors.dim('='.repeat(category.length)));
        
        for (const result of categoryResults) {
          displayResult(result, options.verbose);
        }
      }

      // Show summary
      const summary = {
        total: results.length,
        ok: results.filter(r => r.status === 'ok').length,
        warnings: results.filter(r => r.status === 'warning').length,
        errors: results.filter(r => r.status === 'error').length
      };

      console.log(colors.bold('\nSummary:'));
      console.log(`Total checks: ${summary.total}`);
      console.log(colors.green(`Passed: ${summary.ok}`));
      if (summary.warnings > 0) console.log(colors.yellow(`Warnings: ${summary.warnings}`));
      if (summary.errors > 0) console.log(colors.red(`Errors: ${summary.errors}`));

      // Handle fixes if requested
      if (options.fix && (summary.warnings > 0 || summary.errors > 0)) {
        console.log(colors.bold('\nApplying fixes:'));
        
        for (const result of results) {
          if (result.status !== 'ok' && result.fix) {
            console.log(colors.bold(`\n${result.message}`));
            await applyFix(result);
          }
        }
      }

      // Exit with error if there are any errors
      if (summary.errors > 0) {
        Deno.exit(1);
      }

    } catch (error) {
      logger.error('Doctor command failed:', error);
      console.error(colors.red(`Error: ${(error as Error).message}`));
      Deno.exit(1);
    }
  });