/**
 * 配件管理云函数
 * 功能：配件库存管理、出入库操作
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action } = event

  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    if (action === 'add') {
      // 添加配件
      const { name, spec, unit, price, stock, remark } = event

      // 检查是否已存在
      const exist = await db.collection('accessories').where({ name: name }).get()

      if (exist.data.length > 0) {
        return { success: false, message: '配件已存在' }
      }

      const result = await db.collection('accessories').add({
        data: {
          name: name,
          spec: spec || '',
          unit: unit || '个',
          price: price || 0,
          stock: stock || 0,
          remark: remark || '',
          created_at: new Date(),
          updated_at: new Date()
        }
      })

      return {
        success: true,
        message: '配件添加成功',
        data: { _id: result._id }
      }
    }

    if (action === 'getList') {
      // 获取配件列表
      const { page = 1, pageSize = 20 } = event

      const result = await db.collection('accessories')
        .orderBy('name', 'asc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get()

      return {
        success: true,
        data: result.data
      }
    }

    if (action === 'updateStock') {
      // 更新库存
      const { accessory_id, quantity, type, remark } = event

      // 获取配件信息
      const accessory = await db.collection('accessories').doc(accessory_id).get()

      if (!accessory.data) {
        return { success: false, message: '配件不存在' }
      }

      // 计算新库存
      let newStock
      if (type === 'in') {
        // 入库
        newStock = accessory.data.stock + quantity
      } else if (type === 'out') {
        // 出库
        newStock = accessory.data.stock - quantity
        if (newStock < 0) {
          return { success: false, message: '库存不足' }
        }
      } else {
        return { success: false, message: '未知操作类型' }
      }

      // 更新库存
      await db.collection('accessories').doc(accessory_id).update({
        data: {
          stock: newStock,
          updated_at: new Date()
        }
      })

      // 记录日志
      await db.collection('accessory_logs').add({
        data: {
          accessory_id: accessory_id,
          accessory_name: accessory.data.name,
          type: type, // in/out
          quantity: quantity,
          before_stock: accessory.data.stock,
          after_stock: newStock,
          operator: openid,
          remark: remark || '',
          created_at: new Date()
        }
      })

      return { success: true, message: '库存更新成功' }
    }

    if (action === 'getLogs') {
      // 获取出入库日志
      const { accessory_id, page = 1, pageSize = 20 } = event

      let query = {}
      if (accessory_id) {
        query.accessory_id = accessory_id
      }

      const result = await db.collection('accessory_logs')
        .where(query)
        .orderBy('created_at', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get()

      return {
        success: true,
        data: result.data
      }
    }

    return { success: false, message: '未知操作' }
  } catch (err) {
    console.error('配件操作失败', err)
    return { success: false, message: '操作失败', error: err.message }
  }
}
