/**
 * 物流快递小程序后端服务
 * 主入口文件
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// 导入路由
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const orderRoutes = require('./routes/orders');
const courierRoutes = require('./routes/courier');
const adminRoutes = require('./routes/admin');
const partsRoutes = require('./routes/parts');
const printRoutes = require('./routes/print');

// 导入中间件
const { errorHandler, notFound } = require('./middleware/error');
const { requestLogger } = require('./middleware/logger');

const app = express();

// 中间件配置
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 请求日志
app.use(requestLogger);

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/courier', courierRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/parts', partsRoutes);
app.use('/api/print', printRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API文档首页
app.get('/api', (req, res) => {
  res.json({
    name: '物流快递小程序API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      orders: '/api/orders',
      courier: '/api/courier',
      admin: '/api/admin',
      parts: '/api/parts',
      print: '/api/print'
    }
  });
});

// 错误处理
app.use(notFound);
app.use(errorHandler);

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 服务器运行在端口 ${PORT}`);
  console.log(`📝 API文档: http://localhost:${PORT}/api`);
  console.log(`💚 健康检查: http://localhost:${PORT}/health`);
});

module.exports = app;
