const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** 已送达订单在快递员端列表中保留的时长 */
const COURIER_DELIVERED_VISIBLE_MS = 3 * MS_PER_DAY;

function sameId(a, b) {
  return String(a ?? '') === String(b ?? '');
}

/**
 * 快递员「我的配送」是否仍显示该订单（管理员端不做此过滤，全量见 storage）
 * - 非已送达：始终显示（且满足归属条件）
 * - 已送达：自 deliveredAt（无则用 updateTime）起 3 天内仍显示，之后隐藏
 */
function courierShouldListOrder(order, courierUserId) {
  const isMine =
    sameId(order.courierId, courierUserId) ||
    (order.courierId == null && order.status === 'pending');
  if (!isMine) return false;
  if (order.status !== 'delivered') return true;
  const ref = order.deliveredAt || order.updateTime;
  if (!ref) return true;
  return Date.now() - new Date(ref).getTime() < COURIER_DELIVERED_VISIBLE_MS;
}

module.exports = {
  courierShouldListOrder,
  COURIER_DELIVERED_VISIBLE_MS
};
