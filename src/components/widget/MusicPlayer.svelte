<script lang="ts">
import ColorThief from "colorthief";
import { onMount, tick } from "svelte";
import { fade, slide } from "svelte/transition";
import { siteConfig } from "@/config";

interface Song {
	id: string;
	title: string;
	author: string;
	url: string;
	pic: string;
	lrc?: string;
}

interface MusicConfig {
	enable: boolean;
	id: string;
	server: string;
	type: string;
	api?: string;
}

interface MetingItem {
	id?: number | string;
	title: string;
	author: string;
	url: string;
	pic?: string;
	lrc?: string;
}

// 状态
let isExpanded = false;
let isPlaying = false;
let showPlaylist = false;
let showModeTooltip = false;
let playMode: "order" | "loop" | "shuffle" = "order";
let playlist: Song[] = [];
let currentIndex = 0;

// 进度
let progress = 0;
let duration = 0;
let currentTime = 0;
let isDragging = false;
let isDraggingVolume = false;

let volume = 0.5;
let prevVolume = 0.5;
let showVolume = false;
let audio: HTMLAudioElement;
let likedSongs = new Set<string>();

$: if (audio) {
	audio.volume = volume;
}
// DOM references
let volumeBar: HTMLDivElement;
let progressBar: HTMLDivElement;
let colorThief: ColorThief;
let primaryColor = [20, 20, 20]; // Default dark
let coverImg: HTMLImageElement;
let colorCache: Record<string, [number, number, number]> = {};

// 配置
const musicConfig = (siteConfig.music as MusicConfig) || {
	enable: false,
	id: "3778678",
	server: "netease",
	type: "playlist",
};

const modeNames = {
	order: "顺序播放",
	loop: "单曲循环",
	shuffle: "随机播放",
};

// 格式化时间
function formatTime(seconds: number) {
	if (Number.isNaN(seconds)) return "0:00";
	const min = Math.floor(seconds / 60);
	const sec = Math.floor(seconds % 60);
	return `${min}:${String(sec).padStart(2, "0")}`;
}

async function fetchPlaylist() {
	if (!musicConfig.enable) return;
	try {
		const api = musicConfig.api || "https://api.i-meto.com/meting/api";
		const res = await fetch(
			`${api}?server=${musicConfig.server}&type=${musicConfig.type}&id=${musicConfig.id}&r=${Math.random()}`,
		);
		const data = await res.json();
		// API 返回歌曲数组
		playlist = data.map((item: MetingItem) => {
			let pic = item.pic || "";
			if (pic) {
				pic = pic.replace(/^http:/, "https:");
				pic += pic.includes("?") ? "&param=300y300" : "?param=300y300";
			}
			return {
				id: String(item.id || item.url), // Use url as fallback id
				title: item.title,
				author: item.author,
				url: item.url,
				pic: pic,
				lrc: item.lrc,
			};
		});

		// Sort: Liked songs first, then preserve relative order
		playlist.sort((a, b) => {
			const aLiked = likedSongs.has(a.id);
			const bLiked = likedSongs.has(b.id);
			if (aLiked && !bLiked) return -1;
			if (!aLiked && bLiked) return 1;
			return 0;
		});
	} catch (e) {
		console.error("Failed to fetch playlist", e);
	}
}

function extractColor() {
	if (!currentSong || !currentSong.pic) return;

	// 优先检查缓存
	if (currentSong && colorCache[currentSong.pic]) {
		primaryColor = colorCache[currentSong.pic];
		return;
	}

	if (!coverImg || !colorThief) return;

	// Capture currentSong locally to satisfy TS in callbacks
	const song = currentSong;
	const getColor = () => {
		try {
			const color = colorThief.getColor(coverImg);
			primaryColor = color;
			colorCache[song.pic] = color;
		} catch (e) {
			console.warn("Color extraction failed", e);
		}
	};

	if (coverImg.complete) {
		getColor();
	}
}

function togglePlay() {
	if (!audio) return;
	if (isPlaying) {
		audio.pause();
	} else {
		// Play returns a promise, we can catch failures (e.g. autoplay policy)
		audio.play().catch((e) => console.error("Playback failed", e));
	}
	// isPlaying state is updated by event listeners in setupAudio
}

let tooltipTimeout: number | undefined;

function toggleMute() {
	if (volume > 0) {
		prevVolume = volume;
		volume = 0;
	} else {
		volume = prevVolume > 0 ? prevVolume : 0.5;
	}
	if (typeof localStorage !== "undefined") {
		localStorage.setItem("music-volume", volume.toString());
	}
}

