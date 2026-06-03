const { copyToClipboard } = require('../../utils/clipboard.js');

Page({
  data: {
    deliveryList: []
  },

  onLoad() {
    this.loadDeliveryList();
  },

  onShow() {
    this.loadDeliveryList();
  },

  loadDeliveryList() {
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo || userInfo.role !== 'courier') {
      wx.redirectTo({
        url: '/pages/login/login'
      });
      return;
    }

    const { courierShouldListOrder } = require('../../utils/order-visibility.js');
    const orders = wx.getStorageSync('orders') || [];
    const statusTextMap = {
      pending: '待处理',
      received: '已揽收',
      transit: '配送中',
      delivered: '已送达'
    };
    const courierOrders = orders.filter((order) =>
      courierShouldListOrder(order, userInfo.id)
    );
    
    this.setData({
      deliveryList: courierOrders.map(order => ({
        id: order.id,
        trackingNumber: order.trackingNumber || order.orderNumber,
        receiverAddress: order.receiverAddress,
        statusText: statusTextMap[order.status] || order.status || '-'
      }))
    });
  },

  onCopyTracking(e) {
    const text = e.currentTarget.dataset.text;
    copyToClipboard(text);
  },

  enterPackage() {
    wx.navigateTo({
      url: '/pages/courier-package-entry/courier-package-entry'
    });
  },

  viewDeliveryDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/update-status/update-status?id=${id}`
    });
  },

  goToProfile() {
    wx.navigateTo({
      url: '/pages/my/my'
    });
  }
});
