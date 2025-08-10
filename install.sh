#!/bin/sh

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Function to detect shell and profile file
detect_shell_profile() {
    shell=$(basename "$SHELL")
    case "$shell" in
        bash)
            if [ -f "$HOME/.bash_profile" ]; then
                echo "$HOME/.bash_profile"
            else
                echo "$HOME/.bashrc"
            fi
            ;;
        zsh)
            echo "$HOME/.zshrc"
            ;;
        *)
            echo "$HOME/.profile"
            ;;
    esac
}

# Function to update PATH in profile
update_path() {
    profile_file="$1"
    path_dir="$2"
    
    if ! grep -q "export PATH=\"$path_dir:\$PATH\"" "$profile_file"; then
        echo "" >> "$profile_file"
        echo "# Add BB to PATH" >> "$profile_file"
        echo "export PATH=\"$path_dir:\$PATH\"" >> "$profile_file"
        echo "${GREEN}Added BB directory to PATH in $profile_file${NC}"
        echo "${YELLOW}Please run: source $profile_file${NC}"
    else
        echo "${GREEN}BB directory already in PATH ($profile_file)${NC}"
    fi
}

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

# Check for existing system installation
system_bb="/usr/local/bin/bb"
system_api="/usr/local/bin/bb-api"
system_bui="/usr/local/bin/bb-bui"
has_system_install=false
if [ -f "$system_bb" ] || [ -f "$system_api" ] || [ -f "$system_bui" ]; then
    has_system_install=true
fi

# Ask about installation location
user_install="y"
echo "${YELLOW}BB can be installed for the current user (~/.bb/bin) or system-wide (/usr/local/bin).${NC}"
echo "${YELLOW}User installation is recommended as it:${NC}"
echo "${YELLOW}- Doesn't require sudo for future updates${NC}"
echo "${YELLOW}- Enables automatic updates through the browser interface${NC}"
if [ "$has_system_install" = true ]; then
    echo "${YELLOW}Note: Choosing user installation will remove existing system-wide installation${NC}"
    echo "${YELLOW}(requires sudo password for cleanup)${NC}"
fi
printf "${YELLOW}Install for current user? [Y/n]: ${NC}"
read -r response
[ -n "$response" ] && user_install=$(echo "$response" | tr '[:upper:]' '[:lower:]')

if [ "$user_install" = "n" ] || [ "$user_install" = "no" ]; then
    install_dir="/usr/local/bin"
    need_sudo=true
else
    install_dir="$HOME/.bb/bin"
    need_sudo=false
    # Ensure ~/.bb/bin exists
    mkdir -p "$install_dir"
fi

# Fetch latest release version
latest_version=$(curl -sL https://asyagnmzoxgyhqprdaky.storage.supabase.co/storage/v1/object/releases/latest.json | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
# echo "Latest version: $latest_version"

# Download URL
download_url="https://asyagnmzoxgyhqprdaky.storage.supabase.co/storage/v1/object/releases/${latest_version}/bb-${arch}-${os}-${latest_version}.tar.gz"
# echo "Download URL: $download_url"

# Create a temporary directory
temp_dir=$(mktemp -d)
# echo "Temporary directory: $temp_dir"
trap 'rm -rf "$temp_dir"' EXIT

# Download and extract the tarball
echo "${YELLOW}Downloading BB ${latest_version} for ${arch}-${os}...${NC}"
curl -L --progress-bar "$download_url" -o "$temp_dir/bb.tar.gz"
# echo "Download complete. File size: $(wc -c < "$temp_dir/bb.tar.gz") bytes"
# echo "File type: $(file "$temp_dir/bb.tar.gz")"
echo "${YELLOW}Extracting archive...${NC}"
tar xzf "$temp_dir/bb.tar.gz" -C "$temp_dir"

# List contents of temp directory
# echo "Contents of $temp_dir:"
# ls -la "$temp_dir"

# Make binaries executable
chmod +x "$temp_dir/bb" "$temp_dir/bb-api" "$temp_dir/bb-bui"

# Install binaries
echo "${YELLOW}Installing 'bb', 'bb-api' and 'bb-bui' to $install_dir...${NC}"
if [ "$need_sudo" = true ]; then
    echo "${RED}Note: This step requires sudo access. You may be prompted for your password.${NC}"
    sudo mv "$temp_dir/bb" "$temp_dir/bb-api" "$temp_dir/bb-bui" "$install_dir/"
else
    mv "$temp_dir/bb" "$temp_dir/bb-api" "$temp_dir/bb-bui" "$install_dir/"
    # Remove system installation if it exists
    if [ "$has_system_install" = true ]; then
        echo "${YELLOW}Removing system-wide installation...${NC}"
        echo "${RED}Note: This step requires sudo access. You may be prompted for your password.${NC}"
        if [ -f "$system_bb" ]; then
            sudo rm "$system_bb"
        fi
        if [ -f "$system_api" ]; then
            sudo rm "$system_api"
        fi
        if [ -f "$system_bui" ]; then
            sudo rm "$system_bui"
        fi
        echo "${GREEN}System-wide installation removed successfully${NC}"
    fi
fi

echo "${YELLOW}'bb', 'bb-api' and 'bb-bui' have been successfully installed to $install_dir${NC}"

# Update PATH for user installation
if [ "$need_sudo" = false ]; then
    profile_file=$(detect_shell_profile)
    printf "${YELLOW}Would you like to add $install_dir to your PATH? [Y/n]: ${NC}"
    read -r add_path
    [ -z "$add_path" ] || [ "$add_path" = "y" ] || [ "$add_path" = "Y" ] && update_path "$profile_file" "$install_dir"
fi

# # Install BB Manager
# echo "${YELLOW}Installing BB Manager...${NC}"
# if [ "$os" = "apple-darwin" ]; then
#     echo "${YELLOW}Copying BB Manager.app to /Applications...${NC}"
#     sudo cp -R "$temp_dir/BB Manager.app" /Applications/
#     echo "${GREEN}BB Manager.app has been installed to /Applications/${NC}"
# else
#     manager_path="$install_dir/bb-manager.sh"
#     echo "${YELLOW}Copying bb-manager.sh to $manager_path...${NC}"
#     if [ "$need_sudo" = true ]; then
#         sudo cp "$temp_dir/bb-manager.sh" "$manager_path"
#         sudo chmod +x "$manager_path"
#     else
#         cp "$temp_dir/bb-manager.sh" "$manager_path"
#         chmod +x "$manager_path"
#     fi
#     echo "${GREEN}bb-manager.sh has been installed to $manager_path${NC}"
# fi

echo "${GREEN}You can now run '${BOLD}bb init${NC}${GREEN}' from a project directory, and then run '${BOLD}bb start${NC}${GREEN}' (or '${BOLD}bb chat${NC}${GREEN}').${NC}"