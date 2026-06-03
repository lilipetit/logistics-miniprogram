Page({
  data: {
    pendingOrders: [],
    selectedCount: 0,
    totalPrice: 0.00
  },

  onLoad() {
    this.checkLogin();
    this.loadPendingOrders();
  },

  onShow() {
    this.loadPendingOrders();
  },

  checkLogin() {
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.redirectTo({
        url: '/pages/login/login'
      });
      return;
    }
  },

  loadPendingOrders() {
    const userInfo = wx.getStorageSync('userInfo');
    const orders = wx.getStorageSync('orders') || [];
    
    // 获取当前用户的待支付订单
    const pending = orders.filter(order => 
      order.userId === userInfo.id && 
      order.paymentStatus === 'pending'
    ).map(order => ({
      ...order,
      selected: false,
      createTime: order.createTime ? new Date(order.createTime).toLocaleString('zh-CN') : ''
    }));
    
    this.setData({
      pendingOrders: pending
    });
    this.calculateTotal();
  },

  toggleOrder(e) {
    const index = e.currentTarget.dataset.index;
    const orders = this.data.pendingOrders;
    orders[index].selected = !orders[index].selected;
    
    this.setData({
      pendingOrders: orders
    });
    this.calculateTotal();
  },

  toggleSelectAll() {
    const orders = this.data.pendingOrders;
    const allSelected = orders.every(order => order.selected);
    
    orders.forEach(order => {
      order.selected = !allSelected;
    });
    
    this.setData({
      pendingOrders: orders
    });
    this.calculateTotal();
  },

  calculateTotal() {
    const selectedOrders = this.data.pendingOrders.filter(order => order.selected);
    const count = selectedOrders.length;
    const total = selectedOrders.reduce((sum, order) => sum + parseFloat(order.amount || 0), 0);
    
    this.setData({
      selectedCount: count,
      totalPrice: total.toFixed(2)
    });
  },

  goToPayment() {
    if (this.data.selectedCount === 0) {
      wx.showToast({
        title: '请选择要支付的订单',
        icon: 'none'
      });
      return;
    }

    const selectedOrders = this.data.pendingOrders.filter(order => order.selected);
    const orderIds = selectedOrders.map(order => order.id);
    const totalAmount = this.data.totalPrice;
    
    // 保存选中的订单ID和总金额
    wx.setStorageSync('selectedOrderIds', orderIds);
    wx.setStorageSync('batchPaymentAmount', totalAmount);
    
    // 跳转到支付页面
    wx.navigateTo({
      url: `/pages/payment/payment?fee=${totalAmount}&batch=true`
    });
  }
});
