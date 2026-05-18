# PWA 记账应用打包与部署指南

本项目采用 Vite + Vue 3 构建，并深度集成了 PWA (渐进式 Web 应用) 和 Web Worker (用于本地 AI 推理)。由于这些现代 Web 技术的安全限制，部署和本地使用时有一些非常重要的注意事项。

## 一、 如何打包产物

无论您是准备本地运行还是部署到服务器，首先都需要打包项目代码。

在项目根目录下，运行以下命令：
```bash
# 如果尚未安装依赖
npm install

# 开始打包
npm run build
```
打包完成后，项目根目录下会生成一个 `dist/` 文件夹。这个文件夹里的内容就是最终的、纯静态的前端产物。

---

## 二、 能否直接双击本地打开？（关于 `file://` 协议）

**结论：不可以。**

您**无法**通过直接双击 `dist/index.html`（即在浏览器地址栏显示 `file:///...`）来正常使用这个应用。原因如下：

1. **ES Module 限制**：Vite 默认使用原生的 `<script type="module">` 引入脚本，现代浏览器出于安全原因，禁止在 `file://` 协议下跨文件加载 ES 模块。
2. **PWA (Service Worker) 限制**：PWA 的核心离线技术 Service Worker 要求绝对的安全上下文。浏览器严格规定它**只能**在 `https://` 或 `http://localhost` (本地服务器环境) 下运行。
3. **Web Worker 限制**：我们用于 AI 识别的后台计算线程（`ai.worker.js`）以及模型文件（`.onnx`）的加载，同样无法在 `file://` 下跨域读取。

### 💡 正确的本地无服务器使用方式
如果您只是想在自己的电脑上离线运行它，不需要公网服务器，您可以使用极其轻量的本地服务器工具：

```bash
# 方案1：使用 npm 的 serve 库 (推荐)
npx serve dist

# 方案2：如果您在使用 VS Code，可以安装 "Live Server" 插件
# 然后右键点击 dist 目录下的 index.html 选择 "Open with Live Server"
```
此时，您可以通过浏览器访问 `http://localhost:3000` (或控制台提示的端口)，所有 PWA 和 AI 功能都能完美运行！并且由于应用是完全本地化的，启动后**断网**也能继续使用。

---

## 三、 如何部署到服务器？

如果您想把它变成一个随时随地用手机能访问的网页，甚至“安装”到手机桌面上，您需要将其部署到服务器。

**⚠️ 前提条件：您的服务器/域名必须开启 HTTPS。**
如果没有 HTTPS，PWA 机制将失效，无法在手机桌面生成图标，也无法离线使用。

### 部署选项 1：传统云服务器 (Nginx)
将 `dist/` 文件夹上传到服务器的网页目录下，并配置 Nginx：
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    # SSL 证书配置略...

    location / {
        root /path/to/your/dist;
        index index.html;
        # 这一句对于单页应用 (SPA) 非常重要
        try_files $uri $uri/ /index.html;
    }
}
```

### 部署选项 2：免费的静态托管服务 (强烈推荐)
因为这个应用是纯前端的（没有后端 API，数据存在用户浏览器里），您完全可以免费托管，且自带 HTTPS：

- **Vercel**：关联您的 GitHub 仓库，选择 Vue/Vite 预设，一键免费发布。
- **Netlify**：直接将打包好的 `dist/` 文件夹拖拽到 Netlify 网页上，即可获得一个永久免费的 HTTPS 网址。
- **GitHub Pages**：将代码推送到 GitHub，在仓库 Settings 中开启 GitHub Pages 功能，选择使用 GitHub Actions 构建并发布。

*(注意：我已经帮您在配置中添加了 `base: './'`，这意味着产物自带相对路径兼容能力，就算您把它放在子目录（比如 `https://your-domain.com/bookkeeping/`）下也能正常运行)*
