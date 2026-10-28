# BeeBright Local development

- This repository owns the local desktop/browser app, its tracks, offline data, updater and releases. Make local-only changes here. Do not implement them in Dev-v1/beebright.
- Edit UI source in ui-source/src. Generated UI assets belong in the release ZIP, not in source control.
- Every code, track or content update must update release.json and CHANGELOG.md and ship as a GitHub Release in Dev-v1/beebright-local.
- Build with npm ci --prefix ui-source, then node tools/build-release.mjs. The build must use only files in this repository and installed dependencies.
- Run node --test ui-source/src/*.test.js and python -m unittest discover -v. Test updates with tools/test-local-update.ps1 on Windows.
- Keep update downloads restricted to beebright-local releases. Preserve checksum verification and user progress during upgrades.
- The main-branch workflow tests and builds the local source, publishes the ZIP plus update-manifest.json, and updates the legacy manifest only after publishing succeeds. Never import or synchronize website source.

- Keep the public install commands at https://beebright.app/install.ps1 and /install.sh. Preserve compatibility with older beebright.vercel.app install links. These install the local-repository updater; new app versions must come from published beebright-local releases.
