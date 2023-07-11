const { existsSync, mkdirSync, rmSync } = require('node:fs');
const { join: joinPath } = require('node:path');
const { getSources } = require('../utils/Settings.js');
const { downloadFiles } = require('../utils/FileDownloader.js');
const checkJDKAndAapt2 = require('../utils/checkJDKAndAapt2.js');
const checkJDkAndADB = require('../utils/checkJDKAndADB.js');

global.patchedDir = joinPath(process.cwd(), 'patched');
global.javaCmd = 'java';
global.jarNames = {
  cli: '',
  patchesJar: global.patchedDir,
  integrations: global.patchedDir,
  microG: global.patchedDir,
  patchesList: global.patchedDir,
  selectedApp: '',
  patches: '',
  isRooted: false,
  deviceID: '',
  patch: {
    integrations: false
  }
};

/**
 * @param {import('ws').WebSocket} ws
 */
module.exports = async function updateFiles(ws) {
  const source = getSources();
  const patches = source.patches.split('/');
  const integrations = source.integrations.split('/');

  if (!existsSync(global.patchedDir)) mkdirSync(global.patchedDir);
  if (existsSync('patched-cache'))
    rmSync('patched-cache', { recursive: true, force: true });

  const filesToDownload = [
    {
      owner: 'FAUZAN-CELL',
      repo: 'fz-cli'
    },
    {
      owner: patches[0],
      repo: patches[1]
    },
    {
      owner: integrations[0],
      repo: integrations[1]
    },
    {
      owner: 'FAUZAN-CELL',
      repo: 'MicroG'
    }
  ];

  if (
    typeof global.downloadFinished !== 'undefined' &&
    !global.downloadFinished
  ) {
    ws.send(
      JSON.stringify({
        event: 'error',
        error:
          "Downloading process hasn't finished and you tried to download again."
      })
    );

    return;
  }

  global.downloadFinished = false;

  await downloadFiles(filesToDownload, ws);

  if (process.platform === 'android') await checkJDKAndAapt2(ws);
  else await checkJDkAndADB(ws);

  global.downloadFinished = true;

  ws.send(
    JSON.stringify({
      event: 'finished'
    })
  );
};
