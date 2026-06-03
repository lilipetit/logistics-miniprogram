const stats = require('../../utils/stats-storage.js');

Page({
  data: {
    days: stats.KEEP_DAYS,
    rows: [],
    roles: { user: 0, courier: 0, admin: 0 }
  },

  onLoad() {
    this.checkAdmin();
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  checkAdmin() {
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo || userInfo.role !== 'admin') {
      wx.redirectTo({ url: '/pages/login/login' });
    }
  },

  loadData() {
    const rows = stats.getLast15DaysRows();
    const last = rows[rows.length - 1] || {};
    this.setData({
      rows: rows.slice().reverse(),
      roles: {
        user: last.usersUser || 0,
        courier: last.usersCourier || 0,
        admin: last.usersAdmin || 0
      }
    });
  },

  exportExcel() {
    const rows = stats.getLast15DaysRows();
    const csv = stats.buildStatsCsv(rows);
    const fs = wx.getFileSystemManager();
    const name = `数据统计_${this._formatNowFile()}.csv`;
    const filePath = `${wx.env.USER_DATA_PATH}/${name}`;
    fs.writeFile({
      filePath,
      data: csv,
      encoding: 'utf8',
      success: () => {
        wx.openDocument({
          filePath,
          showMenu: true,
          success: () => {
            wx.showToast({ title: '已打开文件', icon: 'success' });
          },
          fail: () => {
            this._fallbackCopy(csv);
          }
        });
      },
      fail: () => {
        this._fallbackCopy(csv);
      }
    });
  },

  _formatNowFile() {
    const d = new Date();
    const p = (n) => (n < 10 ? `0${n}` : `${n}`);
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
  },

  _fallbackCopy(csv) {
    const plain = csv.replace(/^\uFEFF/, '');
    wx.setClipboardData({
      data: plain,
      success: () => {
        wx.showToast({ title: '已复制，可粘贴到Excel', icon: 'none', duration: 2500 });
      }
    });
  },

  copyCsv() {
    const rows = stats.getLast15DaysRows();
    const csv = stats.buildStatsCsv(rows).replace(/^\uFEFF/, '');
    wx.setClipboardData({
      data: csv,
      success: () => {
        wx.showToast({ title: '已复制到剪贴板', icon: 'success' });
      }
    });
  }
});
