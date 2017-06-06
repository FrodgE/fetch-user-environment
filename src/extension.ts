'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// Modules from Node.js
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Other libraries from npm
const fse = require('fs-extra');
const compareVer = require('semver-compare');
const stripJsonComments = require('strip-json-comments');

// Exception
function JSONError(message, filename) {
    this.message = message;
    this.filename = filename;
    this.stack = (new Error()).stack;
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
    // Get config
    var config = vscode.workspace.getConfiguration("fetchUserEnv");
    var remoteExt = config.get("remoteExtensionPath");
    var remoteSet = config.get("remoteSettingsPath");

    // New environment fetcher
    var environmentFetcher = new FetchEnvironment(remoteExt, remoteSet);

    // Register Commands
    let fetchExtDisposable = vscode.commands.registerCommand('fetchUserEnv.extensions', async function() {
        try {
            await environmentFetcher.fetchExtensions(true);
        } catch (err) {
            vscode.window.showErrorMessage("Failed to fetch extensions.");
            console.error(err);
        }
    });

    let fetchSetDisposable = vscode.commands.registerCommand('fetchUserEnv.settings', async function() {
        try {
            await environmentFetcher.fetchSettings(true);
        } catch (err) {
            vscode.window.showErrorMessage("Failed to fetch settings.");
            console.error(err);
        }
    });

    let saveEnvDisposable = vscode.commands.registerCommand('fetchUserEnv.saveEnvironment', async function() {
        try {
            await environmentFetcher.saveEnvironment();
        } catch (err) {
            vscode.window.showErrorMessage("Failed to save environment.");
            console.error(err);
        }
    });

    // Add to a list of disposables which are disposed when this extension is deactivated.
    context.subscriptions.push(fetchExtDisposable,
                                fetchSetDisposable,
                                saveEnvDisposable);

    // Run automatically on start up.  Don't prompt the user if paths aren't configured.
    // Fetch extensions
    try {
        await environmentFetcher.fetchExtensions(false);
    } catch (err) {
        vscode.window.showErrorMessage("Failed to fetch extensions.");
        console.error(err);
    }

    // Fetch Settings
    try {
        await environmentFetcher.fetchSettings(false);
    } catch (err) {
        vscode.window.showErrorMessage("Failed to fetch settings.");
        console.error(err);
    }
}

// this method is called when your extension is deactivated
export function deactivate() {
}

class FetchEnvironment {
    private _localExtensionPath : string;
    private _remoteExtensionPath : string;
    private _localSettingsPath : string;
    private _remoteSettingsPath : string;
    
    private _localExtVersions = {};

    constructor(remoteExt, remoteSet) {
        // Set remote paths
        this._remoteExtensionPath = remoteExt;
        this._remoteSettingsPath = remoteSet;

        // Set local paths
        this.getLocalPaths();
    }

    private getLocalPaths() {
        // Path of installed extensions
        this._localExtensionPath = path.join(os.homedir(), ".vscode", "extensions");

        // Path of environment settings
        if (os.platform() === "win32") {
            this._localSettingsPath = path.join(process.env.APPDATA, "Code", "User");
        }
        if (os.platform() === "darwin") {
            this._localSettingsPath = path.join(os.homedir(), "Library", "Application Support", "Code", "User");
        }
        if (os.platform() === "linux") {
            this._localSettingsPath = path.join(os.homedir(), ".config", "Code", "User");
        }
    }

    private saveRemoteExtensionPath(path : string) {
        this._remoteExtensionPath = path;

        try {
            this.updateSettings({'fetchUserEnv.remoteExtensionPath' : this._remoteExtensionPath});
        }
        catch (err) {
            throw err;
        }
    }

    private saveRemoteSettingsPath(path : string) {
        this._remoteSettingsPath = path;

        try {
            this.updateSettings({'fetchUserEnv.remoteSettingsPath' : this._remoteSettingsPath});
        }
        catch (err) {
            throw err;
        }
    }

    private async getRemoteExtensionPath() {
        var path = await vscode.window.showInputBox({prompt: "Please enter path for remote extensions"});

        if (!path) {
            vscode.window.showWarningMessage('Path for remote extensions not specified, operation cancelled.');
            return false;
        }

        try {
            this.saveRemoteExtensionPath(path);
        }
        catch (err) {
            throw err;
        }

        return true;
    }

    private async getRemoteSettingsPath() {
        var path = await vscode.window.showInputBox({prompt: "Please enter path for remote settings"});

        if (!path) {
            vscode.window.showWarningMessage('Path for remote settings not specified, operation cancelled.');
            return false;
        }

        try {
            this.saveRemoteSettingsPath(path);
        }
        catch (err) {
            throw err;
        }

        return true;
    }

