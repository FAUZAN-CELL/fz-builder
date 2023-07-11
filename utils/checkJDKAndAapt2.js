const { existsSync } = require('node:fs');
const { join: joinPath } = require('node:path');

const exec = require('./promisifiedExec.js');

const { dloadFromURL } = require('./FileDownloader.js');

/**
 * @param {import('ws').WebSocket} ws
 */
module.exports = async function checkJDKAndAapt2(ws) {
  global.jarNames.devices = [];
  try {
    await exec('java -v');
  } catch (e) {
    if (e.stderr.includes('not found'))
      ws.send(
        JSON.stringify({
          event: 'error',
          error:
            "You don't have JDK installed. Please close Builder and install it using: `pkg install openjdk-17`"
        })
      );
  }

  if (!existsSync(joinPath(global.patchedDir, 'aapt2'))) {
    await dloadFromURL(
      'https://github.com/FAUZAN-CELL/fz-cli/raw/main/aapt2.zip',
      'patched/aapt2.zip',
      ws
    );
    await exec(
      `unzip ${joinPath(global.patchedDir, 'aapt2.zip')} -d ${
        global.patchedDir
      }`
    );

    switch (process.arch) {
      case 'arm64':
        await exec(
          `cp ${joinPath(global.patchedDir, 'arm64-v8a/aapt2')} ${joinPath(
            global.patchedDir,
            'aapt2'
          )}`
        );
        await exec(`chmod +x ${joinPath(global.patchedDir, 'aapt2')}`);
        break;
      case 'arm':
        await exec(
          `cp ${joinPath(global.patchedDir, 'armeabi-v7a/aapt2')} ${joinPath(
            global.patchedDir,
            'aapt2'
          )}`
        );
        await exec(`chmod +x ${joinPath(global.patchedDir, 'aapt2')}`);
    }

    await exec(
      `rm -rf ${joinPath(global.patchedDir, 'arm64-v8a')} ${joinPath(
        global.patchedDir,
        'armeabi-v7a'
      )} ${joinPath(global.patchedDir, 'x86')} ${joinPath(
        global.patchedDir,
        'aapt2.zip'
      )}`
    );
  }
};
