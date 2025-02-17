#!/bin/bash

set -e

echo "Building CLI..."
cd cli
deno compile --allow-env --allow-net --allow-read --allow-run --allow-write --target x86_64-pc-windows-msvc --output ../build/bb.exe src/main.ts
cd ..


echo "Building BUI..."
cd bui
deno task fresh-build && deno compile --include src/static --include src/_fresh --include deno.jsonc --target x86_64-pc-windows-msvc --output ../build/bb-bui.exe -A src/main.ts
cd ..


echo "Building API..."
cd api
deno run --allow-read --allow-run --allow-write scripts/compile.ts --target x86_64-pc-windows-msvc --output ../build/bb-api.exe
cd ..
