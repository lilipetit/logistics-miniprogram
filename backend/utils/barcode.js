/**
 * 条码生成工具
 * 支持CODE128一维码和QR二维码
 */
const bwipjs = require('bwip-js');
const QRCode = require('qrcode');

/**
 * 生成CODE128一维码 (Base64格式)
 * @param {string} data - 要编码的数据
 * @param {object} options - 配置选项
 * @returns {Promise<string>} Base64编码的PNG图片
 */
async function generateCode128(data, options = {}) {
  try {
    const canvas = await bwipjs.toCanvas({
      bcid: 'code128',       // 条码类型
      text: data,            // 要编码的文本
      scale: options.scale || 2,           // 缩放比例
      height: options.height || 10,        // 条码高度(mm)
      includetext: options.includetext !== false,  // 是否包含文本
      textxalign: 'center',  // 文本对齐方式
      backgroundcolor: 'FFFFFF',
      paddingwidth: 5,
      paddingheight: 2
    });
    
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('生成CODE128失败:', error);
    throw error;
  }
}

/**
 * 生成QR二维码 (Base64格式)
 * @param {string} data - 要编码的数据
 * @param {object} options - 配置选项
 * @returns {Promise<string>} Base64编码的PNG图片
 */
async function generateQRCode(data, options = {}) {
  try {
    const qrDataUrl = await QRCode.toDataURL(data, {
      errorCorrectionLevel: options.errorCorrectionLevel || 'M',
      type: 'image/png',
      width: options.width || 200,
      margin: options.margin || 2,
      color: {
        dark: options.darkColor || '#000000',
        light: options.lightColor || '#FFFFFF'
      }
    });
    
    return qrDataUrl;
  } catch (error) {
    console.error('生成QRCode失败:', error);
    throw error;
  }
}

/**
 * 生成快递面单条码组合
 * @param {object} order - 订单信息
 * @returns {Promise<object>} 条码数据
 */
async function generateShippingLabels(order) {
  try {
    // 生成运单号一维码
    const barcode = await generateCode128(order.tracking_number, {
      height: 12,
      scale: 2
    });
    
    // 生成订单链接二维码
    const orderUrl = `https://logistics.example.com/order/${order.tracking_number}`;
    const qrcode = await generateQRCode(orderUrl, {
      width: 150,
      margin: 1
    });
    
    return {
      barcode,
      qrcode,
      barcodeData: order.tracking_number,
      qrcodeData: orderUrl
    };
  } catch (error) {
    console.error('生成快递面单条码失败:', error);
    throw error;
  }
}

/**
 * 生成物流追踪二维码
 * @param {string} trackingNumber - 运单号
 * @returns {Promise<string>} Base64编码的二维码
 */
async function generateTrackingQRCode(trackingNumber) {
  const url = `https://logistics.example.com/track/${trackingNumber}`;
  return generateQRCode(url, { width: 200 });
}

module.exports = {
  generateCode128,
  generateQRCode,
  generateShippingLabels,
  generateTrackingQRCode
};
