import type { APIRoute } from "astro";
import {
	getBangumiSnapshot,
	getCachedBangumiSnapshot,
	hasCachedBangumiSnapshot,
} from "../../lib/bangumi-cache";

export const prerender = false;

const freshCacheHeaders = {
	"Content-Type": "application/json; charset=utf-8",
	"Cache-Control": "public, max-age=0",
	"Vercel-CDN-Cache-Control":
		"public, s-maxage=21600, stale-while-revalidate=604800",
};

const fallbackCacheHeaders = {
	"Content-Type": "application/json; charset=utf-8",
	"Cache-Control": "public, max-age=0",
	"Vercel-CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
};

const noStoreHeaders = {
	"Content-Type": "application/json; charset=utf-8",
	"Cache-Control": "no-store",
	"Vercel-CDN-Cache-Control": "no-store",
};

export const GET: APIRoute = async () => {
	try {
		const { snapshot, source } = await getBangumiSnapshot();

		return new Response(
			JSON.stringify({
				ok: true,
				source,
				stale: false,
				snapshot,
			}),
			{ headers: freshCacheHeaders },
		);
	} catch (error) {
		console.error("Failed to refresh Bangumi snapshot:", error);

		if (hasCachedBangumiSnapshot()) {
			return new Response(
				JSON.stringify({
					ok: true,
					source: "memory-fallback",
					stale: true,
					snapshot: getCachedBangumiSnapshot(),
				}),
				{ headers: fallbackCacheHeaders },
			);
		}

		return new Response(
			JSON.stringify({
				ok: false,
				source: "empty",
				stale: true,
				snapshot: getCachedBangumiSnapshot(),
			}),
			{ status: 503, headers: noStoreHeaders },
		);
	}
};
