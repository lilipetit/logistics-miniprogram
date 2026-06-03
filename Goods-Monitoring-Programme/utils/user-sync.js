/**
 * 管理员修改 users 列表后：同步当前登录态 userInfo，并同步订单中的客户名/快递员名等展示字段
 */

function sameUserId(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

/**
 * 若被修改账号正是当前登录用户，用最新用户对象覆盖 userInfo（id 统一按字符串比较，避免 number/string 导致不同步）
 */
function syncSessionUserIfNeeded(updatedUser) {
  if (!updatedUser || updatedUser.id == null) return;
  const session = wx.getStorageSync('userInfo');
  if (!session || !sameUserId(session.id, updatedUser.id)) return;
  wx.setStorageSync('userInfo', { ...updatedUser });
}

/**
 * 从 users 表合并当前登录用户最新资料到 userInfo（进入「我的」等页时调用，保证与后台编辑一致）
 */
function mergeSessionUserFromUsers() {
  const session = wx.getStorageSync('userInfo');
  if (!session || session.id == null) return null;
  const users = wx.getStorageSync('users') || [];
  const row = users.find((u) => sameUserId(u.id, session.id));
  if (!row) return session;
  const merged = { ...session, ...row };
  wx.setStorageSync('userInfo', merged);
  return merged;
}

/**
 * 根据修改前后差异，更新订单里冗余的用户名、快递员信息
 * @param {object} before 修改前的用户对象
 * @param {object} after 修改后的用户对象
 */
function syncOrdersAfterMemberUpdate(before, after) {
  if (!before || !after || !sameUserId(before.id, after.id)) return;

  const orders = wx.getStorageSync('orders') || [];
  let dirty = false;

  const next = orders.map((o) => {
    let x = o;

    if (sameUserId(o.userId, after.id) && before.username !== after.username) {
      x = { ...x, userName: after.username };
      dirty = true;
    }

    if (sameUserId(o.courierId, after.id)) {
      if (before.role === 'courier' && after.role !== 'courier') {
        x = { ...x, courierId: '', courierName: '' };
        dirty = true;
      } else if (before.username !== after.username) {
        x = { ...x, courierName: after.username };
        dirty = true;
      }
    }

    return x;
  });

  if (dirty) {
    wx.setStorageSync('orders', next);
  }
}

module.exports = {
  sameUserId,
  syncSessionUserIfNeeded,
  mergeSessionUserFromUsers,
  syncOrdersAfterMemberUpdate
};
