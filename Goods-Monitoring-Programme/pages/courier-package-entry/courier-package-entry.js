const { normalizeScanPayload } = require('../../utils/em5-scanner.js');

Page({
  data: {
    inputValue: '',
    normalizedPreview: '',
    inputFocus: false,
    submitting: false
  },

  onLoad() {
    this.setData({ inputFocus: true });
  },

  onShow() {
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo || userInfo.role !== 'courier') {
      wx.redirectTo({ url: '/pages/login/login' });
    }
  },

  onFocus() {
    this.setData({ inputFocus: true });
  },

  onInput(e) {
    const v = e.detail.value || '';
    const normalized = normalizeScanPayload(v);
    this.setData({
      inputValue: v,
      normalizedPreview: v.trim() ? normalized : ''
    });
  },

  onConfirm(e) {
    const v = (e.detail.value || this.data.inputValue || '').trim();
    if (v) {
      this._saveTracking(v);
    }
  },

  submitManual() {
    const v = String(this.data.inputValue || '').trim();
    if (!v) {
      wx.showToast({ title: '请先扫码或输入单号', icon: 'none' });
      return;
    }
    this._saveTracking(v);
  },

  _saveTracking(raw) {
    if (this.data.submitting) return;
    const trackingNumber = normalizeScanPayload(raw);
    if (!trackingNumber || trackingNumber === 'XS') {
      wx.showToast({ title: '单号无效', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    const orders = wx.getStorageSync('orders') || [];
    const userInfo = wx.getStorageSync('userInfo');

    const newOrder = {
      id: Date.now().toString(),
      trackingNumber,
      courierId: userInfo.id,
      status: 'received',
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString()
    };
    orders.push(newOrder);
    wx.setStorageSync('orders', orders);

    wx.showToast({ title: '录入成功', icon: 'success' });
    setTimeout(() => {
      wx.navigateBack();
    }, 600);
  }
});
