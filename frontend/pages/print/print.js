/**
 * 打印页面
 * 用于快递面单打印
 */
const { maskPhone, maskName, maskAddress } = require('../../utils/mask.js');
const { searchPrinters, connectPrinter, getPrinterCharacteristics, writeDataWithSplit, disconnectPrinter, Commands, stringToBytes } = require('../../utils/printer.js');

const app = getApp();

Page({
  data: {
    orderId: '',
    orderData: null,
    printers: [],
    selectedPrinter: null,
    isSearching: false,
    isConnecting: false,
    isPrinting: false,
    printHistory: []
  },

  onLoad(options) {
    if (options.orderId) {
      this.setData({ orderId: options.orderId });
      this.loadOrderData(options.orderId);
    }
    this.loadPrintHistory();
  },

  onShow() {
    // 检查蓝牙状态
    this.checkBluetoothStatus();
  },

  onUnload() {
    // 断开蓝牙连接
    if (this.data.selectedPrinter) {
      disconnectPrinter(this.data.selectedPrinter.deviceId);
    }
  },

  /**
   * 检查蓝牙状态
   */
  checkBluetoothStatus() {
    wx.openBluetoothAdapter({
      success: () => {
        console.log('蓝牙适配器已就绪');
      },
      fail: (err) => {
        wx.showModal({
          title: '提示',
          content: '请开启手机蓝牙',
          confirmText: '去开启',
          success: (res) => {
            if (res.confirm) {
              wx.openBluetoothSetting();
            }
          }
        });
      }
    });
  },

  /**
   * 加载订单数据
   */
  async loadOrderData(orderId) {
    try {
      const res = await wx.request({
        url: `${app.globalData.apiBase}/orders/${orderId}`,
        method: 'GET',
        header: {
          'Authorization': `Bearer ${wx.getStorageSync('token')}`
        }
      });

      if (res.data.success) {
        const order = res.data.data;
        
        // 脱敏处理
        const maskedData = {
          id: order.id,
          orderNumber: order.order_number,
          trackingNumber: order.tracking_number,
          sender: {
            name: maskName(order.sender_name),
            phone: maskPhone(order.sender_phone),
            address: maskAddress(order.sender_address)
          },
          receiver: {
            name: maskName(order.receiver_name),
            phone: maskPhone(order.receiver_phone),
            address: maskAddress(order.receiver_address)
          },
          productCount: order.product_count,
          amount: order.amount,
          createTime: order.create_time,
          originalData: order // 保留原始数据用于调试
        };

        this.setData({ orderData: maskedData });
      }
    } catch (err) {
      console.error('加载订单数据失败:', err);
      wx.showToast({
        title: '加载订单数据失败',
        icon: 'none'
      });
    }
  },

  /**
   * 搜索蓝牙打印机
   */
  async searchPrinters() {
    this.setData({ isSearching: true, printers: [] });
    
    wx.showLoading({ title: '搜索打印机中...' });

    try {
      const printers = await searchPrinters();
      
      this.setData({ printers });
      
      if (printers.length === 0) {
        wx.showToast({
          title: '未搜索到打印机',
          icon: 'none'
        });
      }
    } catch (err) {
      console.error('搜索打印机失败:', err);
      wx.showModal({
        title: '错误',
        content: '搜索打印机失败: ' + err.message
      });
    } finally {
      this.setData({ isSearching: false });
      wx.hideLoading();
    }
  },

  /**
   * 选择打印机
   */
  async selectPrinter(e) {
    const deviceId = e.currentTarget.dataset.deviceId;
    const printer = this.data.printers.find(p => p.deviceId === deviceId);
    
    if (!printer) return;

    this.setData({ isConnecting: true, selectedPrinter: printer });
    wx.showLoading({ title: '连接打印机...' });

    try {
      const connection = await connectPrinter(deviceId);
      const characteristics = await getPrinterCharacteristics(
        connection.deviceId,
        connection.serviceId
      );

      this.setData({
        selectedPrinter: {
          ...printer,
          ...connection,
          ...characteristics
        }
      });

      wx.showToast({
        title: '连接成功',
        icon: 'success'
      });
    } catch (err) {
      console.error('连接打印机失败:', err);
      wx.showModal({
        title: '错误',
        content: '连接打印机失败: ' + err.message
      });
    } finally {
      this.setData({ isConnecting: false });
      wx.hideLoading();
    }
  },

  /**
   * 打印面单
   */
  async printLabel() {
    if (!this.data.orderData) {
      wx.showToast({
        title: '订单数据加载中',
        icon: 'none'
      });
      return;
    }

    if (!this.data.selectedPrinter) {
      wx.showToast({
        title: '请先选择打印机',
        icon: 'none'
      });
      return;
    }

    this.setData({ isPrinting: true });
    wx.showLoading({ title: '正在打印...' });

    try {
      const { selectedPrinter, orderData } = this.data;
      
      // 准备打印数据
      const printCommands = this.generatePrintCommands(orderData);
      
      // 分包发送
      await writeDataWithSplit(
        selectedPrinter.deviceId,
        selectedPrinter.serviceId,
        selectedPrinter.writeId,
        printCommands,
        20
      );

      // 保存打印记录
      await this.savePrintRecord(orderData);
      
      wx.showToast({
        title: '打印成功',
        icon: 'success'
      });
    } catch (err) {
      console.error('打印失败:', err);
      wx.showModal({
        title: '打印失败',
        content: err.message || '请检查打印机连接'
      });
    } finally {
      this.setData({ isPrinting: false });
      wx.hideLoading();
    }
  },

  /**
   * 生成打印指令
   */
  generatePrintCommands(orderData) {
    const commands = [];
    const { trackingNumber, sender, receiver, amount, createTime } = orderData;

    // 初始化打印机
    commands.push(...Commands.INIT);

    // 标题
    commands.push(...Commands.ALIGN_CENTER);
    commands.push(...Commands.FONT_DOUBLE_SIZE);
    commands.push(...stringToBytes('快递运单'));
    commands.push(Commands.LINE_SPACING_DEFAULT[0]);
    commands.push(Commands.LINE_SPACING_DEFAULT[1]);
    commands.push(0);

    // 运单号
    commands.push(...Commands.ALIGN_CENTER);
    commands.push(...Commands.FONT_DOUBLE_HEIGHT);
    commands.push(...stringToBytes(trackingNumber));
    commands.push(10);

    // 分隔线
    commands.push(...Commands.ALIGN_CENTER);
    commands.push(...stringToBytes('═══════════════════'));
    commands.push(10);

    // 寄件人
    commands.push(...Commands.ALIGN_LEFT);
    commands.push(...Commands.FONT_BOLD_ON);
    commands.push(...stringToBytes('【寄件人】'));
    commands.push(...Commands.FONT_BOLD_OFF);
    commands.push(10);
    commands.push(...stringToBytes('姓名: ' + sender.name));
    commands.push(10);
    commands.push(...stringToBytes('电话: ' + sender.phone));
    commands.push(10);
    commands.push(...stringToBytes('地址: ' + sender.address));
    commands.push(10);
    commands.push(10);

    // 收件人
    commands.push(...Commands.FONT_BOLD_ON);
    commands.push(...stringToBytes('【收件人】'));
    commands.push(...Commands.FONT_BOLD_OFF);
    commands.push(10);
    commands.push(...stringToBytes('姓名: ' + receiver.name));
    commands.push(10);
    commands.push(...stringToBytes('电话: ' + receiver.phone));
    commands.push(10);
    commands.push(...stringToBytes('地址: ' + receiver.address));
    commands.push(10);
    commands.push(10);

    // 金额
    commands.push(...Commands.ALIGN_CENTER);
    commands.push(...Commands.FONT_DOUBLE_SIZE);
    commands.push(...stringToBytes('¥' + amount));
    commands.push(10);

    // 时间
    commands.push(...Commands.FONT_NORMAL);
    commands.push(...stringToBytes(createTime));
    commands.push(10);

    // 走纸切纸
    commands.push(...Commands.FEED_LINES(4));
    commands.push(...Commands.PARTIAL_CUT);
    commands.push(...Commands.BEEP);

    return commands;
  },

  /**
   * 保存打印记录
   */
  async savePrintRecord(orderData) {
    try {
      await wx.request({
        url: `${app.globalData.apiBase}/print/record`,
        method: 'POST',
        header: {
          'Authorization': `Bearer ${wx.getStorageSync('token')}`
        },
        data: {
          orderId: orderData.id,
          trackingNumber: orderData.trackingNumber,
          orderNumber: orderData.orderNumber,
          printStatus: 1
        }
      });

      // 更新本地记录
      const history = this.data.printHistory || [];
      history.unshift({
        ...orderData,
        printTime: new Date().toISOString()
      });
      this.setData({ printHistory: history.slice(0, 10) });
      
      wx.setStorageSync('printHistory', this.data.printHistory);
    } catch (err) {
      console.error('保存打印记录失败:', err);
    }
  },

  /**
   * 加载打印历史
   */
  loadPrintHistory() {
    const history = wx.getStorageSync('printHistory') || [];
    this.setData({ printHistory: history });
  },

  /**
   * 重新打印历史记录
   */
  reprintHistory(e) {
    const index = e.currentTarget.dataset.index;
    const record = this.data.printHistory[index];
    
    if (!record) return;

    this.setData({ orderData: record });

    wx.showModal({
      title: '确认打印',
      content: `是否重新打印运单 ${record.trackingNumber}？`,
      success: (res) => {
        if (res.confirm) {
          this.printLabel();
        }
      }
    });
  },

  /**
   * 复制运单号
   */
  copyTrackingNumber() {
    if (!this.data.orderData) return;
    
    wx.setClipboardData({
      data: this.data.orderData.trackingNumber,
      success: () => {
        wx.showToast({
          title: '已复制运单号',
          icon: 'success'
        });
      }
    });
  },

  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack();
  }
});
