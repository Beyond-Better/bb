#!/bin/bash

# Retrieve password from keychain
password=$(security find-generic-password -a "$USER" -s "BB_CODESIGNING_KEYCHAIN_PASSWORD" -w)

if [ $? -ne 0 ]; then
    echo "Error: Could not retrieve certificate password from keychain" >&2
    echo "Run scripts/save_codesigning_keychain_password.sh to set up the password" >&2
    exit 1
fi

echo "$password"