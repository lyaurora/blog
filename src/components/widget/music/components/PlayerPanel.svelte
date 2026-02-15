<script lang="ts">
import {
	currentSong,
	currentTime,
	duration,
	isExpanded,
	primaryColor,
	showPlaylist,
	toggleExpand,
	togglePlaylist,
} from "../store";
import { formatTime } from "../utils";
import Controls from "./Controls.svelte";
import Cover from "./Cover.svelte";
import Playlist from "./Playlist.svelte";
import ProgressBar from "./ProgressBar.svelte";
import VolumeControl from "./VolumeControl.svelte";

export let audio: HTMLAudioElement | null = null;
</script>

<div 
    class="absolute bottom-0 left-0 mb-0 w-60 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 origin-bottom-left font-sans text-shadow-sm"
    class:opacity-100={$isExpanded}
    class:translate-y-0={$isExpanded}
    class:scale-100={$isExpanded}
    class:pointer-events-auto={$isExpanded}
    class:opacity-0={!$isExpanded}
    class:translate-y-4={!$isExpanded}
    class:scale-95={!$isExpanded}
    class:pointer-events-none={!$isExpanded}
    style="background: rgba({$primaryColor[0]}, {$primaryColor[1]}, {$primaryColor[2]}, 0.95); backdrop-filter: blur(20px); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.1);"
    role="dialog"
    aria-label="Music Player"
    tabindex="-1"
    on:click|stopPropagation
    on:keydown|stopPropagation={(e) => { 
        if (e.key === 'Escape') toggleExpand();
    }}
>
    <!-- 头部 / 封面 -->
    <Cover />

    <!-- 歌曲信息（移出遮罩区域以确保可见性） -->
    <div class="px-5 -mt-10 relative z-10 text-white mb-2" style="text-shadow: 0 2px 4px rgba(0,0,0,0.3);">
        <div class="text-lg font-bold truncate tracking-tight">{$currentSong?.title}</div>
        <div class="text-xs text-white/80 truncate mt-1 font-medium">{$currentSong?.author}</div>
    </div>

    <!-- 控制区 -->
    <div class="px-2 pb-3 relative z-10" role="group" aria-label="Controls">
        <!-- 进度条 -->
        <ProgressBar {audio} />
        
        <div class="flex justify-between items-center text-[10px] text-white/50 mb-3 font-medium tracking-wide">
            <span>{formatTime($currentTime)}</span>
            <span>{formatTime($duration)}</span>
        </div>

        <!-- 按钮 -->
        <Controls>
            <div slot="right-controls" class="flex items-center gap-1">
                <!-- 音量控制 -->
                <VolumeControl />

                <!-- 播放列表切换 -->
                <button type="button" class="text-white/60 hover:text-white transition p-1.5" on:click={togglePlaylist} class:text-white={$showPlaylist} aria-label="Toggle playlist">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                </button>
            </div>
        </Controls>
    </div>
    
    <!-- 播放列表遮罩 -->
    <Playlist />
</div>
