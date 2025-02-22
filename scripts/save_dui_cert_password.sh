#!/bin/bash

# Prompt for the certificate password
echo "Enter the certificate password:"
read -s password

# Save to keychain
security add-generic-password -a "$USER" -s "BB_DUI_CERT_PASSWORD" -w "$password" -U

echo "Password saved to keychain"