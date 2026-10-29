# 短信转发助手（SMS Forwarder）

在 **Android 手机** 与 **Windows / macOS / Linux 电脑** 之间，通过局域网加密转发短信。无需第三方服务器，配对信息通过桌面端二维码完成。

> **iOS 说明**：Apple 不允许第三方应用读取系统短信，因此 **本方案仅支持 Android 手机**。iPhone 用户无法使用同款手机端。

## 功能概览

| 组件 | 功能 |
|------|------|
| **Android 端** | 监听新短信（含长短信拼接）、可选双卡 SIM 槽位、前台服务常驻、开机自启、离线队列与重试、转发状态与最近记录 |
| **桌面端** | 按发件人分组会话、系统通知、全文复制、验证码识别与一键复制、本地 SQLite 历史与搜索 |
| **安全** | 配对共享密钥 + AES-256-GCM 加密；局域网 HTTP 仅传输密文 |

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
npm run test:e2e    # 模拟手机 POST 加密短信到本机接收端
```

### 2. 构建并运行桌面端

```bash
bash scripts/build-desktop.sh
cd desktop
npx electron .
```

首次启动后，主界面顶部会显示 **配对二维码** 及 `IP:端口`。请保持电脑与手机在同一 Wi‑Fi。

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
5. 新短信将加密发往电脑；桌面端会弹出系统通知，并在左侧按号码分组显示。

### 建议授予的权限与系统设置

- **运行时权限**：`RECEIVE_SMS`、`READ_SMS`、`POST_NOTIFICATIONS`（Android 13+）、扫码时的相机权限。
- **电池与后台（国产 ROM 重要）**：
  - **小米 MIUI / HyperOS**：设置 → 应用 → 短信转发助手 → 省电策略 → **无限制**；开启 **自启动**。
  - **华为 HarmonyOS / EMUI**：应用启动管理 → 手动管理 → 允许自启动、关联启动、后台活动。
  - **OPPO / ColorOS**：设置 → 电池 → 应用耗电管理 → 允许完全后台行为。
  - **vivo**：i 管家 → 应用管理 → 权限 → 自启动。
- 请将应用加入 **电池优化白名单**，否则后台可能无法及时转发。

## 协议说明（开发者）

- 配对 QR JSON：`{"t":"sms-forwarder-pair","h":"<局域网IP>","p":<端口>,"s":"<base64url 密钥>"}`
- 手机 `POST http://<h>:<p>/api/v1/messages`，Body 为 `{ "v":1, "n":"<nonce>","c":"<ciphertext+tag>" }`
- 密钥派生：HKDF-SHA256，info 字符串 `sms-forwarder-v1`（与 `protocol/` 及 Android `ProtocolCrypto` 一致）

## 已知限制

- **仅 Android** 可读取短信；iOS 不支持。
- 默认 **明文 HTTP** 传输已加密载荷，适用于可信局域网；未实现 TLS/mDNS 自动发现。
- 桌面端每次启动会生成 **新配对密钥与端口**；手机需重新扫码（历史消息仍保存在本机数据库）。
- 双卡 SIM 槽位依赖厂商对 `subscription` 广播字段的支持，部分机型可能为 `null`。
- 验证码识别为常见正则启发式，复杂文案可能漏识别，可手动「复制全文」。

## 许可证

MIT（可按仓库需要调整）
