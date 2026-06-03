function orderStatusLabel(status) {
  const map = {
    pending: '待处理',
    received: '已接收',
    transit: '运输中',
    delivered: '已送达'
  };
  return map[status] || status || '未知';
}

function paymentStatusLabel(status) {
  const map = {
    pending: '待支付',
    success: '支付成功',
    failed: '支付失败'
  };
  return map[status] || '待支付';
}

function escapeCsv(v) {
  const s = String(v == null ? '' : v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildOrdersCsv(orders) {
  const headers = [
    '订单号',
    '快递单号',
    '客户',
    '收件人',
    '收件电话',
    '寄件人',
    '金额',
    '订单状态',
    '支付状态',
    '快递员',
    '创建时间'
  ];
  const lines = [headers.join(',')];
  (orders || []).forEach((o) => {
    lines.push(
      [
        escapeCsv(o.orderNumber),
        escapeCsv(o.trackingNumber),
        escapeCsv(o.userName),
        escapeCsv(o.receiverName),
        escapeCsv(o.receiverPhone),
        escapeCsv(o.senderName),
        escapeCsv(o.amount),
        escapeCsv(orderStatusLabel(o.status)),
        escapeCsv(paymentStatusLabel(o.paymentStatus || 'pending')),
        escapeCsv(o.courierName || ''),
        escapeCsv(o.createTime || '')
      ].join(',')
    );
  });
  return '\uFEFF' + lines.join('\n');
}

Page({
  data: {
    keyword: '',
    statusFilter: 'all',
    payFilter: 'all',
    todayCount: 0,
    totalCount: 0,
    pendingAssignCount: 0,
    allOrders: [],
    pendingOrders: [],
    filteredOrders: []
  },

  onLoad() {
    this.checkAdmin();
    this.refreshAll();
  },

  onShow() {
    this.refreshAll();
  },

  checkAdmin() {
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo || userInfo.role !== 'admin') {
      wx.redirectTo({ url: '/pages/login/login' });
    }
  },

  loadSummary() {
    const orders = wx.getStorageSync('orders') || [];
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = orders.filter((o) => o.createTime && String(o.createTime).startsWith(today)).length;
    const pendingAssignCount = orders.filter(
      (o) => o.status === 'pending' || !o.courierId
    ).length;
    this.setData({
      totalCount: orders.length,
      todayCount,
      pendingAssignCount
    });
  },

  loadPending() {
    const orders = wx.getStorageSync('orders') || [];
    const pending = orders.filter((o) => o.status === 'pending' || !o.courierId);
    this.setData({ pendingOrders: pending });
  },

  loadAllSorted() {
    const orders = wx.getStorageSync('orders') || [];
    const sorted = [...orders].sort((a, b) => {
      const ta = new Date(a.createTime || 0).getTime();
      const tb = new Date(b.createTime || 0).getTime();
      return tb - ta;
    });
    this.setData({ allOrders: sorted }, () => this.applyFilter());
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value || '' }, () => this.applyFilter());
  },

  setStatusFilter(e) {
    const status = e.currentTarget.dataset.status;
    this.setData({ statusFilter: status || 'all' }, () => this.applyFilter());
  },

  setPayFilter(e) {
    const pay = e.currentTarget.dataset.pay;
    this.setData({ payFilter: pay || 'all' }, () => this.applyFilter());
  },

  applyFilter() {
    const { allOrders, keyword, statusFilter, payFilter } = this.data;
    const kw = (keyword || '').trim();
    let list = allOrders;
    if (kw) {
      list = list.filter((o) => {
        const s = `${o.trackingNumber || ''} ${o.orderNumber || ''} ${o.userName || ''} ${o.receiverName || ''} ${o.receiverPhone || ''} ${o.senderPhone || ''}`;
        return s.includes(kw);
      });
    }
    if (statusFilter !== 'all') {
      list = list.filter((o) => (o.status || 'pending') === statusFilter);
    }
    if (payFilter !== 'all') {
      list = list.filter((o) => (o.paymentStatus || 'pending') === payFilter);
    }
    const filteredOrders = list.map((o) => ({
      ...o,
      statusLabel: orderStatusLabel(o.status),
      paymentLabel: paymentStatusLabel(o.paymentStatus || 'pending')
    }));
    this.setData({ filteredOrders });
  },

  refreshAll() {
    this.loadSummary();
    this.loadPending();
    this.loadAllSorted();
  },

  onRefreshTap() {
    this.refreshAll();
    wx.showToast({ title: '已刷新', icon: 'success' });
  },

  viewDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/update-status/update-status?id=${id}` });
  },

  changeOrderStatus(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const statusList = ['pending', 'received', 'transit', 'delivered'];
    const labelList = statusList.map((s) => orderStatusLabel(s));
    wx.showActionSheet({
      itemList: labelList,
      success: (res) => {
        const status = statusList[res.tapIndex];
        const orders = wx.getStorageSync('orders') || [];
        const idx = orders.findIndex((o) => o.id === id);
        if (idx === -1) return;
        orders[idx].status = status;
        orders[idx].updateTime = new Date().toISOString();
        wx.setStorageSync('orders', orders);
        wx.showToast({ title: '状态已更新', icon: 'success' });
        this.refreshAll();
      }
    });
  },

  changePaymentStatus(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const statusList = ['pending', 'success', 'failed'];
    const labelList = statusList.map((s) => paymentStatusLabel(s));
    wx.showActionSheet({
      itemList: labelList,
      success: (res) => {
        const paymentStatus = statusList[res.tapIndex];
        const orders = wx.getStorageSync('orders') || [];
        const idx = orders.findIndex((o) => o.id === id);
        if (idx === -1) return;
        orders[idx].paymentStatus = paymentStatus;
        if (paymentStatus === 'success') {
          orders[idx].paymentTime = new Date().toISOString();
        }
        orders[idx].updateTime = new Date().toISOString();
        wx.setStorageSync('orders', orders);
        wx.showToast({ title: '支付状态已更新', icon: 'success' });
        this.refreshAll();
      }
    });
  },

  deleteOrder(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.showModal({
      title: '删除订单',
      content: '确定删除该物流订单吗？此操作不可恢复。',
      confirmColor: '#FF6B00',
      success: (res) => {
        if (!res.confirm) return;
        const orders = wx.getStorageSync('orders') || [];
        wx.setStorageSync(
          'orders',
          orders.filter((o) => o.id !== id)
        );
        wx.showToast({ title: '已删除', icon: 'success' });
        this.refreshAll();
      }
    });
  },

  assignCourier(e) {
    const orderId = e.currentTarget.dataset.id;
    const users = wx.getStorageSync('users') || [];
    const couriers = users.filter((u) => u.role === 'courier');
    if (couriers.length === 0) {
      wx.showToast({ title: '暂无可用快递员', icon: 'none' });
      return;
    }
    wx.showActionSheet({
      itemList: couriers.map((c) => c.username),
      success: (res) => {
        const selectedCourier = couriers[res.tapIndex];
        const orders = wx.getStorageSync('orders') || [];
        const orderIndex = orders.findIndex((o) => o.id === orderId);
        if (orderIndex === -1) return;
        orders[orderIndex].courierId = selectedCourier.id;
        orders[orderIndex].courierName = selectedCourier.username;
        orders[orderIndex].status = 'received';
        orders[orderIndex].updateTime = new Date().toISOString();
        wx.setStorageSync('orders', orders);
        wx.showToast({ title: '分配成功', icon: 'success' });
        this.refreshAll();
      }
    });
  },

  exportOrdersCsv() {
    const orders = wx.getStorageSync('orders') || [];
    const csv = buildOrdersCsv(orders);
    const fs = wx.getFileSystemManager();
    const name = `物流订单_${Date.now()}.csv`;
    const filePath = `${wx.env.USER_DATA_PATH}/${name}`;
    fs.writeFile({
      filePath,
      data: csv,
      encoding: 'utf8',
      success: () => {
        wx.openDocument({
          filePath,
          showMenu: true,
          success: () => wx.showToast({ title: '已打开', icon: 'success' }),
          fail: () => {
            wx.setClipboardData({
              data: csv.replace(/^\uFEFF/, ''),
              success: () =>
                wx.showToast({ title: '已复制，可粘贴到Excel', icon: 'none', duration: 2500 })
            });
          }
        });
      },
      fail: () => {
        wx.setClipboardData({
          data: csv.replace(/^\uFEFF/, ''),
          success: () =>
            wx.showToast({ title: '已复制到剪贴板', icon: 'none' })
        });
      }
    });
  }
});
