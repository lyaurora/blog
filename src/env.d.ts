/// <reference types="astro/client" />
/// <reference types="vite/client" />

declare module "colorthief" {
	export default class ColorThief {
		getColor(sourceImage: HTMLImageElement | null): [number, number, number];
		getPalette(
			sourceImage: HTMLImageElement | null,
			colorCount?: number,
			quality?: number,
		): [number, number, number][];
	}
}

interface ImportMetaEnv {
	readonly DEV: boolean;
	readonly PROD: boolean;
	readonly BASE_URL: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
