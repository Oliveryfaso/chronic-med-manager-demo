# 部署与提交说明

目标: 生成一个可以在本机以外访问的公开 URL，用于考核页面提交。

## 你需要自己做的事

这部分无法由本地代码自动完成，需要你本人操作:

1. 登录并创建托管平台账号（GitHub 或 Netlify）
2. 上传本项目文件到远程仓库或站点
3. 在平台上开启公开访问并拿到最终 URL
4. 在考核系统里粘贴该 URL 提交

结论:

- 需要把项目上传到“可公开访问的静态托管服务”
- 不需要你自己购买或维护传统服务器
- 用免费静态托管就能满足考核提交

## 0. 本地自检

在项目目录运行:

```bash
cd /Users/oliver/Documents/idea/chronic-med-manager
python3 -m http.server 8080
```

浏览器打开 `http://127.0.0.1:8080`，确认以下内容正常:

- 五个页面都能打开
- 导航跳转正常
- 打卡按钮会更新状态
- AI 漏服助手可输出建议
- 长辈模式与辅助功能可打开

## 1. 方案 A: GitHub Pages（推荐）

### 步骤

1. 创建公开仓库，例如 `chronic-med-manager-demo`
2. 在本地项目目录执行首次推送命令:

```bash
cd /Users/oliver/Documents/idea/chronic-med-manager
git init
git add .
git commit -m "init chronic med manager demo"
git branch -M main
git remote add origin https://github.com/<你的GitHub用户名>/chronic-med-manager-demo.git
git push -u origin main
```

3. 推送后，在仓库中打开 `Settings -> Pages`
4. `Build and deployment` 选择:
- `Source`: `Deploy from a branch`
- `Branch`: `main` + `/root`
5. 保存后等待 1-3 分钟，平台会生成公开链接

### 结果

公开链接通常为:

`https://<你的GitHub用户名>.github.io/<仓库名>/`

如果你本地已经有 git 仓库，只需要 `git add/commit/push` 到远程仓库即可。

## 2. 方案 B: Netlify（备用）

### 步骤

1. 登录 Netlify
2. 点击 `Add new site -> Deploy manually`
3. 将整个 `chronic-med-manager` 文件夹压缩后拖拽上传
4. 上传后会立即获得 `.netlify.app` 链接
5. 在 `Site settings -> Domain management` 可自定义站点名

这个方案不依赖 git，适合赶时间提交。

## 3. 提交前核对清单

- 链接在未登录状态可访问
- 用手机 4G/5G 网络可打开（不是本地缓存）
- 首页首屏可直接看出产品主题与核心价值
- 五个页面跳转无死链
- 随机点击按钮有反馈，不是纯静态截图页

## 4. 建议提交链接格式

优先提交根路径，例如:

`https://xxxx.github.io/chronic-med-manager-demo/`

不建议提交带本地地址或临时会话参数的 URL。

## 5. 我已经帮你准备好的部署文件

项目内已包含静态托管常用配置:

- `.nojekyll`（兼容 GitHub Pages）
- `404.html`（托管异常页）
- `netlify.toml`（Netlify 基础配置）
