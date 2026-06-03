/**
 * JWT认证中间件
 */
const jwt = require('jsonwebtoken');
const { ApiError } = require('./error');

// 验证Token
function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, '请先登录');
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      throw new ApiError(401, 'Token无效');
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      next(new ApiError(401, 'Token无效'));
    } else if (error.name === 'TokenExpiredError') {
      next(new ApiError(401, 'Token已过期，请重新登录'));
    } else {
      next(error);
    }
  }
}

// 可选认证（不强制要求登录）
function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
      }
    }
    next();
  } catch (error) {
    // 忽略错误，继续执行
    next();
  }
}

// 角色权限验证
function checkRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, '请先登录'));
    }
    
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, '权限不足'));
    }
    
    next();
  };
}

// 检查是否为管理员
function isAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return next(new ApiError(403, '需要管理员权限'));
  }
  next();
}

// 检查是否为快递员
function isCourier(req, res, next) {
  if (!req.user || (req.user.role !== 'courier' && req.user.role !== 'admin')) {
    return next(new ApiError(403, '需要快递员权限'));
  }
  next();
}

// 检查是否为用户本人或管理员
function isOwnerOrAdmin(req, res, next) {
  const targetId = req.params.id || req.params.userId;
  
  if (!req.user) {
    return next(new ApiError(401, '请先登录'));
  }
  
  if (req.user.role === 'admin' || req.user.id === targetId) {
    return next();
  }
  
  return next(new ApiError(403, '权限不足'));
}

module.exports = {
  auth,
  optionalAuth,
  checkRole,
  isAdmin,
  isCourier,
  isOwnerOrAdmin
};
