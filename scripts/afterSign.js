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
    console.error('[afterSign] Error during ad-hoc codesign:', error);
    throw error;
  }
}

module.exports = afterSign;
module.exports.default = afterSign;
