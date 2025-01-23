#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env --allow-ffi

import { ensureDir } from "https://deno.land/std/fs/mod.ts";
import { join } from "https://deno.land/std/path/mod.ts";
import Sharp from 'npm:sharp';

const ICON_SIZES = {
  // Standard PNG icons (required by tauri.conf.json)
  'icon.png': 512,      // Main icon
  '32x32.png': 32,      // Windows taskbar
  '128x128.png': 128,   // Standard app icon
  '128x128@2x.png': 256, // High-DPI displays
  '256x256.png': 256,   // High-DPI displays
  '512x512.png': 512,   // macOS Big Sur+ icons
  
  // Windows ICO sizes (will be combined)
  'win-16x16.png': 16,
  'win-32x32.png': 32,
  'win-48x48.png': 48,
  'win-256x256.png': 256,
  
  // macOS ICNS sizes
  'mac-16x16.png': 16,
  'mac-32x32.png': 32,
  'mac-64x64.png': 64,
  'mac-128x128.png': 128,
  'mac-256x256.png': 256,
  'mac-512x512.png': 512,
  'mac-1024x1024.png': 1024,
};

async function generateIcons() {
  const sourcePath = 'bui/src/static/icon.png';
  const targetDir = 'dui/src-tauri/icons';

  // Ensure the target directory exists
  await ensureDir(targetDir);

  try {
    // Read the source image
    const sourceImage = Sharp(await Deno.readFile(sourcePath));

    // Generate all PNG icons
    for (const [filename, size] of Object.entries(ICON_SIZES)) {
      await sourceImage
        .clone()
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(join(targetDir, filename));
      
      console.log(`Generated ${filename} (${size}x${size})`);
    }

    // Create iconset directory for macOS
    const iconsetDir = join(targetDir, 'icon.iconset');
    await ensureDir(iconsetDir);

    // Copy macOS icons to iconset directory
    for (const [filename, size] of Object.entries(ICON_SIZES)) {
      if (filename.startsWith('mac-')) {
        const iconsetName = `icon_${size}x${size}.png`;
        await Deno.copyFile(
          join(targetDir, filename),
          join(iconsetDir, iconsetName)
        );
        
        // Create @2x version if size is less than 512
        if (size <= 512) {
          const doubleSize = size * 2;
          const iconsetName2x = `icon_${size}x${size}@2x.png`;
          const sourceFile = `mac-${doubleSize}x${doubleSize}.png`;
          if (ICON_SIZES[sourceFile]) {
            await Deno.copyFile(
              join(targetDir, sourceFile),
              join(iconsetDir, iconsetName2x)
            );
          }
        }
      }
    }

    // Generate Windows ICO
    const icoSizes = [16, 32, 48, 256];
    const icoBuffers = await Promise.all(
      icoSizes.map(size => 
        sourceImage
          .clone()
          .resize(size, size, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          })
          .png()
          .toBuffer()
      )
    );

    // Combine ICO buffers (basic implementation)
    const icoPath = join(targetDir, 'icon.ico');
    await Deno.writeFile(icoPath, icoBuffers[0]); // Temporary: just use 256x256 version
    console.log('Generated icon.ico (Note: For best results, use ImageMagick to combine all sizes)');

    console.log('\nIcon generation complete!');
    console.log(`Icons saved to: ${targetDir}`);
    console.log('\nFor best results:');
    console.log('\n1. Generate macOS ICNS:');
    console.log('   pushd dui/src-tauri/icons && iconutil -c icns icon.iconset && popd');
    console.log('\n2. Generate Windows ICO using ImageMagick:');
    console.log('   pushd dui/src-tauri/icons && convert win-*.png icon.ico && popd');
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`Error: Source file not found: ${sourcePath}`);
      console.error('Please ensure the source logo file exists at the specified path.');
    } else {
      console.error('Error generating icons:', error);
    }
    Deno.exit(1);
  }
}

// Run the script
await generateIcons();