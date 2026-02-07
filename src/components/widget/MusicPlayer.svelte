<script lang="ts">
import { onMount, tick } from "svelte";
import { fade, fly, scale, slide } from "svelte/transition";
import ColorThief from "colorthief";
import { siteConfig } from "@/config";

interface Song {
    title: string;
    author: string;
    url: string;
    pic: string;
    lrc?: string;
}

import { PAGE_WIDTH } from "@/constants/constants";

// 状态
let isExpanded = false;
let isPlaying = false;
let showPlaylist = false;
let showModeTooltip = false;
let playMode: 'order' | 'loop' | 'shuffle' = 'order';
let playlist: Song[] = [];
let currentIndex = 0;

// 进度
let progress = 0;
let duration = 0;
let currentTime = 0;
let isDragging = false; 

let volume = 0.5;
let audio: HTMLAudioElement;
let colorThief: ColorThief;
let primaryColor = [20, 20, 20]; // Default dark
let coverImg: HTMLImageElement;
let colorCache: Record<string, [number, number, number]> = {};

// 配置
const musicConfig = siteConfig.music || {
    enable: false,
    id: "3778678",
    server: "netease",
    type: "playlist",
};

const modeNames = { 
    order: '顺序播放', 
    loop: '单曲循环', 
    shuffle: '随机播放' 
};

