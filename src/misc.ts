'use strict';

import * as crypto from 'crypto';
import * as fs from 'fs';

export function promisify(func: Function, this_: any = undefined): Function {
	return (...args: any[]) => {
		return new Promise((resolve, reject: any) => {
			args.push((err: any, ...rest: any[]) => {
				if (err) {
					if (reject) {
						reject(err);
						reject = null;
					}
				} else {
					resolve.apply(undefined, Array.prototype.slice.call(rest, 1));
				}
			});
			try {
				func.apply(this_, args);
			} catch (err) {
				if (reject) {
					reject(err);
					reject = null;
				}
			}
		});
	};
}

export async function is_executable(path: string): Promise<boolean> {
	try {
		await promisify(fs.access)(path, fs.constants.R_OK | fs.constants.X_OK);
		return true;
	} catch (e) {
		return false;
	}
}

export async function md5_file(path: string): Promise<string> {
	let output = crypto.createHash('md5');
	let input = fs.createReadStream(path);
	input.pipe(output);
	await promisify(output.once, output)('readable');
	let read = output.read();
	if (typeof read === 'string') {
		return read;
	} else {
		return read.toString('hex');
	}
}
