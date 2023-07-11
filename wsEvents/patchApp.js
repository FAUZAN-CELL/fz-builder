const { spawn } = require('node:child_process');
const { version } = require('node:os');
const { rmSync, renameSync } = require('node:fs');
const { join, sep: separator } = require('node:path');

const exec = require('../utils/promisifiedExec.js');

const mountPatch = require('../utils/mountPatch.js');

const killProcess = require('kill-process-by-name');

/**
 * @param {import('ws').WebSocket} ws
 */
async function mount(ws) {
  ws.send(
    JSON.stringify({
      event: 'patchLog',
      log: 'Trying to mount Patch...'
    })
  );

  await mountPatch(global.jarNames.selectedApp.packageName, ws);
}

/**
 * @param {import('ws').WebSocket} ws
 */
async function afterBuild(ws) {
  // HACK: Kill Java after build is done to prevent EBUSY errors while deleting the cache
  killProcess('java');
  rmSync('patched-cache', { recursive: true, force: true });
  outputName();
  renameSync(
    join(global.patchedDir, 'patched.apk'),
    join(global.patchedDir, global.outputName)
  );

  if (!global.jarNames.isRooted && process.platform === 'android') {
    await exec(
      `cp "${join(
        global.patchedDir,
        global.outputName
      )}" "/storage/emulated/0/${global.outputName}"`
    );
    await exec(`cp "${global.jarNames.microG}" /storage/emulated/0/MicroG.apk`);

    ws.send(
      JSON.stringify({
        event: 'patchLog',
        log: `Copied files over to /storage/emulated/0/!\nPlease install app, its located in /storage/emulated/0/${global.outputName}\nand if you are building YT/YT Music without root, also install /storage/emulated/0/MicroG.apk.`
      })
    );
  } else if (process.platform === 'android') await mount(ws);
  else if (!(global.jarNames.devices && global.jarNames.devices[0]))
    ws.send(
      JSON.stringify({
        event: 'patchLog',
        log: `Patch has been built!\nPlease transfer over patched/${global.outputName} and if you are using YT/YT Music, patched/MicroG.apk and install them!`
      })
    );

  if (global.jarNames.devices && global.jarNames.devices[0]) {
    ws.send(JSON.stringify({ event: 'buildFinished', install: true }));
  } else ws.send(JSON.stringify({ event: 'buildFinished' }));
}

async function reinstallPatch() {
  let pkgNameToGetUninstalled;

  switch (global.jarNames.selectedApp.packageName) {
    case 'com.google.android.youtube':
      if (!global.jarNames.isRooted)
        pkgNameToGetUninstalled = 'app.fz.android.youtube';
      break;
    case 'com.google.android.apps.youtube.music':
      if (!global.jarNames.isRooted)
        pkgNameToGetUninstalled = 'app.fz.android.apps.youtube.music';
      break;
  }

  await exec(
    `adb -s ${global.jarNames.deviceID} uninstall ${pkgNameToGetUninstalled}`
  );
  await exec(
    `adb -s ${global.jarNames.deviceID} install ${join(
      global.patchedDir,
      global.outputName
    )}`
  );
}

function outputName() {
  const part1 = 'Patched';
  let part2 = global.jarNames?.selectedApp?.appName
    ? global.jarNames.selectedApp.appName.replace(/[^a-zA-Z0-9\\.\\-]/g, '')
    : global?.jarNames?.packageName
    ? global.jarNames.packageName.replace(/\./g, '')
    : ''; // make the app name empty if we cannot detect it

  // TODO: If the existing input APK is used from patched/ without downloading, version and arch aren't set
  const part3 = global?.apkInfo?.version ? `v${global.apkInfo.version}` : '';
  const part4 = global?.apkInfo?.arch;
  const part5 = `cli_${global.jarNames.cli
    .split(separator)
    .at(-1)
    .replace('fz-cli-', '')
    .replace('.jar', '')}`;
  const part6 = `patches_${global.jarNames.patchesJar
    .split(separator)
    .at(-1)
    .replace('fz-patches-', '')
    .replace('.jar', '')}`;

  // Filename: <AppName>-<AppVersion>-[Arch]-cli_<CLI_Version>-patches_<PatchesVersion>.apk
  let outputName = '';

  for (const part of [part1, part2, part3, part4, part5, part6])
    if (part) outputName += `-${part}`;

  outputName += '.apk';

  global.outputName = outputName.substring(1);
}

/**
 * @param {string[]} args
 * @param {import('ws').WebSocket} ws
 */
function reportSys(args, ws) {
  ws.send(
    JSON.stringify({
      event: 'error',
      error:
        'An error occured while starting the patching process. Please see the server console.'
    })
  );

  console.log(
    '[builder] Please report these informations to https://github.com/FAUZAN-CELL/fz-builder/issues'
  );
  console.log(
    `OS: ${process.platform}\nArguements: ${args.join(
      ', '
    )}\n OS Version${version()}`
  );
}

/**
 * @param {import('ws').WebSocket} ws
 */
module.exports = async function patchApp(ws) {
  /** @type {string[]} */
  const args = [
    '-jar',
    global.jarNames.cli,
    '-b',
    global.jarNames.patchesJar,
    '-t',
    './patched-cache',
    '--experimental',
    '-a',
    `${join(global.patchedDir, global.jarNames.selectedApp.packageName)}.apk`,
    '-o',
    join(global.patchedDir, 'patched.apk')
  ];

  if (process.platform === 'android') {
    args.push('--custom-aapt2-binary');
    args.push(join(global.patchedDir, 'aapt2'));
  }

  if (global.jarNames.patch.integrations) {
    args.push('-m');
    args.push(global.jarNames.integrations);
  }

  args.push(...global.jarNames.patches.split(' '));

  const buildProcess = spawn(global.javaCmd, args);

  buildProcess.stdout.on('data', async (data) => {
    ws.send(
      JSON.stringify({
        event: 'patchLog',
        log: data.toString()
      })
    );

    if (data.toString().includes('Finished')) await afterBuild(ws);

    if (data.toString().includes('INSTALL_FAILED_UPDATE_INCOMPATIBLE')) {
      await reinstallPatch(ws);
      await afterBuild(ws);
    }

    if (data.toString().includes('Unmatched')) reportSys(args, ws);
  });

  buildProcess.stderr.on('data', async (data) => {
    ws.send(
      JSON.stringify({
        event: 'patchLog',
        log: data.toString()
      })
    );

    if (data.toString().includes('Finished')) await afterBuild(ws);

    if (data.toString().includes('INSTALL_FAILED_UPDATE_INCOMPATIBLE')) {
      await reinstallPatch(ws);
      await afterBuild(ws);
    }

    if (data.toString().includes('Unmatched')) reportSys(args, ws);
  });
};
