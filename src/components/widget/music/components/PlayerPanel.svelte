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

$: isLightBackground =
	($primaryColor[0] * 299 + $primaryColor[1] * 587 + $primaryColor[2] * 114) /
		1000 >
	160;
$: foregroundClass = isLightBackground ? "text-neutral-900" : "text-white";
$: mutedForegroundClass = isLightBackground
	? "text-neutral-800/65"
	: "text-white/60";
$: subtleForegroundClass = isLightBackground
	? "text-neutral-800/45"
	: "text-white/50";
$: titleForegroundClass = isLightBackground
	? "text-neutral-900/80"
	: "text-white";
$: titleWeightClass = isLightBackground ? "font-medium" : "font-semibold";
$: artistForegroundClass = isLightBackground
	? "text-neutral-700/60"
	: "text-white/75";
$: panelShadow = isLightBackground
	? "0 25px 50px -12px rgba(0, 0, 0, 0.28), inset 0 0 0 1px rgba(0, 0, 0, 0.08)"
	: "0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.1)";
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
    style="background: rgba({$primaryColor[0]}, {$primaryColor[1]}, {$primaryColor[2]}, 0.95); backdrop-filter: blur(20px); box-shadow: {panelShadow}; --player-play-bg: {isLightBackground ? 'rgba(255, 255, 255, 0.86)' : 'rgb(255, 255, 255)'}; --player-play-icon: {isLightBackground ? 'rgb(38, 38, 38)' : 'rgb(0, 0, 0)'};"
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
    <div class="px-5 -mt-10 relative z-10 mb-2 {titleForegroundClass}" style="text-shadow: {isLightBackground ? '0 1px 2px rgba(255,255,255,0.35)' : '0 2px 4px rgba(0,0,0,0.35)'};">
        <div class="text-[1.05rem] leading-6 {titleWeightClass} truncate">{$currentSong?.title}</div>
        <div class="text-[0.72rem] leading-4 truncate mt-0.5 font-medium {artistForegroundClass}">{$currentSong?.author}</div>
    </div>

    <!-- 控制区 -->
    <div class="px-2 pb-3 relative z-10 {foregroundClass}" role="group" aria-label="Controls">
        <!-- 进度条 -->
        <ProgressBar {audio} />
        
        <div class="flex justify-between items-center text-[10px] mb-3 font-normal tabular-nums {subtleForegroundClass}">
            <span>{formatTime($currentTime)}</span>
            <span>{formatTime($duration)}</span>
        </div>

        <!-- 按钮 -->
        <Controls>
            <div slot="right-controls" class="flex items-center gap-1">
                <!-- 音量控制 -->
                <VolumeControl />

                <!-- 播放列表切换 -->
                <button type="button" class="text-current opacity-65 hover:opacity-100 transition p-1.5" on:click={togglePlaylist} class:opacity-100={$showPlaylist} aria-label="Toggle playlist">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                </button>
            </div>
        </Controls>
    </div>
    
    <!-- 播放列表遮罩 -->
    <Playlist {isLightBackground} />
</div>
