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
3. The structure of `settings` and `users` (including `videos`) is preserved.
4. No additional properties are added if the schema forbids them.

## General Rules

- Maintain consistent indentation (2 spaces).
- Ensure URLs are valid and titles are descriptive.
- If adding a new user, follow the existing pattern in the `users` array.
