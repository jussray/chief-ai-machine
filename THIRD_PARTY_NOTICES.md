# Third-Party Components and Assets

Chief AI Prompt Machine contains first-party proprietary material and may load or reference third-party assets. The repository’s proprietary `LICENSE` applies only to first-party material authored by or for Juss Ray. It does not replace, narrow, or revoke rights granted by third-party licensors.

## Sources inspected

- `index.html`
- `styles/main.css`
- `scripts/` browser JavaScript files
- Repository root for `package.json`, `package-lock.json`, and other package-manager manifests

No root npm package manifest or lockfile was found. The current browser interface loads JetBrains Mono and Inter through Google Fonts; those fonts remain governed by their respective upstream terms and are not owned by Juss Ray.

## Distribution rule

Before adding or distributing any external font, icon set, script, model, template, or library, record its source, version, license, and any required attribution. If this repository later adopts a package manager, the resolved manifest and lockfile must be included in the third-party audit.

This file is a boundary and audit record, not a substitute for upstream license texts. Do not label third-party fonts, libraries, platform APIs, or assets as owned by Juss Ray merely because the interface uses them.
