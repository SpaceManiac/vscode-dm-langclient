'use strict';

export function promisify(original_function: Function): Function {
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
				original_function.apply(undefined, args);
			} catch (err) {
				if (reject) {
					reject(err);
					reject = null;
				}
			}
		});
	};
}
