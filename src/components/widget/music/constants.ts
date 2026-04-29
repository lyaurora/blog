import type { MusicConfig } from "./types";

export const DEFAULT_MUSIC_CONFIG: MusicConfig = {
	enable: false,
	id: "3778678",
	server: "netease",
	type: "playlist",
};

export const DEFAULT_API_URL = import.meta.env.DEV
	? "https://blog.122425.xyz/api/meting/"
	: "/api/meting/";

export const MODE_NAMES = {
	order: "顺序播放",
	loop: "单曲循环",
	shuffle: "随机播放",
} as const;

export const DEFAULT_PRIMARY_COLOR = [20, 20, 20] as const;
