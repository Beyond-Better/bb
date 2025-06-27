#!/bin/sh

VERSION=$(deno eval 'import { VERSION } from "./version.ts"; console.log(VERSION);')

# Extract full release section for current version from CHANGELOG.md
RELEASE_SECTION=$(awk "/^## \[$VERSION\]/{flag=1; print; next} /^## \[/{flag=0} flag{print}" CHANGELOG.md)

if [ -z "$RELEASE_SECTION" ]; then
  RELEASE_NOTES="See CHANGELOG.md for version $VERSION details."
  HAS_BREAKING="false"
  CRITICAL_NOTICE=""
else
  # Check for breaking changes indicators
  if echo "$RELEASE_SECTION" | grep -qi "breaking\|BREAKING"; then
    HAS_BREAKING="true"
    CRITICAL_NOTICE="🚨 **BREAKING CHANGES DETECTED** - Please backup your projects before upgrading and review the changelog carefully."
  else
    HAS_BREAKING="false"
    CRITICAL_NOTICE=""
  fi
  
  # Extract just the changes (skip the version header)
  RELEASE_NOTES=$(echo "$RELEASE_SECTION" | tail -n +2)
fi

# For local testing, show readable output
echo "=== LOCAL TEST OUTPUT ==="
echo "VERSION: $VERSION"
echo "HAS_BREAKING: $HAS_BREAKING"
echo ""
echo "CRITICAL_NOTICE:"
echo "$CRITICAL_NOTICE"
echo ""
echo "RELEASE_NOTES:"
echo "$RELEASE_NOTES"
echo ""
echo "=== GITHUB ACTIONS FORMAT ==="
echo "# Raw versions (for release body):"
echo "RELEASE_NOTES_RAW<<EOF"
echo "$RELEASE_NOTES"
echo "EOF"
echo ""
echo "CRITICAL_NOTICE_RAW<<EOF"
echo "$CRITICAL_NOTICE"
echo "EOF"
echo ""
echo "HAS_BREAKING=$HAS_BREAKING"
echo ""
echo "# Escaped versions (for environment variables):"

# Escape for GitHub output (this is what GitHub Actions needs for env vars)
RELEASE_NOTES_ESCAPED="${RELEASE_NOTES//'%'/'%25'}"
RELEASE_NOTES_ESCAPED="${RELEASE_NOTES_ESCAPED//$'\n'/'%0A'}"
RELEASE_NOTES_ESCAPED="${RELEASE_NOTES_ESCAPED//$'\r'/'%0D'}"

CRITICAL_NOTICE_ESCAPED="${CRITICAL_NOTICE//'%'/'%25'}"
CRITICAL_NOTICE_ESCAPED="${CRITICAL_NOTICE_ESCAPED//$'\n'/'%0A'}"
CRITICAL_NOTICE_ESCAPED="${CRITICAL_NOTICE_ESCAPED//$'\r'/'%0D'}"

echo "RELEASE_NOTES=$RELEASE_NOTES_ESCAPED"
echo "CRITICAL_NOTICE=$CRITICAL_NOTICE_ESCAPED"