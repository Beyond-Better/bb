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

# Create build directory
mkdir -p $BUILD_DIR/$PACKAGE_NAME/usr/local/bin

# Copy architecture-specific binaries
cp build/bb-x86_64-apple-darwin $BUILD_DIR/$PACKAGE_NAME/usr/local/bin/bb-x86_64
cp build/bb-aarch64-apple-darwin $BUILD_DIR/$PACKAGE_NAME/usr/local/bin/bb-arm64
cp build/bb-api-x86_64-apple-darwin $BUILD_DIR/$PACKAGE_NAME/usr/local/bin/bb-api-x86_64
cp build/bb-api-aarch64-apple-darwin $BUILD_DIR/$PACKAGE_NAME/usr/local/bin/bb-api-arm64

# Make binaries executable
chmod +x $BUILD_DIR/$PACKAGE_NAME/usr/local/bin/bb-x86_64 $BUILD_DIR/$PACKAGE_NAME/usr/local/bin/bb-arm64 $BUILD_DIR/$PACKAGE_NAME/usr/local/bin/bb-api-x86_64 $BUILD_DIR/$PACKAGE_NAME/usr/local/bin/bb-api-arm64

# Verify architecture-specific binaries
echo "\nVerifying architecture-specific binaries:"
file $BUILD_DIR/$PACKAGE_NAME/usr/local/bin/bb-x86_64
file $BUILD_DIR/$PACKAGE_NAME/usr/local/bin/bb-arm64
file $BUILD_DIR/$PACKAGE_NAME/usr/local/bin/bb-api-x86_64
file $BUILD_DIR/$PACKAGE_NAME/usr/local/bin/bb-api-arm64

# Create distribution.xml
cat > $BUILD_DIR/distribution.xml << EOF
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
        <line choice="BB"/>
    </choices-outline>
    <choice id="BB" title="BB">
        <pkg-ref id="$IDENTIFIER"/>
    </choice>
    <pkg-ref id="$IDENTIFIER" version="$VERSION" onConclusion="none">BB-component.pkg</pkg-ref>
</installer-script>
EOF

# Create post-installation script
cat > $BUILD_DIR/$PACKAGE_NAME/postinstall << EOF
#!/bin/bash
arch=$(uname -m)
if [ "\$arch" = "arm64" ]; then
    ln -sf /usr/local/bin/bb-arm64 /usr/local/bin/bb
    ln -sf /usr/local/bin/bb-api-arm64 /usr/local/bin/bb-api
else
    ln -sf /usr/local/bin/bb-x86_64 /usr/local/bin/bb
    ln -sf /usr/local/bin/bb-api-x86_64 /usr/local/bin/bb-api
fi
EOF

chmod +x $BUILD_DIR/$PACKAGE_NAME/postinstall

# Build component package
pkgbuild --root $BUILD_DIR/$PACKAGE_NAME --identifier $IDENTIFIER --version $VERSION --install-location / --scripts $BUILD_DIR/$PACKAGE_NAME $BUILD_DIR/BB-component.pkg

# Build product package
productbuild --distribution $BUILD_DIR/distribution.xml --package-path $BUILD_DIR $BUILD_DIR/$PACKAGE_NAME.pkg

# Sign package (commented out as developer account is not current)
# productsign --sign "Developer ID Installer: Your Name (XXXXXXXXXX)" $BUILD_DIR/$PACKAGE_NAME.pkg $BUILD_DIR/$PACKAGE_NAME-signed.pkg

echo "Package created: $BUILD_DIR/$PACKAGE_NAME.pkg"

# Display package contents for verification
echo "Package contents:"
pkgutil --expand $BUILD_DIR/$PACKAGE_NAME.pkg $BUILD_DIR/expanded_pkg
find $BUILD_DIR/expanded_pkg -type f

# Clean up expanded package
rm -rf $BUILD_DIR/expanded_pkg

# Clean up intermediate files
rm -rf $BUILD_DIR/$PACKAGE_NAME $BUILD_DIR/distribution.xml $BUILD_DIR/BB-component.pkg

# Optionally, move the package to a specific directory
# mv $BUILD_DIR/$PACKAGE_NAME.pkg /path/to/destination/