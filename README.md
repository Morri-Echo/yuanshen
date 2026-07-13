# 原神风格任务完成图片生成器

一个无需后端、可在本地运行的图片合成网页。上传图片后，可以编辑标题文字、调整遮罩效果，并导出带有“任务完成”风格叠层的 PNG 图片。

> 本项目为非官方粉丝创作工具，与米哈游及《原神》官方无关联。

![生成效果示例](outputs/task-overlay-sample.png)

## 功能

- 上传本地图片并即时预览。
- 编辑画面中的两行标题文字。
- 选择固定 `16:9` 输出或沿用原图尺寸。
- 调整遮罩颜色和透明度。
- 在蒙德、璃月、稻妻、须弥、枫丹、纳塔和空月之歌七种大图标之间即时切换。
- 在浏览器中生成并导出 PNG 图片。
- 所有处理均在本地浏览器中完成，不会上传用户图片。

## 本地运行

项目不需要安装第三方依赖。请在项目目录中启动静态文件服务器：

```powershell
python -m http.server 8000
```

然后访问：

```text
http://127.0.0.1:8000/index.html
```

不建议直接双击打开 `index.html`，浏览器对本地文件资源的安全限制可能导致素材加载失败。

## 使用方法

1. 点击“上传图片”选择本地图片。
2. 修改第一行和第二行文字。
3. 选择输出尺寸，并按需调整遮罩颜色和透明度。
4. 选择要展示的大图标。
5. 在右侧画布中检查预览效果。
6. 点击“导出图片”，下载生成的 PNG 文件。

## 项目结构

```text
.
├─ assets/                 页面叠层使用的图片素材
├─ outputs/                本地验证生成的示例图片
├─ tests/                  Node.js 与 Edge 冒烟测试
├─ index.html              页面结构
├─ styles.css              页面样式
├─ script.js               图片加载、Canvas 绘制与导出逻辑
├─ renderer-core.js        尺寸、状态与布局计算
├─ 1.png                   效果参考图
└─ 2.jpg                   本地冒烟测试图片
```

`assets/` 中的素材会随项目一并保留。网页运行时使用七个区域 PNG：`mengdei.png`、`liyue.png`、`daoqi.png`、`xuni.png`、`fengdan.png`、`nata.png`、`nuodekalai.png`，以及 `weiwandaixu-clean.png`。

## 验证

需要本机已安装 Node.js。基础检查命令：

```powershell
node --check script.js
node tests\renderer-core.test.js
node tests\clean-assets.test.js
node tests\static-ui.test.js
node tests\emblem-loading.test.js
```

启动本地服务器后，可以运行 Edge 冒烟测试：

```powershell
node tests\edge-smoke.js
```

该测试会访问本地网页，验证全部七种大图标选择，并刷新 `outputs/task-overlay-sample.png`。

## 开源协议与素材声明

代码的使用、修改与分发遵循仓库中的 [LICENSE](LICENSE)。

仓库内可能包含来源于或参考第三方作品的图片、名称、视觉元素及商标。相关权利属于各自权利人；代码开源协议不代表对第三方素材进行再许可。公开使用、再分发或用于商业场景前，请自行确认素材授权与适用规则。
