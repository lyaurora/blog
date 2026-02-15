# MusicPlayer Widget

一个基于 Svelte 的现代化、高颜值音乐播放器组件，支持网易云音乐歌单。

## 📁 目录结构

```
src/components/widget/
├── MusicPlayer.svelte       # 顶层容器，负责定位、Audio 元素与全局状态协调
└── music/
    ├── README.md            # 本文档
    ├── constants.ts         # 默认配置与常量
    ├── store.ts             # 核心状态管理 (Svelte Store) & 持久化逻辑
    ├── types.ts             # TypeScript 类型定义
    ├── utils.ts             # 工具函数 (格式化时间等)
    └── components/          # 子组件
        ├── Cover.svelte     # 封面显示 (含 ColorThief 颜色提取)
        ├── Controls.svelte  # 播放控制 (上一首/播放/下一首/模式)
        ├── Playlist.svelte  # 播放列表弹窗
        ├── PlayerPanel.svelte # 展开后的主面板布局
        ├── ProgressBar.svelte # 进度条 (支持拖拽)
        └── VolumeControl.svelte # 音量控制
```

## ✨ 核心特性

1.  **极速加载 (Instant Load)**:
    *   歌单数据和当前播放索引会缓存至 `localStorage`。
    *   页面刷新后无需等待 API 响应即可恢复播放状态。
2.  **状态持久化**:
    *   自动保存音量、播放模式、收藏列表。
3.  **视觉体验**:
    *   **黑胶唱片加载占位**: 纯 CSS 实现的拟物化黑胶唱片效果 (MusicPlayer.svelte)。
    *   **自适应主题色**: `Cover.svelte` 使用 `colorthief` (懒加载) 提取封面主色调作为背景模糊。
    *   **平滑过渡**: 封面加载、播放器展开/折叠均有流畅的 CSS 动画。
4.  **健壮性**:
    *   完整的错误处理 (API 失败提示)。
    *   防抖动的 ResizeObserver 定位逻辑。

## 🛠 配置 (Configuration)

主要配置位于 `src/config.ts` 的 `siteConfig.music`：

```typescript
music: {
    enable: true,
    id: "9327502763", // 网易云歌单 ID
    server: "netease",
    type: "playlist",
}
```

## 🎨 视觉微调

### 黑胶唱片 (Vinyl Placeholder)
位于 `MusicPlayer.svelte` 的 `<button>` 内部：
-   **纹理**: `repeating-radial-gradient` 模拟唱片沟槽。
-   **红标**: `bg-gradient-to-br from-red-600 to-red-900`。
-   **轴孔**: `width: 1.5px; height: 1.5px;` (微米级细节)。

### 封面组件 (Cover.svelte)
-   依赖 `colorthief` 库提取颜色，该库已配置为动态导入 (Dynamic Import) 以减少首屏体积。

## 📦 维护指南

-   **修改样式**: 尽量使用 Tailwind CSS 类名。
-   **状态管理**: 所有跨组件状态（播放/暂停、切歌）请通过 `store.ts` 修改，避免组件间直接通信。
-   **API**: 目前依赖 MetingJS 或兼容的后端 API，如需更换源请在 `store.ts` 的 `fetchPlaylist` 中修改。
