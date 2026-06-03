/**
 * 复制到剪贴板（微信 wx.setClipboardData）
 */
function copyToClipboard(text) {
  const t = String(text ?? '').trim();
  if (!t) {
    wx.showToast({ title: '无可复制内容', icon: 'none' });
    return;
  }
  wx.setClipboardData({
    data: t,
    success: () => {
      wx.showToast({ title: '已复制', icon: 'success' });
    },
    fail: () => {
      wx.showToast({ title: '复制失败', icon: 'none' });
    }
  });
}

module.exports = {
  copyToClipboard
};
