<script lang="ts">
import { fade } from "svelte/transition";
import { MODE_NAMES } from "../constants";
import {
	currentSong,
	isPlaying,
	likedSongs,
	nextSong,
	playMode,
	prevSong,
	switchPlayMode,
	toggleLike,
	togglePlay,
} from "../store";

let showModeTooltip = false;
let tooltipTimeout: number | undefined;

function handleModeSwitch() {
	switchPlayMode();
	showModeTooltip = true;
	if (tooltipTimeout) clearTimeout(tooltipTimeout);
	tooltipTimeout = window.setTimeout(() => {
		showModeTooltip = false;
	}, 2000);
}
</script>

<div class="flex justify-between items-center relative">
    <!-- Left Group: Mode, Like -->
    <div class="flex items-center gap-1">
            <!-- 播放模式 -->
        <div class="relative flex items-center justify-center">
            {#if showModeTooltip}
                <div 
                    class="absolute -top-7 left-0 px-2 py-1 bg-white/90 text-black text-[10px] rounded shadow-lg font-medium tracking-wide z-20 pointer-events-none whitespace-nowrap"
                    transition:fade={{ duration: 150 }}
                >
                    {MODE_NAMES[$playMode]}
                    <div class="absolute bottom-[-4px] left-[14px] -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-white/90"></div>
                </div>
            {/if}

            <button 
                type="button"
                class="text-white/60 hover:text-white transition p-1.5 relative group" 
                on:click={handleModeSwitch}
                on:mouseenter={() => { if(window.matchMedia('(hover: hover)').matches) showModeTooltip = true; }}
                on:mouseleave={() => { if(window.matchMedia('(hover: hover)').matches) showModeTooltip = false; }}
                aria-label="Switch play mode"
            >
                {#if $playMode === 'order'}
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>
                {:else if $playMode === 'loop'}
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/><text x="10" y="14" font-size="8" font-weight="bold" fill="currentColor">1</text></svg>
                {:else}
                    <!-- 网易云风格曲线随机图标 -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M16 3h5v5" />
                        <path d="M4 20L21 3" />
                        <path d="M21 16v5h-5" />
                        <path d="M15 15l-5 5-4-4" />
                    </svg>
                {/if}
            </button>
        </div>

        <!-- Like Button -->
        <button 
            type="button"
            class="text-white/60 hover:text-red-400 transition p-1.5 relative group"
            class:text-red-500={$currentSong && $likedSongs.has($currentSong.id)}
            on:click={toggleLike}
            aria-label={$currentSong && $likedSongs.has($currentSong.id) ? "Unlike" : "Like"}
        >
            {#if $currentSong && $likedSongs.has($currentSong.id)}
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 fill-current text-red-500" viewBox="0 0 24 24" stroke="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            {:else}
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            {/if}
        </button>
    </div>

    <!-- Center Group: Prev, Play, Next -->
    <div class="flex items-center gap-1">
        <button type="button" class="text-white/80 hover:text-white transition p-1" on:click={prevSong} aria-label="Previous song">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
        </button>
        
        <button 
            type="button"
            class="w-8 h-8 flex items-center justify-center rounded-full bg-white text-black hover:scale-105 transition shadow-lg active:scale-95"
            on:click={togglePlay}
            aria-label={$isPlaying ? "Pause" : "Play"}
        >
            {#if $isPlaying}
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            {:else}
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mx-auto" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            {/if}
        </button>

        <button type="button" class="text-white/80 hover:text-white transition p-1" on:click={nextSong} aria-label="Next song">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
        </button>
    </div>
    
    <!-- Right Group: Volume, Playlist -->
    <slot name="right-controls" />
</div>
