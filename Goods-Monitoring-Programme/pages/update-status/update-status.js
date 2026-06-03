const { normalizeOrderForDisplay } = require('../../utils/order-display.js');
const { copyToClipboard } = require('../../utils/clipboard.js');

Page({
  data: {
    orderId: '',
    trackingNumber: '',
    currentStatus: 'received',
    courierName: '',
    receiverName: '',
    receiverPhone: '',
    receiverAddress: '',
    userRole: '',
    canEdit: false
  },

  onLoad(options) {
    // 检查登录状态
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.redirectTo({
        url: '/pages/login/login'
      });
      return;
    }

    // 检查权限：只有快递员和管理员可以修改状态
    const canEdit = userInfo.role === 'courier' || userInfo.role === 'admin';
    
    this.setData({
      userRole: userInfo.role,
      canEdit: canEdit
    });

    if (options.id) {
      this.setData({
        orderId: options.id
      });
      this.loadOrderInfo();
    }
  },

  onShow() {
    if (this.data.orderId) {
      this.loadOrderInfo();
    }
  },

  copyTrackingNumber() {
    copyToClipboard(this.data.trackingNumber);
  },

  loadOrderInfo() {
    const orders = wx.getStorageSync('orders') || [];
    const order = orders.find((o) => String(o.id) === String(this.data.orderId));
    const d = normalizeOrderForDisplay(order);

    if (d) {
      this.setData({
        trackingNumber: d.trackingNumber || '-',
        currentStatus: d.currentStatus,
        courierName: d.courierName,
        receiverName: d.receiverName,
        receiverPhone: d.receiverPhone,
        receiverAddress: d.receiverAddress
      });
    }
  },

  updateStatus(e) {
    // 检查权限
    if (!this.data.canEdit) {
      wx.showToast({
        title: '您没有权限修改快递状态',
        icon: 'none'
      });
      return;
    }

    const status = e.currentTarget.dataset.status;
    const statusMap = {
      received: 'received',
      transit: 'transit',
      delivered: 'delivered'
    };
    const nextStatus = statusMap[status];
    if (!nextStatus) return;

    const orders = wx.getStorageSync('orders') || [];
    const orderIndex = orders.findIndex((o) => String(o.id) === String(this.data.orderId));

    if (orderIndex !== -1) {
      const userInfo = wx.getStorageSync('userInfo');
      const prev = { ...orders[orderIndex] };
      const patch = {
        ...prev,
        status: nextStatus,
        updateTime: new Date().toISOString()
      };
      if (nextStatus === 'delivered' && !prev.deliveredAt) {
        patch.deliveredAt = new Date().toISOString();
      }
      // 用户下单时往往未写 courierId，状态一旦改为「已接收」等，原列表条件 (无快递员且 pending) 不再成立，
      // 会导致订单从快递员端消失；此处由操作的快递员认领订单。
      if (userInfo && userInfo.role === 'courier') {
        const noCourier =
          prev.courierId === undefined ||
          prev.courierId === null ||
          String(prev.courierId).trim() === '';
        if (noCourier) {
          patch.courierId = userInfo.id;
        }
        const name =
          (userInfo.username || userInfo.name || '').trim();
        if (name && !(patch.courierName && String(patch.courierName).trim())) {
          patch.courierName = name;
        }
      }
      orders[orderIndex] = patch;
      wx.setStorageSync('orders', orders);

      this.loadOrderInfo();

      wx.showToast({
        title: '状态更新成功',
        icon: 'success'
      });
    }
  },

  confirmReceive() {
    if (!this.data.canEdit) {
      wx.showToast({
        title: '您没有权限修改快递状态',
        icon: 'none'
      });
      return;
    }
    this.updateStatus({ currentTarget: { dataset: { status: 'received' } } });
  },

  startTransit() {
    if (!this.data.canEdit) {
      wx.showToast({
        title: '您没有权限修改快递状态',
        icon: 'none'
      });
      return;
    }
    this.updateStatus({ currentTarget: { dataset: { status: 'transit' } } });
  },

  confirmDelivery() {
    if (!this.data.canEdit) {
      wx.showToast({
        title: '您没有权限修改快递状态',
        icon: 'none'
      });
      return;
    }
    this.updateStatus({ currentTarget: { dataset: { status: 'delivered' } } });
  }
});
