import { derived, get, writable } from "svelte/store";
import { DEFAULT_API_URL } from "./constants";
import type {
	ColorArray,
	MetingItem,
	MusicConfig,
	PlayMode,
	Song,
} from "./types";

// State
export const isExpanded = writable(false);
export const isPlaying = writable(false);
export const showPlaylist = writable(false);
export const playMode = writable<PlayMode>("order");
export const playlist = writable<Song[]>([]);
export const currentIndex = writable(0);
export const primaryColor = writable<ColorArray>([20, 20, 20]);
export const currentSong = writable<Song | undefined>(undefined);
export const progress = writable(0);
export const duration = writable(0);
export const currentTime = writable(0);
export const volume = writable(0.5);
export const likedSongs = writable<Set<string>>(new Set());
export const errorMsg = writable<string | null>(null);
export const isAudioLoading = writable(false);
export const isSeeking = writable(false);
export const audioPreconnectOrigins = derived(
	[playlist, currentIndex],
	([$playlist, $currentIndex]) => {
		if ($playlist.length === 0) return [];

		const origins = new Set<string>();
		for (const offset of [0, 1, -1]) {
			const song =
				$playlist[($currentIndex + offset + $playlist.length) % $playlist.length];
			if (!song?.url) continue;
			try {
				origins.add(new URL(song.url).origin);
			} catch {
				// Ignore malformed upstream URLs; the audio element will report the real error.
			}
		}
		return Array.from(origins);
	},
);

// Internal flag to prevent currentSong jitter during playlist reordering
let isSwitchingPlaylist = false;
const preloadedCovers = new Set<string>();
const preloadedAudio = new Map<string, HTMLAudioElement>();
const PLAYLIST_CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const MAX_AUDIO_ERROR_SKIPS = 3;

// Audio Element Reference
let audio: HTMLAudioElement | null = null;
let fadeInterval: number | null = null;
let playbackRequestToken = 0;
let playbackIntent: "play" | "pause" = "pause";
let consecutiveAudioErrors = 0;
let lastAudioErrorUrl = "";
let lastAudioErrorAt = 0;
let lastCurrentSongUrl = "";

// Derived or manual subscriptions
currentIndex.subscribe(($index) => {
	if (isSwitchingPlaylist) return;
	const $playlist = get(playlist);
	if ($playlist && $playlist[$index]) {
		currentSong.set($playlist[$index]);
		// Persist current index
		if (typeof localStorage !== "undefined") {
			localStorage.setItem("music-current-index", String($index));
		}
	}
});
playlist.subscribe(($playlist) => {
	if (isSwitchingPlaylist) return;
	const $index = get(currentIndex);
	if ($playlist && $playlist[$index]) {
		currentSong.set($playlist[$index]);
	}
});

// Update MediaSession when song changes
currentSong.subscribe(($song) => {
	const nextUrl = $song?.url || "";
	if (nextUrl !== lastCurrentSongUrl) {
		progress.set(0);
		currentTime.set(0);
		duration.set(0);
		lastCurrentSongUrl = nextUrl;
	}

	if (typeof navigator !== "undefined" && "mediaSession" in navigator && $song) {
		navigator.mediaSession.metadata = new MediaMetadata({
			title: $song.title,
			artist: $song.author,
			artwork: [
				{ src: $song.pic, sizes: "500x500", type: "image/jpeg" },
			],
		});
	}
});

// Helper: Sort playlist (Liked songs first)
function sortMusicList(list: Song[], liked: Set<string>): Song[] {
	return [...list].sort((a, b) => {
		const aLiked = liked.has(a.id);
		const bLiked = liked.has(b.id);
		if (aLiked && !bLiked) return -1;
		if (!aLiked && bLiked) return 1;
		return 0;
	});
}

function setPlaylistWithSafeIndex(list: Song[]) {
	if (list.length === 0) {
		playlist.set([]);
		currentSong.set(undefined);
		return;
	}

	const activeSong = get(currentSong);
	let nextIndex = get(currentIndex);

	if (activeSong) {
		const activeIndex = list.findIndex((song) => song.id === activeSong.id);
		if (activeIndex !== -1) nextIndex = activeIndex;
	}

	if (nextIndex < 0 || nextIndex >= list.length) nextIndex = 0;

	playlist.set(list);
	currentIndex.set(nextIndex);
	currentSong.set(list[nextIndex]);
}

