import { get, writable } from "svelte/store";
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

// Internal flag to prevent currentSong jitter during playlist reordering
let isSwitchingPlaylist = false;

// Audio Element Reference
let audio: HTMLAudioElement | null = null;

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

// Actions
export function setAudioElement(el: HTMLAudioElement) {
	audio = el;
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

export function togglePlay() {
	if (!audio) return;
	if (get(isPlaying)) {
		audio.pause();
	} else {
		audio.play().catch((e) => console.error("Playback failed", e));
	}
}

export function setVolume(val: number) {
	volume.set(val);
	if (audio) audio.volume = val;
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
		currentIndex.set(newIndex);
	} else {
		currentIndex.set(($index + 1) % $playlist.length);
	}
	isPlaying.set(true);
}

export function prevSong() {
	const $playlist = get(playlist);
	if ($playlist.length === 0) return;

	const $index = get(currentIndex);
	currentIndex.set(($index - 1 + $playlist.length) % $playlist.length);
	isPlaying.set(true);
}

export function playSong(index: number) {
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
	if (typeof localStorage !== "undefined") {
		const cached = localStorage.getItem(cacheKey);
		if (cached) {
			try {
				const { list, date } = JSON.parse(cached);
				// Can check cache expiration here if needed (e.g. 1 day)
				if (Array.isArray(list) && list.length > 0) {
					const $likedSongs = get(likedSongs);
					const sortedCache = sortMusicList(list, $likedSongs);
					playlist.set(sortedCache);
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
				pic += pic.includes("?") ? "&param=300y300" : "?param=300y300";
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
		playlist.set(sortedPlaylist);

		// Update Cache
		if (typeof localStorage !== "undefined") {
			localStorage.setItem(
				cacheKey,
				JSON.stringify({
					list: newPlaylist, // Cache unsorted original or sorted? Assuming unsorted for raw data, but let's cache what we have
					// Actually caching sortedList is tricky because valid sort depends on likedSongs.
					// Better cache the 'newPlaylist' (raw data) and let init resort it?
					// Currently we cache 'newPlaylist' implicitly if we just store 'newPlaylist'.
					// Let's store 'newPlaylist' (the fetched and mapped data BEFORE sorting by likes is usually cleaner,
					// BUT logic above sets cache directly to store.
					// Let's store 'newPlaylist' (mapped from API) and re-sort on load.
					list: newPlaylist,
					date: Date.now(),
				}),
			);
		}
	} catch (e) {
		console.error("Failed to fetch playlist", e);
		errorMsg.set("加载歌单失败，请检查网络设置");
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
