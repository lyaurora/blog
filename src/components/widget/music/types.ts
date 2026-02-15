export interface Song {
	id: string;
	title: string;
	author: string;
	url: string;
	pic: string;
	lrc?: string;
}

export interface MusicConfig {
	enable: boolean;
	id: string;
	server: string;
	type: string;
	api?: string;
}

export interface MetingItem {
	id?: number | string;
	title: string;
	author: string;
	url: string;
	pic?: string;
	lrc?: string;
}

export type PlayMode = "order" | "loop" | "shuffle";

export type ColorArray = [number, number, number];
