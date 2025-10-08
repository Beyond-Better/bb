#!/bin/bash

# Beyond Better Update Helper Script
# This script handles the final stage of updates to avoid in-place replacement issues

APP_NAME="Beyond Better.app"
TMP_UPDATE="$1"  # Path to downloaded update
INSTALL_PATH="$2"  # Path to current app installation
PID="$3"  # PID of current process to wait for

echo "[UPDATE] Starting update helper..."
echo "[UPDATE] Waiting for process $PID to exit..."

# Wait for the main process to exit (max 30 seconds)
COUNTER=0
while kill -0 "$PID" 2>/dev/null && [ $COUNTER -lt 30 ]; do
    sleep 1
    COUNTER=$((COUNTER + 1))
done

if kill -0 "$PID" 2>/dev/null; then
    echo "[UPDATE] Warning: Process still running after 30 seconds, proceeding anyway"
else
    echo "[UPDATE] Process exited, proceeding with update"
fi

# Additional delay to ensure file handles are closed
sleep 2

# Backup current installation
BACKUP_PATH="${INSTALL_PATH}.backup"
echo "[UPDATE] Creating backup at $BACKUP_PATH"
if [ -d "$INSTALL_PATH" ]; then
    rm -rf "$BACKUP_PATH" 2>/dev/null
    mv "$INSTALL_PATH" "$BACKUP_PATH"
    if [ $? -ne 0 ]; then
        echo "[UPDATE] ERROR: Failed to backup current installation"
        exit 1
    fi
fi

# Extract and install new version
echo "[UPDATE] Installing new version from $TMP_UPDATE"
cd "$(dirname "$INSTALL_PATH")"
tar -xzf "$TMP_UPDATE"

if [ $? -ne 0 ]; then
    echo "[UPDATE] ERROR: Failed to extract update, restoring backup"
    mv "$BACKUP_PATH" "$INSTALL_PATH"
    exit 1
fi

# Verify the new installation
if [ ! -d "$INSTALL_PATH" ]; then
    echo "[UPDATE] ERROR: New installation not found, restoring backup"
    mv "$BACKUP_PATH" "$INSTALL_PATH"
    exit 1
fi

# Remove backup on success
rm -rf "$BACKUP_PATH"

# Re-sign the application to avoid codesign issues
echo "[UPDATE] Re-signing application..."
codesign --force --deep --sign - "$INSTALL_PATH" 2>/dev/null

# Launch the updated application with proper detachment
echo "[UPDATE] Launching updated application..."

# Create a new session to completely detach from any terminal
setsid sh -c "
    # Additional detachment: new process group and session
    nohup open '$INSTALL_PATH' >/dev/null 2>&1 &
    # Wait a moment for launch
    sleep 1
" >/dev/null 2>&1 &

# Alternative method if setsid isn't available
if [ $? -ne 0 ]; then
    echo "[UPDATE] Fallback: using direct launch"
    # Direct launch with maximum detachment
    (open "$INSTALL_PATH" >/dev/null 2>&1 &) &
fi

echo "[UPDATE] Update complete!"
exit 0