// 格式化时间
function formatTime(seconds: number) {
    if (isNaN(seconds)) return "0:00";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? "0" + sec : sec}`;
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
        playlist = data.map((item: any) => {
            let pic = item.pic || "";
            if (pic) {
                pic = pic.replace(/^http:/, "https:");
                pic += pic.includes("?") ? "&param=300y300" : "?param=300y300";
            }
            return {
                title: item.title,
                author: item.author,
                url: item.url,
                pic: pic,
                lrc: item.lrc,
            };
        });
    } catch (e) {
        console.error("Failed to fetch playlist", e);
    }
}

function extractColor() {
    if (!currentSong || !currentSong.pic) return;
    
    // 优先检查缓存
    if (colorCache[currentSong.pic]) {
        primaryColor = colorCache[currentSong.pic];
        return;
    }

    if (!coverImg || !colorThief) return;
    
    const getColor = () => {
        try {
            const color = colorThief.getColor(coverImg);
            primaryColor = color;
            colorCache[currentSong.pic] = color;
        } catch (e) {
             console.warn("Color extraction failed", e);
        }
    }

    if (coverImg.complete) {
        getColor();
    } else {
        coverImg.onload = getColor; // 如果不再依赖 'load' 事件而是检查 complete，这里可能是多余的
    }
}

function togglePlay() {
    if (!audio) return;
    if (isPlaying) {
        audio.pause();
    } else {
        audio.play();
    }
    isPlaying = !isPlaying;
}

function switchPlayMode() {
    if (playMode === 'order') playMode = 'loop';
    else if (playMode === 'loop') playMode = 'shuffle';
    else playMode = 'order';
}

function nextSong() {
    if (playMode === 'shuffle') {
        // 随机播放：选择随机歌曲
        isPlaying = true;
    } else if (playMode === 'loop') {
        // 单曲循环：下一首（手动点击覆盖单曲循环逻辑）
        isPlaying = true;
    }
    
    if (playMode === 'shuffle') {
        let newIndex =  Math.floor(Math.random() * playlist.length);
        while(newIndex === currentIndex && playlist.length > 1) {
            newIndex = Math.floor(Math.random() * playlist.length);
        }
        currentIndex = newIndex;
    } else {
        currentIndex = (currentIndex + 1) % playlist.length;
    }
    isPlaying = true;
}

function handleAutoNext() {
    // 歌曲结束时调用
    if (playMode === 'loop') {
        // 单曲循环
        audio.currentTime = 0;
        audio.play();
    } else {
        nextSong();
    }
}

function prevSong() {
    currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    isPlaying = true;
}

// 拖拽逻辑
function handleSeekStart(e: MouseEvent | TouchEvent) {
    isDragging = true;
    handleSeekMove(e);
}

function handleSeekMove(e: MouseEvent | TouchEvent) {
    if (!isDragging) return;
    const bar = document.getElementById('progress-bar-container');
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    let percent = (clientX - rect.left) / rect.width;
    percent = Math.max(0, Math.min(1, percent));
    progress = percent * 100;
    // 仅更新当前时间显示文本，暂不跳转音频以避免卡顿
    // 但我们需要 currentTime 用于显示
    currentTime = percent * duration;
}

function handleSeekEnd(e: MouseEvent | TouchEvent) {
    if (!isDragging) return;
    isDragging = false;
    const bar = document.getElementById('progress-bar-container');
    if (!bar || !audio) return;
    
    // 最终跳转
    // 我们已经在 move 中更新了 progress，所以只需从中计算时间
    audio.currentTime = (progress / 100) * duration;
}

function toggleExpand() {
    isExpanded = !isExpanded;
    if (!isExpanded) showPlaylist = false;
}

function handleClickOutside(event: MouseEvent) {
    if (isExpanded && !(event.target as Element).closest('.music-player-container')) {
        isExpanded = false;
        showPlaylist = false;
    }
}

function playSong(index: number) {
    currentIndex = index;
    isPlaying = true;
}




let playerStyle = "left: 1rem;"; // 默认安全位置

function calculatePosition() {
    const mainGrid = document.getElementById('main-grid');
    if (!mainGrid) return;


    const gridRect = mainGrid.getBoundingClientRect();
    const playerWidth = 240; // 宽度 60 = 15rem = 240px
    const gap = 16; // 1rem
    
    const computedStyle = window.getComputedStyle(mainGrid);
    const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
    
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
             playerStyle = `left: 2px;`;
         } else {
             playerStyle = `left: 1rem;`;
         }
    }
}

onMount(async () => {
    colorThief = new ColorThief();
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('mousemove', handleSeekMove);
    window.addEventListener('mouseup', handleSeekEnd);
    window.addEventListener('touchmove', handleSeekMove);
    window.addEventListener('touchend', handleSeekEnd);
    
    // 定位逻辑
    const observer = new ResizeObserver(() => {
        window.requestAnimationFrame(calculatePosition);
    });
    observer.observe(document.body);
    
    // 延迟初始计算
    setTimeout(calculatePosition, 100);
    setTimeout(calculatePosition, 500);
    
    await fetchPlaylist();
    
    if (audio) {
        audio.volume = volume;
        audio.addEventListener("timeupdate", () => {
            if (!isDragging) {
                currentTime = audio.currentTime;
                duration = audio.duration || 0;
                progress = (currentTime / duration) * 100;
            }
        });
        audio.addEventListener("ended", handleAutoNext);
        audio.addEventListener("play", () => isPlaying = true);
        audio.addEventListener("pause", () => isPlaying = false);
    }
    
    return () => {
        window.removeEventListener('click', handleClickOutside);
        window.removeEventListener('mousemove', handleSeekMove);
        window.removeEventListener('mouseup', handleSeekEnd);
        window.removeEventListener('touchmove', handleSeekMove);
        window.removeEventListener('touchend', handleSeekEnd);
        observer.disconnect();
    }
});


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
            on:click|stopPropagation
        >
            <!-- 头部 / 封面 -->
            <div 
                class="relative h-44 w-full group"
                style="-webkit-mask-image: linear-gradient(to bottom, black 50%, transparent 100%); mask-image: linear-gradient(to bottom, black 50%, transparent 100%);"
            >
                    <img 
                    bind:this={coverImg}
                    src={currentSong.pic} 
                    alt={currentSong.title} 
                    class="h-full w-full object-cover transition-transform duration-700"
                    class:scale-110={isPlaying}
                    crossorigin="anonymous"
                    on:load={extractColor}
                />
                    <!-- 移除手动渐变遮罩，改用 mask 实现完美融合 -->
                    
                    <!-- 顶部控制：关闭 -->
                    <button 
                        class="absolute top-3 right-3 p-2 rounded-full bg-black/20 text-white/80 hover:bg-black/40 hover:text-white transition-all backdrop-blur-sm z-20"
                        on:click={toggleExpand}
                    >
                       <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <!-- 歌曲信息（移出遮罩区域以确保可见性） -->
                <div class="px-5 -mt-10 relative z-10 text-white mb-2" style="text-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                    <div class="text-lg font-bold truncate tracking-tight">{currentSong.title}</div>
                    <div class="text-xs text-white/80 truncate mt-1 font-medium">{currentSong.author}</div>
                </div>

                <!-- 控制区 -->
                <div class="px-4 pb-5 relative z-10">
                    <!-- 进度条 -->
                    <div 
                        id="progress-bar-container"
                        class="mb-1 h-3 w-full flex items-center cursor-pointer group py-1"
                        on:mousedown={handleSeekStart}
                        on:touchstart={handleSeekStart}
                        role="slider" 
                        tabindex="0"
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
                        <!-- 播放模式 -->
                        <!-- 提示框 -->
                        {#if showModeTooltip}
                            <div 
                                class="absolute -top-7 left-0 -translate-x-1/4 px-2 py-1 bg-white/90 text-black text-[10px] rounded shadow-lg font-medium tracking-wide z-20 pointer-events-none whitespace-nowrap"
                                transition:fade={{ duration: 150 }}
                            >
                                {modeNames[playMode]}
                                <div class="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-white/90"></div>
                            </div>
                        {/if}

                         <button 
                            class="text-white/60 hover:text-white transition p-2 relative group" 
                            on:click={switchPlayMode}
                            on:mouseenter={() => showModeTooltip = true}
                            on:mouseleave={() => showModeTooltip = false}
                         >
                            {#if playMode === 'order'}
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>
                            {:else if playMode === 'loop'}
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/><text x="10" y="14" font-size="8" font-weight="bold" fill="currentColor">1</text></svg>
                            {:else}
                                <!-- 网易云风格曲线随机图标 -->
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                     <path d="M16 3h5v5" />
                                     <path d="M4 20L21 3" />
                                     <path d="M21 16v5h-5" />
                                     <path d="M15 15l-5 5-4-4" />
                                </svg>
                            {/if}
                        </button>

                        <div class="flex items-center gap-4">
                            <button class="text-white/80 hover:text-white transition" on:click={prevSong}>
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                            </button>
                            
                            <button 
                                class="w-12 h-12 flex items-center justify-center rounded-full bg-white text-black hover:scale-105 transition shadow-lg active:scale-95"
                                on:click={togglePlay}
                            >
                                {#if isPlaying}
                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                                {:else}
                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 mx-auto" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                                {/if}
                            </button>

                            <button class="text-white/80 hover:text-white transition" on:click={nextSong}>
                                 <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                            </button>
                        </div>
                        
                         <!-- 播放列表切换 -->
                         <button class="text-white/60 hover:text-white transition p-2" on:click={() => showPlaylist = !showPlaylist} class:text-white={showPlaylist}>
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                        </button>
                    </div>
                </div>
                
                <!-- 播放列表遮罩 -->
                {#if showPlaylist}
                    <div 
                        class="absolute inset-x-0 bottom-0 top-16 z-10 flex flex-col transition-all duration-500"
                        style="background: rgba(0, 0, 0, 0.25); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);"
                        transition:slide={{ duration: 200 }}
                    > 
                        <div class="px-5 py-3 text-[10px] font-bold text-white/50 uppercase tracking-widest flex justify-between items-center bg-white/5">
                            <span>播放列表 ({playlist.length})</span>
                             <button class="text-white/50 hover:text-white transition-colors p-1" on:click={() => showPlaylist = false}>
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <div class="flex-1 overflow-y-auto scrollbar-thin p-1 space-y-0.5">
                            {#each playlist as song, i}
                                <button 
                                    class="w-full flex items-center gap-3 p-2 rounded-md transition-all text-left group relative overflow-hidden"
                                    class:bg-white-10={currentIndex === i} 
                                    class:hover:bg-white-5={currentIndex !== i}
                                    on:click={() => playSong(i)}
                                >
                                    {#if currentIndex === i}
                                        <div class="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-1 bg-white rounded-r my-auto"></div>
                                    {/if}
                                    
                                    <div class="flex-1 min-w-0 pl-2">
                                        <div class="text-xs font-bold truncate leading-tight transition-colors" class:text-white={currentIndex === i} class:text-white-70={currentIndex !== i} class:group-hover:text-white={currentIndex !== i}>{song.title}</div>
                                        <div class="text-[10px] truncate mt-0.5" class:text-white-60={currentIndex === i} class:text-white-40={currentIndex !== i}>{song.author}</div>
                                    </div>
                                    
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
    .bg-white-5 { background-color: rgba(255,255,255,0.05); }
    .text-white-70 { color: rgba(255,255,255,0.7); }
    .text-white-50 { color: rgba(255,255,255,0.5); }
    .text-white-60 { color: rgba(255,255,255,0.6); }
    .text-white-40 { color: rgba(255,255,255,0.4); }

    .animate-music-bar-1 { animation: music-bar 0.5s ease-in-out infinite alternate; }
    .animate-music-bar-2 { animation: music-bar 0.55s ease-in-out infinite alternate; }
    .animate-music-bar-3 { animation: music-bar 0.6s ease-in-out infinite alternate; }
    
    @keyframes music-bar {
        0% { height: 2px; }
        100% { height: 12px; }
    }

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
