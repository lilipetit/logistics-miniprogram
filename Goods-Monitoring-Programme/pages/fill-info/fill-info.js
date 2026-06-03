const { generateTrackingNumber } = require('../../utils/util.js');

const HISTORY_SENDER_KEY = 'history_sender_records';
const HISTORY_RECEIVER_KEY = 'history_receiver_records';
const HISTORY_KEEP = 8;

function sameRecord(a, b) {
  if (!a || !b) return false;
  return (
    String(a.address || '').trim() === String(b.address || '').trim() &&
    String(a.name || '').trim() === String(b.name || '').trim() &&
    String(a.phone || '').trim() === String(b.phone || '').trim()
  );
}

function sideFromKey(key) {
  if (String(key || '').startsWith('sender')) return 'sender';
  if (String(key || '').startsWith('receiver')) return 'receiver';
  return '';
}

function fieldFromKey(key) {
  // senderAddress / senderName / senderPhone...
  const k = String(key || '');
  if (k.endsWith('Address')) return 'address';
  if (k.endsWith('Name')) return 'name';
  if (k.endsWith('Phone')) return 'phone';
  return '';
}

Page({
  data: {
    senderAddress: '',
    senderName: '',
    senderPhone: '',
    receiverAddress: '',
    receiverName: '',
    receiverPhone: '',
    productCount: 1,
    unitPrice: '2.00',
    totalPrice: '2.00',

    // 历史记录联动（只在当前聚焦字段展示）
    historyKey: '',
    historyOptions: []
  },

  onLoad() {
    // 检查登录状态
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }

    this._historyHideTimer = null;
    this._recalcTotal();
  },

  _recalcTotal() {
    const count = parseInt(this.data.productCount || 0, 10);
    const unit = parseFloat(this.data.unitPrice || 0);
    const safeUnit = Number.isFinite(unit) ? unit : 0;
    const total = count > 0 ? (count * safeUnit).toFixed(2) : '0.00';
    this.setData({ totalPrice: total });
  },

  // ====== 历史记录：通用事件 ======
  onFieldFocus(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;
    const side = sideFromKey(key);
    const field = fieldFromKey(key);
    if (!side || !field) return;

    const records = wx.getStorageSync(
      side === 'sender' ? HISTORY_SENDER_KEY : HISTORY_RECEIVER_KEY
    ) || [];

    const inputVal = String(this.data[key] || '').trim();
    const options = [];
    records.forEach((r, idx) => {
      const recordFieldVal = String(r[field] || '').trim();
      if (!recordFieldVal) return;
      if (!inputVal || recordFieldVal.includes(inputVal)) {
        options.push({
          recordIdx: idx,
          address: String(r.address || '').trim(),
          name: String(r.name || '').trim(),
          phone: String(r.phone || '').trim()
        });
      }
    });

    this.setData({
      historyKey: key,
      historyOptions: options.slice(0, 8)
    });
  },

  onFieldBlur(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;
    const side = sideFromKey(key);
    if (!side) return;

    // 只有当该侧地址+姓名+电话都具备时才保存为一条记录
    const record = this._buildSideRecord(side);
    if (record) {
      this._saveSideRecord(side, record);
    }

    if (this._historyHideTimer) clearTimeout(this._historyHideTimer);
    this._historyHideTimer = setTimeout(() => {
      this.setData({ historyKey: '', historyOptions: [] });
    }, 180);
  },

  onHistorySelect(e) {
    const side = e.currentTarget.dataset.side;
    const recordIdx = e.currentTarget.dataset.recordIdx;
    if (!side || recordIdx == null) return;

    const records = wx.getStorageSync(
      side === 'sender' ? HISTORY_SENDER_KEY : HISTORY_RECEIVER_KEY
    ) || [];
    const record = records[Number(recordIdx)];
    if (!record) return;

    if (this._historyHideTimer) clearTimeout(this._historyHideTimer);

    if (side === 'sender') {
      this.setData({
        senderAddress: record.address || '',
        senderName: record.name || '',
        senderPhone: record.phone || '',
        historyKey: '',
        historyOptions: []
      });
    } else {
      this.setData({
        receiverAddress: record.address || '',
        receiverName: record.name || '',
        receiverPhone: record.phone || '',
        historyKey: '',
        historyOptions: []
      });
    }
  },

  onHistoryDelete(e) {
    const side = e.currentTarget.dataset.side;
    const recordIdx = e.currentTarget.dataset.recordIdx;
    if (!side || recordIdx == null) return;

    const storeKey = side === 'sender' ? HISTORY_SENDER_KEY : HISTORY_RECEIVER_KEY;
    const records = wx.getStorageSync(storeKey) || [];
    const idx = Number(recordIdx);
    if (idx < 0 || idx >= records.length) return;

    records.splice(idx, 1);
    wx.setStorageSync(storeKey, records);

    // 如果当前还在该侧某个字段的下拉列表中，刷新下拉内容
    if (this.data.historyKey && sideFromKey(this.data.historyKey) === side) {
      const key = this.data.historyKey;
      // 触发一次计算
      const fake = { currentTarget: { dataset: { key } } };
      this.onFieldFocus(fake);
    } else {
      this.setData({ historyKey: '', historyOptions: [] });
    }
  },

  _buildSideRecord(side) {
    if (side === 'sender') {
      const address = String(this.data.senderAddress || '').trim();
      const name = String(this.data.senderName || '').trim();
      const phone = String(this.data.senderPhone || '').trim();
      if (!address || !name || !phone) return null;
      return { address, name, phone };
    }
    const address = String(this.data.receiverAddress || '').trim();
    const name = String(this.data.receiverName || '').trim();
    const phone = String(this.data.receiverPhone || '').trim();
    if (!address || !name || !phone) return null;
    return { address, name, phone };
  },

  _saveSideRecord(side, record) {
    const storeKey = side === 'sender' ? HISTORY_SENDER_KEY : HISTORY_RECEIVER_KEY;
    const list = wx.getStorageSync(storeKey) || [];

    const rec = {
      address: String(record.address || '').trim(),
      name: String(record.name || '').trim(),
      phone: String(record.phone || '').trim()
    };
    if (!rec.address || !rec.name || !rec.phone) return;

    const filtered = list.filter((x) => !sameRecord(x, rec));
    const next = [rec, ...filtered].slice(0, HISTORY_KEEP);
    wx.setStorageSync(storeKey, next);
  },

  // ====== 寄件信息输入（带历史联动） ======
  onSenderAddressInput(e) {
    const v = e.detail.value || '';
    this.setData({ senderAddress: v });
  },

  onSenderNameInput(e) {
    const v = e.detail.value || '';
    this.setData({ senderName: v });
  },

  onSenderPhoneInput(e) {
    const v = e.detail.value || '';
    this.setData({ senderPhone: v });
  },

  // ====== 收件信息输入（带历史联动） ======
  onReceiverAddressInput(e) {
    const v = e.detail.value || '';
    this.setData({ receiverAddress: v });
  },

  onReceiverNameInput(e) {
    const v = e.detail.value || '';
    this.setData({ receiverName: v });
  },

  onReceiverPhoneInput(e) {
    const v = e.detail.value || '';
    this.setData({ receiverPhone: v });
  },

  // ====== 数量/单价/总价 ======
  decreaseProduct() {
    if (this.data.productCount > 1) {
      const newCount = this.data.productCount - 1;
      this.setData({ productCount: newCount });
      this._recalcTotal();
    }
  },

  increaseProduct() {
    const newCount = this.data.productCount + 1;
    this.setData({ productCount: newCount });
    this._recalcTotal();
  },

  onUnitPriceInput(e) {
    const v = e.detail.value;
    this.setData({ unitPrice: v });
    this._recalcTotal();
  },

  onUnitPriceBlur() {
    const unit = parseFloat(this.data.unitPrice || 0);
    if (!Number.isFinite(unit) || unit < 0) {
      this.setData({ unitPrice: '0.00' });
      this._recalcTotal();
      return;
    }
    this.setData({ unitPrice: unit.toFixed(2) });
    this._recalcTotal();
  },

  // ====== 创建订单 ======
  calculateShipping() {
    const {
      senderAddress,
      senderName,
      senderPhone,
      receiverAddress,
      receiverName,
      receiverPhone,
      productCount,
      unitPrice,
      totalPrice
    } = this.data;

    if (
      !senderAddress ||
      !senderName ||
      !senderPhone ||
      !receiverAddress ||
      !receiverName ||
      !receiverPhone
    ) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }

    if (productCount <= 0) {
      wx.showToast({ title: '请选择货品数量', icon: 'none' });
      return;
    }

    const unit = parseFloat(unitPrice || 0);
    if (!Number.isFinite(unit) || unit <= 0) {
      wx.showToast({ title: '请输入正确单价', icon: 'none' });
      return;
    }

    const shippingFee = parseFloat(totalPrice || 0);

    // 创建订单
    const userInfo = wx.getStorageSync('userInfo');
    const orders = wx.getStorageSync('orders') || [];
    const orderNumber =
      'ORDER' +
      new Date().toISOString().slice(0, 10).replace(/-/g, '') +
      String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    const trackingNumber = generateTrackingNumber();

    const newOrder = {
      id: Date.now().toString(),
      orderNumber,
      trackingNumber,
      userId: userInfo.id,
      userName: userInfo.username,
      senderAddress,
      senderName,
      senderPhone,
      receiverAddress,
      receiverName,
      receiverPhone,
      productCount,
      amount: shippingFee,
      status: 'pending',
      paymentStatus: 'pending',
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString()
    };

    orders.push(newOrder);
    wx.setStorageSync('orders', orders);

    wx.showToast({ title: '订单生成成功', icon: 'success' });

    setTimeout(() => {
      wx.redirectTo({ url: '/pages/order-list/order-list' });
    }, 1500);
  }
});
