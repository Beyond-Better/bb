// Creates an unsigned version of tauri.conf.json for development
import { copy } from "https://deno.land/std/fs/copy.ts";
import { exists } from "https://deno.land/std/fs/exists.ts";

const sourceConfig = "src-tauri/tauri.conf.json";
const devConfig = "src-tauri/tauri.dev.conf.json";

// Read the source config
const config = JSON.parse(await Deno.readTextFile(sourceConfig));

// Modify for unsigned builds
config.bundle.macOS.signingIdentity = null;

// Write the modified config
await Deno.writeTextFile(devConfig, JSON.stringify(config, null, 2));

// Log success
console.log(`Created unsigned config at ${devConfig}`);