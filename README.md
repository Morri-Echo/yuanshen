# 提瓦特任务影像工坊

把一张截图变成「任务完成」时刻的本地网页工具。上传图片或视频后，可以编辑任务文字、切换地区徽记、调整遮罩与粒子，然后导出带任务完成风格叠层的 PNG 图片或动画视频。

当前版本：**1.1**（稳定版）· 纯前端 · 无需后端 · 无构建步骤

![生成效果示例](outputs/task-overlay-sample.png)

## 功能

- **媒体上传**：支持本地图片和视频，上传后即时预览，输出尺寸可选 `16:9`、`4:3`、`9:16` 或沿用原媒体比例。
- **文字编辑**：画面中的两行任务文字均可自定义，随动画时间线一起入场。
- **十三种任务徽记**：蒙德、璃月、稻妻、须弥、枫丹、纳塔、空月之歌、至冬、大赤沙海、沉玉谷、悠悠度假村、空之神殿、幻想真境剧诗。
- **遮罩与粒子**：遮罩颜色、透明度和粒子强度（关闭 / 克制 / 发布感）均可调。
- **动画预览**：任务文字、徽记与粒子的统一时间线，可先预览再导出。
- **双格式导出**：PNG 图片；动画视频优先 MP4（浏览器 WebCodecs + CDN 封装模块，不打包进仓库，保持页面轻量），不可用时自动回退 WebM。
- **工作台皮肤**：本地循环背景视频与交互式 3D 景深粒子，仅作编辑器外观，不会进入导出画面。

上传的媒体只在当前浏览器内处理，不会上传到任何服务器。

## 快速开始

### 在线使用

项目已部署在 GitHub Pages，直接访问：<https://morri-echo.github.io/yuanshen/>

### 本地运行

项目是纯静态网页，不需要安装任何依赖。在项目目录启动一个静态文件服务器即可：

```powershell
python -m http.server 8000
```

然后访问 <http://127.0.0.1:8000/index.html>。

不建议直接双击 `index.html`——浏览器对 `file://` 的资源限制可能导致图片、视频或导出模块加载失败。

## 使用方法

1. 点击「选择文件」，上传本地图片或视频。
2. 修改两行任务文字。
3. 选择输出尺寸，调整遮罩颜色与透明度。
4. 选择任务徽记和粒子效果档位。
5. 在右侧画布检查效果，按需「预览动画」。
6. 选择导出格式（PNG 图片 / MP4 动画），点击导出。

## 项目结构

```text
.
├─ index.html                    页面结构
├─ js/                           页面脚本
│  ├─ renderer-core.js           渲染状态、尺寸和动画计算
│  ├─ script.js                  媒体加载、Canvas 绘制与导出
│  └─ editor-particles.js        编辑器 3D 景深粒子和背景视频控制
├─ css/
│  └─ styles.css                 工作台与响应式界面样式
├─ assets/                       徽记、装饰和轻量工作台背景
│  └─ preview/                   编辑器预览用的小尺寸徽记（512px）
├─ docs/
│  ├─ reference/                 视觉参考图
│  └─ specs/                     功能设计说明
├─ tests/                        Node.js 单元测试与 Edge 冒烟测试
│  └─ fixtures/                  冒烟测试上传用图片
├─ tools/                        素材维护脚本（可选，需要 Pillow）
├─ outputs/
│  └─ task-overlay-sample.png    README 展示图
└─ samples/                      本地示例与素材视频（不入库）
```

## 开发与测试

测试使用系统已安装的 Node.js，无需第三方依赖：

```powershell
node --check js/renderer-core.js
node --check js/script.js
node --check js/editor-particles.js
node tests\renderer-core.test.js
node tests\clean-assets.test.js
node tests\static-ui.test.js
node tests\emblem-loading.test.js
```

启动本地服务器后，可以运行 Edge 冒烟测试（需要本机安装 Microsoft Edge）。它会逐一渲染十三种徽记、校验渲染结果互不相同，并刷新 `outputs/task-overlay-sample.png`：

```powershell
python -m http.server 8000
node tests\edge-smoke.js
```

## 新增任务徽记

1. 把新徽记的透明底 PNG（建议 2446×2446，RGBA）放入 `assets/`。
2. 运行素材脚本，自动统一到现有金色系并生成 512px 预览图：

   ```powershell
   python tools\prepare-emblem.py assets\<新徽记>.png
   ```

3. 在 `js/renderer-core.js`（`EMBLEM_KEYS`）、`js/script.js`（`EMBLEM_ASSETS`）和 `index.html`（下拉选项）中按现有条目注册。
4. 运行上面的测试确认通过。

## 视频导出说明

- PNG 导出保持当前静态画面布局。
- 动画视频会把背景媒体逐帧绘制进任务动画时间线，导出结果不包含源视频音轨。
- MP4 导出优先使用浏览器 WebCodecs API，编码器封装模块（mp4-muxer）在导出时从 CDN 加载，不打包进仓库以保持网页轻量。
- 浏览器不支持 MP4 或 CDN 不可用时，自动回退为 WebM（MediaRecorder）。

## 协议与素材声明

代码的使用、修改与分发遵循仓库中的 [LICENSE](LICENSE)。

仓库包含来源于或参考第三方作品的名称、视觉元素及素材。公开使用、再分发或用于商业场景前，请自行确认素材授权和适用规则。本项目与相关游戏开发商或发行商不存在官方关联。
