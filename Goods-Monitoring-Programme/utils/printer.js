/**
 * 蓝牙打印工具
 * 汉印A300E ESC/POS协议打印
 */

// ESC/POS指令常量
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

// 打印命令
const Commands = {
  // 初始化打印机
  INIT: [ESC, 0x40],
  
  // 对齐方式
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  
  // 字体大小
  FONT_NORMAL: [ESC, 0x21, 0x00],
  FONT_BOLD_ON: [ESC, 0x45, 0x01],
  FONT_BOLD_OFF: [ESC, 0x45, 0x00],
  FONT_DOUBLE_HEIGHT: [GS, 0x21, 0x10],
  FONT_DOUBLE_WIDTH: [GS, 0x21, 0x20],
  FONT_DOUBLE_SIZE: [GS, 0x21, 0x30],
  
  // 行间距
  LINE_SPACING_DEFAULT: [ESC, 0x32],
  LINE_SPACING_SET: [ESC, 0x33],
  
  // 切纸
  CUT_PAPER: [GS, 0x56, 0x00],
  PARTIAL_CUT: [GS, 0x56, 0x01],
  
  // 蜂鸣器
  BEEP: [ESC, 0x42, 0x05, 0x09],
  
  // 走纸
  FEED_LINE: [ESC, 0x64, 0x01],
  FEED_LINES: (n) => [ESC, 0x64, n]
};

/**
 * 将字节数组转换为ArrayBuffer
 */
function arrayToBuffer(array) {
  return new Uint8Array(array).buffer;
}

/**
 * 连接蓝牙打印机
 */
async function connectPrinter(deviceId) {
  return new Promise((resolve, reject) => {
    wx.openBluetoothAdapter({
      success: () => {
        wx.createBLEConnection({
          deviceId,
          success: () => {
            // 获取服务
            wx.getBLEDeviceServices({
              deviceId,
              success: (res) => {
                const service = res.services.find(s => s.uuid.toUpperCase().includes('49535343'));
                if (service) {
                  resolve({ deviceId, serviceId: service.uuid });
                } else {
                  resolve({ deviceId, serviceId: res.services[0].uuid });
                }
              },
              fail: reject
            });
          },
          fail: reject
        });
      },
      fail: (err) => {
        reject(new Error('蓝牙适配器初始化失败: ' + err.errMsg));
      }
    });
  });
}

/**
 * 获取蓝牙打印机特征值
 */
async function getPrinterCharacteristics(deviceId, serviceId) {
  return new Promise((resolve, reject) => {
    wx.getBLEDeviceCharacteristics({
      deviceId,
      serviceId,
      success: (res) => {
        const characteristic = res.characteristics.find(c => 
          c.properties.write || c.properties.writeNoResponse
        );
        if (characteristic) {
          resolve({
            writeId: characteristic.characteristicId,
            canWrite: characteristic.properties.write,
            canWriteNoResponse: characteristic.properties.writeNoResponse
          });
        } else {
          resolve({
            writeId: res.characteristics[0].characteristicId,
            canWrite: res.characteristics[0].properties.write,
            canWriteNoResponse: res.characteristics[0].properties.writeNoResponse
          });
        }
      },
      fail: reject
    });
  });
}

/**
 * 向蓝牙打印机写入数据
 */
async function writeData(deviceId, serviceId, characteristicId, data) {
  const buffer = arrayToBuffer(data);
  
  return new Promise((resolve, reject) => {
    wx.writeBLECharacteristicValue({
      deviceId,
      serviceId,
      characteristicId,
      value: buffer,
      success: () => {
        // 写入后需要一定时间处理
        setTimeout(resolve, 50);
      },
      fail: reject
    });
  });
}

/**
 * 分包发送大数据
 */
async function writeDataWithSplit(deviceId, serviceId, characteristicId, data, maxLength = 20) {
  const chunks = [];
  
  // 分包
  for (let i = 0; i < data.length; i += maxLength) {
    chunks.push(data.slice(i, i + maxLength));
  }
  
  // 逐包发送
  for (const chunk of chunks) {
    await writeData(deviceId, serviceId, characteristicId, Array.from(chunk));
    await sleep(20); // 每次发送后短暂延迟
  }
}

/**
 * 睡眠函数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 字符串转字节数组（GBK编码）
 */
function stringToBytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    if (charCode < 0x80) {
      bytes.push(charCode);
    } else {
      // GBK编码处理
      bytes.push(0x81 + Math.floor(charCode / 256));
      bytes.push(charCode % 256);
    }
  }
  return bytes;
}

/**
 * 生成快递面单打印数据
 */
