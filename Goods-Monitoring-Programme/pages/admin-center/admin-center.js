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

function userRoleLabel(role) {
  const map = { user: '用户', courier: '司机', admin: '管理员' };
  return map[role] || role || '';
}

const userSync = require('../../utils/user-sync.js');

Page({
  data: {
    todayOrders: 128,
    courierCount: 25,
    pendingOrders: [],
    activeTab: 'orders', // orders | users
    orderKeyword: '',
    allOrders: [],
    filteredOrders: [],
    userRoleFilter: 'all', // all | user | courier | admin
    userKeyword: '',
    allUsers: [],
    filteredUsers: [],
    /** 新增用户弹层 */
    showAddUserModal: false,
    addUserPhone: '',
    addUserUsername: '',
    addUserPassword: '',
    addUserRole: 'user'
  },

  onLoad() {
    this.checkAdminAuth();
    this.loadPendingOrders();
    this.loadStats();
    this.loadAllOrders();
    this.loadUsers();
  },

  onShow() {
    this.loadPendingOrders();
    this.loadStats();
    this.loadAllOrders();
    this.loadUsers();
  },

  checkAdminAuth() {
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo || userInfo.role !== 'admin') {
      wx.redirectTo({
        url: '/pages/login/login'
      });
      return;
    }
  },

  loadStats() {
    const orders = wx.getStorageSync('orders') || [];
    const today = new Date().toISOString().slice(0, 10);
    const todayOrders = orders.filter(order => 
      order.createTime && order.createTime.startsWith(today)
    );
    
    const users = wx.getStorageSync('users') || [];
    const couriers = users.filter(user => user.role === 'courier');
    
    this.setData({
      todayOrders: todayOrders.length,
      courierCount: couriers.length
    });
  },

  loadPendingOrders() {
    const orders = wx.getStorageSync('orders') || [];
    const pending = orders.filter(order => 
      order.status === 'pending' || !order.courierId
    ).slice(0, 10);
    
    this.setData({
      pendingOrders: pending
    });
  },

  refreshOrders() {
    this.loadPendingOrders();
    this.loadStats();
    this.loadAllOrders();
    this.loadUsers();
    wx.showToast({
      title: '刷新成功',
      icon: 'success'
    });
  },

  // ===== Tabs =====
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab) return;
    this.setData({ activeTab: tab });
  },

  // ===== Orders (All) =====
  loadAllOrders() {
    const orders = wx.getStorageSync('orders') || [];
    // 最新在前
    const sorted = [...orders].sort((a, b) => {
      const ta = new Date(a.createTime || 0).getTime();
      const tb = new Date(b.createTime || 0).getTime();
      return tb - ta;
    });
    this.setData(
      { allOrders: sorted },
      () => this.applyOrderFilter()
    );
  },

  onOrderKeywordInput(e) {
    this.setData({ orderKeyword: e.detail.value || '' }, () => this.applyOrderFilter());
  },

  applyOrderFilter() {
    const { allOrders, orderKeyword } = this.data;
    const kw = (orderKeyword || '').trim();
    const base = !kw
      ? allOrders
      : allOrders.filter(o => {
          const s = `${o.trackingNumber || ''} ${o.orderNumber || ''} ${o.userName || ''} ${o.receiverName || ''} ${o.receiverPhone || ''}`;
          return s.includes(kw);
        });
    const filteredOrders = base.map(o => ({
      ...o,
      statusLabel: orderStatusLabel(o.status),
      paymentLabel: paymentStatusLabel(o.paymentStatus || 'pending')
    }));
    this.setData({ filteredOrders });
  },

  getOrderStatusText(status) {
    return orderStatusLabel(status);
  },

  getPaymentStatusText(status) {
    return paymentStatusLabel(status);
  },

  viewOrderDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/update-status/update-status?id=${id}` });
  },

  changeOrderStatus(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const statusList = ['pending', 'received', 'transit', 'delivered'];
    const labelList = statusList.map(s => this.getOrderStatusText(s));
    wx.showActionSheet({
      itemList: labelList,
      success: (res) => {
        const status = statusList[res.tapIndex];
        const orders = wx.getStorageSync('orders') || [];
        const idx = orders.findIndex(o => o.id === id);
        if (idx === -1) return;
        orders[idx].status = status;
        orders[idx].updateTime = new Date().toISOString();
        wx.setStorageSync('orders', orders);
        wx.showToast({ title: '状态已更新', icon: 'success' });
        this.loadPendingOrders();
        this.loadAllOrders();
      }
    });
  },

  changePaymentStatus(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const statusList = ['pending', 'success', 'failed'];
    const labelList = statusList.map(s => this.getPaymentStatusText(s));
    wx.showActionSheet({
      itemList: labelList,
      success: (res) => {
        const paymentStatus = statusList[res.tapIndex];
        const orders = wx.getStorageSync('orders') || [];
        const idx = orders.findIndex(o => o.id === id);
        if (idx === -1) return;
        orders[idx].paymentStatus = paymentStatus;
        if (paymentStatus === 'success') {
          orders[idx].paymentTime = new Date().toISOString();
        }
        orders[idx].updateTime = new Date().toISOString();
        wx.setStorageSync('orders', orders);
        wx.showToast({ title: '支付状态已更新', icon: 'success' });
        this.loadPendingOrders();
        this.loadAllOrders();
      }
    });
  },

  deleteOrder(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.showModal({
      title: '删除订单',
      content: '确定删除该快递订单吗？此操作不可恢复。',
      confirmColor: '#FF6B00',
      success: (res) => {
        if (!res.confirm) return;
        const orders = wx.getStorageSync('orders') || [];
        const next = orders.filter(o => o.id !== id);
        wx.setStorageSync('orders', next);
        wx.showToast({ title: '已删除', icon: 'success' });
        this.loadPendingOrders();
        this.loadStats();
        this.loadAllOrders();
      }
    });
  },

  // ===== Users CRUD =====
  loadUsers() {
    const users = wx.getStorageSync('users') || [];
    this.setData({ allUsers: users }, () => this.applyUserFilter());
  },

  onUserKeywordInput(e) {
    this.setData({ userKeyword: e.detail.value || '' }, () => this.applyUserFilter());
  },

  setUserRoleFilter(e) {
    const role = e.currentTarget.dataset.role;
    this.setData({ userRoleFilter: role || 'all' }, () => this.applyUserFilter());
  },

  applyUserFilter() {
    const { allUsers, userRoleFilter, userKeyword } = this.data;
    const kw = (userKeyword || '').trim();
    const filtered = allUsers.filter(u => {
      const roleOk = userRoleFilter === 'all' ? true : u.role === userRoleFilter;
      if (!roleOk) return false;
      if (!kw) return true;
      const s = `${u.username || ''} ${u.phone || ''} ${u.role || ''}`;
      return s.includes(kw);
    });
    const filteredUsers = filtered.map(u => ({
      ...u,
      roleLabel: userRoleLabel(u.role)
    }));
    this.setData({ filteredUsers });
  },

  roleToText(role) {
    return userRoleLabel(role);
  },

  addUser() {
    this.setData({
      showAddUserModal: true,
      addUserPhone: '',
      addUserUsername: '',
      addUserPassword: '',
      addUserRole: 'user'
    });
  },

  closeAddUserModal() {
    this.setData({ showAddUserModal: false });
  },

  noop() {},

  preventTouchMove() {
    return false;
  },

  onAddUserPhoneInput(e) {
    this.setData({ addUserPhone: e.detail.value || '' });
  },

  onAddUserUsernameInput(e) {
    this.setData({ addUserUsername: e.detail.value || '' });
  },

  onAddUserPasswordInput(e) {
    this.setData({ addUserPassword: e.detail.value || '' });
  },

  /** 自定义复选外观：点选一行切换角色（真机兼容，不依赖原生 checkbox） */
  selectAddUserRole(e) {
    const role = e.currentTarget.dataset.role;
    if (role && ['user', 'courier', 'admin'].includes(role)) {
      this.setData({ addUserRole: role });
    }
  },

  confirmAddUser() {
    const phone = (this.data.addUserPhone || '').trim();
    const username = (this.data.addUserUsername || '').trim();
    const password = (this.data.addUserPassword || '').trim();
    const role = this.data.addUserRole || 'user';

    if (!phone || !username || !password) {
      wx.showToast({ title: '请填写手机号、用户名和密码', icon: 'none' });
      return;
    }
    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '请输入11位手机号', icon: 'none' });
      return;
    }
    if (!['user', 'courier', 'admin'].includes(role)) {
      wx.showToast({ title: '请选择角色', icon: 'none' });
      return;
    }
    const users = wx.getStorageSync('users') || [];
    if (users.some(u => u.phone === phone)) {
      wx.showToast({ title: '手机号已存在', icon: 'none' });
      return;
    }
    users.push({ id: Date.now().toString(), phone, username, password, role });
    wx.setStorageSync('users', users);
    wx.showToast({ title: '已新增', icon: 'success' });
    this.setData({ showAddUserModal: false });
    this.loadUsers();
    this.loadStats();
  },

  editUser(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const users = wx.getStorageSync('users') || [];
    const u = users.find(x => x.id === id);
    if (!u) return;
    
    // 分步编辑：先选择要编辑的字段
    wx.showActionSheet({
      itemList: ['修改手机号', '修改用户名', '修改密码', '修改角色'],
      success: (res) => {
        const action = res.tapIndex;
        let title = '';
        let placeholder = '';
        let currentValue = '';
        
        switch(action) {
          case 0: // 修改手机号
            title = '修改手机号';
            placeholder = '请输入新手机号';
            currentValue = u.phone;
            break;
          case 1: // 修改用户名
            title = '修改用户名';
            placeholder = '请输入新用户名';
            currentValue = u.username;
            break;
          case 2: // 修改密码
            title = '修改密码';
            placeholder = '请输入新密码';
            currentValue = '';
            break;
          case 3: // 修改角色
            title = '修改角色';
            placeholder = '请输入角色(user/courier/admin)';
            currentValue = u.role;
            break;
        }
        
        wx.showModal({
          title: title,
          content: `当前值：${action === 2 ? '******' : currentValue}`,
          editable: true,
          placeholderText: placeholder,
          confirmColor: '#FF6B00',
          success: (modalRes) => {
            if (!modalRes.confirm || !modalRes.content) return;
            const newValue = modalRes.content.trim();
            
            if (!newValue) {
              wx.showToast({ title: '输入不能为空', icon: 'none' });
              return;
            }
            
            const next = users.map(x => {
              if (x.id !== id) return x;
              const updated = { ...x };
              
              switch(action) {
                case 0: // 手机号
                  if (users.some(u => u.phone === newValue && u.id !== id)) {
                    wx.showToast({ title: '手机号已存在', icon: 'none' });
                    return x;
                  }
                  updated.phone = newValue;
                  break;
                case 1: // 用户名
                  updated.username = newValue;
                  break;
                case 2: // 密码
                  updated.password = newValue;
                  break;
                case 3: // 角色
                  if (!['user', 'courier', 'admin'].includes(newValue)) {
                    wx.showToast({ title: '角色仅支持 user/courier/admin', icon: 'none' });
                    return x;
                  }
                  updated.role = newValue;
                  break;
              }
              
              return updated;
            });
            
            wx.setStorageSync('users', next);
            const updated = next.find((x) => x.id === id);
            if (updated) {
              userSync.syncSessionUserIfNeeded(updated);
              userSync.syncOrdersAfterMemberUpdate(u, updated);
            }
            wx.showToast({ title: '已保存', icon: 'success' });
            this.loadUsers();
            this.loadStats();
            this.loadPendingOrders();
            this.loadAllOrders();
          }
        });
      }
    });
  },

  deleteUser(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const current = wx.getStorageSync('userInfo');
    wx.showModal({
      title: '删除用户',
      content: '确定删除该账号吗？此操作不可恢复。',
      confirmColor: '#FF6B00',
      success: (res) => {
        if (!res.confirm) return;
        if (current && current.id === id) {
          wx.showToast({ title: '不能删除当前登录管理员', icon: 'none' });
          return;
        }
        const users = wx.getStorageSync('users') || [];
        const target = users.find(u => u.id === id);
        const next = users.filter(u => u.id !== id);
        wx.setStorageSync('users', next);

        // 若删除的是快递员，清理订单上 courierId/courierName
        if (target && target.role === 'courier') {
          const orders = wx.getStorageSync('orders') || [];
          const nextOrders = orders.map(o => {
            if (o.courierId === id) return { ...o, courierId: '', courierName: '' };
            return o;
          });
          wx.setStorageSync('orders', nextOrders);
        }

        wx.showToast({ title: '已删除', icon: 'success' });
        this.loadUsers();
        this.loadStats();
        this.loadPendingOrders();
        this.loadAllOrders();
      }
    });
  },

  assignCourier(e) {
    const orderId = e.currentTarget.dataset.id;
    const users = wx.getStorageSync('users') || [];
    const couriers = users.filter(user => user.role === 'courier');
    
    if (couriers.length === 0) {
      wx.showToast({
        title: '暂无可用快递员',
        icon: 'none'
      });
      return;
    }

    const courierNames = couriers.map(c => c.username);
    wx.showActionSheet({
      itemList: courierNames,
      success: (res) => {
        const selectedCourier = couriers[res.tapIndex];
        const orders = wx.getStorageSync('orders') || [];
        const orderIndex = orders.findIndex(o => o.id === orderId);
        
        if (orderIndex !== -1) {
          orders[orderIndex].courierId = selectedCourier.id;
          orders[orderIndex].courierName = selectedCourier.username;
          orders[orderIndex].status = 'received';
          orders[orderIndex].updateTime = new Date().toISOString();
          wx.setStorageSync('orders', orders);
          
          wx.showToast({
            title: '分配成功',
            icon: 'success'
          });
          
          this.loadPendingOrders();
        }
      }
    });
  },

  goToProfile() {
    wx.navigateTo({
      url: '/pages/my/my'
    });
  },

  goAdminStats() {
    wx.navigateTo({
      url: '/pages/admin-stats/admin-stats'
    });
  },

  goOrderManage() {
    wx.navigateTo({
      url: '/pages/order-manage/order-manage'
    });
  }
});
