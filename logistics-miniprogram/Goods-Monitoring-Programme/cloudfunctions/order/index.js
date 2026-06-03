/**
 * 订单管理云函数
 * 功能：创建订单、查询订单、更新订单状态、生成运单号
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

/**
 * 生成运单号
 */
function generateTrackingNo() {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `XS${timestamp}${random}`
}

/**
 * 创建订单
 */
exports.main = async (event, context) => {
  const { action } = event

  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    if (action === 'create') {
      // 创建新订单
      const {
        sender_name, sender_phone, sender_address,
        receiver_name, receiver_phone, receiver_address,
        goods_name, goods_weight, goods_volume,
        remarks, payment_method, freight
      } = event

      const trackingNo = generateTrackingNo()

      const result = await db.collection('orders').add({
        data: {
          tracking_no: trackingNo,
          openid: openid,
          user_id: '', // 稍后填充
          status: 'pending', // pending/picked_up/in_transit/delivered/completed/cancelled
          sender: {
            name: sender_name,
            phone: sender_phone,
            address: sender_address
          },
          receiver: {
            name: receiver_name,
            phone: receiver_phone,
            address: receiver_address
          },
          goods: {
            name: goods_name,
            weight: goods_weight || 0,
            volume: goods_volume || 0
          },
          payment_method: payment_method || 'pay_on_delivery',
          freight: freight || 0,
          remarks: remarks || '',
          courier_id: '',
          courier_name: '',
          created_at: new Date(),
          updated_at: new Date()
        }
      })

      // 添加轨迹记录
      await db.collection('order_tracking').add({
        data: {
          order_id: result._id,
          tracking_no: trackingNo,
          status: 'pending',
          location: sender_address,
          description: '订单已创建，等待揽收',
          operator: '',
          created_at: new Date()
        }
      })

      return {
        success: true,
        message: '订单创建成功',
        data: {
          _id: result._id,
          tracking_no: trackingNo
        }
      }
    }

    if (action === 'getList') {
      // 获取订单列表
      const { status, page = 1, pageSize = 10 } = event

      let query = {}
      if (status) {
        query.status = status
      }

      const result = await db.collection('orders')
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

    if (action === 'getByTrackingNo') {
      // 通过运单号查询
      const { tracking_no } = event

      const result = await db.collection('orders').where({
        tracking_no: tracking_no
      }).get()

      if (result.data.length === 0) {
        return { success: false, message: '订单不存在' }
      }

      // 获取轨迹
      const tracking = await db.collection('order_tracking')
        .where({ order_id: result.data[0]._id })
        .orderBy('created_at', 'asc')
        .get()

      return {
        success: true,
        data: {
          ...result.data[0],
          tracking_list: tracking.data
        }
      }
    }

    if (action === 'updateStatus') {
      // 更新订单状态
      const { order_id, status, location, description } = event

      await db.collection('orders').doc(order_id).update({
        data: {
          status: status,
          updated_at: new Date()
        }
      })

      // 添加轨迹
      await db.collection('order_tracking').add({
        data: {
          order_id: order_id,
          status: status,
          location: location || '',
          description: description,
          operator: openid,
          created_at: new Date()
        }
      })

      return { success: true, message: '状态更新成功' }
    }

    if (action === 'assignCourier') {
      // 分配快递员
      const { order_id, courier_id, courier_name } = event

      await db.collection('orders').doc(order_id).update({
        data: {
          courier_id: courier_id,
          courier_name: courier_name,
          updated_at: new Date()
        }
      })

      return { success: true, message: '快递员分配成功' }
    }

    return { success: false, message: '未知操作' }
  } catch (err) {
    console.error('订单操作失败', err)
    return { success: false, message: '操作失败', error: err.message }
  }
}
