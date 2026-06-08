import fs from "node:fs";
import path_module from "node:path";

export function getDir(path: string): string {
	const postsDir = path_module.join(process.cwd(), "src/content/posts", path);
	try {
		if (fs.existsSync(postsDir) && fs.statSync(postsDir).isDirectory()) {
			return `${path}/`;
		}
	} catch {}

	const lastSlashIndex = path.lastIndexOf("/");
	if (lastSlashIndex < 0) {
		return "/";
	}
	return path.substring(0, lastSlashIndex + 1);
}
