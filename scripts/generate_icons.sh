#!/bin/bash

# Ensure we're in the project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

# Check if deno is installed
if ! command -v deno &> /dev/null; then
    echo "Error: deno is not installed"
    echo "Please install deno first: https://deno.land/#installation"
    exit 1
fi

# Create the icons directory if it doesn't exist
mkdir -p dui/src-tauri/icons

# Run the icon generation script
echo "Generating icons..."
deno run --allow-read --allow-write scripts/generate_dui_icons.ts

# Check if the generation was successful
if [ $? -eq 0 ]; then
    echo "Icons generated successfully!"
    echo "You can find the icons in dui/src-tauri/icons/"
else
    echo "Error: Icon generation failed"
    exit 1
fi