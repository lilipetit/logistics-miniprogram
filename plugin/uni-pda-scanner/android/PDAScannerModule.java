package com.logistics.pda.scanner;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.sunmi.scanner.sdk.helper.CaptureDeviceFactory;
import com.sunmi.scanner.sdk.interfaces.CaptureDevice;
import com.sunmi.scanner.sdk.interfaces.DecodeDeviceListener;

import java.util.HashMap;
import java.util.Map;

import io.dcloud.feature.uniapp.common.DcloudUniAppModule;
import io.dcloud.feature.uniapp.common.UniJSCallback;
import io.dcloud.feature.uniapp.common.UniJSObject;

public class PDAScannerModule extends DcloudUniAppModule {
    private static final String TAG = "PDAScanner";
    
    private CaptureDevice captureDevice;
    private boolean isScanning = false;
    private boolean enableSound = true;
    private boolean enableVibrate = true;
    private String scanMode = "single";
    
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    public PDAScannerModule(Context context) {
        super(context);
        initDevice();
    }

    private void initDevice() {
        try {
            captureDevice = CaptureDeviceFactory.getDevice(context);
            if (captureDevice != null) {
                Log.i(TAG, "扫码设备初始化成功");
                captureDevice.open();
            } else {
                Log.w(TAG, "未检测到硬件扫码设备");
            }
        } catch (Exception e) {
            Log.e(TAG, "初始化扫码设备失败: " + e.getMessage());
        }
    }

    public void initScanner(UniJSObject options, UniJSCallback callback) {
        try {
            if (options != null) {
                enableSound = options.optBoolean("enableSound", true);
                enableVibrate = options.optBoolean("enableVibrate", true);
                scanMode = options.optString("scanMode", "single");
            }

            Map<String, Object> result = new HashMap<>();
            result.put("code", 0);
            result.put("message", "初始化成功");
            
            if (captureDevice != null) {
                captureDevice.open();
                captureDevice.setSound(enableSound);
                captureDevice.setVibrate(enableVibrate);
            }
            
            callback.invoke(result);
        } catch (Exception e) {
            Map<String, Object> result = new HashMap<>();
            result.put("code", -1);
            result.put("message", "初始化失败: " + e.getMessage());
            callback.invoke(result);
        }
    }

    public void startScan(UniJSObject options, UniJSCallback callback) {
        if (isScanning) return;
        isScanning = true;

        if (captureDevice != null) {
            try {
                captureDevice.setDecodeDeviceListener(new DecodeDeviceListener() {
                    @Override
                    public void onDecodeResult(String data, String type, int requestId) {
                        handleScanResult(data, type, callback);
                    }

                    @Override
                    public void onError(Exception e, int requestId) {
                        Map<String, Object> result = new HashMap<>();
                        result.put("code", -1);
                        result.put("message", e.getMessage());
                        callback.invoke(result);
                    }
                });
                
                captureDevice.startScan();
            } catch (Exception e) {
                isScanning = false;
                Map<String, Object> result = new HashMap<>();
                result.put("code", -1);
                result.put("message", "启动扫码失败: " + e.getMessage());
                callback.invoke(result);
            }
        }
    }

    private void handleScanResult(String data, String type, UniJSCallback callback) {
        mainHandler.post(() -> {
            if (!isScanning) return;

            Map<String, Object> result = new HashMap<>();
            result.put("code", 0);
            result.put("data", data);
            result.put("type", type);
            result.put("timestamp", System.currentTimeMillis());
            
            callback.invoke(result);

            if ("single".equals(scanMode)) {
                isScanning = false;
                if (captureDevice != null) captureDevice.stopScan();
            }
        });
    }

    public void stopScan(UniJSObject options, UniJSCallback callback) {
        isScanning = false;
        if (captureDevice != null) {
            try {
                captureDevice.stopScan();
            } catch (Exception e) {
                Log.e(TAG, "停止扫码失败: " + e.getMessage());
            }
        }
        
        Map<String, Object> result = new HashMap<>();
        result.put("code", 0);
        result.put("message", "已停止扫码");
        callback.invoke(result);
    }

    public void releaseScanner(UniJSObject options, UniJSCallback callback) {
        stopScan(options, callback);
        
        if (captureDevice != null) {
            try {
                captureDevice.close();
            } catch (Exception e) {
                Log.e(TAG, "关闭扫码设备失败: " + e.getMessage());
            }
        }
    }

    public void toggleFlash(UniJSObject options, UniJSCallback callback) {
        boolean enabled = options.optBoolean("enabled", false);
        
        Map<String, Object> result = new HashMap<>();
        
        if (captureDevice != null) {
            try {
                captureDevice.setFlash(enabled);
                result.put("code", 0);
                result.put("message", "闪光灯已" + (enabled ? "打开" : "关闭"));
            } catch (Exception e) {
                result.put("code", -1);
                result.put("message", "操作失败: " + e.getMessage());
            }
        } else {
            result.put("code", -1);
            result.put("message", "设备不支持闪光灯控制");
        }
        
        callback.invoke(result);
    }

    public void getDeviceInfo(UniJSObject options, UniJSCallback callback) {
        Map<String, Object> info = new HashMap<>();
        info.put("deviceName", android.os.Build.MODEL);
        info.put("deviceId", android.os.Build.SERIAL);
        info.put("hasScanner", captureDevice != null);
        info.put("sdkVersion", "1.3.42.14");
        
        Map<String, Object> result = new HashMap<>();
        result.put("code", 0);
        result.put("data", info);
        callback.invoke(result);
    }

    public void isSupported(UniJSObject options, UniJSCallback callback) {
        Map<String, Object> result = new HashMap<>();
        result.put("supported", captureDevice != null);
        callback.invoke(result);
    }
}
