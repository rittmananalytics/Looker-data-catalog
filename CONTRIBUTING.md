# Contributing

Thanks for helping. Issues and pull requests are welcome.

## Before you open a pull request

- Keep one app for every deployment. Branding and wording go in `catalog.yml`, not in `app.src.js`.
- Keep the app under Looker's 900 KB limit per app on a large project. Say in the pull request how a change affects the size.
- Never add client data, credentials, logos you do not have the right to share, or screenshots that show people's names.
- Run the checks the CI runs:

```bash
python3 -m py_compile skills/looker-data-catalog/scripts/*.py skills/looker-data-catalog/template/catalog_builder/build_metadata.py
cp skills/looker-data-catalog/template/app/src/app.src.js /tmp/app.mjs && node --check /tmp/app.mjs
```

- If you change a step, update `SKILL.md` and the README.

## Reporting a security problem

Do not open a public issue. Use GitHub's private vulnerability reporting on this repo.
