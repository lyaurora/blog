/**
 * 防抖函数 - 延迟执行，在等待期间如果再次触发则重新计时
 * @param func 要执行的函数
 * @param wait 延迟时间（毫秒）
 * @returns 防抖处理后的函数
 */
export function debounce<T extends (...args: never[]) => unknown>(
	func: T,
	wait: number,
): (...args: Parameters<T>) => void {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	return function (this: unknown, ...args: Parameters<T>) {
		if (timeoutId !== null) {
			clearTimeout(timeoutId);
		}

		timeoutId = setTimeout(() => {
			func.apply(this, args);
			timeoutId = null;
		}, wait);
	};
}

/**
 * 节流函数 - 限制函数执行频率
 * @param func 要执行的函数
 * @param wait 时间间隔（毫秒）
 * @returns 节流处理后的函数
 */
export function throttle<T extends (...args: never[]) => unknown>(
	func: T,
	wait: number,
): (...args: Parameters<T>) => void {
	let lastTime = 0;
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	return function (this: unknown, ...args: Parameters<T>) {
		const now = Date.now();

		if (now - lastTime >= wait) {
			if (timeoutId !== null) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}
			lastTime = now;
			func.apply(this, args);
		} else if (timeoutId === null) {
			timeoutId = setTimeout(
				() => {
					lastTime = Date.now();
					timeoutId = null;
					func.apply(this, args);
				},
				wait - (now - lastTime),
			);
		}
	};
}
