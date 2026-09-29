# 项目规则

本仓库是 Hugo 静态博客，使用仓库内的 PaperMod 主题。站点配置在 `hugo.yml`，构建产物在 `public/`。

## 目录与内容

- 文章放在 `content/posts/`；其他页面和分类元数据放在 `content/` 对应位置。新文件名优先用小写 kebab-case，front matter 沿用现有格式。
- 需要 Hugo 处理的资源放在 `assets/`；直接复制到站点的文件放在 `static/`；浏览器小游戏放在 `static/games/`。
- 项目级模板和渲染钩子放在 `layouts/`；不要手改 `public/`，应重新构建。
- 已决定但尚未实现的设计记录放在 `docs/design/`，每项一个小写 kebab-case 文件。配套的独立 HTML 小样命名为同名前缀加 `-demo.html`，仅供本地评审，不作为站点页面。功能完成后，将仍有效的规则并入本文件，精简设计记录。
- 改变目录、命名或工作流程时，先更新本文件。不要撤销用户现有改动。

## 主题与页面

- 仓库内的 PaperMod 版本固定，不升级或与上游重新同步。改动前查阅 Hugo/PaperMod 官方文档；优先使用配置、front matter 或 i18n，其次使用项目级覆盖，最后才改 `themes/PaperMod/`，并记录原因。
- `layouts/_default/baseof.html` 是主题模板的项目覆盖；修改主题对应模板时检查两者是否需要同步，保留跳转正文链接和 `<main id="main">`。
- 正文使用系统字体，不引入整站网络字体。`assets/css/extended/custom.css` 不添加全局 `font-family`，以免覆盖代码字体。调整字号时一起检查正文行宽、代码宽度和标题层级。
- `assets/css/extended/chroma-light.css` 的浅色代码配色已调整对比度；重新生成时检查对比度。
- `layouts/_markup/render-image.html` 只处理 Markdown 图片，不处理原始 `<img>`；远程图片尺寸获取失败时构建仍可继续。修改图片或布局时检查页面跳动。
- 原生折叠目录在无 JavaScript 时仍可用；右侧目录条只是增强。目录条整体接收指针事件，各标记不单独接收；移动端及窄屏不显示。
- 锚点滚动由 `layouts/partials/footer.html` 处理。内容加载导致标题移动时允许有限次校正；文末标题可能因滚动边界无法到达页面顶部。
- 首页介绍区的流体形象由三个文件组成：`layouts/partials/home_info.html`（项目级覆盖，标题/正文/社交图标须与主题同名 partial 保持同步）、`assets/css/extended/fluid-ip.css`、`assets/js/fluid-ip.js`。设计记录见 `docs/design/fluid-ip.md`。
- 全站导航通过 `hugo.yml` 的 `params.label.iconSVG` 使用同一形象标记；文章末尾复用该 SVG 作为返回文章列表的入口。小形象样式也放在 `fluid-ip.css`，不复制主题 header，不增加持续运行的动画循环。阅读区和文章卡片保持稳定；小形象仅在对应链接悬停或聚焦时柔和转向。文章页可克隆该标记挂在阅读进度条尖端、文末签名形象可冒出一次（见 `docs/design/fluid-ink.md` 场景 D），只用 transform，不接收指针，静止即停 rAF。
- 墨团与回声的全站互变共用 `assets/js/fluid-ink.js`（`window.FluidInk`：回声路径、元素墨化滤镜等原语），设计记录见 `docs/design/fluid-ink.md`。回声必须画在主体 goo 滤镜组内才能融合，不用 HTML 圆点代替；元素与墨团交接用阈值滤镜单参数渐变，不用 `clip-path` 硬边或透明度交叉淡化；每个场景一条有限的 rAF 时间轴，中断时清理临时滤镜、路径与行内样式。
- 形象静态优先：Hugo 直接输出主体与眼睛，按钮默认 `disabled`。在入口层上，按钮负责进入文章列表，手机和减少动态效果模式也可操作；进入列表后，仅宽屏、精细指针且未要求减少动态效果时启用原有分离动画。静态时不得留下可聚焦却无反应的控件。
- 形象配色只用主题变量：主体、回声和变形图案取 `--primary`，眼睛取首页背景（亮色 `--code-bg`、暗色 `--theme`），不硬编码颜色。回声数量与变形内容由 `fluid-ip.js` 的规格数组决定，不要写死三团；动画只在点击时跑有限帧，结束、页面隐藏、形象被移除或门槛失效都必须清空回声路径并隐藏变形图案。
- 首页回声按「分离、塑形、停留、软化、回融」运行；停留阶段再次点击可提前收回，其他阶段重复点击不启动并行动画。轮换内容放在同一规格数组中。变形只占 SVG 预留区域，不移动文章或遮盖简介；减少动态效果与手机保持静态。
- 首页入口的页面编排由 `fluid-transition.js` 管理：单一时钟驱动，进场与收回互为倒放；回声在主体 goo 组内缢缩脱离、飞行，落地舒展成目标墨带后按阈值滤镜交接为真实的介绍标题、简介、社交链接、导航标记和右下角按钮，链接与按钮不替换为副本；导航首页链接可将它们收回角色并返回入口。仅普通左键/键盘激活接管首页链接，修饰键与其他页面导航保持原生行为。页面编排在至少 600px 宽且精细指针时启用，较窄屏、触屏或减少动态效果时直接切换；缩放、隐藏页面或历史导航中断时结束动画并清理临时墨团，不能遗留隐藏内容。
- 首页入口层由 `assets/css/extended/fluid-transition.css`、`assets/js/fluid-transition.js`、`layouts/partials/extend_head.html` 实现。脚本在 `<head>` 设置入口状态以避免正文先闪现；按 SVG 主体可见轮廓居中，同一 SVG 从入口移动并缩小到文章列表介绍区。进入后 URL 为 `/#articles`，浏览器返回可回到入口；直接打开该地址跳过入口。无 JavaScript 时直接呈现原文章列表。减少动态效果时直接切换；文章卡片链接不等待动画、保持普通导航。桌面精细指针移动时，仅两只眼睛小幅跟随；文章卡片不触发回声或悬停动画。
- 星野背景已停用：`static/js/starfield.js` 与 `assets/css/extended/starfield.css` 保留在盘上，但注入点已从 `extend_footer.html` 移除；构建产物中不应再出现 `#starfield-canvas` 或 `/js/starfield.js`。
- 主题切换在支持 View Transition 且未要求减少动态效果时，以墨迹从主题键漫开替换配色，期间屏蔽 `.theme-transition` 颜色过渡；否则保持原切换。翻转逻辑与 PaperMod 保持一致（`data-theme` 与 `localStorage` 的 `pref-theme`）。
- `layouts/partials/footer.html` 由 `partialCached` 渲染，`extend_footer.html` 内不能写按页码或 URL 变化的条件（如 `eq .Paginator.PageNumber 1`），否则首页各分页会共用同一份缓存输出；这里只用 `.IsHome` 这类同页集合内一致的条件。

## 验证与发布

- 内容、模板、资源或配置改动后运行 `hugo --gc --minify`。若本机没有 Hugo，报告无法验证，不要自行安装全局依赖。
- 本地预览使用 `hugo server --buildDrafts --buildFuture --renderToMemory`；`--renderToMemory` 避免预览服务与正式构建互相覆盖 `public/`。
- 首页形象的动画契约用 `node docs/design/fluid-ip-check.mjs` 检查（门槛、变形阶段、结束与中断后清空、重复点击不并发、无形象页面不报错）；配色、布局与观感仍要在浏览器里按桌面/窄屏、亮暗色实际查看，不能只看构建结果。
- 入口状态与导航用 `node docs/design/fluid-transition-check.mjs` 检查（模拟 rAF 时钟：进退倒放、中断清空、无挂起 rAF）；还需在浏览器里检查入口、返回、手机轻触、缩减动态效果与文章卡片普通导航。
- `.github/workflows/deploy.yml` 在推送 `master` 后部署，使用 `rsync --delete` 同步 `public/`；推送前检查构建产物及远端删除影响。
