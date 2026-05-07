import { siteConfig } from "../config";

const USER_AGENT = "sai/astro-blog-tracker";

export interface BangumiSubject {
	id: number;
	name: string;
	name_cn: string;
	images: {
		large?: string;
		common?: string;
		medium?: string;
		small?: string;
		grid?: string;
	};
	eps: number;
	score: number;
}

export interface BangumiItem {
	subject: BangumiSubject;
	ep_status: number;
	rate: number;
}

export interface BangumiCollection {
	label: string;
	type: number;
	limit: number;
	list: BangumiItem[];
}

interface BangumiCollectionPage {
	total?: number;
	data?: BangumiItem[];
}

interface BangumiCollectionRequest {
	label: string;
	type: number;
	limit: number;
}

export interface BangumiSnapshot {
	updatedAt: string;
	collections: BangumiCollection[];
}

export const bangumiCollections: BangumiCollectionRequest[] = [
	{ label: "正在追", type: 3, limit: 100 },
	{ label: "补番计划", type: 1, limit: 100 },
	{ label: "已看完", type: 2, limit: 100 },
];

export function formatBangumiUpdatedAt(date = new Date()) {
	return date
		.toLocaleString("zh-CN", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			hour12: false,
			timeZone: "Asia/Shanghai",
		})
		.replace(/\//g, "-");
}

export function createEmptyBangumiSnapshot(): BangumiSnapshot {
	return {
		updatedAt: "",
		collections: bangumiCollections.map((collection) => ({
			...collection,
			list: [],
		})),
	};
}

async function fetchBangumiCollection(
	username: string,
	type: number,
	limit: number,
): Promise<BangumiItem[]> {
	const list: BangumiItem[] = [];
	let offset = 0;

	while (true) {
		const url = `https://api.bgm.tv/v0/users/${username}/collections?subject_type=2&type=${type}&limit=${limit}&offset=${offset}`;
		const response = await fetch(url, {
			headers: { "User-Agent": USER_AGENT },
		});

		if (!response.ok) {
			throw new Error(
				`Bangumi API error: ${response.status} ${response.statusText}`,
			);
		}

		const json: BangumiCollectionPage = await response.json();
		const page = Array.isArray(json.data) ? json.data : [];

		if (page.length === 0) break;

		list.push(...page);
		offset += page.length;

		if (typeof json.total === "number" && offset >= json.total) break;
		if (page.length < limit) break;
	}

	return list;
}

export async function fetchBangumiSnapshot(): Promise<BangumiSnapshot> {
	const username = siteConfig.bangumiUser;

	if (!username) {
		return createEmptyBangumiSnapshot();
	}

	const collections = await Promise.all(
		bangumiCollections.map(async (collection): Promise<BangumiCollection> => {
			const list = await fetchBangumiCollection(
				username,
				collection.type,
				collection.limit,
			);
			return { ...collection, list };
		}),
	);
	const now = new Date();

	return {
		updatedAt: formatBangumiUpdatedAt(now),
		collections,
	};
}
