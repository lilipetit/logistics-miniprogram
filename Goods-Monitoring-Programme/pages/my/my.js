const userSync = require('../../utils/user-sync.js');
const { copyToClipboard } = require('../../utils/clipboard.js');

Page({
  data: {
    userInfo: {},
    roleText: '',
    showQueryModal: false,
    queryNumber: '',
    queryResult: null,
    queryError: ''
  },

  onLoad() {
    this.checkLogin();
    this.loadUserInfo();
  },

  onShow() {
    this.loadUserInfo();
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

  loadUserInfo() {
    // 与 users 账号库对齐，避免管理员在后台改资料后此处仍显示旧缓存
    const merged = userSync.mergeSessionUserFromUsers();
    const userInfo = merged || wx.getStorageSync('userInfo');
    if (userInfo) {
      const roleMap = {
        user: '用户',
        courier: '快递员',
        admin: '管理员'
      };
      this.setData({
        userInfo,
        roleText: roleMap[userInfo.role] || '用户'
      });
    }
  },

  queryPackage() {
    this.setData({
      showQueryModal: true,
      queryNumber: '',
      queryResult: null,
      queryError: ''
    });
  },

  hideQueryModal() {
    this.setData({
      showQueryModal: false,
      queryNumber: '',
      queryResult: null,
      queryError: ''
    });
  },

  stopPropagation() {
    // 阻止事件冒泡
  },

  onCopyText(e) {
    copyToClipboard(e.currentTarget.dataset.text);
  },

  onQueryInput(e) {
    this.setData({
      queryNumber: e.detail.value,
      queryResult: null,
      queryError: ''
    });
  },

  doQuery() {
    const { queryNumber } = this.data;
    
    if (!queryNumber || !queryNumber.trim()) {
      wx.showToast({
        title: '请输入快递单号',
        icon: 'none'
      });
      return;
    }

    // 查询订单
    const orders = wx.getStorageSync('orders') || [];
    const order = orders.find(o => 
      o.trackingNumber === queryNumber.trim() || 
      o.orderNumber === queryNumber.trim()
    );

    if (order) {
      const statusMap = {
        'pending': '待处理',
        'received': '已接收',
        'transit': '运输中',
        'delivering': '派送中',
        'delivered': '已送达'
      };
      
      this.setData({
        queryResult: {
          ...order,
          createTime: order.createTime ? new Date(order.createTime).toLocaleString('zh-CN') : ''
        },
        statusText: statusMap[order.status] || order.status,
        queryError: ''
      });
    } else {
      this.setData({
        queryResult: null,
        queryError: '未找到该快递单号，请检查后重试'
      });
    }
  },

  viewQueryDetail() {
    if (this.data.queryResult && this.data.queryResult.id) {
      this.hideQueryModal();
      wx.navigateTo({
        url: `/pages/update-status/update-status?id=${this.data.queryResult.id}`
      });
    }
  },

  showLogoutConfirm() {
    wx.showModal({
      title: '确认注销',
      content: '注销将删除当前账号（用户/司机/管理员）并退出登录。历史订单将保留，但该账号将无法再登录。确定继续吗？',
      confirmText: '确定注销',
      confirmColor: '#FF6B00',
      success: (res) => {
        if (res.confirm) {
          this.logout();
        }
      }
    });
  },

  logout() {
    const current = wx.getStorageSync('userInfo');

    // 先删除账号
    if (current && current.id) {
      const users = wx.getStorageSync('users') || [];
      const nextUsers = users.filter(u => u.id !== current.id);
      wx.setStorageSync('users', nextUsers);

      // 若该账号是快递员，顺便清理订单上的 courierId/courierName（避免“幽灵快递员”）
      if (current.role === 'courier') {
        const orders = wx.getStorageSync('orders') || [];
        const nextOrders = orders.map(o => {
          if (o.courierId === current.id) {
            return { ...o, courierId: '', courierName: '' };
          }
          return o;
        });
        wx.setStorageSync('orders', nextOrders);
      }
    }

    // 清除登录态
    wx.removeStorageSync('userInfo');
    
    wx.showToast({
      title: '注销成功',
      icon: 'success'
    });

    setTimeout(() => {
      wx.redirectTo({
        url: '/pages/login/login'
      });
    }, 1500);
  }
});
