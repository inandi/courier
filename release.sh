#!/bin/bash

# Publishes to two separate registries (both must succeed for users on VSCodium / Open VSX):
# - Visual Studio Marketplace: @vscode/vsce
# - Open VSX Registry: ovsx
# Tokens: VSCE_PAT and OVSX_PAT in .publish-secrets (see .publish-secrets.sample).

set -o pipefail

# Check if the version number is passed as an argument
if [ -z "$1" ]; then
  echo "Error: No version number provided."
  echo "Usage: $0 2.1.1"
  exit 1
fi

VERSION=$1
# RELEASE_BRANCH="release/$VERSION"
DATE=$(date +%Y-%m-%d)
TIMESTAMP=$(date +"%m/%d/%Y, %I:%M:%S %p")

# Prompt message
echo "INFO: Update release.md with latest release information."
echo "WARNING: The release should be created from the release branch with the latest/desired pull."
read -p "Are you sure you want to proceed? (yes/no): " CONFIRMATION

if [ "$CONFIRMATION" != "yes" ]; then
  echo "Release process aborted."
  exit 0
fi

# Ensure package.json version matches the release (bump it before running this script)
if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is required to read package.json version."
  exit 1
fi
PKG_VERSION=$(node -p "require('./package.json').version" 2>/dev/null)
if [ -z "$PKG_VERSION" ]; then
  echo "Error: Could not read version from package.json."
  exit 1
fi
if [ "$PKG_VERSION" != "$VERSION" ]; then
  echo "Error: package.json version ($PKG_VERSION) does not match release argument ($VERSION)."
  echo "Set \"version\" in package.json to $VERSION, then run this script again."
  exit 1
fi

# Get the Git user
GIT_USER=$(git config user.name)
if [ -z "$GIT_USER" ]; then
  GIT_USER="Unknown"
fi

# Step 3: Append new version info to version.md
echo "Appending new version information to version.md..."
{
  echo "v$VERSION => $GIT_USER on $TIMESTAMP"
} >> version.md

# Step 4: Copy the content of release.md to the top of CHANGELOG.md with --- appended
if [ -f "release.md" ]; then
  echo "Copying release.md content to the top of CHANGELOG.md..."
  {
    echo "# Release v$VERSION - $DATE"
    echo ""
    cat release.md
    echo ""
    echo "---"
    echo ""
    cat CHANGELOG.md
  } > tmp_CHANGELOG.md && mv tmp_CHANGELOG.md CHANGELOG.md
else
  echo "Error: release.md file not found. Please prepare release.md manually."
  exit 1
fi

# Step 4.1: Copy the content of release.md.sample to release.md
if [ -f "release.md.sample" ]; then
  echo "Copying release.md.sample content to release.md..."
  {
    cat release.md.sample
  } > tmp_release.md && mv tmp_release.md release.md
else
  echo "Error: release.md.sample file not found. Please prepare release.md.sample manually."
  exit 1
fi

# # Step 5: Commit changes and push the release branch
echo "Committing release changes and pushing new tag..."
git add release.md CHANGELOG.md version.md
git commit -m "Release v$VERSION - $DATE"
git push

# Step 6: Create a tag for the release
echo "Creating a tag: v$VERSION"
git tag v$VERSION
git push origin v$VERSION

# Step 7: Publish to VS Code Marketplace and Open VSX Registry
echo "Publishing extension to marketplaces..."

PUBLISH_FAILED=0
PUBLISH_ATTEMPTED=0

publish_marketplace() {
  echo "Publishing to Visual Studio Marketplace..."
  if npx --yes @vscode/vsce publish -p "$VSCE_PAT"; then
    echo "✓ Successfully published to Visual Studio Marketplace"
  else
    echo "✗ Failed to publish to Visual Studio Marketplace"
    return 1
  fi
}

publish_open_vsx() {
  echo "Publishing to Open VSX Registry..."
  if npx --yes ovsx publish -p "$OVSX_PAT"; then
    echo "✓ Successfully published to Open VSX Registry"
  else
    echo "✗ Failed to publish to Open VSX Registry"
    return 1
  fi
}

# Load secrets from .publish-secrets file
if [ -f ".publish-secrets" ]; then
  echo "Loading publishing secrets..."
  set -a
  # shellcheck source=/dev/null
  source .publish-secrets
  set +a

  if [ -n "$VSCE_PAT" ] && [ -n "$OVSX_PAT" ]; then
    PUBLISH_ATTEMPTED=1
    publish_marketplace || PUBLISH_FAILED=1
    publish_open_vsx || PUBLISH_FAILED=1
  elif [ -n "$VSCE_PAT" ]; then
    echo "Note: OVSX_PAT not set — skipping Open VSX (VSCodium users will not see updates until you publish there)."
    PUBLISH_ATTEMPTED=1
    publish_marketplace || PUBLISH_FAILED=1
  elif [ -n "$OVSX_PAT" ]; then
    echo "Note: VSCE_PAT not set — skipping Visual Studio Marketplace."
    PUBLISH_ATTEMPTED=1
    publish_open_vsx || PUBLISH_FAILED=1
  else
    echo "Warning: Neither VSCE_PAT nor OVSX_PAT found in .publish-secrets."
    echo "Skipping publishing. See .publish-secrets.sample."
  fi
else
  echo "Warning: .publish-secrets file not found."
  echo "Skipping publishing. Create .publish-secrets from .publish-secrets.sample and add your tokens."
fi

if [ "$PUBLISH_ATTEMPTED" -eq 1 ] && [ "$PUBLISH_FAILED" -eq 1 ]; then
  echo "Release tagging finished, but one or more publish steps failed."
  exit 1
fi

echo "Release process completed successfully."
