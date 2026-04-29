<script lang="ts">
import { currentTime, duration, isSeeking, progress } from "../store";

export let audio: HTMLAudioElement | null = null;

let progressBar: HTMLDivElement;
let isDragging = false;
let seekProgress = 0;

$: safeProgress = Math.max(0, Math.min(100, $progress || 0));
$: displayProgress = isDragging ? seekProgress : safeProgress;
$: hasProgress = displayProgress > 0;

function updateSeekPosition(clientX: number) {
	if (!progressBar) return;

	const rect = progressBar.getBoundingClientRect();
	const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));

	seekProgress = percent * 100;
	$progress = seekProgress;
	$currentTime = percent * $duration;
}

function commitSeek() {
	if (!audio || !$duration) return;
	audio.currentTime = (seekProgress / 100) * $duration;
	$progress = seekProgress;
}

function handleSeekStart(e: PointerEvent) {
	if (e.button !== 0 && e.pointerType === "mouse") return;

	e.preventDefault();
	progressBar?.setPointerCapture(e.pointerId);
	isDragging = true;
	isSeeking.set(true);
	seekProgress = safeProgress;
	updateSeekPosition(e.clientX);
}

function handleSeekMove(e: PointerEvent) {
	if (!isDragging) return;

	e.preventDefault();
	updateSeekPosition(e.clientX);
}

function handleSeekEnd(e: PointerEvent) {
	if (!isDragging) return;

	e.preventDefault();
	commitSeek();
	isDragging = false;
	isSeeking.set(false);

	if (progressBar?.hasPointerCapture(e.pointerId)) {
		progressBar.releasePointerCapture(e.pointerId);
	}
}
</script>

<div
	bind:this={progressBar}
	class="mb-1 h-4 w-full flex items-center cursor-pointer group py-1 touch-none select-none"
	on:pointerdown={handleSeekStart}
	on:pointermove={handleSeekMove}
	on:pointerup={handleSeekEnd}
	on:pointercancel={handleSeekEnd}
	role="slider"
	tabindex="0"
	aria-label="Seek slider"
	aria-valuenow={Math.round(displayProgress)}
	aria-valuemin="0"
	aria-valuemax="100"
	on:keydown={(e) => {
		if (!audio) return;
		if (e.key === "ArrowRight") {
			audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
		} else if (e.key === "ArrowLeft") {
			audio.currentTime = Math.max(0, audio.currentTime - 5);
		}
	}}
>
	<div
		class="h-1 w-full rounded-full relative overflow-visible"
		style="background: var(--player-progress-track);"
	>
		<div
			class="progress-fill h-full rounded-full relative transition-all duration-150"
			style="width: {displayProgress}%; min-width: {hasProgress ? '2px' : '0'}; background: var(--player-progress-fill);"
		>
			<div
				class="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2.5 h-2.5 rounded-full shadow-md transition-opacity"
				style="opacity: {isDragging ? 1 : hasProgress ? 0.65 : 0}; background: var(--player-progress-thumb);"
			></div>
		</div>
	</div>
</div>

<style>
	.group:hover .progress-fill {
		background: var(--player-progress-fill-hover) !important;
	}
</style>
