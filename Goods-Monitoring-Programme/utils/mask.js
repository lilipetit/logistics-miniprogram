/**
 * 信息脱敏工具函数
 * 用于快递面单打印时的数据脱敏处理
 */

/**
 * 手机号脱敏
 * 格式: 138****1234 (保留前3位和后4位)
 * @param {string} phone - 手机号
 * @returns {string} 脱敏后的手机号
 */
function maskPhone(phone) {
  if (!phone || phone.length !== 11) return phone || '';
  return phone.substring(0, 3) + '****' + phone.substring(7);
}

/**
 * 姓名脱敏
 * 格式: 张*、张**、欧阳*豪
 * @param {string} name - 姓名
 * @returns {string} 脱敏后的姓名
 */
function maskName(name) {
  if (!name) return '';
  const len = name.length;
  if (len <= 1) return name;
  if (len === 2) return name[0] + '*';
  
  // 处理复姓等情况，如"欧阳"、"司马"等
  if (isDoubleSurname(name)) {
    if (len === 3) return name[0] + name[1] + '*';
    return name[0] + name[1] + '*' + name[len - 1];
  }
  
  // 普通姓名：首尾保留，中间脱敏
  return name[0] + '*'.repeat(len - 2) + name[len - 1];
}

/**
 * 判断是否为复姓
 * @param {string} name - 姓名
 * @returns {boolean}
 */
function isDoubleSurname(name) {
  const doubleSurnames = [
    '欧阳', '司马', '上官', '诸葛', '慕容', '令狐', '公孙', '西门', '南宫', '万俟',
    '尉迟', '呼延', '赫连', '澹台', '皇甫', '完颜', '长孙', '宇文', '司徒', '司空'
  ];
  return doubleSurnames.some(surname => name.startsWith(surname));
}

/**
 * 地址脱敏
 * 格式: 上海市浦东新区****浦东新区123号
 * 保留省市区，隐藏详细地址
 * @param {string} address - 详细地址
 * @returns {string} 脱敏后的地址
 */
function maskAddress(address) {
  if (!address) return '';
  
  // 如果地址太短，不进行脱敏
  if (address.length < 10) return address;
  
  // 移除可能的详细门牌号
  // 保留前6个字符作为大致位置
  if (address.length <= 15) {
    return address.substring(0, 6) + '****';
  }
  
  return address.substring(0, 6) + '****' + address.substring(address.length - 6);
}

/**
 * 身份证脱敏
 * 格式: 310***********1234
 * @param {string} idCard - 身份证号
 * @returns {string} 脱敏后的身份证号
 */
function maskIdCard(idCard) {
  if (!idCard || idCard.length !== 18) return idCard || '';
  return idCard.substring(0, 6) + '********' + idCard.substring(14);
}

/**
 * 订单数据批量脱敏
 * @param {object} order - 订单对象
 * @returns {object} 脱敏后的订单对象
 */
function maskOrderData(order) {
  return {
    ...order,
    senderName: maskName(order.senderName),
    senderPhone: maskPhone(order.senderPhone),
    senderAddress: maskAddress(order.senderAddress),
    receiverName: maskName(order.receiverName),
    receiverPhone: maskPhone(order.receiverPhone),
    receiverAddress: maskAddress(order.receiverAddress)
  };
}

/**
 * 批量脱敏联系人列表
 * @param {Array} contacts - 联系人列表
 * @returns {Array} 脱敏后的联系人列表
 */
function maskContacts(contacts) {
  return contacts.map(contact => ({
    ...contact,
    name: maskName(contact.name),
    phone: maskPhone(contact.phone),
    address: maskAddress(contact.address)
  }));
}

module.exports = {
  maskPhone,
  maskName,
  maskAddress,
  maskIdCard,
  maskOrderData,
  maskContacts
};
