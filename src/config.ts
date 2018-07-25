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
    return await exists(`${path}/help/ref/info.html`) && await exists(`${path}/bin/dm.exe`);
}

export async function byond_path(): Promise<string | undefined> {
    // If it's specified use it right away.
    let directory: string | undefined = workspace.getConfiguration('dreammaker').get('byondPath');
    if (directory === null) {
        // Explicitly disabled.
        return;
    }
    if (directory && await validate_byond_path(directory)) {
        return directory;
    }

    // Attempt to find BYOND in its stock location.
    if (!directory && os.platform() === 'win32') {
        if (await exists("C:/Program Files (x86)/BYOND")) {
            directory = "C:/Program Files (x86)/BYOND";
        } else if (await exists("C:/Program Files/BYOND")) {
            directory = "C:/Program Files/BYOND";
        }
    }

    // Loop until the user finds or cancels
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

    // Store the selected directory
    workspace.getConfiguration('dreammaker').update('byondPath', directory, ConfigurationTarget.Global);
    return directory;
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
