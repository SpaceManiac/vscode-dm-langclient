// Utilities for managing the configuration.
'use strict';

import * as os from 'os';
import { workspace, window, Uri, ConfigurationTarget } from "vscode";
import { exists } from './misc';

export async function auto_update(): Promise<boolean> {
    let enabled: boolean | undefined = workspace.getConfiguration('dreammaker').get('autoUpdate');
    if (typeof enabled === 'boolean') {
        return enabled;
    }
    let choice = await window.showInformationMessage("Auto-updates are available for dm-langserver. Would you like to enable them?", "Yes", "Just Once", "No");
    if (choice === "Yes") {
        workspace.getConfiguration('dreammaker').update('autoUpdate', true, ConfigurationTarget.Global);
        return true;
    } else if (choice === "Just Once") {
        workspace.getConfiguration('dreammaker').update('autoUpdate', false, ConfigurationTarget.Global);
        return true;
    } else if (choice === "No") {
        workspace.getConfiguration('dreammaker').update('autoUpdate', false, ConfigurationTarget.Global);
        return false;
    } else {
        return false;
    }
}

async function validate_byond_path(path: string): Promise<boolean> {
    // Windows or Linux installs are OK
    return await exists(`${path}/bin/dm.exe`) || await exists(`${path}/bin/DreamMaker`);
}

export const DREAM_MAKER: string[] = ['bin/dm.exe', 'bin/DreamMaker'];
export const DREAM_DAEMON: string[] = ['bin/dreamdaemon.exe', 'bin/DreamDaemon'];
export const DREAM_SEEKER: string[] = ['bin/dreamseeker.exe'];
export async function find_byond_file(nameset: string[]): Promise<string | undefined> {
    // If it's specified use it right away.
    let directories: string | string[] | undefined = workspace.getConfiguration('dreammaker').get('byondPath');
    if (directories === null) {
        // Explicitly disabled.
        return;
    } else if (directories === undefined || directories === "") {
        // Not configured => empty array.
        directories = [];
    } else if (!(directories instanceof Array)) {
        // Configured as a string => single-element array.
        directories = [directories];
    }

    // Attempt to find BYOND in its stock location.
    if (!directories.length && os.platform() === 'win32') {
        if (await exists("C:/Program Files (x86)/BYOND")) {
            directories.push("C:/Program Files (x86)/BYOND");
        } else if (await exists("C:/Program Files/BYOND")) {
            directories.push("C:/Program Files/BYOND");
        }
    }

    // If the search path is empty, prompt the user.
    // Loop until the user finds or cancels.
    if (!directories.length) {
        let directory;
        while (true) {
            let message;
            if (!directory) {
                message = "This feature requires a BYOND path to be configured. Select now?";
            } else if (!await validate_byond_path(directory)) {
                message = `"${directory}" does not appear to contain a BYOND installation. Select again?`;
            } else {
                break;
            }

            let choice = await window.showInformationMessage(message, "Configure", "Never");
            if (choice === "Never") {
                workspace.getConfiguration('dreammaker').update('byondPath', null, ConfigurationTarget.Global);
                return undefined;
            } else if (choice !== "Configure") {
                return undefined;
            }

            let selection: Uri[] | undefined = await window.showOpenDialog({
                defaultUri: directory ? Uri.file(directory) : undefined,
                canSelectFiles: false,
                canSelectFolders: true,
            });
            if (!selection) {  // cancelled
                return undefined;
            }
            if (selection[0].scheme != 'file') {
                continue;
            }
            directory = selection[0].fsPath;
        }
        directories = [directory];
        workspace.getConfiguration('dreammaker').update('byondPath', directories, ConfigurationTarget.Global);
    }

    // Hit the search paths.
    for (let each of directories) {
        for (let name of nameset) {
            let path = `${each}/${name}`;
            if (await exists(path)) {
                return path;
            }
        }
    }
}

export async function tick_on_create(): Promise<boolean> {
    let enabled: boolean | undefined = workspace.getConfiguration('dreammaker').get('tickOnCreate');
    if (typeof enabled === 'boolean') {
        return enabled;
    }
    let choice = await window.showInformationMessage("Would you like to tick newly-created code files?", "Once", "Always", "Never");
    if (choice === "Always") {
        workspace.getConfiguration('dreammaker').update('tickOnCreate', true, ConfigurationTarget.Global);
        return true;
    } else if (choice === "Once") {
        return true;
    } else if (choice === "Never") {
        workspace.getConfiguration('dreammaker').update('tickOnCreate', false, ConfigurationTarget.Global);
        return false;
    } else {
        return false;
    }
}

export async function object_tree_pane(): Promise<boolean> {
    let enabled: boolean | undefined = workspace.getConfiguration('dreammaker').get('objectTreePane');
    if (typeof enabled === 'boolean') {
        return enabled;
    }
    // Just default to `false` for now because of the performance penalty involved.
    return false;
}

export async function reparse_on_save(): Promise<boolean> {
    let enabled: boolean | undefined = workspace.getConfiguration('dreammaker').get('reparseOnSave');
    if (typeof enabled === 'boolean') {
        return enabled;
    }
    // Default to `false` for now because reparsing can take up to 30s+ on older machines.
    return false;
}
