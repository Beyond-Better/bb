#!/bin/bash

# Ensure we're in the project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "Error: This script is for macOS only"
    exit 1
fi

# First generate the PNG files
echo "Generating PNG icons..."
deno run --allow-read --allow-write scripts/generate_dui_icons.ts

# Check if the PNG generation was successful
if [ $? -ne 0 ]; then
    echo "Error: PNG icon generation failed"
    exit 1
fi

ICON_DIR="dui/src-tauri/icons"
ICONSET_DIR="$ICON_DIR/icon.iconset"

# Create iconset directory
echo "Creating iconset directory..."
mkdir -p "$ICONSET_DIR"

# Copy and rename files according to Apple's iconset format
echo "Preparing iconset..."
cp "$ICON_DIR/mac-16x16.png" "$ICONSET_DIR/icon_16x16.png"
cp "$ICON_DIR/mac-32x32.png" "$ICONSET_DIR/icon_16x16@2x.png"
cp "$ICON_DIR/mac-32x32.png" "$ICONSET_DIR/icon_32x32.png"
cp "$ICON_DIR/mac-64x64.png" "$ICONSET_DIR/icon_32x32@2x.png"
cp "$ICON_DIR/mac-128x128.png" "$ICONSET_DIR/icon_128x128.png"
cp "$ICON_DIR/mac-256x256.png" "$ICONSET_DIR/icon_128x128@2x.png"
cp "$ICON_DIR/mac-256x256.png" "$ICONSET_DIR/icon_256x256.png"
cp "$ICON_DIR/mac-512x512.png" "$ICONSET_DIR/icon_256x256@2x.png"
cp "$ICON_DIR/mac-512x512.png" "$ICONSET_DIR/icon_512x512.png"
cp "$ICON_DIR/mac-1024x1024.png" "$ICONSET_DIR/icon_512x512@2x.png"

# Generate ICNS file
echo "Generating ICNS file..."
iconutil -c icns "$ICONSET_DIR"

# Check if ICNS generation was successful
if [ $? -eq 0 ]; then
    echo "ICNS file generated successfully at $ICON_DIR/icon.icns"
    
    # Clean up temporary iconset directory
    rm -rf "$ICONSET_DIR"
    
    # Clean up temporary mac-*.png files
    rm "$ICON_DIR"/mac-*.png
    
    echo "Cleaned up temporary files"
else
    echo "Error: ICNS generation failed"
    exit 1
fi

echo "Icon generation complete!"