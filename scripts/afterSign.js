const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

async function afterSign(context) {
  const { electronPlatformName, appOutDir, packager } = context;

  if (electronPlatformName !== 'darwin' && process.platform !== 'darwin') {
    return;
  }

  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  if (!fs.existsSync(appPath)) {
    console.warn(`[afterSign] App bundle not found at: ${appPath}`);
    return;
  }

  console.log(`[afterSign] Applying ad-hoc codesign to ${appPath}...`);
  try {
    execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' });
    console.log('[afterSign] Ad-hoc codesign completed successfully.');
  } catch (error) {
    // Unsigned CI artifacts are still useful for testing and manual distribution.
    // Do not fail the complete cross-platform release when ad-hoc signing is unavailable.
    console.warn('[afterSign] Ad-hoc codesign was skipped:', error);
  }
}

module.exports = afterSign;
module.exports.default = afterSign;
