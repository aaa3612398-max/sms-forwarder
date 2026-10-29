# 短信转发助手（SMS Forwarder）

在 **Android 手机** 与 **Windows / macOS / Linux 电脑** 之间，通过局域网加密转发短信。无需第三方服务器，配对信息通过桌面端二维码完成。

> **iOS 说明**：Apple 不允许第三方应用读取系统短信，因此 **本方案仅支持 Android 手机**。iPhone 用户无法使用同款手机端。

## 功能概览

| 组件 | 功能 |
|------|------|
| **Android 端** | 监听新短信（含长短信拼接）、可选双卡 SIM 槽位、前台服务常驻、开机自启、Wi‑Fi 恢复后自动重连、UDP 发现电脑新 IP、离线队列与重试 |
| **桌面端** | 持久配对（固定端口/密钥/设备 ID）、按发件人分组、系统通知、验证码复制、SQLite 历史与搜索、已配对手机管理、可选开机自启 |
| **安全** | 配对共享密钥 + AES-256-GCM；发现应答带 HMAC；密钥存于系统用户目录（可用 OS 密钥链加密） |

## 目录结构

```
android/    # Kotlin 原生 Android 应用
desktop/    # Electron + React 桌面应用
protocol/   # 共享消息协议与加密（Node 实现 + 单元测试）
scripts/    # 构建与端到端协议模拟脚本
```

## 环境要求

- **Node.js** 20+（推荐 22）
- **Android**：JDK 17、Android SDK 35（见下方脚本）
- **桌面打包**：各平台需安装 Electron Builder 依赖（Linux 上打包 Windows/macOS 需额外 wine 等，建议在对应系统打包）

## 快速开始

### 1. 安装依赖并跑通协议测试

```bash
npm ci
npm run build:protocol
npm run test:protocol
npm run test:e2e          # 模拟手机 POST 加密短信
npm run test:discovery    # 模拟 UDP 发现应答
```

### 2. 构建并运行桌面端

```bash
bash scripts/build-desktop.sh
cd desktop
npx electron .
```

首次启动后，主界面显示 **配对二维码** 与当前 `IP:端口`（默认固定 **8765**）。配对信息会写入本机用户数据目录，**重启桌面端无需重新扫码**。可勾选 **开机自动启动桌面端**。

若电脑 DHCP 更换局域网 IP，手机在转发失败时会通过 **UDP 8766** 广播自动发现新地址（需配对密钥与电脑设备 ID 一致）。

可选打包（当前 CI 环境以 `dir`/Linux 包为主）：

```bash
bash scripts/build-desktop.sh --package
```

### 3. 构建 Android Debug APK

```bash
bash scripts/setup-android-sdk.sh   # 首次：安装 commandline-tools 与 platform-35
bash scripts/build-android.sh
```

安装：`android/app/build/outputs/apk/debug/app-debug.apk`

### 一键构建（协议测试 + 桌面 + 若已有 SDK 则 APK）

```bash
bash scripts/build-all.sh
```

## 配对与使用

1. 在电脑上启动 **短信转发助手** 桌面应用，记下二维码。
2. 在 Android 上安装 APK，授予 **短信**、**通知**、**相机（扫码）** 权限。
3. 点击 **扫码配对**，扫描电脑上的二维码。
4. 点击 **启动转发服务**（配对成功后会自动尝试启动）。通知栏出现「短信转发运行中」表示前台服务已开启。
5. 新短信将加密发往电脑；桌面端弹出通知，并在「已配对手机」中记录该设备。
6. 桌面端可对已配对手机 **取消配对** 或 **重新生成配对码**（会使旧手机失效，需重新扫码）。

手机端会记住配对信息；**重启手机或 Wi‑Fi 重连** 后前台服务会继续运行并尝试发送队列。若电脑 IP 变化，将自动 UDP 发现并重试。

### 建议授予的权限与系统设置

- **运行时权限**：`RECEIVE_SMS`、`READ_SMS`、`POST_NOTIFICATIONS`（Android 13+）、扫码时的相机权限。
- **电池与后台（国产 ROM 重要）**：
  - **小米 MIUI / HyperOS**：设置 → 应用 → 短信转发助手 → 省电策略 → **无限制**；开启 **自启动**。
  - **华为 HarmonyOS / EMUI**：应用启动管理 → 手动管理 → 允许自启动、关联启动、后台活动。
  - **OPPO / ColorOS**：设置 → 电池 → 应用耗电管理 → 允许完全后台行为。
  - **vivo**：i 管家 → 应用管理 → 权限 → 自启动。
- 请将应用加入 **电池优化白名单**，否则后台可能无法及时转发。

## 协议说明（开发者）

- 配对 QR JSON：`{"t":"sms-forwarder-pair","h":"<IP>","p":8765,"s":"<密钥>","d":"<电脑设备ID>"}`
- 消息：`POST /api/v1/messages`，Header `X-SF-Device-Id` / `X-SF-Device-Name`，Body 为 AES-GCM 信封
- 发现：UDP **8766**，请求 `{t:"sf-discover-req",n,s}`，响应 `{t:"sf-discover-res",n,h,p,d,s}`（HMAC 由配对密钥派生）

## 已知限制

- **仅 Android** 可读取短信；iOS 不支持。
- 默认 **明文 HTTP** 传输密文；未实现 TLS。发现为 **UDP 广播**，部分网络/访客 Wi‑Fi 可能隔离广播导致发现失败（可重新扫码更新 IP）。
- **重新生成配对码** 或 **取消配对** 后，需按界面提示重新扫码。
- 固定端口 **8765/8766** 若被占用，需手动释放或改代码/config（当前版本未提供 UI 改端口）。
- 双卡 SIM 槽位依赖厂商对 `subscription` 广播字段的支持，部分机型可能为 `null`。
- 验证码识别为常见正则启发式，复杂文案可能漏识别，可手动「复制全文」。

## 许可证

MIT（可按仓库需要调整）
