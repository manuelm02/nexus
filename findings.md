# 发现记录

## 代码库状态
- 前端 `src/index.css` 当前使用旧 Navy Mono 配色（`--primary: 215 65% 12%`）
- `tailwind.config.ts` 使用 `.ts` 扩展名，已集成 `tailwindcss-animate`
- Sidebar 使用深色 `bg-primary`（即将改为 `bg-sidebar`）
- MobileNav 已按 PRIMARY_MOBILE_PATHS 实现 4+n 模式
- shell/ 目录不存在，所有组件需新建
- 有 DesktopView/MobileView 拆分的页面: Crawl, Inbox, Mindbank, Notes, PanelHub, Settings, ToDo, Translate
- 无拆分的页面: Chat, CodingPractice, Login, Profile, Tasks
- 所有 `.nexus-*` 原语定义在 `index.css` 的 `@layer components` 中
