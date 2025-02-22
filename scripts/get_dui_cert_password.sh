#!/bin/bash

# Retrieve password from keychain
password=$(security find-generic-password -a "$USER" -s "BB_DUI_CERT_PASSWORD" -w)

if [ $? -ne 0 ]; then
    echo "Error: Could not retrieve certificate password from keychain" >&2
    echo "Run scripts/save_dui_cert_password.sh to set up the password" >&2
    exit 1
fi

echo "$password"