function toggleLike() {
	if (!currentSong) return;
	if (likedSongs.has(currentSong.id)) {
		likedSongs.delete(currentSong.id);
	} else {
		likedSongs.add(currentSong.id);
	}
	likedSongs = new Set(likedSongs); // Trigger reactivity
	if (typeof localStorage !== "undefined") {
		localStorage.setItem(
			"music-liked-songs",
			JSON.stringify(Array.from(likedSongs)),
		);
	}
}

function handleVolumeClick() {
	// Detect if device supports hover (desktop) vs touch (mobile)
	// On touch devices, clicking the icon toggles the slider visibility
	if (window.matchMedia("(hover: hover)").matches) {
		toggleMute();
	} else {
		showVolume = !showVolume;
	}
}

function switchPlayMode() {
	if (playMode === "order") playMode = "loop";
	else if (playMode === "loop") playMode = "shuffle";
	else playMode = "order";

	// Mobile fix: Show tooltip briefly then hide
	showModeTooltip = true;
	if (tooltipTimeout) clearTimeout(tooltipTimeout);
	tooltipTimeout = window.setTimeout(() => {
		showModeTooltip = false;
	}, 2000);
}

function nextSong() {
	if (playMode === "shuffle") {
		let newIndex = Math.floor(Math.random() * playlist.length);
		while (newIndex === currentIndex && playlist.length > 1) {
			newIndex = Math.floor(Math.random() * playlist.length);
		}
		currentIndex = newIndex;
	} else {
		currentIndex = (currentIndex + 1) % playlist.length;
	}
	// Ensure we play even if currently paused (playlist navigation implies play intent)
	isPlaying = true;
}

function handleAutoNext() {
	// 歌曲结束时调用
	if (playMode === "loop") {
		// 单曲循环
		audio.currentTime = 0;
		audio.play();
	} else {
		nextSong();
	}
}

function prevSong() {
	currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
	// Ensure we play even if currently paused
	isPlaying = true;
}

// 拖拽逻辑
function handleSeekStart(e: MouseEvent | TouchEvent) {
	isDragging = true;
	handleSeekMove(e);
}

function handleSeekMove(e: MouseEvent | TouchEvent) {
	if (!isDragging) return;
	if (!progressBar) return;
	const rect = progressBar.getBoundingClientRect();
	const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
	let percent = (clientX - rect.left) / rect.width;
	percent = Math.max(0, Math.min(1, percent));
	progress = percent * 100;
	// 仅更新当前时间显示文本，暂不跳转音频以避免卡顿
	// 但我们需要 currentTime 用于显示
	currentTime = percent * duration;
}

function handleSeekEnd() {
	if (!isDragging) return;
	isDragging = false;
	if (!progressBar || !audio) return;

	// 最终跳转
	// 我们已经在 move 中更新了 progress，所以只需从中计算时间
	audio.currentTime = (progress / 100) * duration;
}

function updateVolume(e: MouseEvent | TouchEvent) {
	if (!volumeBar) return;
	const rect = volumeBar.getBoundingClientRect();
	const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
	// Calculate from bottom
	let percent = (rect.bottom - clientY) / rect.height;
	percent = Math.max(0, Math.min(1, percent));
	volume = percent;
}

function handleVolumeStart(e: MouseEvent | TouchEvent) {
	isDraggingVolume = true;
	updateVolume(e);
}

function handleVolumeMove(e: MouseEvent | TouchEvent) {
	if (!isDraggingVolume) return;
	updateVolume(e);
}

function handleVolumeEnd() {
	if (!isDraggingVolume) return;
	isDraggingVolume = false;
	if (typeof localStorage !== "undefined") {
		localStorage.setItem("music-volume", volume.toString());
	}
}

function toggleExpand() {
	isExpanded = !isExpanded;
	if (!isExpanded) showPlaylist = false;
}

async function togglePlaylist() {
	showPlaylist = !showPlaylist;
	if (showPlaylist) {
		await tick();
		// Wait for the slide transition (200ms) to complete for accurate positioning
		setTimeout(() => {
			const activeItem = document.querySelector(".playlist-active-item");
			if (activeItem) {
				activeItem.scrollIntoView({ behavior: "smooth", block: "center" });
			}
		}, 250);
	}
}

function handleClickOutside(event: MouseEvent) {
	if (
		isExpanded &&
		!(event.target as Element).closest(".music-player-container")
	) {
		isExpanded = false;
		showPlaylist = false;
	}
}

function playSong(index: number) {
	currentIndex = index;
	// Explicit user action, ensure play
	isPlaying = true;
}

