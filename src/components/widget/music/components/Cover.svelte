<script lang="ts">
import { onMount, tick } from "svelte";
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

// 监听歌曲变化重新提取颜色
$: if ($currentSong && $isExpanded) {
	tick().then(() => extractColor());
}

let imageLoaded = false;
let lastPic: string | null = null;
function handleImageLoad() {
	imageLoaded = true;
}

$: if ($currentSong) {
	if ($currentSong.pic !== lastPic) {
		imageLoaded = false;
		lastPic = $currentSong.pic;
	}
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
        class="absolute top-3 right-3 p-2 rounded-full bg-black/20 text-white/80 hover:bg-black/40 hover:text-white transition-all backdrop-blur-sm z-20"
        on:click={toggleExpand}
        aria-label="Close player"
    >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>
</div>
