// A task provider for running DreamMaker builds.
import * as os from 'os';
import { dirname } from 'path';
import { TaskProvider, CancellationToken, Task, ProcessExecution, TaskDefinition, workspace, TaskGroup, FileType } from "vscode";

import * as config from './config';

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
            for (let [file, type] of await workspace.fs.readDirectory(folder.uri)) {
                if (type == FileType.Directory) {
                    continue;
                }
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
                    new ProcessExecution(dm_exe_path, [file], {
                        cwd: folder.uri.scheme === 'file' ? folder.uri.fsPath : undefined,
                        env: env
                    }),
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
