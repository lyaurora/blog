import {
	type BangumiSnapshot,
	createEmptyBangumiSnapshot,
	fetchBangumiSnapshot,
} from "./bangumi";

const MEMORY_CACHE_TTL_MS = 10 * 60 * 1000;

let memorySnapshot: BangumiSnapshot | undefined;
let memorySnapshotUpdatedAt = 0;
let refreshPromise: Promise<BangumiSnapshot> | undefined;

interface BangumiSnapshotResult {
	source: "memory" | "fresh";
	snapshot: BangumiSnapshot;
}

function isMemorySnapshotFresh(): boolean {
	return Boolean(
		memorySnapshot &&
			Date.now() - memorySnapshotUpdatedAt < MEMORY_CACHE_TTL_MS,
	);
}

export function getCachedBangumiSnapshot(): BangumiSnapshot {
	return memorySnapshot ?? createEmptyBangumiSnapshot();
}

export function hasCachedBangumiSnapshot(): boolean {
	return memorySnapshot !== undefined;
}

export async function getBangumiSnapshot(): Promise<BangumiSnapshotResult> {
	if (memorySnapshot && isMemorySnapshotFresh()) {
		return {
			source: "memory" as const,
			snapshot: memorySnapshot,
		};
	}

	const snapshot = await refreshBangumiSnapshot();
	return {
		source: "fresh" as const,
		snapshot,
	};
}

export async function refreshBangumiSnapshot(): Promise<BangumiSnapshot> {
	if (refreshPromise) return refreshPromise;

	refreshPromise = fetchBangumiSnapshot()
		.then((snapshot) => {
			memorySnapshot = snapshot;
			memorySnapshotUpdatedAt = Date.now();
			return snapshot;
		})
		.finally(() => {
			refreshPromise = undefined;
		});

	return refreshPromise;
}
