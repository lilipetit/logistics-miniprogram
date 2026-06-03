/**
 * 快递员侧物流单号：统一以 XS 开头（替代历史 SF 前缀）。
 * 扫码枪原始内容若含 SF 或其它前缀，会规范为 XS。
 */
function normalizeCourierTracking(raw) {
  let s = String(raw || '')
    .trim()
    .replace(/[\r\n\t]/g, '');
  if (!s) return '';

  const upper = s.toUpperCase();
  if (upper.startsWith('XS')) {
    return 'XS' + s.slice(2);
  }
  if (upper.startsWith('SF')) {
    return 'XS' + s.slice(2);
  }
  return 'XS' + s;
}

module.exports = {
  normalizeCourierTracking
};