function generateExpressLabel(orderData) {
  const { trackingNumber, sender, receiver, amount, createTime } = orderData;
  const commands = [];
  
  // 初始化
  commands.push(...Commands.INIT);
  
  // 标题 - 居中对齐，大字体
  commands.push(...Commands.ALIGN_CENTER);
  commands.push(...Commands.FONT_DOUBLE_SIZE);
  commands.push(...stringToBytes('快递运单'));
  commands.push(LF);
  commands.push(...Commands.FONT_NORMAL);
  commands.push(...Commands.FEED_LINE);
  
  // 分隔线
  commands.push(...Commands.ALIGN_CENTER);
  commands.push(...stringToBytes('═══════════════════'));
  commands.push(LF);
  
  // 运单号条形码区域（文本显示）
  commands.push(...Commands.ALIGN_CENTER);
  commands.push(...Commands.FONT_DOUBLE_HEIGHT);
  commands.push(...stringToBytes(trackingNumber));
  commands.push(LF);
  commands.push(...Commands.FONT_NORMAL);
  
  // 分隔线
  commands.push(...Commands.ALIGN_CENTER);
  commands.push(...stringToBytes('───────────────────'));
  commands.push(LF);
  
  // 寄件人信息
  commands.push(...Commands.ALIGN_LEFT);
  commands.push(...Commands.FONT_BOLD_ON);
  commands.push(...stringToBytes('【寄件人】'));
  commands.push(...Commands.FONT_BOLD_OFF);
  commands.push(LF);
  commands.push(...stringToBytes('姓名: ' + sender.name));
  commands.push(LF);
  commands.push(...stringToBytes('电话: ' + sender.phone));
  commands.push(LF);
  commands.push(...stringToBytes('地址: ' + sender.address));
  commands.push(LF);
  commands.push(...Commands.FEED_LINE);
  
  // 收件人信息
  commands.push(...Commands.FONT_BOLD_ON);
  commands.push(...stringToBytes('【收件人】'));
  commands.push(...Commands.FONT_BOLD_OFF);
  commands.push(LF);
  commands.push(...stringToBytes('姓名: ' + receiver.name));
  commands.push(LF);
  commands.push(...stringToBytes('电话: ' + receiver.phone));
  commands.push(LF);
  commands.push(...stringToBytes('地址: ' + receiver.address));
  commands.push(LF);
  commands.push(...Commands.FEED_LINE);
  
  // 分隔线
  commands.push(...Commands.ALIGN_CENTER);
  commands.push(...stringToBytes('═══════════════════'));
  commands.push(LF);
  
  // 金额信息
  commands.push(...Commands.ALIGN_CENTER);
  commands.push(...Commands.FONT_DOUBLE_WIDTH);
  commands.push(...stringToBytes('¥' + amount));
  commands.push(LF);
  commands.push(...Commands.FONT_NORMAL);
  
  // 时间戳
  commands.push(...Commands.ALIGN_CENTER);
  commands.push(...stringToBytes(createTime));
  commands.push(LF);
  
  // 走纸并切纸
  commands.push(...Commands.FEED_LINES(4));
  commands.push(...Commands.PARTIAL_CUT);
  
  // 蜂鸣提示
  commands.push(...Commands.BEEP);
  
  return commands;
}

/**
 * 搜索附近的蓝牙打印机
 */
async function searchPrinters() {
  return new Promise((resolve, reject) => {
    // 初始化蓝牙适配器
    wx.openBluetoothAdapter({
      success: () => {
        // 开始搜索
        wx.startBluetoothDevicesDiscovery({
          services: ['49535343-FE7D-4AE5-8FA9-9FAFD205E455'], // 常见打印机服务UUID
          allowDuplicatesKey: false,
          success: () => {
            let devices = [];
            let timer = null;
            
            // 监听设备发现
            wx.onBluetoothDeviceFound((res) => {
              const device = res.devices[0];
              if (device.name && device.name.toUpperCase().includes('PRINTER')) {
                devices.push({
                  deviceId: device.deviceId,
                  name: device.name,
                  RSSI: device.RSSI
                });
              }
            });
            
            // 5秒后停止搜索并返回结果
            timer = setTimeout(() => {
              wx.stopBluetoothDevicesDiscovery({
                success: () => {
                  resolve(devices);
                },
                fail: reject
              });
              wx.offBluetoothDeviceFound();
            }, 5000);
          },
          fail: reject
        });
      },
      fail: (err) => {
        reject(new Error('蓝牙适配器初始化失败: ' + err.errMsg));
      }
    });
  });
}

/**
 * 断开蓝牙连接
 */
async function disconnectPrinter(deviceId) {
  return new Promise((resolve) => {
    wx.closeBLEConnection({
      deviceId,
      success: () => {
        wx.closeBluetoothAdapter({
          success: () => resolve(),
          fail: () => resolve()
        });
      },
      fail: () => resolve()
    });
  });
}

/**
 * 打印快递面单
 */
async function printExpressLabel(orderData) {
  const { deviceId } = orderData;
  
  if (!deviceId) {
    throw new Error('请先选择打印机');
  }
  
  // 连接打印机
  const connection = await connectPrinter(deviceId);
  const characteristics = await getPrinterCharacteristics(
    connection.deviceId,
    connection.serviceId
  );
  
  // 生成打印数据
  const printData = generateExpressLabel(orderData);
  
  // 发送到打印机
  await writeDataWithSplit(
    connection.deviceId,
    connection.serviceId,
    characteristics.writeId,
    printData
  );
  
  // 断开连接
  await disconnectPrinter(connection.deviceId);
  
  return true;
}

module.exports = {
  Commands,
  connectPrinter,
  getPrinterCharacteristics,
  writeData,
  writeDataWithSplit,
  searchPrinters,
  disconnectPrinter,
  printExpressLabel,
  generateExpressLabel,
  stringToBytes,
  maskPhone,
  maskName,
  maskAddress
};
