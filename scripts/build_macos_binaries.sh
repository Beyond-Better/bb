#!/bin/bash

set -e

# Check if running on macOS
if [[ "$(uname)" != "Darwin" ]]; then
    echo "This script must be run on macOS"
    exit 1
fi

# Set variables
BUILD_DIR="build"
TARGETS=("x86_64-apple-darwin" "aarch64-apple-darwin")

# Create build directory
mkdir -p $BUILD_DIR

# Build binaries for each target
for TARGET in "${TARGETS[@]}"; do
    echo "Building for $TARGET"

    # Build CLI
    echo "Building CLI..."
    cd cli
    deno compile --allow-env --allow-net --allow-read --allow-run --allow-write --target $TARGET --output ../$BUILD_DIR/bb-$TARGET src/main.ts
    cd ..

    # Build API
    echo "Building API..."
    cd api
    deno run --allow-read --allow-run --allow-write scripts/compile.ts --target $TARGET --output ../$BUILD_DIR/bb-api-$TARGET
    cd ..

    echo "Build completed for $TARGET"
    echo
done

# Verify built binaries
echo "Verifying built binaries:"
for TARGET in "${TARGETS[@]}"; do
    echo "CLI binary for $TARGET:"
    file $BUILD_DIR/bb-$TARGET
    echo "API binary for $TARGET:"
    file $BUILD_DIR/bb-api-$TARGET
    echo
done

echo "All binaries built successfully!"