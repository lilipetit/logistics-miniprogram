/**
 * PDA扫码插件 - JS端接口
 * 用于调用原生Android扫码SDK
 */

const CHANNEL = uni.requireNativePlugin('logistics-pda-scanner');

/**
 * 初始化扫码引擎
 * @param {Object} options - 配置选项
 */
function initScanner(options = {}) {
  return new Promise((resolve, reject) => {
    if (!CHANNEL) {
      reject(new Error('PDA扫码插件未安装'));
      return;
    }

    CHANNEL.initScanner({
      enableSound: options.enableSound !== false,
      enableVibrate: options.enableVibrate !== false,
      scanMode: options.scanMode || 'single'
    }, (result) => {
      if (result.code === 0) {
        resolve(result);
      } else {
        reject(new Error(result.message || '初始化失败'));
      }
    });
  });
}

/**
 * 开始扫码监听
 * @param {Function} callback - 扫码结果回调
 */
function startScan(callback) {
  if (!CHANNEL) {
    console.error('PDA扫码插件未安装');
    return;
  }

  CHANNEL.startScan({}, (result) => {
    if (result.code === 0) {
      callback({
        code: result.data,
        type: result.type || 'UNKNOWN',
        timestamp: result.timestamp || Date.now()
      });
    }
  });
}

/**
 * 停止扫码监听
 */
function stopScan() {
  if (!CHANNEL) return;
  CHANNEL.stopScan({}, () => {});
}

/**
 * 释放扫码引擎
 */
function releaseScanner() {
  if (!CHANNEL) return;
  return new Promise((resolve) => {
    CHANNEL.releaseScanner({}, resolve);
  });
}

/**
 * 开关闪光灯
 */
function toggleFlash(enabled) {
  if (!CHANNEL) return Promise.reject(new Error('PDA扫码插件未安装'));
  return new Promise((resolve, reject) => {
    CHANNEL.toggleFlash({ enabled }, (result) => {
      if (result.code === 0) resolve(result);
      else reject(new Error(result.message));
    });
  });
}

/**
 * 获取设备信息
 */
function getDeviceInfo() {
  if (!CHANNEL) return Promise.reject(new Error('PDA扫码插件未安装'));
  return new Promise((resolve, reject) => {
    CHANNEL.getDeviceInfo({}, (result) => {
      if (result.code === 0) resolve(result.data);
      else reject(new Error(result.message));
    });
  });
}

/**
 * 检查是否支持硬件扫码
 */
function isSupported() {
  if (!CHANNEL) return Promise.resolve(false);
  return new Promise((resolve) => {
    CHANNEL.isSupported({}, (result) => {
      resolve(result.supported === true);
    });
  });
}

/**
 * 解析运单号（规范化处理）
 */
function normalizeTrackingNumber(rawCode) {
  if (!rawCode) return '';
  let code = rawCode.trim().toUpperCase();
  
  // 移除常见前缀
  const prefixes = ['XS', 'SF', 'YT', 'YD', 'STO', 'EMS'];
  for (const prefix of prefixes) {
    if (code.startsWith(prefix)) {
      code = code.substring(prefix.length);
      break;
    }
  }
  
  // 只保留数字和字母
  code = code.replace(/[^A-Z0-9]/g, '');
  
  // 如果原码以XS开头，保持XS前缀
  if (rawCode.trim().toUpperCase().startsWith('XS')) {
    return 'XS' + code;
  }
  
  return code;
}

export default {
  initScanner,
  startScan,
  stopScan,
  releaseScanner,
  toggleFlash,
  getDeviceInfo,
  isSupported,
  normalizeTrackingNumber
};
