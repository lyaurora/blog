<script lang="ts">
import { onDestroy } from "svelte";
import { flip } from "svelte/animate";
import { slide } from "svelte/transition";
import {
	currentIndex,
	errorMsg,
	isPlaylistLoading,
	isPlaying,
	likedSongs,
	playlist,
	playSong,
	showPlaylist,
	toggleLike,
} from "../store";
import type { Song } from "../types";

export let isLightBackground = false;
let activeScrollTimer: number | undefined;

async function handlePlaySong(index: number) {
	playSong(index);
}

function handleLike(e: MouseEvent | KeyboardEvent, song: Song) {
	e.stopPropagation();
	toggleLike(song);
}

function handleSongKeydown(e: KeyboardEvent, index: number) {
	if (e.key !== "Enter" && e.key !== " ") return;
	e.preventDefault();
	handlePlaySong(index);
}

// Ensure reactivity for the set usage in loop
$: likedIds = $likedSongs;

function clearActiveScrollTimer() {
	if (activeScrollTimer) {
		window.clearTimeout(activeScrollTimer);
		activeScrollTimer = undefined;
	}
}

function scheduleActiveScroll(index: number) {
	clearActiveScrollTimer();
	activeScrollTimer = window.setTimeout(() => {
		if (!$showPlaylist || $currentIndex !== index) return;
		const activeItem = document.querySelector<HTMLElement>(
			".music-player-container .playlist-active-item",
		);
		activeItem?.scrollIntoView({ behavior: "smooth", block: "center" });
		activeScrollTimer = undefined;
	}, 250);
}

// Auto-scroll to active item when playlist is shown or the active song changes.
$: if ($showPlaylist && $playlist.length > 0) {
	scheduleActiveScroll($currentIndex);
} else {
	clearActiveScrollTimer();
}

onDestroy(clearActiveScrollTimer);
</script>

{#if $showPlaylist}
    <div 
        class="absolute inset-x-0 bottom-0 top-16 z-10 flex flex-col transition-all duration-500"
        class:text-neutral-950={isLightBackground}
        class:text-white={!isLightBackground}
        style="background: {isLightBackground ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.3)'}; backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px);"
        transition:slide={{ duration: 200 }}
        role="listbox"
        aria-label="Playlist"
    >
        <div class="px-5 py-3 text-[10px] font-semibold opacity-55 uppercase tracking-wider flex justify-between items-center bg-current/5">
            <span>播放列表 ({$playlist.length})</span>
                <button type="button" class="opacity-60 hover:opacity-100 transition-opacity p-1" on:click={() => $showPlaylist = false} aria-label="Close playlist">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        </div>
        
        <div class="flex-1 overflow-y-auto scrollbar-thin p-1 space-y-0.5 relative" class:scrollbar-light={isLightBackground}>
            {#if $isPlaylistLoading && $playlist.length === 0}
                <div class="absolute inset-0 flex flex-col items-center justify-center opacity-60 p-4 text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 mb-2 animate-spin opacity-60" viewBox="0 0 24 24" fill="none">
                        <circle class="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3"></circle>
                        <path class="opacity-85" fill="currentColor" d="M21 12a9 9 0 0 0-9-9v3a6 6 0 0 1 6 6h3z"></path>
                    </svg>
                    <p class="text-xs">正在加载歌单</p>
                </div>
            {:else if $errorMsg}
                <div class="absolute inset-0 flex flex-col items-center justify-center opacity-65 p-4 text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 mb-2 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    <p class="text-xs">{$errorMsg}</p>
                </div>
            {:else if $playlist.length === 0}
                <div class="absolute inset-0 flex flex-col items-center justify-center opacity-45 p-4 text-center">
                    <p class="text-xs">暂无可播放歌曲</p>
                </div>
            {:else}
                {#each $playlist as song, i (song.id)}
                    <div animate:flip={{ duration: 300 }}>
                        <div 
                            class="w-full flex items-center gap-3 p-2 rounded-md transition-all text-left group relative overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/45"
                            class:bg-current-10={$currentIndex === i}
                            class:playlist-active-item={$currentIndex === i}
                            class:playlist-idle-item={$currentIndex !== i}
                            role="option"
                            aria-selected={$currentIndex === i}
                            tabindex="0"
                            on:click={() => handlePlaySong(i)}
                            on:keydown={(e) => handleSongKeydown(e, i)}
                        >
                            {#if $currentIndex === i}
                                <div class="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-1 bg-current rounded-r my-auto"></div>
                            {/if}
                            
                            <div class="flex-1 min-w-0 pl-2">
                                <div class="text-xs font-medium truncate opacity-90 group-hover:opacity-100 transition-opacity">{song.title}</div>
                                <div class="text-[10px] font-normal truncate opacity-55 group-hover:opacity-75 transition-opacity mt-0.5">{song.author}</div>
                            </div>

                            <!-- 播放状态 (Status) -->
                            {#if $currentIndex === i}
                                <div class="shrink-0 flex items-center justify-center w-4 h-4 mr-1">
                                    {#if $isPlaying}
                                        <div class="flex gap-0.5 items-end h-3">
                                            <div class="w-0.5 bg-current animate-music-bar-1"></div>
                                            <div class="w-0.5 bg-current animate-music-bar-2"></div>
                                            <div class="w-0.5 bg-current animate-music-bar-3"></div>
                                        </div>
                                    {:else}
                                        <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 opacity-55" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                                    {/if}
                                </div>
                            {/if}

                            <!-- 交互式红心 (Interactive Heart) -->
                            <button 
                                type="button"
                                class="w-6 h-6 flex items-center justify-center hover:text-red-500 hover:scale-110 transition shrink-0 z-10 {likedIds.has(song.id) ? 'text-red-500' : 'opacity-35'}"
                                on:click={(e) => handleLike(e, song)}
                                on:keydown|stopPropagation
                                aria-label={likedIds.has(song.id) ? "Unlike" : "Like"}
                            >
                                {#if likedIds.has(song.id)}
                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                                {:else}
                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                                {/if}
                            </button>
                        </div>
                    </div>
                {/each}
            {/if}
        </div>
    </div>
{/if}

<style>
    .bg-current-10 { background-color: color-mix(in srgb, currentColor 10%, transparent); }
    .playlist-idle-item:hover { background-color: color-mix(in srgb, currentColor 5%, transparent); }

    /* 自定义滚动条 */
    .scrollbar-thin::-webkit-scrollbar {
        width: 4px;
    }
    .scrollbar-thin::-webkit-scrollbar-track {
        background: transparent;
    }
    .scrollbar-thin::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 10px;
    }
    .scrollbar-thin::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.4);
    }
    .scrollbar-light::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.16);
    }
    .scrollbar-light::-webkit-scrollbar-thumb:hover {
        background: rgba(0, 0, 0, 0.28);
    }

    /* 播放中动画 */
    @keyframes music-bar-1 { 0%, 100% { height: 20%; } 50% { height: 80%; } }
    @keyframes music-bar-2 { 0%, 100% { height: 50%; } 50% { height: 100%; } }
    @keyframes music-bar-3 { 0%, 100% { height: 10%; } 50% { height: 60%; } }
    
    .animate-music-bar-1 { animation: music-bar-1 0.8s infinite ease-in-out; }
    .animate-music-bar-2 { animation: music-bar-2 0.8s infinite ease-in-out 0.2s; }
    .animate-music-bar-3 { animation: music-bar-3 0.8s infinite ease-in-out 0.4s; }
</style>
