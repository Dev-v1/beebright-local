#!/bin/sh
set -eu
case "$(uname -s)" in
  Darwin|Linux) ;;
  *) printf '%s\n' 'This installer supports macOS and Linux. Use install.ps1 on Windows.' >&2; exit 1 ;;
esac
command -v curl >/dev/null || { printf '%s\n' 'Install curl and try again.' >&2; exit 1; }
BeeRoot="$HOME/.local/share/BeeBright"
BeeBin="$HOME/.local/bin"
mkdir -p "$BeeRoot/tools" "$BeeBin"
export UV_PYTHON_INSTALL_DIR="$BeeRoot/runtime-3.15"
export UV_PYTHON_BIN_DIR="$BeeRoot/tools"
export UV_NO_MODIFY_PATH=1
  curl -fsSL https://astral.sh/uv/install.sh -o "$BeeRoot/uv-install.sh"
  UV_UNMANAGED_INSTALL="$BeeRoot/tools" sh "$BeeRoot/uv-install.sh"
  rm -f "$BeeRoot/uv-install.sh"
"$BeeRoot/tools/uv" python install 3.15
BeePython=$("$BeeRoot/tools/uv" python find --managed-python 3.15)
"$BeePython" -c 'import sys; assert sys.version_info[:2] == (3,15)'
curl -fsSL https://raw.githubusercontent.com/Dev-v1/beebright-local/main/bootstrap.py -o "$BeeRoot/bootstrap.py.new"
mv "$BeeRoot/bootstrap.py.new" "$BeeRoot/bootstrap.py"
# Python writes the shell launcher using shell quoting for paths with spaces.
"$BeePython" - "$BeePython" "$BeeRoot" "$BeeBin" <<'PY'
import pathlib, shlex, sys
python, root, folder = sys.argv[1:]
launcher = pathlib.Path(folder) / 'beebright'
launcher.write_text('#!/bin/sh\nexec ' + shlex.quote(python) + ' ' + shlex.quote(root + '/bootstrap.py') + ' "$@"\n')
launcher.chmod(0o755)
PY
"$BeeBin/beebright" update
# A piped installer cannot change its parent terminal's PATH. Configure both
# interactive and login shells, including macOS bash and custom zsh directories.
BeePathLine='export PATH="$HOME/.local/bin:$PATH" # BeeBright'
bee_add_path() {
  if ! grep -F "$BeePathLine" "$1" >/dev/null 2>&1; then
    printf '\n%s\n' "$BeePathLine" >> "$1"
  fi
}
bee_add_path "$HOME/.bashrc"
if [ -f "$HOME/.bash_profile" ]; then
  BeeBashLogin="$HOME/.bash_profile"
elif [ -f "$HOME/.bash_login" ]; then
  BeeBashLogin="$HOME/.bash_login"
else
  BeeBashLogin="$HOME/.profile"
fi
bee_add_path "$BeeBashLogin"
BeeZshDir="${ZDOTDIR:-$HOME}"
mkdir -p "$BeeZshDir"
bee_add_path "$BeeZshDir/.zprofile"
bee_add_path "$BeeZshDir/.zshrc"
printf '%s\n' 'Installed BeeBright with its own Python 3.15 runtime.' 'To use beebright in this terminal, run:' '  export PATH="$HOME/.local/bin:$PATH"' 'Then type beebright. New bash and zsh terminals load the command automatically.' 'You can also run "$HOME/.local/bin/beebright" directly.' 'macOS/Linux practice opens the offline UI in your browser. Keep the terminal open; Ctrl+C stops it.'
