
# 🎵 VibeFlow Studio

**VibeFlow Studio** 是一个基于 Web 的动态音乐视频制作工具。它允许用户将 MP3 音频、歌词文件（LRC）和视觉素材（图片/视频）组合在一起，通过强大的实时渲染引擎，创作出令人惊叹的动态歌词视频（Lyric Video）。

项目完全运行在浏览器端，利用 HTML5 Canvas 进行高性能渲染，并集成了 **Google Gemini Flash** AI 模型来实现智能双语歌词翻译。

---

## ✨ 核心功能 (Key Features)

### 1. 📝 智能歌词系统 (Smart Lyric Engine)
*   **格式支持**：支持导入 `.lrc` 文件或纯文本粘贴。
*   **可视化编辑器**：
    *   **打点同步 (Record Sync)**：像玩音游一样，通过敲击空格键为纯文本歌词录制时间戳。
    *   **精细微调**：支持对每一行歌词的时间和文本进行微调。
    *   **双语支持**：自动生成双语对照格式。
*   **🤖 AI 自动翻译 (Powered by Gemini Flash)**：
    *   集成 Google Gemini API。
    *   **自动/手动源语言识别**：支持指定源语言或自动检测。
    *   **多语种支持**：支持翻译至中文（简/繁）、英语、日语、韩语、西语等 10+ 种语言。
    *   **双语保留**：智能生成与原歌词时间戳完全一致的翻译行，实现完美的双语字幕效果。

### 2. 🎨 视觉与特效 (Visuals & FX)
*   **动态播放列表**：支持混合上传图片和视频作为背景素材。
*   **转场特效 (Transitions)**：内置高性能 Canvas 转场引擎。
    *   `Crossfade` (淡入淡出)
    *   `Flash Black` (黑场闪烁 - 适合鼓点强的音乐)
    *   `Zoom Fade` (缩放叠化)
    *   `Glitch Shake` (故障抖动 - 赛博朋克风格)
*   **歌词渲染特效**：
    *   `Karaoke` (卡拉OK逐字擦除)
    *   `Typewriter` (打字机效果)
    *   `Breathing` (呼吸光晕)
    *   `Scatter` (粒子散开)
    *   `Fade Up` (上浮淡入)
*   **完全自定义**：字体、大小、颜色、光晕 (Glow)、阴影 (Shadow)、背景遮罩 (Overlay) 均可实时调节。

### 3. 🎬 标题与演职员表 (Titles & Credits)
*   独立的片头/片尾编辑器。
*   支持多种排版模式：
    *   **Standard**: 居中堆叠。
    *   **Vertical**: 竖排文字 (适合古风/中文排版)。
    *   **Cinematic**: 电影感宽屏排版。

### 4. 💾 项目管理与导出 (Project & Export)
*   **本地数据库**：使用 IndexedDB 存储项目，支持保存大型音频和视频素材，页面刷新不丢失。
*   **配置导出**：支持导出 `.json` 配置文件分享模板。
*   **LRC 导出**：制作好的歌词可以导出为标准 `.lrc` 文件。
*   **视频录制**：利用 `MediaRecorder` API，支持高达 1080p/60fps (取决于机器性能) 的 WebM 视频内录导出。
*   **多比例支持**：一键切换 16:9 (横屏), 9:16 (抖音/Shorts/Reels), 1:1 (Instagram)。

---

## 🛠️ 技术栈 (Tech Stack)

*   **Frontend Framework**: React 19
*   **Styling**: Tailwind CSS
*   **Icons**: Lucide React
*   **AI Integration**: Google GenAI SDK (`@google/genai`)
*   **Storage**: IndexedDB (Client-side persistent storage)
*   **Rendering**: HTML5 Canvas 2D Context
*   **Build Tool**: Vite

---

## 🚀 快速开始 (Getting Started)

### 前置要求
你需要一个 Google Gemini API Key 才能使用 AI 翻译功能。

### 安装与运行

1.  **克隆项目**
    ```bash
    git clone https://github.com/your-username/vibeflow-studio.git
    cd vibeflow-studio
    ```

2.  **安装依赖**
    ```bash
    npm install
    ```

3.  **配置环境变量**
    在根目录创建 `.env` 文件：
    ```env
    VITE_API_KEY=your_google_gemini_api_key_here
    ```
    *(注意：在代码中需通过 `process.env.API_KEY` 或 `import.meta.env` 访问，具体取决于构建配置)*

4.  **启动开发服务器**
    ```bash
    npm run dev
    ```

5.  打开浏览器访问 `http://localhost:5173`。

---

## 📖 使用指南 (User Guide)

1.  **导入素材**：点击左侧面板，上传你的 MP3 音频文件。
2.  **制作歌词**：
    *   导入现有的 `.lrc` 文件。
    *   或者，点击 "Edit" 粘贴纯文本歌词，然后进入 "Record Sync" 模式，跟随音乐点击按钮或空格键打点。
    *   **翻译**：在编辑器中，选择源语言和目标语言，点击 "Create Bilingual" 生成双语歌词。
3.  **设置背景**：批量上传图片或视频。在列表重排顺序，设置图片持续时间（视频自动获取时长）。
4.  **调整视觉**：
    *   在 Output Settings 中选择分辨率（如 16:9）。
    *   选择 Transition Effect（如 Crossfade）。
    *   调整歌词样式（字体、颜色、特效）。
5.  **导出**：
    *   点击顶部 "Record & Export" 开始录制。
    *   播放完成后自动停止并下载 `.webm` 视频文件。

---

## 🔒 隐私说明
VibeFlow Studio 是一个纯客户端应用。您的音频、图片和歌词数据仅存储在您的浏览器本地 (IndexedDB)，不会上传到任何服务器（除使用 AI 翻译时需将文本发送至 Google API）。

---

## 📄 License
MIT License