let playerStyle = "left: 1rem;"; // 默认安全位置

function calculatePosition() {
	const mainGrid = document.getElementById("main-grid");
	if (!mainGrid) return;

	const gridRect = mainGrid.getBoundingClientRect();
	const playerWidth = 240; // 宽度 60 = 15rem = 240px
	const gap = 16; // 1rem

	const computedStyle = window.getComputedStyle(mainGrid);
	const paddingLeft = Number.parseFloat(computedStyle.paddingLeft) || 0;

	// 侧边栏内容的视觉左边缘
	const sidebarLeftEdge = gridRect.left + paddingLeft;

	// 计算播放器应位于侧边栏左侧的位置
	const targetLeft = sidebarLeftEdge - playerWidth - gap;

	if (targetLeft >= 2) {
		playerStyle = `left: ${targetLeft}px;`;
	} else {
		// 如果空间极窄（例如 targetLeft 为 -2px），
		// 我们将其强制固定在距屏幕边缘 2px 处以防被遮挡。
		// 这可能会略微减小间距（例如 14px 而非 16px），
		// 但优先保证播放器可见且“大致”对齐。
		// 如果 targetLeft 为负数（超窄屏），回退到左下角（1rem）。
		if (targetLeft > -50) {
			playerStyle = "left: 2px;";
		} else {
			playerStyle = "left: 1rem;";
		}
	}
}

function setupAudio(node: HTMLAudioElement) {
	node.volume = volume;

	const handleTimeUpdate = () => {
		if (!isDragging) {
			currentTime = node.currentTime;
			duration = node.duration || 0;
			progress = (currentTime / duration) * 100;
		}
	};

	const handlePlayState = () => {
		isPlaying = true;
	};

	const handlePauseState = () => {
		isPlaying = false;
	};

	node.addEventListener("timeupdate", handleTimeUpdate);
	node.addEventListener("ended", handleAutoNext);
	node.addEventListener("play", handlePlayState);
	node.addEventListener("pause", handlePauseState);

	return {
		destroy() {
			node.removeEventListener("timeupdate", handleTimeUpdate);
			// handleAutoNext is global function
			node.removeEventListener("ended", handleAutoNext);
			node.removeEventListener("play", handlePlayState);
			node.removeEventListener("pause", handlePauseState);
		},
	};
}

onMount(() => {
	// Load saved volume
	if (typeof localStorage !== "undefined") {
		const savedVolume = localStorage.getItem("music-volume");
		if (savedVolume) {
			volume = Number(savedVolume);
		}
	}

	// Load liked songs
	if (typeof localStorage !== "undefined") {
		const savedLiked = localStorage.getItem("music-liked-songs");
		if (savedLiked) {
			try {
				likedSongs = new Set(JSON.parse(savedLiked));
			} catch (e) {
				console.error("Failed to load liked songs", e);
			}
		}
	}

	colorThief = new ColorThief();
	window.addEventListener("mousemove", handleSeekMove);
	window.addEventListener("mouseup", handleSeekEnd);
	window.addEventListener("touchmove", handleSeekMove);
	window.addEventListener("touchend", handleSeekEnd);
	window.addEventListener("mousemove", handleVolumeMove);
	window.addEventListener("mouseup", handleVolumeEnd);
	window.addEventListener("touchmove", handleVolumeMove);
	window.addEventListener("touchend", handleVolumeEnd);

	// 定位逻辑
	const observer = new ResizeObserver(() => {
		window.requestAnimationFrame(calculatePosition);
	});
	observer.observe(document.body);

	// 延迟初始计算
	setTimeout(calculatePosition, 500);

	(async () => {
		await fetchPlaylist();
	})();

	return () => {
		window.removeEventListener("mousemove", handleSeekMove);
		window.removeEventListener("mouseup", handleSeekEnd);
		window.removeEventListener("touchmove", handleSeekMove);
		window.removeEventListener("touchend", handleSeekEnd);
		window.removeEventListener("mousemove", handleVolumeMove);
		window.removeEventListener("mouseup", handleVolumeEnd);
		window.removeEventListener("touchmove", handleVolumeMove);
		window.removeEventListener("touchend", handleVolumeEnd);
		observer.disconnect();
	};
});

let currentSong: Song | undefined;
$: currentSong = playlist[currentIndex];
// 切换歌曲时确认颜色
$: if (currentSong && isExpanded) {
	// 等待 DOM 更新
	tick().then(() => extractColor());
}
</script>

<svelte:window on:click={handleClickOutside} />

