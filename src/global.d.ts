import type { AstroIntegration } from "@swup/astro";

interface Pagefind {
	search: (query: string) => Promise<{
		results: Array<{
			data: () => Promise<SearchResult>;
		}>;
	}>;
	init?: () => Promise<void>;
	options?: (options: Record<string, unknown>) => Promise<void>;
	preload?: (query: string) => Promise<void>;
}

declare global {
	interface BangumiSnapshot {
		updatedAt?: string;
		revision?: string;
		collections: Array<{
			type?: number;
			label?: string;
			list?: unknown[];
		}>;
	}

	interface BangumiSnapshotCacheEnvelope {
		version: number;
		cachedAt: number;
		snapshot: BangumiSnapshot;
	}

	interface BangumiSnapshotPayload {
		ok?: boolean;
		source?: string;
		stale?: boolean;
		snapshot?: BangumiSnapshot;
	}

	interface Window {
		// type from '@swup/astro' is incorrect
		swup: AstroIntegration;
		pagefind?: Pagefind;
		loadPagefind?: () => Promise<Pagefind | null>;
		__pagefindLoadPromise?: Promise<Pagefind | null>;
		__warmBangumiSnapshot?: () => Promise<BangumiSnapshotPayload>;
		__bangumiSnapshotPromise?: Promise<BangumiSnapshotPayload>;
		__bangumiSnapshotPromiseStartedAt?: number;
		__bangumiSnapshotWarmupSetup?: boolean;
	}
}

interface SearchResult {
	url: string;
	meta: {
		title: string;
	};
	excerpt: string;
	content?: string;
	word_count?: number;
	filters?: Record<string, unknown>;
	anchors?: Array<{
		element: string;
		id: string;
		text: string;
		location: number;
	}>;
	weighted_locations?: Array<{
		weight: number;
		balanced_score: number;
		location: number;
	}>;
	locations?: number[];
	raw_content?: string;
	raw_url?: string;
	sub_results?: SearchResult[];
}
