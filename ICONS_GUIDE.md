# PWA 图标生成指南

## 问题说明

在iOS设备上，当用户通过" Safari -> 分享 -> 添加到主屏幕"安装PWA时，如果缺少适当尺寸的apple-touch-icon，系统会显示应用名称的首字母而不是图标。

## 解决方案

### 1. 安装依赖

```bash
npm install sharp
```

### 2. 生成图标

```bash
npm run generate-icons
```

这将生成所有必要的图标尺寸：

#### iOS 图标
- `apple-touch-icon-180.png` (180x180) - iPhone 6 Plus及更新机型
- `apple-touch-icon-152.png` (152x152) - iPad Retina
- `apple-touch-icon-120.png` (120x120) - iPhone Retina
- `apple-touch-icon-76.png` (76x76) - iPad非Retina

#### Android/Web 图标
- `icon-192.png` (192x192) - 用于PWA manifest
- `icon-512.png` (512x512) - 用于PWA manifest

### 3. 构建应用

```bash
npm run build
```

## 技术细节

### HTML中的图标声明

在`index.html`中，我们声明了多个尺寸的apple-touch-icon：

```html
<link rel="apple-touch-icon" sizes="180x180" href="icons/apple-touch-icon-180.png" />
<link rel="apple-touch-icon" sizes="152x152" href="icons/apple-touch-icon-152.png" />
<link rel="apple-touch-icon" sizes="120x120" href="icons/apple-touch-icon-120.png" />
<link rel="apple-touch-icon" sizes="76x76" href="icons/apple-touch-icon-76.png" />
```

### PWA Manifest配置

在`vite.config.js`的manifest配置中，包含了所有必要的图标：

```javascript
icons: [
  {
    src: 'icons/icon-192.png',
    sizes: '192x192',
    type: 'image/png'
  },
  {
    src: 'icons/icon-512.png',
    sizes: '512x512',
    type: 'image/png'
  },
  {
    src: 'icons/apple-touch-icon-180.png',
    sizes: '180x180',
    type: 'image/png',
    purpose: 'any'
  }
]
```

## 注意事项

1. **源图标质量**：确保`icon-512.png`是高质量的PNG图像，最好带有透明背景
2. **图标设计**：图标应该在各种尺寸下都清晰可辨，避免过多细节
3. **测试**：在不同设备和浏览器上测试PWA安装效果
4. **缓存**：如果之前已经添加到主屏幕，可能需要删除后重新添加才能看到新图标

## 故障排除

如果图标仍然不显示：

1. 清除浏览器缓存
2. 从主屏幕删除应用后重新添加
3. 检查控制台是否有图标加载错误
4. 确保所有图标文件都存在于`public/icons/`目录中
