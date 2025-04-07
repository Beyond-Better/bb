#!/usr/bin/env -S deno run --allow-run --allow-read

import { exists } from "@std/fs";
import { join } from "@std/path";

interface VerificationResult {
  name: string;
  status: "success" | "warning" | "error";
  message: string;
}

async function checkCommand(command: string): Promise<boolean> {
  try {
    const process = new Deno.Command(command, { args: ["--version"] });
    const { success } = await process.output();
    return success;
  } catch {
    return false;
  }
}

async function verifySetup(): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];

  // Check required tools
  const tools = [
    { command: "cargo", name: "Rust/Cargo" },
    { command: "node", name: "Node.js" },
    { command: "npm", name: "npm" },
    { command: "deno", name: "Deno" },
  ];

  for (const tool of tools) {
    const isInstalled = await checkCommand(tool.command);
    results.push({
      name: tool.name,
      status: isInstalled ? "success" : "error",
      message: isInstalled 
        ? `${tool.name} is installed`
        : `${tool.name} is not installed - Required for development`,
    });
  }

  // Check platform-specific tools
  if (Deno.build.os === "windows") {
    const hasImageMagick = await checkCommand("magick");
    results.push({
      name: "ImageMagick",
      status: hasImageMagick ? "success" : "warning",
      message: hasImageMagick
        ? "ImageMagick is installed"
        : "ImageMagick is not installed - Required for Windows icon generation",
    });
  }

  // Check project structure
  const requiredDirs = [
    "dui/src",
    "dui/src-tauri",
    "dui/src-tauri/src",
    "dui/src-tauri/icons",
  ];

  for (const dir of requiredDirs) {
    const dirExists = await exists(dir);
    results.push({
      name: `Directory: ${dir}`,
      status: dirExists ? "success" : "error",
      message: dirExists
        ? `${dir} exists`
        : `${dir} is missing - Required for project structure`,
    });
  }

  // Check configuration files
  const configFiles = [
    "dui/package.json",
    "dui/tsconfig.json",
    "dui/vite.config.ts",
    "dui/tailwind.config.js",
    "dui/src-tauri/Cargo.toml",
    "dui/src-tauri/tauri.conf.json",
  ];

  for (const file of configFiles) {
    const fileExists = await exists(file);
    results.push({
      name: `Config: ${file}`,
      status: fileExists ? "success" : "error",
      message: fileExists
        ? `${file} exists`
        : `${file} is missing - Required configuration file`,
    });
  }

  // Check source icon
  const sourceIcon = "bui/src/static/logo.png";
  const hasSourceIcon = await exists(sourceIcon);
  results.push({
    name: "Source Icon",
    status: hasSourceIcon ? "success" : "error",
    message: hasSourceIcon
      ? "Source icon exists"
      : "Source icon is missing - Required for icon generation",
  });

  return results;
}

// Run verification and display results
console.log("Verifying BB Desktop UI development setup...\n");

const results = await verifySetup();
let hasErrors = false;

for (const result of results) {
  const icon = result.status === "success" ? "✅" :
              result.status === "warning" ? "⚠️" : "❌";
  
  console.log(`${icon} ${result.name}: ${result.message}`);
  
  if (result.status === "error") {
    hasErrors = true;
  }
}

console.log("\nVerification complete!");

if (hasErrors) {
  console.log("\n❌ Some checks failed. Please fix the issues above before proceeding.");
  Deno.exit(1);
} else {
  console.log("\n✅ Development environment is properly configured!");
}