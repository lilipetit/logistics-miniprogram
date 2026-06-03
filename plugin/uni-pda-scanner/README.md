# PDA扫码插件Android配置

## 依赖配置

在 `app/build.gradle` 中添加：

```gradle
dependencies {
    implementation fileTree(dir: 'libs', include: ['*.jar', '*.aar'])
    implementation 'com.sunmi:scanner-sdk:1.3.42.14'
}
```

## 权限配置

已在 `AndroidManifest.xml` 中配置以下权限：
- `BLUETOOTH` - 蓝牙通信
- `BLUETOOTH_ADMIN` - 蓝牙管理
- `BLUETOOTH_CONNECT` - 连接蓝牙设备
- `BLUETOOTH_SCAN` - 扫描蓝牙设备
- `CAMERA` - 摄像头扫码
- `VIBRATE` - 震动反馈

## 模块注册

在 `dcloud_uniplugins.json` 中注册：

```json
{
  "nativePlugins": [
    {
      "name": "logistics-pda-scanner",
      "class": "com.logistics.pda.scanner.PDAScannerModule"
    }
  ]
}
```

## 使用示例

```javascript
import PDAScanner from '@/uni-pda-scanner/index.js';

async function initAndScan() {
  // 检查支持
  const supported = await PDAScanner.isSupported();
  console.log('硬件扫码支持:', supported);
  
  // 初始化
  await PDAScanner.initScanner({
    enableSound: true,
    enableVibrate: true,
    scanMode: 'single'
  });
  
  // 开始扫码
  PDAScanner.startScan((result) => {
    console.log('扫码结果:', result);
    
    // 规范化运单号
    const trackingNumber = PDAScanner.normalizeTrackingNumber(result.code);
    console.log('运单号:', trackingNumber);
  });
}
```
