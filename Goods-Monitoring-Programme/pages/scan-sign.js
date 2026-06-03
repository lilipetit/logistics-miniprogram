/**
 * 扫码签收页面
 * 支持PDA硬件扫码和小程序摄像头扫码
 */
const PDAScanner = require('../../utils/pda-scanner.js');

Page({
  data: {
    // 扫码模式
    scanMode: 'pda', // 'pda' - PDA硬件扫码, 'camera' - 摄像头扫码
    isScanning: false,
    
    // 扫码结果
    scanResult: null,
    trackingNumber: '',
    
    // 订单信息
    orderInfo: null,
    orderLoading: false,
    
    // 设备信息
    deviceInfo: null,
    pdaSupported: false,
    
    // 操作状态
    signing: false,
    
    // 历史记录
    historyList: []
  },

  onLoad() {
    this.initScanner();
    this.loadHistory();
  },

  onShow() {
    if (this.data.scanMode === 'pda' && !this.data.isScanning) {
      this.startPDAScan();
    }
  },

  onUnload() {
    this.stopScan();
  },

  /**
   * 初始化扫码引擎
   */
  async initScanner() {
    try {
      // 检查PDA硬件扫码支持
      const supported = await PDAScanner.isSupported();
      this.setData({ pdaSupported: supported });

      if (supported) {
        // 初始化PDA扫码
        await PDAScanner.initScanner({
          enableSound: true,
          enableVibrate: true,
          scanMode: 'single'
        });

        // 获取设备信息
        const deviceInfo = await PDAScanner.getDeviceInfo();
        this.setData({ deviceInfo });
        
        // 自动开始扫码
        this.startPDAScan();
      } else {
        wx.showModal({
          title: '提示',
          content: '未检测到PDA硬件扫码功能，将使用摄像头扫码',
          showCancel: false
        });
      }
    } catch (err) {
      console.error('初始化扫码失败:', err);
      this.setData({ pdaSupported: false });
    }
  },

  /**
   * 开始PDA硬件扫码
   */
  startPDAScan() {
    if (!this.data.pdaSupported || this.data.isScanning) return;

    this.setData({ isScanning: true });

    PDAScanner.startScan((result) => {
      console.log('PDA扫码结果:', result);
      this.handleScanResult(result.code);
    });
  },

  /**
   * 停止扫码
   */
  stopScan() {
    this.setData({ isScanning: false });
    
    if (this.data.scanMode === 'pda') {
      PDAScanner.stopScan();
    } else {
      // 关闭摄像头
      wx.scanCode({
        onlyFromCamera: false
      });
    }
  },

  /**
   * 处理扫码结果
   */
  async handleScanResult(code) {
    if (!code) return;

    // 规范化运单号
    const trackingNumber = PDAScanner.normalizeTrackingNumber(code);
    
    this.setData({
      scanResult: code,
      trackingNumber,
      isScanning: false
    });

    // 自动查询订单
    await this.queryOrder(trackingNumber);
  },

  /**
   * 切换扫码模式
   */
  switchScanMode(e) {
    const mode = e.currentTarget.dataset.mode;
    
    if (mode === this.data.scanMode) return;

    // 停止当前扫码
    this.stopScan();
    
    this.setData({
      scanMode: mode,
      scanResult: null,
      trackingNumber: '',
      orderInfo: null
    });

    // 根据模式开始扫码
    if (mode === 'pda') {
      this.startPDAScan();
    }
  },

  /**
   * 打开摄像头扫码
   */
  openCameraScan() {
    this.setData({ scanMode: 'camera' });
    
    wx.scanCode({
      onlyFromCamera: true,
      success: (res) => {
        this.handleScanResult(res.result);
      },
      fail: (err) => {
        console.error('扫码失败:', err);
        if (err.errMsg !== 'cancel') {
          wx.showToast({
            title: '扫码失败',
            icon: 'none'
          });
        }
      }
    });
  },

  /**
   * 输入运单号查询
   */
  onTrackingInput(e) {
    this.setData({ trackingNumber: e.detail.value });
  },

  /**
   * 查询订单
   */
  async queryOrder(trackingNumber) {
    if (!trackingNumber) {
      wx.showToast({
        title: '请输入运单号',
        icon: 'none'
      });
      return;
    }

    this.setData({ orderLoading: true });

    try {
      const res = await wx.request({
        url: `${getApp().globalData.apiBase}/orders/track/${trackingNumber}`,
        method: 'GET'
      });

      if (res.data.success) {
        this.setData({ orderInfo: res.data.data });
      } else {
        wx.showToast({
          title: '未找到订单',
          icon: 'none'
        });
        this.setData({ orderInfo: null });
      }
    } catch (err) {
      console.error('查询订单失败:', err);
      wx.showToast({
        title: '查询失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ orderLoading: false });
    }
  },

  /**
   * 搜索按钮点击
   */
  onSearchTap() {
    this.queryOrder(this.data.trackingNumber);
  },

  /**
   * 一键签收
   */
  async confirmSign() {
    if (!this.data.orderInfo) {
      wx.showToast({
        title: '请先查询订单',
        icon: 'none'
      });
      return;
    }

    if (this.data.orderInfo.status === 'delivered') {
      wx.showToast({
        title: '该订单已签收',
        icon: 'none'
      });
      return;
    }

    this.setData({ signing: true });

    try {
      const res = await wx.request({
        url: `${getApp().globalData.apiBase}/orders/${this.data.orderInfo.id}/status`,
        method: 'PUT',
        header: {
          'Authorization': `Bearer ${wx.getStorageSync('token')}`
        },
        data: {
          status: 'delivered',
          description: '收件人已签收',
          location: this.data.orderInfo.receiver_address
        }
      });

      if (res.data.success) {
        // 保存到历史记录
        this.saveToHistory(this.data.orderInfo);
        
        wx.showToast({
          title: '签收成功',
          icon: 'success'
        });

        // 清空当前数据，准备下一次扫码
        setTimeout(() => {
          this.clearAndContinue();
        }, 1500);
      } else {
        wx.showToast({
          title: res.data.message || '签收失败',
          icon: 'none'
        });
      }
    } catch (err) {
      console.error('签收失败:', err);
      wx.showToast({
        title: '签收失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ signing: false });
    }
  },

  /**
   * 签收并打印
   */
  async signAndPrint() {
    await this.confirmSign();
    
    if (this.data.orderInfo) {
      // 跳转到打印页面
      wx.navigateTo({
        url: `/pages/print/print?orderId=${this.data.orderInfo.id}`
      });
    }
  },

  /**
   * 保存到历史记录
   */
  saveToHistory(order) {
    const history = this.data.historyList || [];
    
    history.unshift({
      ...order,
      signTime: new Date().toISOString()
    });
    
    // 只保留最近20条
    this.setData({ historyList: history.slice(0, 20) });
    wx.setStorageSync('signHistory', this.data.historyList);
  },

  /**
   * 加载历史记录
   */
  loadHistory() {
    const history = wx.getStorageSync('signHistory') || [];
    this.setData({ historyList: history });
  },

  /**
   * 清空并继续
   */
  clearAndContinue() {
    this.setData({
      scanResult: null,
      trackingNumber: '',
      orderInfo: null
    });

    // 继续扫码
    if (this.data.scanMode === 'pda') {
      this.startPDAScan();
    }
  },

  /**
   * 查看历史详情
   */
  viewHistoryDetail(e) {
    const index = e.currentTarget.dataset.index;
    const order = this.data.historyList[index];
    
    if (order) {
      wx.showModal({
        title: '签收信息',
        content: `运单号: ${order.tracking_number}\n收件人: ${order.receiver_name}\n签收时间: ${order.signTime}`,
        showCancel: true,
        confirmText: '打印面单',
        cancelText: '关闭',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: `/pages/print/print?orderId=${order.id}`
            });
          }
        }
      });
    }
  },

  /**
   * 手动输入运单号并签收
   */
  showManualInput() {
    wx.showModal({
      title: '手动输入运单号',
      editable: true,
      placeholderText: '请输入运单号',
      success: (res) => {
        if (res.confirm && res.content) {
          this.handleScanResult(res.content.trim());
        }
      }
    });
  }
});
