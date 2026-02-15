<script lang="ts">
import { currentTime, duration, isPlaying, progress } from "../store";

export let audio: HTMLAudioElement | null = null;

let progressBar: HTMLDivElement;
let isDragging = false;

// 拖拽逻辑
function handleSeekStart(e: MouseEvent | TouchEvent) {
	isDragging = true;
	handleSeekMove(e);
	window.addEventListener("mousemove", handleSeekMove);
	window.addEventListener("mouseup", handleSeekEnd);
	window.addEventListener("touchmove", handleSeekMove);
	window.addEventListener("touchend", handleSeekEnd);
}

function handleSeekMove(e: MouseEvent | TouchEvent) {
	if (!isDragging) return;
	if (!progressBar) return;
	const rect = progressBar.getBoundingClientRect();
	const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
	let percent = (clientX - rect.left) / rect.width;
	percent = Math.max(0, Math.min(1, percent));
	$progress = percent * 100;
	// 仅更新当前显示时间，不立即 seek
	$currentTime = percent * $duration;
}

function handleSeekEnd(e: MouseEvent | TouchEvent) {
	if (!isDragging) return;
	isDragging = false;
	if (audio) {
		audio.currentTime = ($progress / 100) * $duration;
	}
	window.removeEventListener("mousemove", handleSeekMove);
	window.removeEventListener("mouseup", handleSeekEnd);
	window.removeEventListener("touchmove", handleSeekMove);
	window.removeEventListener("touchend", handleSeekEnd);
}
</script>

<div 
    bind:this={progressBar}
    class="mb-1 h-3 w-full flex items-center cursor-pointer group py-1"
    on:mousedown={handleSeekStart}
    on:touchstart={handleSeekStart}
    role="slider" 
    tabindex="0"
    aria-label="Seek slider"
    aria-valuenow={$progress}
    aria-valuemin="0"
    aria-valuemax="100"
    on:keydown={(e) => {
        if (!audio) return;
        if (e.key === 'ArrowRight') {
            audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
        } else if (e.key === 'ArrowLeft') {
            audio.currentTime = Math.max(0, audio.currentTime - 5);
        }
    }}
>
    <div class="h-1 w-full bg-white/20 rounded-full relative overflow-visible">
            <div 
            class="h-full bg-white/90 rounded-full relative" 
            style="width: {$progress}%"
        >
            <div class="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                    class:opacity-100={isDragging}
            ></div>
        </div>
    </div>
</div>
