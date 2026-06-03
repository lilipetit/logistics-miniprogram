# 物流快递小程序 - 完整项目

完整的物流快递小程序，包含后端、微信小程序、PDA插件和打印功能。

## 项目结构

```
logistics-miniprogram/
├── Goods-Monitoring-Programme/  # 微信小程序前端（可直接在开发者工具中打开）
│   ├── pages/
│   │   ├── print/               # 打印面单页面
│   │   ├── scan-sign/           # 扫码签收页面
│   │   └── ...                  # 原有页面
│   └── ...
├── backend/                      # Node.js 后端服务
│   ├── routes/                  # API 路由
│   ├── database/                # 数据库脚本
│   └── ...
├── plugin/                       # uni-app PDA 插件
└── pda-sdk/                      # PDA SDK
```

## 快速开始

### 1. 在微信开发者工具中测试

1. 打开微信开发者工具
2. 导入项目：选择 `Goods-Monitoring-Programme` 目录
3. 填入您的小程序 AppID
4. 编译运行

### 2. 启动后端服务

```bash
cd backend
npm install
cp .env.example .env
# 编辑 .env 配置数据库
npm run dev
```

### 3. 配置小程序

在 `Goods-Monitoring-Programme/app.js` 中配置后端地址：
```javascript
globalData: {
  apiBase: 'http://localhost:3000/api'
}
```

## GitHub 推送指南

### 创建仓库并推送

```bash
# 在 GitHub 上创建新仓库（不要初始化任何文件）
# 然后执行：

git remote add origin https://github.com/您的用户名/logistics-miniprogram.git
git branch -M main
git push -u origin main
```

### 更新代码

```bash
git add .
git commit -m "更新说明"
git push
```

## 详细文档

详见 [README.md](README.md)
