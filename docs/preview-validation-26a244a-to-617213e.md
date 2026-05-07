# 预览验证记录（基线 `26a244a`）

验证顺序：`50f69fc -> 637ea88 -> aba69bc -> 2fe99d4 -> 289e5f2 -> 617213e`

仅检查路径：
1. 首次进入 `/bangumi`
2. `/bangumi` -> `/about`
3. `/` -> `/about`

## 结果

| 提交 | 结果 | 说明 |
|---|---|---|
| `50f69fc` | 未见闪屏 | 此提交未改动目标 4 文件。 |
| `637ea88` | 未见闪屏 | 仅优化动画 GPU 合成与组件加载策略，未引入 entry gate。 |
| `aba69bc` | **首次出现闪屏** | 引入 `entry-pending` 与 1.5s 延迟解除，且将入场触发与异步内容加载解耦，造成页面内容先隐藏后显现。 |
| `2fe99d4` | 保留闪屏风险 | 继续扩大 entry gate（最长 2.5s），并在 `entry-ready` 事件后再启动部分逻辑。 |
| `289e5f2` | 回归修复方向 | 对 entry gate 加初始化保护，降低站内跳转回归风险。 |
| `617213e` | 无新增该类改动 | 仅改动 `Navbar.astro`。 |

## 按要求回滚并复测

首次出现闪屏提交：`aba69bc`。

仅回滚该提交中涉及的目标文件：
- `src/layouts/Layout.astro`
- `src/styles/transition.css`
- `src/components/Navbar.astro`
- `src/components/Bangumi.astro`

复测结论：三条路径闪屏现象消失（恢复为 `637ea88` 前一版该组文件行为）。

## 复测所用回滚命令（仅针对 `aba69bc` 影响文件）

```bash
git checkout aba69bc^ -- src/layouts/Layout.astro src/styles/transition.css src/components/Navbar.astro src/components/Bangumi.astro
```

