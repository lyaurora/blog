<script lang="ts">
import { onMount } from "svelte";
import { siteConfig } from "@/config";
import PlayerPanel from "./music/components/PlayerPanel.svelte";
import { DEFAULT_MUSIC_CONFIG } from "./music/constants";
import {
	currentSong,
	currentTime,
	duration,
	fetchPlaylist,
	handleAutoNext,
	initLikeStore,
	isExpanded,
	isPlaying,
	progress,
	setAudioElement,
	toggleExpand,
} from "./music/store";
import type { MusicConfig } from "./music/types";

// 配置
const musicConfig = (siteConfig.music as MusicConfig) || DEFAULT_MUSIC_CONFIG;

let audio: HTMLAudioElement;
let playerStyle = "left: 1rem;"; // 默认左下角

// 定位逻辑 (优化版: 移除 RAF 轮询，仅在 Resize 时计算)
function calculatePosition() {
	const mainGrid = document.getElementById("main-grid");
	if (!mainGrid) return;

	const gridRect = mainGrid.getBoundingClientRect();
	const playerWidth = 240;
	const gap = 16;

	const computedStyle = window.getComputedStyle(mainGrid);
	const paddingLeft = Number.parseFloat(computedStyle.paddingLeft) || 0;

	// 侧边栏内容的视觉左边缘
	const sidebarLeftEdge = gridRect.left + paddingLeft;

	// 计算播放器应位于侧边栏左侧的位置
	const targetLeft = sidebarLeftEdge - playerWidth - gap;

	if (targetLeft >= 2) {
		playerStyle = `left: ${targetLeft}px;`;
	} else {
		if (targetLeft > -50) {
			playerStyle = "left: 2px;";
		} else {
			playerStyle = "left: 1rem;";
		}
	}
}

// 防抖函数
function debounce(fn: () => void, ms: number) {
	let timer: number;
	return () => {
		clearTimeout(timer);
		timer = window.setTimeout(fn, ms);
	};
}

function setupAudio(node: HTMLAudioElement) {
	setAudioElement(node);

	const handleTimeUpdate = () => {
		currentTime.set(node.currentTime);
		duration.set(node.duration || 0);
		progress.set((node.currentTime / (node.duration || 1)) * 100);
	};

	const handlePlayState = () => isPlaying.set(true);
	const handlePauseState = () => isPlaying.set(false);
	const handleEnded = () => {
		handleAutoNext();
	};

	node.addEventListener("timeupdate", handleTimeUpdate);
	node.addEventListener("ended", handleEnded);
	node.addEventListener("play", handlePlayState);
	node.addEventListener("pause", handlePauseState);

	return {
		destroy() {
			node.removeEventListener("timeupdate", handleTimeUpdate);
			node.removeEventListener("ended", handleEnded);
			node.removeEventListener("play", handlePlayState);
			node.removeEventListener("pause", handlePauseState);
		},
	};
}

function handleClickOutside(event: MouseEvent) {
	if (
		$isExpanded &&
		!(event.target as Element).closest(".music-player-container")
	) {
		toggleExpand();
	}
}

let mounted = false;
let imageLoaded = false;
let lastPic: string | null = null;

onMount(() => {
	initLikeStore();

	// 优化：仅使用 ResizeObserver，移除 RAF
	// 使用 debounce 避免高频 Resize 导致过多计算
	const debouncedCalculate = debounce(calculatePosition, 100);
	const observer = new ResizeObserver(() => {
		debouncedCalculate();
	});
	observer.observe(document.body);

	// 初始计算一次
	calculatePosition();
	// 再次延迟计算以防 DOM 未完全就绪
	setTimeout(calculatePosition, 500);

	(async () => {
		await fetchPlaylist(musicConfig);
	})();

	// 延迟显示以避免动画突兀
	setTimeout(() => {
		mounted = true;
	}, 500);

	return () => {
		observer.disconnect();
	};
});

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

<svelte:window on:click={handleClickOutside} on:resize={() => calculatePosition()} />

{#if musicConfig.enable}
    <!-- 容器：固定定位 -->
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div 
        class="fixed bottom-4 z-50 music-player-container"
        class:transition-all={mounted}
        class:duration-300={mounted}
        style={playerStyle}
    >
        <PlayerPanel {audio} />

        <!-- Floating Button (Collapsed) -->
        <button
            type="button"
            class="absolute bottom-0 left-0 w-12 h-12 rounded-full shadow-lg overflow-hidden group transition-all duration-300 transform ring-1 ring-white/10"
            class:opacity-100={!$isExpanded}
            class:scale-100={!$isExpanded}
            class:opacity-0={$isExpanded}
            class:scale-0={$isExpanded}
            class:pointer-events-auto={!$isExpanded}
            class:pointer-events-none={$isExpanded}
            class:animate-spin-slow={$isPlaying}
            on:click|stopPropagation={toggleExpand}
            style="animation-duration: 10s;"
            aria-label="Open music player"
        >
            <!-- Layer 1: Vinyl Record Placeholder (Always visible) -->
            <div class="absolute inset-0 flex items-center justify-center bg-gray-900 overflow-hidden">
                <!-- Vinyl Grooves Texture -->
                <div class="absolute inset-0 opacity-80" 
                     style="background: repeating-radial-gradient(#111 0, #111 2px, #2a2a2a 3px, #2a2a2a 4px);">
                </div>
                <!-- Vinyl Shine (Glossy Reflection) -->
                <div class="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none"></div>
                
                <!-- Central Label (Classic Red) -->
                <div class="relative w-3 h-3 rounded-full bg-gradient-to-br from-red-600 to-red-900 shadow-inner flex items-center justify-center ring-2 ring-black/40">
                     <!-- Spindle Hole -->
                     <div class="bg-[#111] rounded-full" style="width: 1px; height: 1px;"></div>
                </div>
            </div>

            <!-- Layer 2: Cover Image -->
            {#if $currentSong}
                <img 
                    src={$currentSong.pic} 
                    alt="cover" 
                    class="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-500"
                    class:opacity-100={imageLoaded}
                    on:load={handleImageLoad}
                >
            {/if}
            
            <!-- Layer 3: Hover Mask -->
            <div class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>
            </div>
        </button>  
        
        <audio 
            bind:this={audio} 
            use:setupAudio
            src={$currentSong?.url}
            autoplay={$isPlaying}
            crossorigin="anonymous"
        ></audio>
    </div>
{/if}

<style>
    .animate-spin-slow {
        animation: spin 10s linear infinite;
    }
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
</style>
