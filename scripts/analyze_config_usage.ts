#!/usr/bin/env -S deno run --allow-read --allow-write

import { walk } from '@std/fs';
import { join, relative } from '@std/path';

interface ConfigUsage {
  file: string;
  line: number;
  type: 'read' | 'write';
  configPath: string[];
  context: string;
}

interface AnalysisResult {
  totalFiles: number;
  configFiles: number;
  usages: ConfigUsage[];
  patterns: {
    pattern: string;
    count: number;
  }[];
}

const CONFIG_PATTERNS = [
  'ConfigManager\\.',
  'config\\.',
  'fullConfig',
  'globalConfig',
  'projectConfig',
  '\\.api\\.',
  '\\.bui\\.',
  '\\.cli\\.',
  'usePromptCaching',
  'ignoreLLMRequestCache',
  'apiHostname',
  'apiPort',
  'apiUseTls'
];

const FILE_PATTERNS = [
  /\.tsx?$/,  // TypeScript files
  /\.jsx?$/   // JavaScript files
];

// Directories and files to ignore
const IGNORE_PATTERNS = [
  /playground/,
  /node_modules/,
  /configManager\.ts$/,
  /configSchema\.ts$/,
  /\.git\//,
  /\.bb\//,
  /dist\//,
  /build\//
];

function shouldIgnore(path: string): boolean {
  return IGNORE_PATTERNS.some(pattern => pattern.test(path));
}

async function findConfigUsage(content: string, filePath: string): Promise<ConfigUsage[]> {
  const usages: ConfigUsage[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for config patterns
    for (const pattern of CONFIG_PATTERNS) {
      const regex = new RegExp(pattern);
      if (regex.test(line)) {
        // Get context (surrounding lines)
        const start = Math.max(0, i - 2);
        const end = Math.min(lines.length, i + 3);
        const context = lines.slice(start, end).join('\n');

        // Determine if read or write
        const type = line.includes('=') || line.includes('set') ? 'write' : 'read';

        // Try to extract config path
        const configPath = extractConfigPath(line);

        usages.push({
          file: filePath,
          line: i + 1,
          type,
          configPath,
          context
        });
      }
    }
  }

  return usages;
}

function extractConfigPath(line: string): string[] {
  const path: string[] = [];
  
  // Match patterns like: config.api.hostname or fullConfig.api.port
  const matches = line.match(/(?:config|fullConfig|globalConfig)\.([a-zA-Z.]+)/);
  if (matches && matches[1]) {
    path.push(...matches[1].split('.'));
  }
  
  return path;
}

async function analyzeDirectory(dir: string): Promise<AnalysisResult> {
  const result: AnalysisResult = {
    totalFiles: 0,
    configFiles: 0,
    usages: [],
    patterns: CONFIG_PATTERNS.map(pattern => ({ pattern, count: 0 }))
  };

  // Walk through all files
  for await (const entry of walk(dir, {
    includeDirs: false,
    match: FILE_PATTERNS,
    skip: IGNORE_PATTERNS
  })) {
    // Double-check ignore patterns (in case walk skip doesn't catch all)
    if (shouldIgnore(entry.path)) {
      continue;
    }

    result.totalFiles++;
    
    const content = await Deno.readTextFile(entry.path);
    const relativePath = relative(dir, entry.path);
    
    // Check for config patterns
    let hasConfig = false;
    for (const pattern of CONFIG_PATTERNS) {
      const regex = new RegExp(pattern);
      if (regex.test(content)) {
        hasConfig = true;
        const patternResult = result.patterns.find(p => p.pattern === pattern);
        if (patternResult) {
          patternResult.count++;
        }
      }
    }
    
    if (hasConfig) {
      result.configFiles++;
      const usages = await findConfigUsage(content, relativePath);
      result.usages.push(...usages);
    }
  }

  return result;
}

async function generateReport(result: AnalysisResult): Promise<string> {
  const report = [];
  
  report.push('# Configuration Usage Analysis\n');
  
  report.push('## Summary');
  report.push(`- Total files analyzed: ${result.totalFiles}`);
  report.push(`- Files with config usage: ${result.configFiles}`);
  report.push(`- Total config usages found: ${result.usages.length}\n`);
  
  report.push('## Pattern Matches');
  for (const pattern of result.patterns) {
    if (pattern.count > 0) {
      report.push(`- ${pattern.pattern}: ${pattern.count} occurrences`);
    }
  }
  report.push('');
  
  report.push('## Detailed Usages\n');
  const byFile = new Map<string, ConfigUsage[]>();
  for (const usage of result.usages) {
    if (!byFile.has(usage.file)) {
      byFile.set(usage.file, []);
    }
    byFile.get(usage.file)!.push(usage);
  }
  
  // Sort files for consistent output
  const sortedFiles = Array.from(byFile.keys()).sort();
  
  for (const file of sortedFiles) {
    const usages = byFile.get(file)!;
    report.push(`### ${file}`);
    for (const usage of usages) {
      report.push(`- Line ${usage.line} (${usage.type})`);
      if (usage.configPath.length > 0) {
        report.push(`  Config path: ${usage.configPath.join('.')}`);
      }
      report.push('  Context:');
      report.push('  ```typescript');
      report.push(usage.context.split('\n').map(line => '  ' + line).join('\n'));
      report.push('  ```\n');
    }
  }

  report.push('\n## Ignored Patterns');
  report.push('The following patterns were ignored during analysis:');
  for (const pattern of IGNORE_PATTERNS) {
    report.push(`- ${pattern.toString()}`);
  }
  
  return report.join('\n');
}

// Main execution
if (import.meta.main) {
  try {
    const projectRoot = Deno.args[0] || Deno.cwd();
    console.log(`Analyzing directory: ${projectRoot}`);
    console.log('Ignoring patterns:', IGNORE_PATTERNS.map(p => p.toString()).join(', '));
    
    const result = await analyzeDirectory(projectRoot);
    const report = await generateReport(result);
    
    // Save report
    const reportPath = join(projectRoot, 'docs/development/config_migration/usage_analysis.md');
    await Deno.mkdir(join(projectRoot, 'docs/development/config_migration'), { recursive: true });
    await Deno.writeTextFile(reportPath, report);
    
    console.log(`Analysis complete. Report saved to: ${reportPath}`);
    console.log(`Found ${result.configFiles} files with configuration usage`);
    console.log(`Total of ${result.usages.length} configuration usages detected`);
  } catch (error) {
    console.error('Error:', error);
    Deno.exit(1);
  }
}