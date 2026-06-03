function mapStorageStatusToTimeline(status) {
  const statusMap = {
    pending: 'received',
    received: 'received',
    transit: 'transit',
    delivered: 'delivered'
  };
  return statusMap[status] || 'received';
}

/** 从订单对象取出展示用字段（避免 undefined 与状态不同步） */
function normalizeOrderForDisplay(order) {
  if (!order) return null;
  return {
    trackingNumber: order.trackingNumber || order.orderNumber || '',
    currentStatus: mapStorageStatusToTimeline(order.status),
    courierName:
      order.courierName != null && String(order.courierName).trim() !== ''
        ? String(order.courierName)
        : '',
    receiverName:
      order.receiverName != null && String(order.receiverName).trim() !== ''
        ? String(order.receiverName)
        : '',
    receiverPhone:
      order.receiverPhone != null && String(order.receiverPhone).trim() !== ''
        ? String(order.receiverPhone)
        : '',
    receiverAddress:
      order.receiverAddress != null && String(order.receiverAddress).trim() !== ''
        ? String(order.receiverAddress)
        : ''
  };
}

module.exports = {
  normalizeOrderForDisplay,
  mapStorageStatusToTimeline
};
