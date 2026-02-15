<script lang="ts">
import { fade } from "svelte/transition";
import { isExpanded, setVolume, volume } from "../store";

let volumeBar: HTMLDivElement;
let isDraggingVolume = false;
let showVolume = false;

// 音量控制逻辑
function updateVolume(e: MouseEvent | TouchEvent) {
	if (!volumeBar) return;
	const rect = volumeBar.getBoundingClientRect();
	const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
	// Calculate from bottom
	let percent = (rect.bottom - clientY) / rect.height;
	percent = Math.max(0, Math.min(1, percent));
	setVolume(percent);
}

function handleVolumeStart(e: MouseEvent | TouchEvent) {
	isDraggingVolume = true;
	updateVolume(e);
	window.addEventListener("mousemove", handleVolumeMove);
	window.addEventListener("mouseup", handleVolumeEnd);
	window.addEventListener("touchmove", handleVolumeMove);
	window.addEventListener("touchend", handleVolumeEnd);
}

function handleVolumeMove(e: MouseEvent | TouchEvent) {
	if (!isDraggingVolume) return;
	updateVolume(e);
}

function handleVolumeEnd() {
	if (!isDraggingVolume) return;
	isDraggingVolume = false;
	window.removeEventListener("mousemove", handleVolumeMove);
	window.removeEventListener("mouseup", handleVolumeEnd);
	window.removeEventListener("touchmove", handleVolumeMove);
	window.removeEventListener("touchend", handleVolumeEnd);
}

// Toggle mute is handled in store, but here we handle UI interaction
function handleVolumeClick() {
	// Detect if device supports hover (desktop) vs touch (mobile)
	// On touch devices, clicking the icon toggles the slider visibility
	if (window.matchMedia("(hover: hover)").matches) {
		import("../store").then(({ toggleMute }) => toggleMute());
	} else {
		showVolume = !showVolume;
	}
}
</script>

<div 
    class="relative group h-8 w-6 flex items-center justify-center"
    on:mouseenter={() => showVolume = true}
    on:mouseleave={() => { if(!isDraggingVolume) showVolume = false; }}
    role="group"
    aria-label="Volume control"
>
    {#if showVolume}
        <div 
            class="absolute bottom-full left-1/2 -translate-x-1/2 pb-4 flex flex-col items-center justify-end z-30 pointer-events-auto"
            transition:fade={{ duration: 150 }}
        >
            <div class="h-28 w-8 bg-black/60 backdrop-blur-md rounded-full shadow-xl border border-white/10 flex flex-col items-center justify-end pb-3 pt-3">
                <div 
                    bind:this={volumeBar}
                    class="volume-bar relative w-1.5 h-full bg-white/20 rounded-full cursor-pointer flex flex-col justify-end overflow-hidden group/slider"
                    on:mousedown={handleVolumeStart}
                    on:touchstart={handleVolumeStart}
                    on:click|stopPropagation={(e) => updateVolume(e)}
                    role="slider"
                    tabindex="0"
                    aria-label="Volume slider"
                    aria-valuenow={$volume * 100}
                    aria-valuemin="0"
                    aria-valuemax="100"
                    on:keydown={(e) => {
                        if (e.key === 'ArrowUp') {
                            setVolume(Math.min(1, $volume + 0.1));
                        }
                        if (e.key === 'ArrowDown') {
                            setVolume(Math.max(0, $volume - 0.1));
                        }
                    }}
                >
                    <div 
                        class="w-full bg-white rounded-full relative transition-all duration-75"
                        style="height: {$volume * 100}%"
                    ></div>
                </div>
            </div>
        </div>
    {/if}

    <button 
        type="button"
        class="text-white/60 hover:text-white transition p-1.5 relative"
        on:click={handleVolumeClick}
        aria-label={$volume > 0 ? "Mute" : "Unmute"}
    >
        {#if $volume === 0}
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
        {:else if $volume < 0.5}
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
        {:else}
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
        {/if}
    </button>
</div>
