# 故事续写 (Story Continuation)

一个 SillyTavern 扩展，灵感来自彩云小梦，可以调用 Agent 生成故事的多个续写版本。

## 功能

- 📝 输入故事背景或使用当前聊天内容
- 🔄 选择续写方向：前传 / 后续 / 番外
- 🎲 一次生成 2-5 个候选故事
- 👑 **调用所有 Agent（三省六部）进行协作**
- 📥 将选中的故事插入聊天
- ➡️ 继续扩展选中的故事

## 支持的 Agent

- 🐋 鲸鱼娘（中枢）
- 👑 太子（分拣）
- 📜 中书省（规划）
- 🔍 门下省（审核）
- 📨 尚书省（派发）
- 👤 吏部（人事）
- 💰 户部（财务）
- ⚔️ 兵部（军事）
- 🔧 工部（技术）
- ⚖️ 刑部（法律）
- 🌅 早朝官（早间）

## 安装

### 手动安装

1. 克隆或下载此仓库
2. 将 `Story_continuation_test` 文件夹复制到 SillyTavern 的 `public/scripts/extensions/third-party/` 目录下
3. 重启 SillyTavern
4. 在扩展管理中启用"故事续写"

### 从文件夹安装

1. 打开 SillyTavern
2. 进入设置 → 扩展
3. 点击"从文件夹安装"
4. 选择 `Story_continuation_test` 文件夹

## 使用方法

1. 在扩展设置中找到"📖 故事续写"面板
2. 在文本框中输入故事背景或开头
3. 也可以点击"📝 使用当前聊天"按钮来使用对话历史
4. 选择续写方向（后续/前传/番外）
5. 选择生成数量
6. **选择要调用的 Agent**（可以选不同的Agent来获得不同风格）
7. 点击"🚀 开始生成"
8. 查看生成的故事卡片
9. 点击"📥 插入"将故事添加到聊天
10. 或者点击"➡️ 继续"来扩展该故事

## 技术细节

- 使用 SillyTavern 的 `callAPI` 与当前连接的 AI API 交互
- 支持所有 SillyTavern 支持的 API（OpenAI、Claude、LocalAI、Ollama 等）
- 使用 SillyTavern 的 `extension_settings` 保存设置

## 要求

- SillyTavern 1.0.0 或更高版本

## 许可证

MIT