    public async fetchExtensions(prompt: boolean) {
        if (!this._remoteExtensionPath) {
            if (!prompt) {
                return;
            }

            try {
                if (!await this.getRemoteExtensionPath()) {
                    return;
                }
            }
            catch (err) {
                if (err instanceof JSONError) {
                    let message = "Error detected in configuration file: \"" + err.filename + "\", " + err.message;
                    vscode.window.showErrorMessage(message);
                    return;
                }
            }

        }

        if (!fs.existsSync(this._remoteExtensionPath)) {
            try {
                this.saveRemoteExtensionPath(null);
            }
            catch (err) {
                if (err instanceof JSONError) {
                    // Not great, not the end of the world either.  Prompt but move on.
                    let message = "Error detected in configuration file: \"" + err.filename + "\", " + err.message;
                    vscode.window.showWarningMessage(message);
                }
            }

            vscode.window.showErrorMessage('Cannot access extensions at specified remote path.');
            console.error('Specified remote extension path \"' + this._remoteExtensionPath + "\" does not exist");

            return;
        }

        // Check versions of installed extensions
        this.getInstalledExtensions();

        try {
            // Compare local versions to remote, and copy newer versions
            if (this.installNewExtensions()) {
                // Extensions were updated, reload/restart required
                let reloadOption = {title: 'Reload'};
                vscode.window.showInformationMessage('Extensions updated, please restart Visual Studio Code or reload window', reloadOption)
                    .then(choice => {
                        if (choice === reloadOption) {
                            vscode.commands.executeCommand('workbench.action.reloadWindow');
                        }
                    });
            }
            else {
                if (prompt) {
                    vscode.window.showInformationMessage('Extensions are up to date');
                }
                console.log('No updated extensions found.');
            }
        }
        catch (err) {
            if (err instanceof JSONError) {
                let message = "Error detected in extension package file: \"" + err.filename + "\", " + err.message;
                vscode.window.showErrorMessage(message);
            }
            else {
                vscode.window.showErrorMessage("Failed to fetch extensions.");
            }
            console.error(err);
        }

        return;
    }

    public async fetchSettings(prompt: boolean) {
        if (!this._remoteSettingsPath) {
            if (!prompt) {
                return;
            }

            try {
                if (!await this.getRemoteSettingsPath()) {
                    return;
                }
            }
            catch (err) {
                if (err instanceof JSONError) {
                    let message = "Error detected in configuration file: \"" + err.filename + "\", " + err.message;
                    vscode.window.showErrorMessage(message);
                    return;
                }
            }
        }

        if (!fs.existsSync(path.join(this._remoteSettingsPath, "settings.json"))) {
            try {
                this.saveRemoteSettingsPath(null);
            }
            catch (err) {
                if (err instanceof JSONError) {
                    // Not great, not the end of the world either.  Prompt but move on.
                    let message = "Error detected in configuration file: \"" + err.filename + "\", " + err.message;
                    vscode.window.showWarningMessage(message);
                }
            }

            vscode.window.showErrorMessage('Cannot access settings at specified remote path.');
            console.error('\"settings.json\" does not exist in specified remote settings path \"' + this._remoteSettingsPath + "\"");

            return;
        }

        try {
            // Compare local settings to remote, update as required
            if (this.compareRemoteSettings()) {
                // Settings were updated, reload/restart required
                let reloadOption = {title: 'Reload'};
                vscode.window.showInformationMessage('Settings updated, please restart Visual Studio Code or reload window', reloadOption)
                    .then(choice => {
                        if (choice === reloadOption) {
                            vscode.commands.executeCommand('workbench.action.reloadWindow');
                        }
                    });
            }
            else {
                if (prompt) {
                    vscode.window.showInformationMessage('Settings are up to date');
                }
                console.log('No updated settings found.');
            }
        }
        catch (err) {
            if (err instanceof JSONError) {
                let message = "Error detected in configuration file: \"" + err.filename + "\", " + err.message;
                vscode.window.showErrorMessage(message);
            }
            else {
                vscode.window.showErrorMessage("Failed to fetch settings.");
            }
            console.error(err);
        }

        return;
    }

