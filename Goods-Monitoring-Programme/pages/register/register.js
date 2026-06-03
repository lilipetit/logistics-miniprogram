Page({
  data: {
    selectedRole: 'user',
    phone: '',
    username: '',
    password: '',
    confirmPassword: '',
    registerSuccess: false,
    showPassword: false,
    showConfirmPassword: false
  },

  selectRole(e) {
    const role = e.currentTarget.dataset.role;
    this.setData({
      selectedRole: role
    });
  },

  onPhoneInput(e) {
    this.setData({
      phone: e.detail.value
    });
  },

  onUsernameInput(e) {
    this.setData({
      username: e.detail.value
    });
  },

  onPasswordInput(e) {
    this.setData({
      password: e.detail.value
    });
  },

  onConfirmPasswordInput(e) {
    this.setData({
      confirmPassword: e.detail.value
    });
  },

  handleRegister() {
    const { selectedRole, phone, username, password, confirmPassword } = this.data;

    if (!phone || !username || !password || !confirmPassword) {
      wx.showToast({
        title: '请填写完整信息',
        icon: 'none'
      });
      return;
    }

    if (password !== confirmPassword) {
      wx.showToast({
        title: '两次密码输入不一致',
        icon: 'none'
      });
      return;
    }

    // 检查手机号是否已注册（一个电话只能注册一个角色）
    const users = wx.getStorageSync('users') || [];
    const existingUser = users.find(u => u.phone === phone);
    if (existingUser) {
      wx.showModal({
        title: '手机号已注册',
        content: `该手机号已注册为${existingUser.role === 'user' ? '用户' : existingUser.role === 'courier' ? '司机' : '管理员'}，一个手机号只能注册一个角色`,
        showCancel: false,
        confirmText: '知道了',
        confirmColor: '#FF6B00'
      });
      return;
    }

    // 保存用户信息
    const newUser = {
      id: Date.now().toString(),
      phone,
      username,
      password,
      role: selectedRole
    };
    users.push(newUser);
    wx.setStorageSync('users', users);
    
    // 不自动登录，清除userInfo
    wx.removeStorageSync('userInfo');

    // 显示注册成功界面
    this.setData({
      registerSuccess: true
    });
  },

  goToLogin() {
    // 跳转到登录页面
    wx.redirectTo({
      url: '/pages/login/login'
    });
  },

  togglePassword() {
    this.setData({
      showPassword: !this.data.showPassword
    });
  },

  toggleConfirmPassword() {
    this.setData({
      showConfirmPassword: !this.data.showConfirmPassword
    });
  }
});
