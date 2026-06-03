/**
 * 用户认证云函数
 * 功能：注册、登录、获取用户信息
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

/**
 * 用户注册
 */
exports.main = async (event, context) => {
  const { phone, password, role, name } = event

  try {
    // 检查手机号是否已注册
    const existUser = await db.collection('users').where({
      phone: phone
    }).get()

    if (existUser.data.length > 0) {
      return { success: false, message: '手机号已注册' }
    }

    // 获取 openid
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    // 创建用户
    const result = await db.collection('users').add({
      data: {
        openid: openid,
        phone: phone,
        password: password, // 生产环境应该加密
        role: role || 'user', // user/courier/admin
        name: name || '',
        created_at: new Date(),
        updated_at: new Date()
      }
    })

    return {
      success: true,
      message: '注册成功',
      data: {
        _id: result._id,
        openid: openid,
        phone: phone,
        role: role || 'user'
      }
    }
  } catch (err) {
    console.error('注册失败', err)
    return { success: false, message: '注册失败', error: err.message }
  }
}
