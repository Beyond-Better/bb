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

# Run the verification script
echo "Running development environment verification..."
deno run --allow-run --allow-read scripts/verify_dui_setup.ts

# Check the exit code
if [ $? -eq 0 ]; then
    echo "Verification completed successfully!"
else
    echo "Verification failed. Please fix the reported issues."
    exit 1
fi