{#if musicConfig.enable && playlist.length > 0}
    <!-- 容器：固定定位，JS 计算对齐 -->
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div 
        class="fixed bottom-4 z-50 music-player-container transition-all duration-300"
        style={playerStyle}
    >
        <!-- 展开播放器 -->
        <div 
            class="absolute bottom-0 left-0 mb-0 w-60 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 origin-bottom-left font-sans text-shadow-sm"
            class:opacity-100={isExpanded}
            class:translate-y-0={isExpanded}
            class:scale-100={isExpanded}
            class:pointer-events-auto={isExpanded}
            class:opacity-0={!isExpanded}
            class:translate-y-4={!isExpanded}
            class:scale-95={!isExpanded}
            class:pointer-events-none={!isExpanded}
            style="background: rgba({primaryColor[0]}, {primaryColor[1]}, {primaryColor[2]}, 0.95); backdrop-filter: blur(20px); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.1);"
            role="dialog"
            aria-label="Music Player"
            tabindex="-1"
            on:click|stopPropagation
            on:keydown|stopPropagation={(e) => { 
                if (e.key === 'Escape') toggleExpand();
            }}
        >
            <!-- 头部 / 封面 -->
            <div 
                class="relative h-44 w-full group"
                style="-webkit-mask-image: linear-gradient(to bottom, black 50%, transparent 100%); mask-image: linear-gradient(to bottom, black 50%, transparent 100%);"
            >
                    <img 
                    bind:this={coverImg}
                    src={currentSong?.pic} 
                    alt={currentSong?.title}  
                    class="h-full w-full object-cover transition-transform duration-700"
                    class:scale-110={isPlaying}
                    crossorigin="anonymous"
                    on:load={extractColor}
                />
                    <!-- 移除手动渐变遮罩，改用 mask 实现完美融合 -->
                    
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

                <!-- 歌曲信息（移出遮罩区域以确保可见性） -->
                <div class="px-5 -mt-10 relative z-10 text-white mb-2" style="text-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                    <div class="text-lg font-bold truncate tracking-tight">{currentSong?.title}</div>
                    <div class="text-xs text-white/80 truncate mt-1 font-medium">{currentSong?.author}</div>
                </div>

                <!-- 控制区 -->
                <div class="px-2 pb-3 relative z-10" role="group" aria-label="Controls">
                    <!-- 进度条 -->
                    <div 
                        bind:this={progressBar}
                        class="mb-1 h-3 w-full flex items-center cursor-pointer group py-1"
                        on:mousedown={handleSeekStart}
                        on:touchstart={handleSeekStart}
                        role="slider" 
                        tabindex="0"
                        aria-label="Seek slider"
                        aria-valuenow={progress}
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
                                style="width: {progress}%"
                            >
                                <div class="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                                     class:opacity-100={isDragging}
                                ></div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex justify-between items-center text-[10px] text-white/50 mb-3 font-medium tracking-wide">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>

                    <!-- 按钮 -->
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
                                        {modeNames[playMode]}
                                        <div class="absolute bottom-[-4px] left-[14px] -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-white/90"></div>
                                    </div>
                                {/if}

                                <button 
                                    type="button"
                                    class="text-white/60 hover:text-white transition p-1.5 relative group" 
                                    on:click={switchPlayMode}
                                    on:mouseenter={() => { if(window.matchMedia('(hover: hover)').matches) showModeTooltip = true; }}
                                    on:mouseleave={() => { if(window.matchMedia('(hover: hover)').matches) showModeTooltip = false; }}
                                    aria-label="Switch play mode"
                                >
                                    {#if playMode === 'order'}
                                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>
                                    {:else if playMode === 'loop'}
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
                                class:text-red-500={currentSong && likedSongs.has(currentSong.id)}
                                on:click={toggleLike}
                                aria-label={currentSong && likedSongs.has(currentSong.id) ? "Unlike" : "Like"}
                            >
                                {#if currentSong && likedSongs.has(currentSong.id)}
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
                                aria-label={isPlaying ? "Pause" : "Play"}
                            >
                                {#if isPlaying}
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
                        <div class="flex items-center gap-1">
                            <!-- 音量控制 -->
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
                                                aria-valuenow={volume * 100}
                                                aria-valuemin="0"
                                                aria-valuemax="100"
                                                on:keydown={(e) => {
                                                    if (e.key === 'ArrowUp') {
                                                        volume = Math.min(1, volume + 0.1);
                                                        localStorage.setItem("music-volume", volume.toString());
                                                    }
                                                    if (e.key === 'ArrowDown') {
                                                        volume = Math.max(0, volume - 0.1);
                                                        localStorage.setItem("music-volume", volume.toString());
                                                    }
                                                }}
                                            >
                                                <div 
                                                    class="w-full bg-white rounded-full relative transition-all duration-75"
                                                    style="height: {volume * 100}%"
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                {/if}

                                <button 
                                    type="button"
                                    class="text-white/60 hover:text-white transition p-1.5 relative"
                                    on:click={handleVolumeClick}
                                    aria-label={volume > 0 ? "Mute" : "Unmute"}
                                >
                                    {#if volume === 0}
                                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
                                    {:else if volume < 0.5}
                                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                                    {:else}
                                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                                    {/if}
                                </button>
                            </div>

                            <!-- 播放列表切换 -->
                            <button type="button" class="text-white/60 hover:text-white transition p-1.5" on:click={togglePlaylist} class:text-white={showPlaylist} aria-label="Toggle playlist">
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                            </button>
                         </div>
                    </div>
                </div>
                
                <!-- 播放列表遮罩 -->
                {#if showPlaylist}
                    <div 
                        class="absolute inset-x-0 bottom-0 top-16 z-10 flex flex-col transition-all duration-500"
                        style="background: rgba(0, 0, 0, 0.25); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);"
                        transition:slide={{ duration: 200 }}
                        role="listbox"
                        aria-label="Playlist"
                    > 
                        <div class="px-5 py-3 text-[10px] font-bold text-white/50 uppercase tracking-widest flex justify-between items-center bg-white/5">
                            <span>播放列表 ({playlist.length})</span>
                             <button type="button" class="text-white/50 hover:text-white transition-colors p-1" on:click={() => showPlaylist = false} aria-label="Close playlist">
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <div class="flex-1 overflow-y-auto scrollbar-thin p-1 space-y-0.5">
                            {#each playlist as song, i}
                                <button 
                                    type="button"
                                    class="w-full flex items-center gap-3 p-2 rounded-md transition-all text-left group relative overflow-hidden"
                                    class:bg-white-10={currentIndex === i} 
                                    class:playlist-active-item={currentIndex === i}
                                    class:hover:bg-white-5={currentIndex !== i}
                                    on:click={() => playSong(i)}
                                >
                                    {#if currentIndex === i}
                                        <div class="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-1 bg-white rounded-r my-auto"></div>
                                    {/if}
                                    
                                    <div class="flex-1 min-w-0 pl-2">
                                        <div class="text-xs font-bold truncate text-white/90 group-hover:text-white transition">{song.title}</div>
                                        <div class="text-[10px] truncate text-white/50 group-hover:text-white/70 transition mt-0.5">{song.author}</div>
                                    </div>
                                    {#if likedSongs.has(song.id)}
                                        <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-red-500 fill-current ml-2 shrink-0" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                                    {/if}
                                    {#if currentIndex === i && isPlaying}
                                         <div class="flex gap-0.5 items-end h-3 mb-1 mr-1">
                                             <div class="w-0.5 bg-white animate-music-bar-1"></div>
                                             <div class="w-0.5 bg-white animate-music-bar-2"></div>
                                             <div class="w-0.5 bg-white animate-music-bar-3"></div>
                                         </div>
                                    {:else if currentIndex === i}
                                        <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-white/50" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                                    {/if}
                                </button>
                            {/each}
                        </div>
                    </div>
                {/if}
        </div>

        <!-- Floating Button (Collapsed) -->
        <button
            type="button"
            class="absolute bottom-0 left-0 w-12 h-12 rounded-full shadow-lg overflow-hidden group transition-all duration-300 transform"
            class:opacity-100={!isExpanded}
            class:scale-100={!isExpanded}
            class:opacity-0={isExpanded}
            class:scale-0={isExpanded}
            class:pointer-events-auto={!isExpanded}
            class:pointer-events-none={isExpanded}
            class:animate-spin-slow={isPlaying}
            on:click|stopPropagation={toggleExpand}
            style="animation-duration: 10s;"
            aria-label="Open music player"
        >
            {#if currentSong}
                    <img src={currentSong.pic} alt="cover" class="w-full h-full object-cover">
                {:else}
                    <div class="w-full h-full bg-gray-800 flex items-center justify-center text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                    </div>
                {/if}
                
                <!-- 悬停遮罩 -->
                <div class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>
            </div>
        </button>  
        
        <audio 
            bind:this={audio} 
            use:setupAudio
            src={currentSong?.url}
            autoplay={isPlaying}
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
    
    .bg-white-10 { background-color: rgba(255,255,255,0.1); }

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
</style>