    public async saveEnvironment() {
        try {
            if (!this._remoteExtensionPath) {
                if (!await this.getRemoteExtensionPath()) {
                    return;
                }
            }
        }
        catch (err) {
            if (err instanceof JSONError) {
                let message = "Error detected in configuration file: \"" + err.filename + "\", " + err.message;
                vscode.window.showErrorMessage(message);
                return;
            }
        }

        try {
            if (!this._remoteSettingsPath) {
                if (!await this.getRemoteSettingsPath()){
                    return;
                }
            }
        }
        catch (err) {
            if (err instanceof JSONError) {
                let message = "Error detected in configuration file: \"" + err.filename + "\", " + err.message;
                vscode.window.showErrorMessage(message);
                return;
            }
        }

        if (!fs.existsSync(this._remoteSettingsPath)) {
            // Path does not yet exist, create it
            fse.ensureDir(this._remoteSettingsPath, function (err) {
                if (err) return console.error(err);
            });
        }

        if (!fs.existsSync(this._remoteExtensionPath)) {
            // Path does not yet exist, create it
            fse.ensureDir(this._remoteExtensionPath, function (err) {
                if (err) return console.error(err);
            });
        }

        var settingsPath: string;
        var extensionPath: string;

        if (os.platform() === "win32") {
            // Windows is case preserving, case insensitive
            // Convert to lowercase
            settingsPath = String(this._remoteSettingsPath).toLowerCase();
            extensionPath = String(this._remoteExtensionPath).toLowerCase();
        }
        else {
            settingsPath = String(this._remoteSettingsPath);
            extensionPath = String(this._remoteExtensionPath);
        }

        // Are the remote paths empty?  Count the number of items.
        var items = fs.readdirSync(settingsPath).length;
        items += fs.readdirSync(extensionPath).length;

        // Check if paths are nested.
        if ((settingsPath !== extensionPath)
            && (settingsPath.startsWith(extensionPath)
                || extensionPath.startsWith(settingsPath)))
        {
            // Nested, reduce item count.
            items -= 1;
        }

        if (items > 0) {
            vscode.window.showErrorMessage('Cannot save environment, remote paths are not empty.');
            return;
        }

        try {
            // Copy settings and extensions to remote locations
            this.copyEnvToRemote();
        }
        catch (err) {
            if (err instanceof JSONError) {
                let message = "Error detected in configuration file: \"" + err.filename + "\", " + err.message;
                vscode.window.showErrorMessage(message);
            }
            else {
                vscode.window.showErrorMessage("Failed to save environment.");
            }
            console.error(err);
        }

        try {
            // Hide command pallete menu item
            this.updateSettings({'fetchUserEnv.palEnableSaveEnv' : false});
        }
        catch (err) {
            if (err instanceof JSONError) {
                // Not great, not the end of the world either.  Prompt but move on.
                let message = "Error detected in configuration file: \"" + err.filename + "\", " + err.message;
                vscode.window.showWarningMessage(message);
            }
        }
        
        vscode.window.showInformationMessage('Current environment saved.');
        return;
    }

    private compareRemoteSettings() {
        var remoteSettings;

        try {
            // Read remote settings file
            // Need to strip comments out...
            remoteSettings = JSON.parse(stripJsonComments(fs.readFileSync(path.join(this._remoteSettingsPath, "settings.json"), "UTF-8")));
        }
        catch (err) {
            // Invalid JSON data
            throw new JSONError(err.message, path.join(this._remoteSettingsPath, "settings.json"));
        }
        
        // Filter out settings related to this extension
        for (let key in remoteSettings) {
            if (remoteSettings.hasOwnProperty(key) && key.startsWith("fetchUserEnv")) {
                delete remoteSettings[key];
            }
        }

        // Local environment settings
        var localEnvironment = vscode.workspace.getConfiguration();

        var updated: boolean = false;
        var newSettings = {};

        for (let prop in remoteSettings) {
            let base = {};
            let compare = {};
            
            base[prop] = localEnvironment.get(prop);
            compare[prop] = remoteSettings[prop];
            
            // Returned object will have no properties if base & compare are the same
            let res = this.compareUpdate(base, compare);
            
            for (let key in res) {
                if (res.hasOwnProperty(key)) {
                    // Object has a property therefore a difference was found
                    // Add to list of required updates
                    Object.assign(newSettings, res);
                    updated = true;
                    
                    let logStr = JSON.stringify(res, null, 2);
                    console.log("Updating config parameter");
                    console.log(logStr);
                    break;
                }
            }
        }

        if (updated) {
            try {
                // New settings were found
                this.updateSettings(newSettings);
            }
            catch (err) {
                throw err;
            }
        }
        return updated;
    }

    private compareUpdate(base: {}, compare: {}) {
        // Quick wins, look for items that have been added or removed
        // Are there nested items that need to be added?
        for (let prop in compare) {
            if ((typeof(base[prop]) === "undefined")    // Property value within the initial base object is queried from the current environment and consequently may not actually exist.
                || (!base.hasOwnProperty(prop)))
            {
                // No need to keep searching
                return compare;
            }
        }
        // Are there nested items in the baseline that need to be removed?
        for (let prop in base) {
            if ((typeof(compare[prop]) === "undefined") // Should be redundant but keep for consistency
                || (!compare.hasOwnProperty(prop))) {
                // No need to keep searching
                return compare;
            }
        }

        // Compare each item
        for (let prop in compare) {
            // Check if we need to dig deeper...
            if (typeof(compare[prop]) === "object") {
                let diff = this.compareUpdate(base[prop] , compare[prop]);

                // Check if differences were found
                for (let key in diff) {
                    if (diff.hasOwnProperty(key)) {
                        // A difference was found, return entire object.
                        // Returning differences only will delete matching items
                        return compare;
                    }
                }
            }
            else if (base[prop] !== compare[prop]) {
                // A difference was found, return entire object.
                // Returning differences only will delete matching items
                return compare;
            }
        }

        // No differences, return empty object
        return {};
    }

