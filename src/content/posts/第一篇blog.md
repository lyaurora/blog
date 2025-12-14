---
title: 我的第一篇测试文章
published: 2025-12-14
description: 这是我通过 VS Code 和 Git 发布的第一篇文章！
tags: [测试, 生活]
category: 日常
draft: false
---

## 大家好！

这是我的第一篇博客文章。

如果你能看到这句话，说明我已经成功掌握了：
1. 搭建 Astro 博客
2. 使用 VS Code 写文章
3. 自动部署到 Vercel

## 视频分享测试

### 1. 嵌入 Bilibili 视频示例
<iframe src="//player.bilibili.com/player.html?isOutside=true&aid=1804992291&bvid=BV1xb421q7Ks&cid=1551946003&p=1" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true" width="100%" height="450"></iframe>

### 2. 嵌入 YouTube 视频示例
<iframe width="100%" height="450" src="https://www.youtube.com/embed/j9hWHyjVq3M" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>

## 代码高亮演示

### Python - Hello World
```python
def main():
    print("Hello, World!")

if __name__ == "__main__":
    main()
```

### JavaScript - 经典闭包
```javascript
function createCounter() {
    let count = 0;
    return function() {
        return ++count;
    };
}

const counter = createCounter();
console.log(counter()); // 1
console.log(counter()); // 2
```

## Fuwari 专用 Directive 风格提示块演示
这种写法更美观，而且**支持自定义标题**。

:::note
这是默认的笔记块。
:::

:::tip
这是提示块，通常是绿色的。
:::

:::important
这是重要信息块，通常是紫色的。
:::

:::warning
这是警告块，通常是黄色的。
:::

:::caution
这是危险块，通常是红色的。
:::

### 自定义标题演示

:::tip[💡 我的独家秘籍]
看！我可以把标题改成任何我想要的样子，甚至加 Emoji。
:::

:::warning[⚠️ 这是一个严重的警告]
不要在没有备份的情况下删除数据库！
:::