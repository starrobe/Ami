# 终端体验优化路线图

目标：让 Ami Terminal 从「命令执行器」向「真实终端体验」演进。本文件是待办清单与未来方向的单一来源，按优先级和阶段组织。

## 已修复（2026-08-30）

- [x] `ls` 与 Tab 补全列表的中文列宽错位 —— `columnLayout.ts` 改用 `stringWidth` 按显示宽度对齐（含测试）。
- [x] `Ctrl+L` 行内无效 —— 现在任何时刻按 `Ctrl+L` 都清屏并重绘提示符 + 当前输入 + 光标位置。
- [x] `ErrorBoundary` 静默吞错 —— 富内容渲染失败时回退显示错误信息，不再凭空消失。
- [x] `useTerminal.ts` 拆分 —— 716→349 行，拆为 `input`（按键处理）、`completion`（补全，纯函数可测）、`register`（命令注册）、`prompt`（提示符）。
- [x] `Ctrl+C` 语义 —— 改发 `SIGINT`（中断前台进程），`Signal` 类型新增 SIGINT，与 `kill` 的 `SIGTERM`/`SIGKILL` 区分。
- [x] 面板快捷键 —— `G`（跳到底部）、`gg`（跳到顶部）。
- [x] 面板快捷键 —— `q` / `Esc` 关闭面板（SIGTERM 终止）。

## 待优化（按优先级）

### 高优先级 —— 行编辑与历史（成本低、收益最高）

纯 `onData` 加分支，不碰架构，补上后「手感」立刻上一个台阶。

- [ ] `Ctrl+A` / `Ctrl+E` —— 行首 / 行尾
- [ ] `Ctrl+K`（删到行尾）、`Ctrl+D`（删光标处）
- [ ] `Ctrl+R` —— 反向历史搜索（目前只能 ↑ 逐条翻）
- [ ] `Alt+B` / `Alt+F` / `Alt+D` —— 按词移动 / 删词（目前只有 `Ctrl+W`）
- [ ] `Ctrl+P` / `Ctrl+N`、`Home` / `End`
- [ ] `!!` / `!n` / `!$` —— 历史展开

### 中优先级 —— 命令覆盖与 shell 语法

- [ ] 补常用命令（复用只读 FS，成本低）：`head` / `tail` / `wc` / `sort` / `uniq` / `find` / `date` / `uname` / `which` / `tree`
- [ ] 通配符 glob：`ls *.md`、`cat blog/*`（现在 `*` 被当字面量）
- [ ] `&&` / `;` / `||` 链式执行
- [ ] 环境变量：`echo $HOME`；提示符的 `~` 目前硬编码 `replace('/home/user','~')`，可抽成 `$HOME`
- [ ] `&` 后台启动语法：现在只有面板能靠 `Ctrl+Z`/关闭挂后台
- [ ] `cat --raw`：保留面板预览的同时，给一个直接 dump 文本的选项

### 低优先级 —— 打磨

- [ ] 面板分页体验（剩余）：`j/k` 滚动
- [ ] 面板搜索 `/`（已临时移除：焦点被选区抢走；需改用非 `Selection` API 的高亮方案重做）
- [ ] 提示符增强：显示 git 分支、路径过长缩写、自定义 PS1
- [ ] 配置持久化：历史 / 主题 / 别名存 `localStorage`，刷新不丢
- [ ] 主题扩展（暂缓）：目前 `themes.ts` 只有 `default`，`theme` 命令形同虚设 —— 补 dracula / solarized / gruvbox / catppuccin
- [ ] `ls -l` 元数据真实化：`size` 按字节、`date` 从 frontmatter（当前 `DEFAULT_DATE` 写死、`formatSize` 用字符串长度）

## 未来路线图（分阶段）

### Phase 1 —— 打磨已有

高优先级全部 + 主题扩展 + 面板快捷键。目标：让现有功能的手感接近真终端。

### Phase 2 —— shell 语法

glob、`&&`/`;`、`$VAR`、`&` 后台、`>` 重定向。这是从「命令执行器」到「shell」的关键一跃。

### Phase 3 —— 让进程真正跑起来（核心亮点）

进程框架已就绪（`Process` 接口 + 信号状态机 + `fg`/`bg`/`kill`），但目前**只有 `PanelProcess` 一种实现**，「运行体」（后台 `running` 持续执行）能力一个实现都没有。建议第一批落地：

- `sleep 3 &` → `jobs` 显示 `Running` → `kill %1` 打断
- `ping` / `yes` —— 流式输出，后台继续刷屏
- 音乐播放（最初设想场景）—— 后台 `running`、`Ctrl+Z` 暂停、`fg` 恢复，完整演示信号模型

### Phase 4 —— 架构级

- **管道 `|`**：最大的一块，要求命令输出从 `string` 抽象成可流式/可拼接的流（如 `ls | grep blog`）。需单独设计，别急着堆。
- **可写文件系统**：`touch` / `mkdir` / `rm` / `mv`（内存态或 `localStorage` 持久化）。
- **`less` 分页器**。
- **多标签终端**。
