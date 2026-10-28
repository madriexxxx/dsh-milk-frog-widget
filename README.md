# dsh-milk-frog-widget（奶蛙余额挂件）

DSH Web 界面角落里的奶蛙：**平时板着严肃脸**，点一下会**大笑**（笑眼 + 张嘴 + 腮红 + 小星星），头顶弹出钱包面板 —— DeepSeek 余额、赠金、充值余额、今日已用。再点一下 / 点别处 / Esc 收起，奶蛙收回笑脸。奶蛙可以按住拖动，位置记在浏览器里。

仿照 `dsh-whale-widget` 的思路，但实现走 DSH 的标准 Client 插件通道（`shell.overlay` 槽位），不是注入脚本。

## 数据从哪来

宿主半端只注册一个**只读**路由 `GET /dsh-milk-frog/balance`：

1. 有 `DEEPSEEK_API_KEY` 就用它查 `https://api.deepseek.com/user/balance`（总余额 / 赠金 / 充值余额）；
2. 没配或失败，退回 DSH 的 `deepseekAccount` 登录态（与「设置 → 账号与余额」同一条路，不自己拼鉴权）；
3. **今日已用**按余额观测的下降额累计，充值等上升额不会冲掉消费；账本在 `$DSH_HOME/milk-frog/ledger.json`，跨重启保留 30 天。

路由只认本机回环 Host + 同源请求，没有写接口，不读写凭据内容。

## 已知口径

- 「今日已用」是**观测口径**：只统计界面开着、余额读得到的时段；面板里会写「从 HH:MM 起观测」。
- 换余额来源（API Key ↔ 账号登录）等于换一本账，当天数字从切换那一刻重新累计。
- 默认位置在右下角小鲸鱼上方一截；拖动后不会再自动挪。

## 安装 / 卸载

### 从 GitHub 安装（推荐，DSH Web profile）

```bash
dsh plugin --profile web add github:madriexxxx/dsh-milk-frog-widget
```

装的是仓库当前版本；想升级时先 remove 再 add。升级到 1.0 之前可能改安装方式，以 README 为准。

### 官方桌面客户端（Electron）

在 DSH 会话里让 AI 用 `plugin_manager install_bundle` 指向本仓库目录（或下载解压后的目录），不要用 `dsh plugin --profile desktop`。

### 本地目录安装 / 卸载

```
plugin_manager install_bundle  → 绝对路径指向本目录
plugin_manager remove_bundle   → 包名 dsh-milk-frog-widget
```

## 许可

MIT，见 [LICENSE](./LICENSE)。
