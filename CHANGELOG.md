# Change Log

All notable changes to the "fetch-user-environment" extension will be documented in this file.

## [Unreleased]

- Prompt if unable to access remote data
- Log activity to output channel

## [1.1.0] - 2017-06-09

- Fix ENOENT (no such file or directory) error when attempting to read the local settings file before it has been created
- Add support to update unchanged local user settings to a default value (feature request, thanks @ajansveld for the suggestion)

## [1.0.3] - 2017-04-08

- Fix comparison of object arrays within user settings
- Add button to reload window when settings or extensions are updated

## [1.0.2] - 2017-03-20

- Detect JSON errors with configuration files and alert the user
- Provide feedback if settings and extensions are up to date when run from the command palette
- Extension no longer saves itself when saving the environment

## [1.0.1] - 2017-03-19

- Fix typos

## [1.0.0] - 2017-03-19

- Initial release
