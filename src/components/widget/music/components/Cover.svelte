<script lang="ts">
import { tick } from "svelte";
import {
	currentSong,
	isExpanded,
	isPlaying,
	primaryColor,
	toggleExpand,
} from "../store";

let coverImg: HTMLImageElement;
let colorThief: any; // Dynamic import type
let colorCache: Record<string, [number, number, number]> = {};

$: isLightBackground =
	($primaryColor[0] * 299 + $primaryColor[1] * 587 + $primaryColor[2] * 114) /
		1000 >
	160;

async function extractColor() {
	if (!$currentSong || !$currentSong.pic) return;

	// 优先检查缓存
	if ($currentSong && colorCache[$currentSong.pic]) {
		$primaryColor = colorCache[$currentSong.pic];
		return;
	}

	if (!coverImg) return;

	// Lazy load ColorThief if not loaded
	if (!colorThief) {
		try {
			const module = await import("colorthief");
			const ColorThiefClass = module.default;
			colorThief = new ColorThiefClass();
		} catch (e) {
			console.error("Failed to load ColorThief", e);
			return;
		}
	}

	// Capture currentSong locally to satisfy TS in callbacks
	const song = $currentSong;
	const getColor = () => {
		try {
			const color = colorThief.getColor(coverImg);
			$primaryColor = color;
			colorCache[song.pic] = color;
		} catch (e) {
			console.warn("Color extraction failed", e);
		}
	};

	if (coverImg.complete) {
		getColor();
	} else {
		coverImg.addEventListener("load", getColor, { once: true });
	}
}

let imageLoaded = false;
let lastPic: string | null = null;
let lastColorPic: string | null = null;
function handleImageLoad() {
	imageLoaded = true;
	if ($isExpanded) {
		extractColor();
	}
}

$: if ($currentSong) {
	if ($currentSong.pic !== lastPic) {
		imageLoaded = false;
		lastPic = $currentSong.pic;
	}
}

$: if ($currentSong && $isExpanded && $currentSong.pic !== lastColorPic) {
	lastColorPic = $currentSong.pic;
	tick().then(() => extractColor());
}
</script>

<div 
    class="relative h-44 w-full group"
    style="-webkit-mask-image: linear-gradient(to bottom, black 50%, transparent 100%); mask-image: linear-gradient(to bottom, black 50%, transparent 100%);"
>
    <div class="absolute inset-0 bg-gray-800 animate-pulse" class:hidden={imageLoaded}></div>
    <img 
        bind:this={coverImg}
        src={$currentSong?.pic} 
        alt={$currentSong?.title}  
        class="h-full w-full object-cover transition-transform duration-700 opacity-0 transition-opacity duration-500"
        class:scale-110={$isPlaying}
        class:opacity-100={imageLoaded}
        crossorigin="anonymous"
        on:load={handleImageLoad}
    />
    
    <!-- 顶部控制：关闭 -->
    <button 
        type="button"
        class="absolute top-3 right-3 p-2 rounded-full transition-all backdrop-blur-sm z-20"
        class:bg-white-40={isLightBackground}
        class:hover:bg-white-60={isLightBackground}
        class:text-neutral-800={isLightBackground}
        class:bg-black-20={!isLightBackground}
        class:hover:bg-black-40={!isLightBackground}
        class:text-white-80={!isLightBackground}
        class:hover:text-white={!isLightBackground}
        on:click={toggleExpand}
        aria-label="Close player"
    >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>
</div>

<style>
    .bg-white-40 { background-color: rgba(255, 255, 255, 0.4); }
    .hover\:bg-white-60:hover { background-color: rgba(255, 255, 255, 0.6); }
    .bg-black-20 { background-color: rgba(0, 0, 0, 0.2); }
    .hover\:bg-black-40:hover { background-color: rgba(0, 0, 0, 0.4); }
    .text-white-80 { color: rgba(255, 255, 255, 0.8); }
</style>