// Actions
export function setAudioElement(el: HTMLAudioElement) {
	audio = el;
	
	// Setup MediaSession hardware/OS controls
	if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
		navigator.mediaSession.setActionHandler("play", playAudio);
		navigator.mediaSession.setActionHandler("pause", pauseAudio);
		navigator.mediaSession.setActionHandler("previoustrack", prevSong);
		navigator.mediaSession.setActionHandler("nexttrack", nextSong);
	}
}

export function toggleExpand() {
	isExpanded.update((v) => {
		if (v) showPlaylist.set(false);
		return !v;
	});
}

export function togglePlaylist() {
	showPlaylist.update((v) => !v);
}

export function handleAudioWaiting() {
	if (get(isPlaying) || playbackIntent === "play") {
		isAudioLoading.set(true);
	}
}

export function handleAudioReady() {
	consecutiveAudioErrors = 0;
	lastAudioErrorUrl = "";
	isAudioLoading.set(false);
	if (get(playlist).length > 0) errorMsg.set(null);
}

export function handleAudioError() {
	isAudioLoading.set(false);

	const failedSong = get(currentSong);
	if (!failedSong) return;

	const now = Date.now();
	if (failedSong.url === lastAudioErrorUrl && now - lastAudioErrorAt < 1200) {
		return;
	}
	lastAudioErrorUrl = failedSong.url;
	lastAudioErrorAt = now;

	const $playlist = get(playlist);
	if ($playlist.length <= 1 || consecutiveAudioErrors >= MAX_AUDIO_ERROR_SKIPS) {
		isPlaying.set(false);
		errorMsg.set("当前歌曲加载失败，请稍后再试");
		return;
	}

	consecutiveAudioErrors++;
	console.warn("Audio failed, skipping to next song", failedSong.title);
	nextSong();
}

function clearFadeInterval() {
	if (fadeInterval !== null) {
		clearInterval(fadeInterval);
		fadeInterval = null;
	}
}

function pauseAudio() {
	playbackIntent = "pause";
	const requestToken = ++playbackRequestToken;
	isAudioLoading.set(false);

	clearFadeInterval();

	if (!audio) return;

	if (audio.paused) {
		audio.volume = get(volume);
		return;
	}

	// Fade out over 200ms to avoid abrupt clicks/pops in headphones.
	const stepTime = 20;
	const steps = 200 / stepTime;
	let currentStep = 0;

	fadeInterval = window.setInterval(() => {
		if (
			!audio ||
			requestToken !== playbackRequestToken ||
			playbackIntent !== "pause"
		) {
			clearFadeInterval();
			return;
		}

		currentStep++;
		const targetVolume = get(volume);
		const newVol = targetVolume * (1 - currentStep / steps);

		if (currentStep < steps && newVol > 0) {
			audio.volume = newVol;
			return;
		}

		audio.volume = 0;
		audio.pause();
		audio.volume = targetVolume;
		clearFadeInterval();
	}, stepTime);
}

function playAudio() {
	if (!audio) return;

	playbackIntent = "play";
	const requestToken = ++playbackRequestToken;

	clearFadeInterval();

	// Fade in over 200ms to avoid abrupt clicks/pops in headphones.
	const targetVolume = get(volume);
	const stepTime = 20;
	const steps = 200 / stepTime;
	let currentStep = 0;

	if (!audio.paused) {
		audio.volume = targetVolume;
		preloadNearbyAudio(get(playlist), get(currentIndex));
		return;
	}

	audio.volume = 0;
	isAudioLoading.set(true);
	preloadNearbyAudio(get(playlist), get(currentIndex));
	audio.play().then(() => {
		if (!audio) return;

		if (requestToken !== playbackRequestToken) {
			if (playbackIntent !== "play") {
				audio.pause();
				audio.volume = targetVolume;
			}
			return;
		}

		if (playbackIntent !== "play") {
			audio.pause();
			audio.volume = targetVolume;
			return;
		}

		fadeInterval = window.setInterval(() => {
			if (
				!audio ||
				requestToken !== playbackRequestToken ||
				playbackIntent !== "play"
			) {
				clearFadeInterval();
				return;
			}

			currentStep++;
			const newVol = targetVolume * (currentStep / steps);

			if (currentStep < steps && newVol < targetVolume) {
				audio.volume = newVol;
				return;
			}

			audio.volume = targetVolume;
			clearFadeInterval();
		}, stepTime);
	}).catch((e) => {
		if (audio) audio.volume = targetVolume;
		isAudioLoading.set(false);
		clearFadeInterval();

		if (
			requestToken !== playbackRequestToken ||
			playbackIntent !== "play"
		) {
			return;
		}

		console.error("Playback failed", e);
		if (!(e instanceof DOMException) || e.name !== "NotAllowedError") {
			handleAudioError();
		}
	});
}

