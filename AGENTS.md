# AI Agents Guidelines

When editing the content of this repository, especially `public/content.json`, please follow these rules:

## JSON Validation

Whenever you modify `public/content.json`, you **must** validate it against its schema `public/content.schema.json`.

### How to validate

You can use a JSON schema validator to ensure your changes are correct. If you have access to a terminal, you can install and use `ajv-cli` (or a similar tool):

```bash
# One-time installation
npm install -g ajv-cli

# Validation command
ajv validate -s public/content.schema.json -d public/content.json
```

If you don't have the tools installed, manually verify that:
1. All required fields are present.
2. Data types match the schema (e.g., integers for minutes/points, boolean for flags).
3. The structure of `settings` and `users` (including `categories` and their `videos`) is preserved.
4. No additional properties are added if the schema forbids them.

## Versioning

Whenever you make **any** change to the code, you **must** bump the `version` field in `package.json`. This version is shown in the UI (bottom-left corner), so it must always reflect the current state of the code.

Follow [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`) when choosing the new number:

1. **MAJOR** (`x.0.0`) — increment for incompatible or breaking changes (e.g., removing/renaming a feature, changing the content schema in a non-backward-compatible way).
2. **MINOR** (`0.x.0`) — increment for new, backward-compatible functionality (e.g., adding a new feature or option). Reset PATCH to `0`.
3. **PATCH** (`0.0.x`) — increment for backward-compatible bug fixes, small tweaks, refactors, or documentation-only changes.

Always bump exactly one number and reset the lower-order numbers to `0` (e.g., `1.2.3` → `1.3.0` for a minor bump).

### How to bump the version

**Always** use the `npm version` command instead of hand-editing `package.json`. This bumps the `version` field in **both** `package.json` and `package-lock.json` in one step, keeping them in sync and avoiding drift:

```bash
# Choose exactly one of the following, matching the SemVer guidance above:
npm version patch --no-git-tag-version   # bug fixes, small tweaks, docs
npm version minor --no-git-tag-version   # new, backward-compatible features
npm version major --no-git-tag-version   # breaking changes
```

The `--no-git-tag-version` flag updates the files without creating a git commit or tag, so you stay in control of committing.

If you ever edit `package.json` by hand, you **must** afterwards run `npm install --package-lock-only` (or `npm install`) so that `package-lock.json` is realigned to the same version. `package.json` and `package-lock.json` must never disagree on the `version`.

## General Rules

- Maintain consistent indentation (2 spaces).
- Ensure URLs are valid and titles are descriptive.
- If adding a new user, follow the existing pattern in the `users` array.
