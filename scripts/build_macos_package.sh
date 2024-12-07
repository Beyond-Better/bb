#!/bin/bash

set -e

# Check if running on macOS
if [[ "$(uname)" != "Darwin" ]]; then
    echo "This script must be run on macOS"
    exit 1
fi

# Set variables
VERSION=$(cat version.ts | grep VERSION | cut -d'"' -f2)
PACKAGE_NAME="BB-$VERSION"
BUILD_DIR="build/macos_package"
IDENTIFIER="dev.beyondbetter.bb"
APP_NAME="BB.app"

# Create build directory
mkdir -p "$BUILD_DIR/$APP_NAME/Contents/MacOS"
mkdir -p "$BUILD_DIR/$APP_NAME/Contents/Resources"

# Copy binaries
cp build/bb-x86_64-apple-darwin "$BUILD_DIR/$APP_NAME/Contents/MacOS/bb-x86_64"
cp build/bb-aarch64-apple-darwin "$BUILD_DIR/$APP_NAME/Contents/MacOS/bb-arm64"
cp build/bb-api-x86_64-apple-darwin "$BUILD_DIR/$APP_NAME/Contents/MacOS/bb-api-x86_64"
cp build/bb-api-aarch64-apple-darwin "$BUILD_DIR/$APP_NAME/Contents/MacOS/bb-api-arm64"

# Make binaries executable
chmod +x "$BUILD_DIR/$APP_NAME/Contents/MacOS/"*

# Create Info.plist
cat > "$BUILD_DIR/$APP_NAME/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>bb-launcher</string>
    <key>CFBundleIconFile</key>
    <string>bb-icon</string>
    <key>CFBundleIdentifier</key>
    <string>$IDENTIFIER</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>BB</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>$VERSION</string>
    <key>CFBundleVersion</key>
    <string>$VERSION</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.15</string>
</dict>
</plist>
EOF

# Create launcher script
cat > "$BUILD_DIR/$APP_NAME/Contents/MacOS/bb-launcher" << EOF
#!/bin/bash
DIR="\$( cd "\$( dirname "\${BASH_SOURCE[0]}" )" && pwd )"
arch=\$(uname -m)
if [ "\$arch" = "arm64" ]; then
    BB_BIN="\$DIR/bb-arm64"
    BB_API_BIN="\$DIR/bb-api-arm64"
else
    BB_BIN="\$DIR/bb-x86_64"
    BB_API_BIN="\$DIR/bb-api-x86_64"
fi
export PATH="\$DIR:\$PATH"
"\$BB_BIN" "\$@"
EOF

chmod +x "$BUILD_DIR/$APP_NAME/Contents/MacOS/bb-launcher"

# Create component package
pkgbuild --root "$BUILD_DIR" --identifier "$IDENTIFIER" --version "$VERSION" --install-location "/Applications" "$BUILD_DIR/$PACKAGE_NAME-component.pkg"

# Create distribution.xml
cat > "$BUILD_DIR/distribution.xml" << EOF
<?xml version="1.0" encoding="utf-8"?>
<installer-script minSpecVersion="1.000000">
    <title>BB Installer</title>
    <options customize="never" allow-external-scripts="no"/>
    <domains enable_anywhere="true"/>
    <installation-check script="pm_install_check();"/>
    <script>
        function pm_install_check() {
            if(!(system.compareVersions(system.version.ProductVersion,'10.15') >= 0)) {
                my.result.title = 'Failure';
                my.result.message = 'You need at least macOS 10.15 to install BB.';
                my.result.type = 'Fatal';
                return false;
            }
            return true;
        }
    </script>
    <choices-outline>
        <line choice="default"/>
    </choices-outline>
    <choice id="default" title="BB">
        <pkg-ref id="$IDENTIFIER"/>
    </choice>
    <pkg-ref id="$IDENTIFIER" version="$VERSION" onConclusion="none">$PACKAGE_NAME-component.pkg</pkg-ref>
</installer-script>
EOF

# Build product package
productbuild --distribution "$BUILD_DIR/distribution.xml" --package-path "$BUILD_DIR" "$BUILD_DIR/$PACKAGE_NAME.pkg"

echo "Package created: $BUILD_DIR/$PACKAGE_NAME.pkg"

# Clean up intermediate files
rm -rf "$BUILD_DIR/$APP_NAME" "$BUILD_DIR/distribution.xml" "$BUILD_DIR/$PACKAGE_NAME-component.pkg"