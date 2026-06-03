# 物流快递小程序完整开发文档

## 项目概览

本项目基于 `Goods-Monitoring-Programme` 源码进行扩展开发，实现了完整的后端服务和微信小程序功能。

---

## 第一步：后端与三端业务开发

### 1.1 数据库设计 ([backend/database/schema.sql](backend/database/schema.sql))

创建了10张核心数据表：

| 表名 | 说明 |
|------|------|
| `users` | 用户表（支持 user/courier/admin 三种角色） |
| `orders` | 订单表（含寄件人、收件人、货品、费用等完整信息） |
| `order_tracks` | 订单轨迹表（记录状态变更历史） |
| `parts_inventory` | 配件库存表 |
| `parts_stock_records` | 配件出入库记录表 |
| `print_records` | 打印记录表 |
| `history_contacts` | 历史联系人表 |
| `system_config` | 系统配置表 |
| `login_logs` | 登录日志表 |
| `operation_logs` | 操作日志表 |

### 1.2 后端接口 ([backend/](backend/))

**技术栈**: Node.js + Express + MySQL + JWT

| 路由文件 | 功能模块 |
|----------|----------|
| [routes/auth.js](backend/routes/auth.js) | 认证模块（登录、注册、Token刷新） |
| [routes/users.js](backend/routes/users.js) | 用户模块（个人信息、历史联系人） |
| [routes/orders.js](backend/routes/orders.js) | 订单模块（创建、查询、状态流转） |
| [routes/courier.js](backend/routes/courier.js) | 快递员模块（包裹录入、订单认领） |
| [routes/admin.js](backend/routes/admin.js) | 管理员模块（用户管理、订单管理） |
| [routes/parts.js](backend/routes/parts.js) | 配件模块（出入库、库存预警） |
| [routes/print.js](backend/routes/print.js) | 打印模块（面单数据生成、打印记录） |

### 1.3 核心功能实现

#### 运单号自动生成
```javascript
// 格式: XS + 10位时间戳
function generateTrackingNumber() {
  const timestamp = Date.now().toString().slice(-10);
  return `XS${timestamp}`;
}
```

#### 订单状态流转
```
pending → received → transit → delivered
         ↓                    ↓
      cancelled            cancelled
```

#### 配件自动扣减库存
```javascript
// 出库时自动扣减，支持事务处理
await transaction(async (conn) => {
  const [parts] = await conn.execute('SELECT * FROM parts_inventory WHERE id = ? FOR UPDATE', [partsId]);
  // 验证库存充足后扣减
  await conn.execute('UPDATE parts_inventory SET stock_quantity = ? WHERE id = ?', [afterQuantity, partsId]);
  // 记录出入库流水
});
```

---

## 第二步：汉印 A300E 脱敏面单 + 双码打印

### 2.1 脱敏函数 ([frontend/utils/mask.js](frontend/utils/mask.js))

| 函数 | 功能 | 示例 |
|------|------|------|
| `maskPhone()` | 手机号脱敏 | `138****1234` |
| `maskName()` | 姓名脱敏 | `张*` / `欧阳*豪` |
| `maskAddress()` | 地址脱敏 | `上海市****浦东新区` |

### 2.2 蓝牙打印 ([frontend/utils/printer.js](frontend/utils/printer.js))

**ESC/POS 打印命令封装**:
- 初始化、清屏、对齐方式
- 字体大小、加粗控制
- 一维码(CODE128)、二维码(QR)生成
- 分包发送大数据、蓝牙连接管理

### 2.3 打印页面 ([frontend/pages/print/](frontend/pages/print/))

功能特性：
- 面单预览（含脱敏信息）
- 蓝牙打印机搜索和连接
- 一键打印
- 打印历史记录

---

## 第三步：PDA 扫码集成

### 3.1 SDK 分析

已解压到 [pda-sdk/](pda-sdk/)，包含：
- `e3scanner_v1.3.42.14-release.aar` - Android库
- `e3scanner_v1.3.42.14-release.jar` - Java库
- `XCScanner_SDK_User_Guide_zhCN.pdf` - 中文文档

### 3.2 uni 原生插件 ([plugin/uni-pda-scanner/](plugin/uni-pda-scanner/))

| 文件 | 说明 |
|------|------|
| `android/PDAScannerModule.java` | Android原生模块 |
| `android/AndroidManifest.xml` | 权限配置 |
| `jsapi/index.js` | JS接口封装 |

