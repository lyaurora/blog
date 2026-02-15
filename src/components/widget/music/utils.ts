export function formatTime(seconds: number) {
	if (Number.isNaN(seconds)) return "0:00";
	const min = Math.floor(seconds / 60);
	const sec = Math.floor(seconds % 60);
	return `${min}:${String(sec).padStart(2, "0")}`;
}
