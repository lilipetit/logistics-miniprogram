/**
 * 错误处理中间件
 */

// 自定义API错误类
class ApiError extends Error {
  constructor(statusCode, message, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// 404处理
function notFound(req, res, next) {
  const error = new ApiError(404, `路径 ${req.originalUrl} 不存在`);
  next(error);
}

// 全局错误处理
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = err.message || '服务器内部错误';

  // 开发环境返回详细错误信息
  const response = {
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      errors: err.errors 
    })
  };

  // 验证错误
  if (err.errors) {
    response.errors = err.errors;
  }

  res.status(statusCode).json(response);
}

// 异步错误捕获包装器
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  ApiError,
  notFound,
  errorHandler,
  asyncHandler
};
