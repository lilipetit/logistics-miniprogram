Page({
  data: {
    phone: '',
    password: '',
    showPassword: false
  },

  onLoad() {
    // 检查是否已登录
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.redirectToHome(userInfo.role);
    }
  },

  onPhoneInput(e) {
    this.setData({
      phone: e.detail.value
    });
  },

  onPasswordInput(e) {
    this.setData({
      password: e.detail.value
    });
  },

  handleLogin() {
    const { phone, password } = this.data;
    
    if (!phone || !password) {
      wx.showToast({
        title: '请输入手机号和密码',
        icon: 'none'
      });
      return;
    }

    // 模拟登录验证
    const users = wx.getStorageSync('users') || [];
    const user = users.find(u => u.phone === phone && u.password === password);
    
    if (user) {
      wx.setStorageSync('userInfo', user);
      wx.showToast({
        title: '登录成功',
        icon: 'success'
      });
      setTimeout(() => {
        this.redirectToHome(user.role);
      }, 1500);
    } else {
      wx.showToast({
        title: '手机号或密码错误',
        icon: 'none'
      });
    }
  },

  redirectToHome(role) {
    if (role === 'admin') {
      wx.redirectTo({
        url: '/pages/admin-center/admin-center'
      });
    } else if (role === 'courier') {
      wx.redirectTo({
        url: '/pages/courier-center/courier-center'
      });
    } else {
      wx.redirectTo({
        url: '/pages/send-package/send-package'
      });
    }
  },

  goToRegister() {
    wx.navigateTo({
      url: '/pages/register/register'
    });
  },

  togglePassword() {
    this.setData({
      showPassword: !this.data.showPassword
    });
  }
});
