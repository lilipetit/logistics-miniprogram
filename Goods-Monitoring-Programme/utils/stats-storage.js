/**
 * 近 15 天统计快照（本地存储），与订单/用户数据同步合并
 */
const SNAPSHOT_KEY = 'statsDailySnapshots15d';
const KEEP_DAYS = 15;

function pad(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function countByRole(users) {
  const roles = { user: 0, courier: 0, admin: 0 };
  (users || []).forEach((u) => {
    if (roles[u.role] !== undefined) roles[u.role] += 1;
  });
  return roles;
}

function countOrderStatus(orders) {
  const s = { pending: 0, received: 0, transit: 0, delivered: 0 };
  (orders || []).forEach((o) => {
    const k = o.status || 'pending';
    if (s[k] !== undefined) s[k] += 1;
  });
  return s;
}

/**
 * 按创建日聚合订单（YYYY-MM-DD）
 */
function ordersCreatedOnDay(orders, dateStr) {
  return (orders || []).filter(
    (o) => o.createTime && String(o.createTime).slice(0, 10) === dateStr
  );
}

function sumPaidAmount(orders) {
  return (orders || [])
    .filter((o) => o.paymentStatus === 'success')
    .reduce((sum, o) => sum + parseFloat(o.amount || 0, 10), 0);
}

/**
 * 刷新并写入近 KEEP_DAYS 天每日快照（含当日各角色人数为当前值）
 */
function refreshSnapshots() {
  const users = wx.getStorageSync('users') || [];
  const orders = wx.getStorageSync('orders') || [];
  const roles = countByRole(users);
  const list = [];
  const now = new Date();
  for (let i = KEEP_DAYS - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const ds = formatDate(d);
    const dayOrders = ordersCreatedOnDay(orders, ds);
    const st = countOrderStatus(dayOrders);
    const paidAmt = sumPaidAmount(dayOrders);
    list.push({
      date: ds,
      orderCount: dayOrders.length,
      paidAmount: Math.round(paidAmt * 100) / 100,
      pendingPayCount: dayOrders.filter((o) => (o.paymentStatus || 'pending') === 'pending').length,
      statusPending: st.pending,
      statusReceived: st.received,
      statusTransit: st.transit,
      statusDelivered: st.delivered,
      usersUser: roles.user,
      usersCourier: roles.courier,
      usersAdmin: roles.admin
    });
  }
  wx.setStorageSync(SNAPSHOT_KEY, list);
  return list;
}

/**
 * 合并：优先用刷新结果（与当前订单一致）
 */
function getLast15DaysRows() {
  return refreshSnapshots();
}

/**
 * 生成 CSV（Excel 可用 UTF-8 BOM）
 */
function buildStatsCsv(rows) {
  const headers = [
    '日期',
    '新增订单数',
    '已付金额',
    '待支付笔数',
    '状态_待处理',
    '状态_已接收',
    '状态_运输中',
    '状态_已送达',
    '角色_用户数',
    '角色_司机数',
    '角色_管理员数'
  ];
  const lines = [headers.join(',')];
  (rows || []).forEach((r) => {
    lines.push(
      [
        r.date,
        r.orderCount,
        r.paidAmount,
        r.pendingPayCount,
        r.statusPending,
        r.statusReceived,
        r.statusTransit,
        r.statusDelivered,
        r.usersUser,
        r.usersCourier,
        r.usersAdmin
      ].join(',')
    );
  });
  return '\uFEFF' + lines.join('\n');
}

module.exports = {
  SNAPSHOT_KEY,
  KEEP_DAYS,
  formatDate,
  getLast15DaysRows,
  buildStatsCsv,
  countByRole
};
