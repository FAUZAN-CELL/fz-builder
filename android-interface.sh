#!/bin/bash

shopt -s extglob

SCR_NAME_EXEC=$0
SCR_NAME_EXEC_FP=$(realpath "$0")
SCR_NAME=$(basename "$SCR_NAME_EXEC")
SCR_NAME=${SCR_NAME%.*}
RVB_DIR=$HOME/fz-builder

COLOR_OFF='\033[0m'
COLOR_RED='\033[1;31m'

help_info() {
  cat <<EOF
Usage: $SCR_NAME [command] [options]

Commands:
  run                          Launches the fz-builder.
                               Running $SCR_NAME_EXEC without arguments will
                               assume this command (i.e. will run the
                               builder)
    --delete-cache
    --dc                       Deletes patched/ before running builder
    --delete-cache-no-keystore
    --dcnk                     Deletes patched/ before running builder, but
                               preserving keystore file.
    --delete-cache-after
    --dca                      Deletes patched/ after running builder
    --delete-cache-after-no-keystore
    --dcank                    Deletes patched/ after running builder, but
                               preserving keystore file

  reinstall                    Delete everything and start from scratch.
    --delete-keystore          Also delete the signature file. This will
                               make a different signature,
                               which will not allow you to install an
                               updated build over the previously installed
                               one (you'll need to uninstall that first)

  update                       Update the builder to the latest version

  help                         Display this help info
EOF
}

log() {
  echo -e "[$SCR_NAME] $1"
}

error() {
  log "$1"
  [[ "$2" == y ]] && help_info
  exit "${3:-1}"
}

dload_and_install() {
  log "Downloading fz-builder..."
  curl -sLo fz-builder.zip https://github.com/FAUZAN-CELL/fz-builder/archive/refs/heads/main.zip
  log "Unzipping..."
  unzip -qqo fz-builder.zip
  rm fz-builder.zip
  mv fz-builder-main/{.[!.]*,*} .
  log "Installing packages..."
  npm install --omit=dev
  rmdir fz-builder-main
  [[ -z "$1" ]] && log "Done. Execute \`$SCR_NAME_EXEC run\` to launch the builder."
}

preflight() {
  setup_storage() {
    [[ ! -d "$HOME"/storage ]] && {
      log "You will now get a permission dialog to allow access to storage."
      log "This is needed in order to move the built APK (+ MicroG) to internal storage."
      sleep 5
      termux-setup-storage
    } || {
      log "Already gotten storage access."
    }
  }

  install_dependencies() {
    local JAVA_NF NODE_NF
    which java >/dev/null || JAVA_NF=1
    which node >/dev/null || NODE_NF=1
    [[ -z "$JAVA_NF" ]] && [[ -z "$NODE_NF" ]] && {
      log "Node.js and JDK already installed."
      return
    }
    log "Updating Termux and installing dependencies..."
    pkg update -y
    pkg install nodejs-lts openjdk-17 -y || {
      error "$COLOR_RED
Failed to install Node.js and OpenJDK 17.
Possible reasons (in the order of commonality):
1. Termux was downloaded from Play Store. Termux in Play Store is deprecated, and has packaging bugs. Please install it from F-Droid.
2. Mirrors are down at the moment. Try running \`termux-change-repo\`.
3. Internet connection is unstable.
4. Lack of free storage.$COLOR_OFF" n 2
    }
  }
  
  setup_storage
  install_dependencies

  [[ ! -d "$RVB_DIR" ]] && {
    log "fz-builder not installed. Installing..."
    mkdir -p "$RVB_DIR"
    cd "$RVB_DIR"
    dload_and_install n
  } || {
    log "fz-builder found."
    log "All checks done."
    }
}

run_builder() {
  preflight
  termux-wake-lock
  echo
  [[ "$1" == "--delete-cache" ]] || [[ "$1" == "--dc" ]] && {
    delete_cache
  }
  [[ "$1" == "--delete-cache-no-keystore" ]] || [[ "$1" == "--dcnk" ]] && {
    delete_cache_no_keystore
  }
  cd "$RVB_DIR"
  node .
  [[ "$1" == "--delete-cache-after" ]] || [[ "$1" == "--dca" ]] && {
    delete_cache
  }
  [[ "$1" == "--delete-cache-after-no-keystore" ]] || [[ "$1" == "--dcank" ]] && {
    delete_cache_no_keystore
  }
  termux-wake-unlock
}

delete_cache() {
  # Is this even called a cache?
  log "Deleting builder cache..."
  rm -rf "$RVB_DIR"/patched
}

delete_cache_no_keystore() {
  log "Deleting builder cache preserving keystore..."
  mv "$RVB_DIR"/patched/fz.keystore "$HOME"/fz.keystore
  rm -rf "$RVB_DIR"/patched
  mkdir -p "$RVB_DIR"/patched
  mv "$HOME"/fz.keystore "$RVB_DIR"/patched/fz.keystore
}

reinstall_builder() {
  log "Deleting fz-builder..."
  [[ "$1" != "--delete-keystore" ]] && {
    [[ -f "$RVB_DIR/patched/fz.keystore" ]] && {
      mv "$RVB_DIR"/patched/fz.keystore "$HOME"/fz.keystore
      log "Preserving the keystore. If you do not want this, use the --delete-keystore flag."
      log "Execute \`$SCR_NAME_EXEC help\` for more info."
    }
  }
  rm -r "$RVB_DIR"
  mkdir -p "$RVB_DIR"
  [[ -f "$HOME/fz.keystore" ]] && {
    log "Restoring the keystore..."
    mkdir -p "$RVB_DIR"/patched
    mv "$HOME"/fz.keystore "$RVB_DIR"/patched/fz.keystore
  }
  log "Reinstalling..."
  cd "$RVB_DIR"
  dload_and_install
}

update_builder() {
  log "Backing up some stuff..."
  [[ -d "$RVB_DIR/patched" ]] && {
    mkdir -p "$HOME"/patched_backup
    mv "$RVB_DIR"/patched/* "$HOME"/patched_backup
  }
  [[ -f "$RVB_DIR/settings.json" ]] && {
    mv "$RVB_DIR"/settings.json "$HOME"/settings.json
  }
  log "Deleting fz-builder..."
  rm -r "$RVB_DIR"
  log "Restoring the backup..."
  mkdir -p "$RVB_DIR"
  [[ -d "$HOME/pathed_backup" ]] && {
    mkdir -p "$RVB_DIR"/patched
    mv "$HOME"/patched_backup/* "$RVB_DIR"/patched
  }
  [[ -f "$HOME/settings.json" ]] && {
    mv "$HOME"/settings.json "$RVB_DIR"/settings.json
  }
  log "Updating fz-builder..."
  cd "$RVB_DIR"
  dload_and_install n
  run_self_update
}

run_self_update() {
  log "Performing self-update..."

  # Download new version
  log "Downloading latest version..."
  ! curl -sLo "$SCR_NAME_EXEC_FP".tmp https://raw.githubusercontent.com/FAUZAN-CELL/fz-builder/main/android-interface.sh && {
    log "Failed: Error while trying to download new version!"
    error "File requested: https://raw.githubusercontent.com/FAUZAN-CELL/fz-builder/main/android-interface.sh" n
  } || log "Done."

  # Copy over modes from old version
  OCTAL_MODE=$(stat -c '%a' "$SCR_NAME_EXEC_FP")
  ! chmod "$OCTAL_MODE" "$SCR_NAME_EXEC_FP.tmp" && error "Failed: Error while trying to set mode on $SCR_NAME_EXEC.tmp." n

  # Spawn update script
  cat > updateScript.sh << EOF
#!/bin/bash

# Overwrite old file with new
mv "$SCR_NAME_EXEC_FP.tmp" "$SCR_NAME_EXEC_FP" && {
  echo -e "[$SCR_NAME] Done. Execute '$SCR_NAME_EXEC run' to launch the builder."
  rm \$0
  } || {
  echo "[$SCR_NAME] Failed!"
  }
EOF

  log "Running update process..."
  exec /bin/bash updateScript.sh
}

main() {
  if [[ -z "$@" ]]; then
    run_builder
  elif [[ $# -gt 2 ]]; then
    error "2 optional arguments acceptable, got $#."
  else
    case $1 in
      run)
        run_builder "$2"
      ;;
      reinstall)
        reinstall_builder "$2"
      ;;
      update)
        update_builder
      ;;
      help)
        help_info
      ;;
      *)
        error "Invalid argument(s): $@."
      ;;
    esac
  fi
}

main $@