function preloadCover(pic?: string) {
	if (!pic || typeof Image === "undefined" || preloadedCovers.has(pic)) return;
	preloadedCovers.add(pic);
	const image = new Image();
	image.decoding = "async";
	image.src = pic;
}

function preloadNearbyCovers(list: Song[], index: number) {
	if (list.length === 0) return;
	preloadCover(list[index]?.pic);
	preloadCover(list[(index + 1) % list.length]?.pic);
	preloadCover(list[(index - 1 + list.length) % list.length]?.pic);
}

function preloadAudio(url?: string) {
	if (!url || typeof Audio === "undefined" || preloadedAudio.has(url)) return;

	const nextAudio = new Audio();
	nextAudio.crossOrigin = "anonymous";
	nextAudio.preload = "auto";
	nextAudio.src = url;
	nextAudio.load();
	preloadedAudio.set(url, nextAudio);

	if (preloadedAudio.size > 6) {
		const [oldUrl, oldAudio] = preloadedAudio.entries().next().value as [
			string,
			HTMLAudioElement,
		];
		oldAudio.removeAttribute("src");
		oldAudio.load();
		preloadedAudio.delete(oldUrl);
	}
}

function preloadNearbyAudio(list: Song[], index: number) {
	if (list.length === 0) return;
	preloadAudio(list[(index + 1) % list.length]?.url);
	preloadAudio(list[(index - 1 + list.length) % list.length]?.url);
}

function preloadNearbyAssets(list: Song[], index: number) {
	preloadNearbyCovers(list, index);
	if (get(isPlaying) || playbackIntent === "play") {
		preloadNearbyAudio(list, index);
	}
}

export function togglePlay() {
	if (!audio) return;

	if (get(isPlaying)) {
		pauseAudio();
	} else {
		playAudio();
	}
}

export function setVolume(val: number) {
	volume.set(val);
	if (audio && !fadeInterval) audio.volume = val;
	if (typeof localStorage !== "undefined") {
		localStorage.setItem("music-volume", val.toString());
	}
}

export function toggleMute() {
	const currentVol = get(volume);
	if (currentVol > 0) {
		setVolume(0);
	} else {
		setVolume(0.5);
	}
}

export function switchPlayMode() {
	playMode.update((mode) => {
		let newMode: PlayMode = "order";
		if (mode === "order") newMode = "loop";
		else if (mode === "loop") newMode = "shuffle";
		else newMode = "order";

		if (typeof localStorage !== "undefined") {
			localStorage.setItem("music-play-mode", newMode);
		}
		return newMode;
	});
}

export function nextSong() {
	const $playlist = get(playlist);
	if ($playlist.length === 0) return;

	const $mode = get(playMode);
	const $index = get(currentIndex);

	if ($mode === "shuffle") {
		let newIndex = Math.floor(Math.random() * $playlist.length);
		while (newIndex === $index && $playlist.length > 1) {
			newIndex = Math.floor(Math.random() * $playlist.length);
		}
		preloadNearbyAssets($playlist, newIndex);
		currentIndex.set(newIndex);
	} else {
		const newIndex = ($index + 1) % $playlist.length;
		preloadNearbyAssets($playlist, newIndex);
		currentIndex.set(newIndex);
	}
	isPlaying.set(true);
}

export function prevSong() {
	const $playlist = get(playlist);
	if ($playlist.length === 0) return;

	const $index = get(currentIndex);
	const newIndex = ($index - 1 + $playlist.length) % $playlist.length;
	preloadNearbyAssets($playlist, newIndex);
	currentIndex.set(newIndex);
	isPlaying.set(true);
}

export function playSong(index: number) {
	const $playlist = get(playlist);
	if (index < 0 || index >= $playlist.length) return;

	preloadNearbyAssets($playlist, index);
	currentIndex.set(index);
	isPlaying.set(true);
}

// Updated toggleLike to accept an optional song argument
export function toggleLike(targetSong?: Song) {
	const $song = targetSong || get(currentSong);
	if (!$song) return;

	const $liked = get(likedSongs);
	const newSet = new Set($liked);

	// 1. Update Liked Set Logic
	if (newSet.has($song.id)) {
		newSet.delete($song.id);
	} else {
		newSet.add($song.id);
	}

	// 2. Update likedSongs Store FIRST
	likedSongs.set(newSet);

	// 3. Re-sort Playlist based on new liked status
	const $playlist = get(playlist);
	const sortedPlaylist = sortMusicList($playlist, newSet);

	// 4. Find Current Song's New Index (Need to respect the ACTUAL current playing song)
	const $currentSong = get(currentSong);
	let newIndex = -1;
	if ($currentSong) {
		newIndex = sortedPlaylist.findIndex((s) => s.id === $currentSong.id);
	}

	// CRITICAL: Prevent currentSong from updating during this transition
	isSwitchingPlaylist = true;

	// 5. Update Playlist and Index Stores
	playlist.set(sortedPlaylist);
	if (newIndex !== -1) {
		currentIndex.set(newIndex);
	}

	// Release lock
	isSwitchingPlaylist = false;

	// 6. Persist
	if (typeof localStorage !== "undefined") {
		localStorage.setItem(
			"music-liked-songs",
			JSON.stringify(Array.from(newSet)),
		);
	}
}

