/**
 * 打印记录云函数
 * 功能：记录打印历史、查询打印记录
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const { action } = event

  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    if (action === 'add') {
      // 添加打印记录
      const { order_id, tracking_no, printer_name, print_type } = event

      const result = await db.collection('print_logs').add({
        data: {
          order_id: order_id,
          tracking_no: tracking_no,
          printer_name: printer_name || '',
          print_type: print_type || 'express_sheet',
          status: 'success',
          operator: openid,
          created_at: new Date()
        }
      })

      return {
        success: true,
        message: '打印记录已保存',
        data: { _id: result._id }
      }
    }

    if (action === 'getList') {
      // 获取打印记录列表
      const { order_id, page = 1, pageSize = 20 } = event

      let query = {}
      if (order_id) {
        query.order_id = order_id
      }

      const result = await db.collection('print_logs')
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
      // 通过运单号查询打印记录
      const { tracking_no } = event

      const result = await db.collection('print_logs')
        .where({ tracking_no: tracking_no })
        .orderBy('created_at', 'desc')
        .get()

      return {
        success: true,
        data: result.data
      }
    }

    return { success: false, message: '未知操作' }
  } catch (err) {
    console.error('打印记录操作失败', err)
    return { success: false, message: '操作失败', error: err.message }
  }
}
