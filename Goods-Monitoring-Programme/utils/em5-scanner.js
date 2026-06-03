/**
 * EM5 / e3_scanner 扫码能力接入说明（请对照厂商《扫码SDK文档 e3_scanner_code》）
 *
 * 微信小程序无法直接调用 Android 离线 aar，常见接入方式：
 *
 * 1) HID 键盘模式（最常见）
 *    扫描枪把条码当作键盘输入 + 回车。使用「包裹录入」页的输入框接收，
 *    已在 pages/courier-package-entry 中通过 bindconfirm / 手动提交 处理。
 *
 * 2) 小程序插件
 *    若厂商提供「小程序插件」，在 app.json 根节点增加：
 *    "plugins": { "厂商名": { "version": "x.x.x", "provider": "wxAppId" } }
 *    然后在此文件 requirePlugin('厂商名') 并调用文档中的 API，在回调里把
 *    结果交给 normalizeScanPayload 再写入订单。
 *
 * 3) 蓝牙 BLE
 *    wx.openBluetoothAdapter → 按文档中的 deviceId / serviceId / characteristicId
 *    使用 notify 收码，再 normalizeScanPayload。
 *
 * 当前导出：把任意扫码结果规范为以 XS 开头的单号字符串。
 */
const { normalizeCourierTracking } = require('./courier-tracking.js');

function normalizeScanPayload(raw) {
  return normalizeCourierTracking(raw);
}

module.exports = {
  normalizeScanPayload
};
