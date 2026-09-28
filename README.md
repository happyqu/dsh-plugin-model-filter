# @happyqu/dsh-plugin-model-filter

一个 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 插件：在 DSH Web UI 的输入框模型选择菜单里加一个**过滤框**，让按 provider 分组的长模型列表可以边打字边收窄。

## 功能

点击输入框里的模型控件会照常弹出菜单（Model / Effort）。进入 **Model** 后面板顶部多出一个过滤框：

- 输入即时收窄列表，不区分大小写。
- 匹配范围包括**显示名**、**模型 id**、**描述**和**provider 名**，所以 `flash`、`qwen3`、`openrouter`、`stronger` 都能命中。
- 有查询时会显示 `已显示/总数` 计数和一个清除（✕）按钮。
- 无匹配时显示本地化的「无匹配模型」提示，而不是一个空面板。
- 当前使用的模型仍保持勾选，DeepSeek 优先的 provider 排序不变。
- 键盘操作：过滤框进入时自动聚焦，`Enter` 选中第一项，`↑`/`↓` 进入列表行，`Escape` 清空面板，`Tab`/`Shift+Tab` 与官方控件一致。

## 安装

```bash
dsh plugin --profile web add @happyqu/dsh-plugin-model-filter
dsh --profile web --dump-config
# 重启 dsh web
```

`dsh plugin add` 会安装依赖并把 bundle 加入 profile。包自带 `cordis.patch.yml`，以 `insert` 方式追加插件行；`--dump-config` 可确认该行已进入配置树。

本地开发可从插件目录运行 `dsh plugin --profile web add .`。

卸载或停用该 bundle 即可恢复官方选择器。

## 工作方式

输入框的模型座位 `conversation.input.model` 是一个 **`single`** 槽位，而 single 槽位渲染的是**优先级最低**的活跃条目。本插件以 `priority: -1` 注册同一座位，从而**遮蔽**官方 `ModelSelect`，但并不销毁它。

这也是为什么本插件是官方控件的完整副本而非一个小挂件：过滤要收窄的列表位于官方组件自己的 portal 菜单内部，没有更弱的扩展点能触及它。这份副本是忠实的——相同的结构、相同的行为、相同的主题 token——只是多加了过滤。

数据与提交都走**同一个按会话共享的 `ModelDirectory`**（`ctx.modelDirectories`），也就是官方选择器和 `/model` 弹窗读取的那一份，因此在这里切换模型，那些入口下次显示的即是新值。Host 侧没有任何重新实现，所以 Host 半边是空的。

两个刻意的取舍遵循 Harness 插件规则：

- **不 import 任何 Harness Client 包**（只从浏览器模块表取 `react`/`react-dom`）。菜单素材、状态圆点、toast 和图标都带 `_dshmf_` 前缀本地复制，样式只用 `--dsw-*` 主题 token。
- **遮蔽官方 UI，而不是打补丁。** 停用该 bundle 即移除注册，未被改动的官方选择器随即回归。

## 测试

```bash
node scripts/verify-client.mjs
```

脚本通过一个打桩的模块表和一个小型 hook 感知渲染器载入 `lib/client.js`，然后断言：工厂与导出形态正确、注册命中的是正确座位且优先级构成遮蔽、inject 面与座位契约一致、两份词典覆盖组件读取的每一个 key（且不多不少），以及组件确实**渲染得出来**——关闭态、在根面板打开、深入到带过滤的模型列表、过滤、过滤至空、清除、以及 effort 面板。组件一旦抛错就会让其槽位条目变空白，因此这些渲染用例才是最要紧的检查。

## 限制

- 座位以固定优先级遮蔽。若另一个插件以更低优先级遮蔽同一座位，则由它胜出。
- 过滤是本地子串匹配，没有模糊匹配，也没有排序权重。
- `/model` 弹窗本来就有自己的过滤，本插件不涉及。

## License

[MIT](LICENSE)
