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
	revision: string;
	collections: BangumiCollection[];
}

export const bangumiCollections: BangumiCollectionRequest[] = [
	{ label: "正在追", type: 3, limit: 100 },
	{ label: "补番计划", type: 1, limit: 100 },
	{ label: "已看完", type: 2, limit: 100 },
];

export function formatBangumiUpdatedAt(date: Date = new Date()): string {
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
		revision: "empty",
		collections: bangumiCollections.map((collection) => ({
			...collection,
			list: [],
		})),
	};
}

function normalizeBangumiItem(item: BangumiItem): BangumiItem {
	const subject = item.subject;

	return {
		ep_status: item.ep_status,
		rate: item.rate,
		subject: {
			id: subject.id,
			name: subject.name,
			name_cn: subject.name_cn,
			eps: subject.eps,
			score: subject.score,
			images: {
				large: subject.images?.large,
				common: subject.images?.common,
				medium: subject.images?.medium,
				grid: subject.images?.grid,
			},
		},
	};
}

function createBangumiSnapshotRevision(
	collections: BangumiCollection[],
): string {
	return collections
		.map((collection) => {
			const itemRevision = collection.list
				.map((item) => {
					const subject = item.subject;
					return [
						subject.id,
						subject.name_cn || subject.name,
						subject.images?.large ||
							subject.images?.common ||
							subject.images?.medium ||
							subject.images?.grid ||
							"",
						subject.eps,
						subject.score,
						item.ep_status,
						item.rate,
					].join(":");
				})
				.join("|");

			return `${collection.type}:${collection.label}:${itemRevision}`;
		})
		.join("||");
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
			).then((items) => items.map(normalizeBangumiItem));
			return { ...collection, list };
		}),
	);
	const now = new Date();

	return {
		updatedAt: formatBangumiUpdatedAt(now),
		revision: createBangumiSnapshotRevision(collections),
		collections,
	};
}
