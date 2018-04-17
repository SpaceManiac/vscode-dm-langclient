'use strict';

import { NotificationType } from 'vscode-languageclient';

export const WindowStatus: NotificationType<WindowStatusParams, {}> = new NotificationType('$window/status');
export interface WindowStatusParams {
    environment: string | undefined,
    tasks: string[] | undefined,
}
