// A task provider for running DreamMaker builds.
import * as fs from 'fs';
import * as os from 'os';
import { dirname } from 'path';
import { TaskProvider, CancellationToken, Task, ProcessExecution, TaskDefinition, workspace, TaskGroup } from "vscode";

import * as config from './config';
import { promisify } from './misc';

class DMTask implements TaskDefinition {
    type = 'dreammaker';  // must match package.json
    dme: string;

    constructor(dme: string) {
        this.dme = dme;
    }
}

export class Provider implements TaskProvider {
    async provideTasks(token?: CancellationToken): Promise<Task[]> {
        let list = [];
        let dm_exe_path;
        for (let folder of (workspace.workspaceFolders || [])) {
            if (folder.uri.scheme !== 'file') {
                continue;
            }
            let path = folder.uri.fsPath;
            let files: string[] = await promisify(fs.readdir)(path);
            for (let file of files) {
                if (!file.endsWith('.dme')) {
                    continue;
                }

                if (!dm_exe_path) {
                    dm_exe_path = await config.find_byond_file(['bin/dm.exe', 'bin/DreamMaker']);
                    if (!dm_exe_path) {
                        // not configured
                        return [];
                    }
                }

                let env: {[key: string]: string} = {};
                if (os.platform() !== 'win32') {
                    env['LD_LIBRARY_PATH'] = dirname(dm_exe_path);
                }

                let task = new Task(
                    new DMTask(file),
                    folder,
                    `build - ${file}`,
                    "dm",
                    new ProcessExecution(dm_exe_path, [file], { cwd: path, env: env }),
                    '$dreammaker'
                );
                task.group = TaskGroup.Build;
                list.push(task);
            }
        };
        return list;
    }

    resolveTask(task: Task, token?: CancellationToken): undefined {
        return;
    }
}
