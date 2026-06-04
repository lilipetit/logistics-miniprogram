/**
 * 用户登录云函数
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const { phone, password } = event

  try {
    // 获取 openid
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    // 查询用户
    const userResult = await db.collection('users').where({
      phone: phone
    }).get()

    if (userResult.data.length === 0) {
      return { success: false, message: '用户不存在' }
    }

    const user = userResult.data[0]

    // 验证密码
    if (user.password !== password) {
      return { success: false, message: '密码错误' }
    }

    // 更新 openid（如果用户之前没有）
    if (!user.openid) {
      await db.collection('users').doc(user._id).update({
        data: {
          openid: openid,
          updated_at: new Date()
        }
      })
    }

    return {
      success: true,
      message: '登录成功',
      data: {
        _id: user._id,
        openid: openid,
        phone: user.phone,
        role: user.role,
        name: user.name
      }
    }
  } catch (err) {
    console.error('登录失败', err)
    return { success: false, message: '登录失败', error: err.message }
  }
}
