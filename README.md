# 智能周报

Smart Weekly Report。Windows 桌面端工具，用户可以用口语记录工作事项，配置自定义 AI API 后将记录优化为周报可用任务条目，并按日、周、月、年管理记录。

## 技术栈

- Electron
- React
- TypeScript
- Ant Design
- SQLite（sql.js，本地持久化为数据库文件）
- OpenAI-Compatible 自定义 AI API

## 运行

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

## 打包

```bash
npm run dist
```

打包后主要产物在 `release/`：

- `Smart-Weekly-Report-Setup-1.0.0-x64.exe`：Windows 安装包
- `Smart-Weekly-Report-Portable-1.0.0-x64.exe`：便携版
- `Smart-Weekly-Report-Windows-1.0.0-x64.zip`：Windows ZIP 版
- `Smart-Weekly-Report-macOS-1.0.0-x64.dmg`：macOS Intel 安装包
- `Smart-Weekly-Report-macOS-1.0.0-arm64.dmg`：macOS Apple Silicon 安装包
- `Smart-Weekly-Report-Linux-1.0.0-x64.AppImage`：Linux AppImage
- `Smart-Weekly-Report-Linux-1.0.0-x64.deb`：Linux deb 包
- `Smart-Weekly-Report-Linux-1.0.0-x64.tar.gz`：Linux 压缩包
- `win-unpacked/Smart Weekly Report.exe`：免安装解包版

多系统发布建议通过 GitHub Actions 的 `Multi-platform release` 工作流生成。macOS 包未签名和未公证时，首次打开可能被 Gatekeeper 拦截。

## 隐私与数据安全

智能周报的数据默认保存在用户本地电脑。应用不会上传全部历史记录。

只有在用户主动使用 AI 优化功能时，当前待优化的任务内容会发送到用户自行配置的 AI API 服务。API Key 使用本机安全能力加密保存。

详细说明见 [PRIVACY.md](./PRIVACY.md)。

## 发布说明

当前版本暂未进行代码签名。首次运行时 Windows 可能提示未知发布者，请确认文件来源后选择继续运行。

正式发布说明见 [RELEASE_NOTES.md](./RELEASE_NOTES.md)。

## 已实现

- Windows 桌面应用工程骨架
- 正式应用图标
- 系统托盘、关闭到托盘、快捷唤起
- 任务新增、编辑、删除、搜索、筛选
- 当前周期任务统计
- 多选任务、批量 AI 优化、复制所选、批量删除
- 今日、本周、本月、本年、全部记录视图
- 项目管理
- AI API 配置、测试连接、单条任务优化
- API Key 本地安全存储
- 周报生成、复制、Markdown 导出
- 本地数据库备份与恢复
- SQLite 本地持久化