**JS接口**:
```javascript
import PDAScanner from '@/uni-pda-scanner/index.js';

// 初始化
await PDAScanner.initScanner({ enableSound: true });

// 开始扫码
PDAScanner.startScan((result) => {
  const trackingNumber = PDAScanner.normalizeTrackingNumber(result.code);
});

// 停止扫码
PDAScanner.stopScan();

// 释放资源
await PDAScanner.releaseScanner();
```

### 3.3 扫码签收页面 ([frontend/pages/scan-sign/](frontend/pages/scan-sign/))

功能特性：
- **PDA硬件扫码** - 支持M5/EM5手持终端侧边按键扫码
- **摄像头扫码** - 兼容小程序摄像头扫码
- **一键签收** - 扫码后自动填充运单号，一键确认签收
- **签收打印** - 签收后直接打印面单
- **历史记录** - 记录最近20条签收信息

---

## 项目结构

```
├── backend/                    # Node.js 后端服务
│   ├── config/                 # 配置文件
│   ├── database/               # 数据库脚本
│   ├── middleware/             # 中间件
│   ├── routes/                 # API路由
│   ├── utils/                  # 工具函数
│   ├── app.js                  # 入口文件
│   └── package.json
│
├── frontend/                   # 微信小程序前端
│   ├── pages/
│   │   ├── print/              # 打印页面
│   │   └── scan-sign/          # 扫码签收页面
│   └── utils/
│       ├── mask.js             # 脱敏函数
│       └── printer.js           # 蓝牙打印
│
├── plugin/
│   └── uni-pda-scanner/        # uni-app PDA扫码插件
│       ├── android/             # Android原生代码
│       └── jsapi/              # JS接口
│
└── pda-sdk/                    # 原始SDK文件
    └── EM5的扫码SDK/
```

---

## 快速开始

### 1. 初始化数据库
```bash
mysql -u root -p < backend/database/schema.sql
```

### 2. 配置后端
```bash
cd backend
cp .env.example .env
# 编辑 .env 配置数据库信息
npm install
npm run dev
```

### 3. 配置小程序
在 `app.js` 中配置后端API地址：
```javascript
globalData: {
  apiBase: 'http://your-server:3000/api'
}
```

### 4. 安装PDA插件
将 `plugin/uni-pda-scanner/` 复制到uni-app项目的 `nativePlugins/` 目录

---

## API接口列表

### 认证模块 `/api/auth`
- `POST /register` - 用户注册
- `POST /login` - 用户登录
- `GET /me` - 获取当前用户信息
- `PUT /password` - 修改密码

### 订单模块 `/api/orders`
- `POST /` - 创建订单
- `GET /` - 获取订单列表
- `GET /:id` - 获取订单详情
- `PUT /:id/status` - 更新订单状态
- `GET /track/:trackingNumber` - 根据运单号查询

### 快递员模块 `/api/courier`
- `GET /orders` - 获取负责订单
- `POST /package/entry` - 包裹录入
- `POST /claim/:orderId` - 认领订单
- `GET /stats` - 获取统计数据

### 管理员模块 `/api/admin`
- `GET /stats` - 系统统计
- `GET /users` - 用户列表
- `POST /users` - 创建用户
- `PUT /users/:id` - 更新用户
- `GET /orders` - 所有订单
- `POST /orders/:id/assign` - 分配快递员

### 配件模块 `/api/parts`
- `GET /` - 配件列表
- `POST /stock/in` - 入库
- `POST /stock/out` - 出库（自动扣减）
- `GET /stock/alerts` - 库存预警

### 打印模块 `/api/print`
- `POST /label` - 生成面单数据
- `POST /barcode` - 生成一维码
- `POST /qrcode` - 生成二维码
- `POST /record` - 保存打印记录
- `GET /records` - 打印历史

---

## 技术要点

### 权限控制
- JWT Token 认证
- 角色中间件：`auth`、`isAdmin`、`isCourier`
- 资源级权限校验

### 打印数据脱敏
- 手机号：前3位 + **** + 后4位
- 姓名：首尾保留，中间脱敏（支持复姓）
- 地址：保留省市区，隐藏详细地址

### 蓝牙打印协议
- ESC/POS 指令集
- CODE128 一维码（运单号）
- QR 二维码（订单链接）
- 分包发送（每包20字节）

### 扫码数据规范化
```javascript
function normalizeTrackingNumber(code) {
  // 移除前缀、空白、特殊字符
  // 保持XS运单号格式
  return 'XS' + cleanCode;
}
```

---

## 开发说明

所有代码已生成在项目目录中，可以直接使用或根据需要进行二次开发。

如需进一步定制或有其他问题，请告诉我。
