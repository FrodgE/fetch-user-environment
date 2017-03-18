# Fetch User Environment

This extension checks that the development environment has the required settings applied and extensions installed, as determined by a development leader.

Local user settings and installed extensions are compared with those stored at a shared location.  User settings that are incorrect are updated and user settings that are missing are merged, all other settings are unchanged.  Extensions that are missing or old are __*side loaded*__ to allow for management of proprietary extensions that are not available in the marketplace, all other extensions are unchanged.

## Features

* Updates incorrect and merges missing local user settings
* Side loads missing or old extensions

## Usage

Once configured (see below), upon starting Visual Studio Code this extension will automatically check that all required settings have been applied and that all required extensions have been installed.  The extension can also be run manually through the command pallete.

To compare the current user settings with those at the shared location, open the command pallete and run the following command.  Settings that are incorrect or missing will be updated.

```
Fetch user environment: Fetch settings
```

To compare extensions that are installed locally with those at the shared location, open the command pallete and run the following command.  Extensions that are newer or missing will be side loaded.

```
Fetch user environment: Fetch extensions
```

## Configuration

This extension requires that the shared locations to retrieve the settings and extensions are specified.  A prompt requesting the paths to the shared locations will be displayed upon first use.  The paths can also be updated manually.

For example on a Windows system with a shared network resource mapped to Z drive the configuration may look as follows:

```json
{
  "fetchUserEnv.remoteSettingsPath": "Z:\\Devtools\\VSCode\\settings",
  "fetchUserEnv.remoteExtensionPath": "Z:\\Devtools\\VSCode\\extensions"
}
```

## Initial Preparation

Before this extension can compare and retrieve settings and extensions, the content at the shared locations must first be created.  This can be done via the command pallete or manually.

#### Command pallete

Creating the content via the command pallete will simply duplicate the current user environment to the shared locations that have been specified.

NOTE: To prevent an accidental overwrite of the content, the shared locations _must_ be empty.  The operation will be terminated otherwise.

The command pallete item to create the shared content is disabled by default.  To enable it change the following setting:

```json
{
  "fetchUserEnv.palEnableSaveEnv": true
}
```

Once the current user environment is configured correctly, and the command pallete item is enabled, open the command pallete and run the following command:

```
Fetch user environment: Save user environment
```

#### Manual

Manual creation of the content is merely a task of copying the desired settings and extensions to the shared locations.  Once the user environment is configured correctly, copy the settings and extensions from the following locations:

Settings

> * __Windows:__ %APPDATA%\Code\User\settings.json
> * __Mac:__ $HOME/Library/Application Support/Code/User/settings.json
> * __Linux:__ $HOME/.config/Code/User/settings.json

Extensions

> * __Windows:__ %USERPROFILE%\\.vscode\extensions
> * __Mac/Linux:__ $HOME/.vscode/extensions

## Available Commands

The following commands are available on the command pallete:

* `Fetch user environment: Fetch settings` - Compare the current user settings with those at the shared location.  Settings that are incorrect or missing will be updated.
* `Fetch user environment: Fetch extensions` - Compare extensions that are installed locally with those at the shared location.  Extensions that are newer or missing will be side loaded.
* `Fetch user environment: Save user environment` - Duplicate the current user environment to the shared locations. (only available when enabled in the settings, see above)

## Settings

All settings and default values are below.  See above for usage details.

```json
{
  "fetchUserEnv.remoteSettingsPath": null,
  "fetchUserEnv.remoteExtensionPath": null,
  "fetchUserEnv.palEnableSaveEnv": false
}
```

## Release Notes

### 1.0.1

Fix typos

### 1.0.0

Initial release

---
<a href="https://twitter.com/mr_frodge" class="twitter-follow-button" data-show-count="false">Follow @mr_frodge</a><script async src="//platform.twitter.com/widgets.js" charset="utf-8"></script>
