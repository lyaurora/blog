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
	interface Window {
		// type from '@swup/astro' is incorrect
		swup: AstroIntegration;
		pagefind?: Pagefind;
		loadPagefind?: () => Promise<Pagefind | null>;
		__pagefindLoadPromise?: Promise<Pagefind | null>;
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