export async function fetchPlaylist(config: MusicConfig) {
	if (!config.enable) return;
	errorMsg.set(null); // Clear previous errors

	// Try to load from cache first
	const cacheKey = `music-playlist-${config.id}`;
	let hasUsableCache = false;
	if (typeof localStorage !== "undefined") {
		const cached = localStorage.getItem(cacheKey);
		if (cached) {
			try {
				const { list, date } = JSON.parse(cached);
				const cacheAge = typeof date === "number" ? Date.now() - date : 0;
				if (
					Array.isArray(list) &&
					list.length > 0 &&
					cacheAge <= PLAYLIST_CACHE_MAX_AGE
				) {
					const $likedSongs = get(likedSongs);
					const sortedCache = sortMusicList(list, $likedSongs);
					setPlaylistWithSafeIndex(sortedCache);
					preloadNearbyAssets(sortedCache, get(currentIndex));
					hasUsableCache = true;
					errorMsg.set(null);
				}
			} catch (e) {
				console.error("Failed to load cached playlist", e);
			}
		}
	}

	try {
		const api = config.api || DEFAULT_API_URL;
		const res = await fetch(
			`${api}?server=${config.server}&type=${config.type}&id=${config.id}&r=${Math.random()}`,
		);
		if (!res.ok) {
			throw new Error(`API Error: ${res.status} ${res.statusText}`);
		}
		const data = await res.json();

		if (!Array.isArray(data)) {
			throw new Error("Invalid playlist data format");
		}

		const $likedSongs = get(likedSongs);

		const newPlaylist = data.map((item: MetingItem) => {
			let pic = item.pic || "";
			if (pic) {
				pic = pic.replace(/^http:/, "https:");
				const sizeParam = pic.includes("type=pic")
					? "picsize=500"
					: "param=500y500";
				pic += pic.includes("?") ? `&${sizeParam}` : `?${sizeParam}`;
			}
			return {
				id: String(item.id || item.url),
				title: item.title,
				author: item.author,
				url: item.url,
				pic: pic,
				lrc: item.lrc,
			};
		});

		const sortedPlaylist = sortMusicList(newPlaylist, $likedSongs);
		setPlaylistWithSafeIndex(sortedPlaylist);
		preloadNearbyAssets(sortedPlaylist, get(currentIndex));
		errorMsg.set(null);

		// Update Cache
		if (typeof localStorage !== "undefined") {
			localStorage.setItem(
				cacheKey,
				JSON.stringify({
					// Cache unsorted original raw data
					list: newPlaylist,
					date: Date.now(),
				}),
			);
		}
	} catch (e) {
		console.error("Failed to fetch playlist", e);
		if (!hasUsableCache) {
			errorMsg.set("加载歌单失败，请检查网络设置");
		}
	}
}

export function handleAutoNext() {
	const $mode = get(playMode);
	if ($mode === "loop") {
		if (audio) {
			audio.currentTime = 0;
			audio.play();
		}
	} else {
		nextSong();
	}
}

export function initLikeStore() {
	if (typeof localStorage !== "undefined") {
		const savedLiked = localStorage.getItem("music-liked-songs");
		if (savedLiked) {
			try {
				likedSongs.set(new Set(JSON.parse(savedLiked)));
			} catch (e) {
				console.error("Failed to load liked songs", e);
			}
		}
		const savedVolume = localStorage.getItem("music-volume");
		if (savedVolume) {
			volume.set(Number(savedVolume));
		}

		const savedPlayMode = localStorage.getItem("music-play-mode");
		if (savedPlayMode) {
			if (["order", "loop", "shuffle"].includes(savedPlayMode)) {
				playMode.set(savedPlayMode as PlayMode);
			}
		}

		// Restore current index
		const savedIndex = localStorage.getItem("music-current-index");
		if (savedIndex) {
			currentIndex.set(Number(savedIndex));
		}
	}
}
