#!/bin/sh

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Determine architecture
arch=$(uname -m)
case $arch in
    x86_64)
        arch="x86_64"
        ;;
    aarch64|arm64)
        arch="aarch64"
        ;;
    *)
        echo "${RED}Unsupported architecture: $arch${NC}"
        exit 1
        ;;
esac

# Determine OS
os=$(uname -s | tr '[:upper:]' '[:lower:]')
case $os in
    linux)
        os="unknown-linux-gnu"
        ;;
    darwin)
        os="apple-darwin"
        ;;
    *)
        echo "${RED}Unsupported OS: $os${NC}"
        exit 1
        ;;
esac

# Fetch latest release version
latest_version=$(curl -sL https://api.github.com/repos/Beyond-Better/bb/releases/latest | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
# echo "Latest version: $latest_version"

# Download URL
download_url="https://github.com/Beyond-Better/bb/releases/download/${latest_version}/bb-${arch}-${os}-${latest_version}.tar.gz"
# echo "Download URL: $download_url"

# Create a temporary directory
temp_dir=$(mktemp -d)
# echo "Temporary directory: $temp_dir"
trap 'rm -rf "$temp_dir"' EXIT

# Download and extract the tarball
echo "${YELLOW}Downloading BB ${latest_version} for ${arch}-${os}...${NC}"
curl -sL "$download_url" -o "$temp_dir/bb.tar.gz"
# echo "Download complete. File size: $(wc -c < "$temp_dir/bb.tar.gz") bytes"
# echo "File type: $(file "$temp_dir/bb.tar.gz")"
echo "${YELLOW}Extracting archive...${NC}"
tar xzf "$temp_dir/bb.tar.gz" -C "$temp_dir"

# List contents of temp directory
# echo "Contents of $temp_dir:"
# ls -la "$temp_dir"

# Make binaries executable
chmod +x "$temp_dir/bb" "$temp_dir/bb-api"

# Install binaries
echo "${YELLOW}Installing 'bb' and 'bb-api' to /usr/local/bin...${NC}"
echo "${RED}Note: This step requires sudo access. You may be prompted for your password.${NC}"
sudo mv "$temp_dir/bb" "$temp_dir/bb-api" /usr/local/bin/

echo "${YELLOW}'bb' and 'bb-api' have been successfully installed to /usr/local/bin/${NC}"
echo "${GREEN}You can now run '${BOLD}bb init${NC}${GREEN}' from a project directory, and then run '${BOLD}bb start${NC}${GREEN}' (or '${BOLD}bb chat${NC}${GREEN}').${NC}"


