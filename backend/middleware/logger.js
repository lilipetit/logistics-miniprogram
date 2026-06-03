/**
 * 请求日志中间件
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  
  // 响应完成后记录日志
  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent')
    };
    
    // 根据状态码选择日志级别
    if (res.statusCode >= 400) {
      console.error('❌', JSON.stringify(log));
    } else {
      console.log('📝', JSON.stringify(log));
    }
  });
  
  next();
}

module.exports = {
  requestLogger
};