    private getInstalledExtensions() {
        // Get all extensions and filter for those installed by the user
        var localExtensions = vscode.extensions.all.filter(ext => {
            return ext.extensionPath.startsWith(this._localExtensionPath);
        });
        
        // Query the version of each installed extension
        for (let ext in localExtensions) {
            this._localExtVersions[localExtensions[ext].id] = localExtensions[ext].packageJSON["version"];
        }
    }

    private installNewExtensions() {
        // Find all extensions at the remote path
        // Obtain list of all top level directories
        var folders = fs.readdirSync(this._remoteExtensionPath).filter(file => fs.statSync(path.join(this._remoteExtensionPath, file)).isDirectory());

        var updated: boolean = false;

        for (let folder in folders) {
            let packageFile = path.join(this._remoteExtensionPath, folders[folder], "package.json");

            if (!fs.existsSync(packageFile)) {
                // Not a valid extension directory, skip
                continue;
            }

            // Query extension ID
            let json_file;

            try {
                json_file = JSON.parse(fs.readFileSync(packageFile, "UTF-8"));
            }
            catch (err) {
                throw new JSONError(err.message, packageFile);
            }

            let id = json_file["publisher"] + "." + json_file["name"];
            let version = json_file["version"];

            if (typeof this._localExtVersions[id] !== "undefined") {
                if (compareVer(this._localExtVersions[id], version) >= 0) {
                    // Correct version, move along
                    continue;
                }
            }

            // Missing or old version, copy from remote source.
            // No need to remove old version, VS Code will do that automatically upon restart
            console.log("Updating extension \"" + id + "\" to version " + version);
            let srcPath = path.join(this._remoteExtensionPath, folders[folder]);
            let dstPath = path.join(this._localExtensionPath, id + "-" + version);
            fse.copy(srcPath, dstPath, function (err) {
                if (err) return console.error(err);
            });
            updated = true;
        }

        return updated;
    }

    private copyEnvToRemote() {
        var localSettings;

        try {
            // Copy settings
            // Read local settings file so it can be filtered and saved
            // Need to strip comments out...
            localSettings = JSON.parse(stripJsonComments(fs.readFileSync(path.join(this._localSettingsPath, "settings.json"), "UTF-8")));
        } catch (err) {
            throw new JSONError(err.message, path.join(this._localSettingsPath, "settings.json"));
        }
        
        // Filter out settings related to this extension
        for (let key in localSettings) {
            if (localSettings.hasOwnProperty(key) && key.startsWith("fetchUserEnv")) {
                delete localSettings[key];
            }
        }

        // Save to remote
        var remoteSettingsJSON = JSON.stringify(localSettings, null, 2);
        fs.writeFileSync(path.join(this._remoteSettingsPath, "settings.json"), remoteSettingsJSON, "UTF-8");

        // Copy extensions
        // Get all extensions and filter for those installed by the user
        var localExtensions = vscode.extensions.all.filter(ext => {
            return ext.extensionPath.startsWith(this._localExtensionPath);
        });

        // Filter out this extension!
        localExtensions = localExtensions.filter(ext => {
            return !ext.extensionPath.includes("fetch-user-environment");
        });

        for (let ext in localExtensions) {
            let srcPath = localExtensions[ext].extensionPath;
            let dstPath = path.join(this._remoteExtensionPath, path.basename(srcPath));
            fse.copy(srcPath, dstPath, function (err) {
                if (err) return console.error(err);
            });
        }
    }

    private updateSettings(newSettings: {}) {
        var localSettings = {};
        var localSettingsFile = path.join(this._localSettingsPath, "settings.json");

        // Does the local settings file exist yet?
        if (fs.existsSync(localSettingsFile)) {
            try {
                // It exists!  Read local settings file so new settings can be merged and saved
                // Need to strip comments out...
                localSettings = JSON.parse(stripJsonComments(fs.readFileSync(localSettingsFile, "UTF-8")));
            }
            catch (err) {
                throw new JSONError(err.message, localSettingsFile);
            }
        }

        // Update cached local settings
        Object.assign(localSettings, newSettings);

        // Save back to disk (creating the local settings file if required)
        var localSettingsJSON = JSON.stringify(localSettings, null, 2);
        fs.writeFileSync(localSettingsFile, localSettingsJSON, "UTF-8");
    }

    dispose() {}
}
