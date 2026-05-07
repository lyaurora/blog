import {
	type BangumiSnapshot,
	createEmptyBangumiSnapshot,
	fetchBangumiSnapshot,
} from "./bangumi";

let memorySnapshot: BangumiSnapshot | undefined;

export function getCachedBangumiSnapshot() {
	return memorySnapshot ?? createEmptyBangumiSnapshot();
}

export function hasCachedBangumiSnapshot() {
	return memorySnapshot !== undefined;
}

export async function refreshBangumiSnapshot() {
	const snapshot = await fetchBangumiSnapshot();
	memorySnapshot = snapshot;
	return snapshot;
}
