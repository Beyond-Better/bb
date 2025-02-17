#!/bin/sh

# Set default destination directory
# DEST_DIR="${1:-/usr/local/bin}"
DEST_DIR="${1:-${HOME}/.bb/bin}"

deno task build

# Copy build files to the specified destination directory
cp build/bb build/bb-api build/bb-bui "$DEST_DIR"

echo "Installation complete. Files copied to $DEST_DIR"