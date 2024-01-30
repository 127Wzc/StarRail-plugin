import fetch from 'node-fetch'
import _ from 'lodash'
import moment from 'moment'
import User from '../../genshin/model/user.js'
import MysSRApi from '../runtime/MysSRApi.js'
import setting from '../utils/setting.js'
import { getCk, rulePrefix } from '../utils/common.js'
import runtimeRender from '../common/runtimeRender.js'
import GsCfg from '../../genshin/model/gsCfg.js'

export class Challenge extends plugin {
  constructor (e) {
    super({
      name: '星铁plugin-深渊',
      dsc: '星穹铁道深渊信息',
      /** https://oicqjs.github.io/oicq/#events */
      event: 'message',
      priority: setting.getConfig('gachaHelp').noteFlag ? 5 : 500,
      rule: [
        {
          reg: `^${rulePrefix}(上期|本期)?(深渊|忘却|忘却之庭|混沌|混沌回忆)$`,
          fnc: 'challenge'
        },
        {
          reg: `^${rulePrefix}(上期|本期)?(虚构|虚构叙事)$`,
          fnc: 'challengeStory'
        }
      ]
    })
    this.User = new User(e)
  }

  async challenge (e) {
    this.e.isSr = true
    this.isSr = true
    let user = this.e.user_id
    let ats = e.message.filter(m => m.type === 'at')
    if (ats.length > 0 && !e.atBot) {
      user = ats[0].qq
      this.e.user_id = user
      this.User = new User(this.e)
    }

    let uid = e.msg.match(/\d+/)?.[0]
    await this.miYoSummerGetUid()
    uid = uid || (await redis.get(`STAR_RAILWAY:UID:${user}`)) || this.e.user?.getUid('sr')
    if (!uid) {
      await e.reply('尚未绑定uid,请发送#星铁绑定uid进行绑定')
      return false
    }

    let ck = await getCk(e)
    if (!ck || Object.keys(ck).filter(k => ck[k].ck).length === 0) {
      let ckArr = GsCfg.getConfig('mys', 'pubCk') || []
      ck = ckArr[0]
    }
    if (!ck) {
      await e.reply(`尚未绑定Cookie,${this.app2config.docs}`)
      return false
    }

    let scheduleType = '1'
    if (e.msg.indexOf('上期') > -1) {
      scheduleType = '2'
    }

    let api = new MysSRApi(uid, ck)
    let sdk = api.getUrl('getFp')
    let fpRes = await fetch(sdk.url, { headers: sdk.headers, method: 'POST', body: sdk.body })
    fpRes = await fpRes.json()
    let deviceFp = fpRes?.data?.device_fp
    if (deviceFp) {
      await redis.set(`STARRAIL:DEVICE_FP:${uid}`, deviceFp, { EX: 86400 * 7 })
    }
    // 先查simple，大概率simple不出验证码，详细才出
    let simpleRes = await api.getData('srChallengeSimple', { deviceFp, schedule_type: scheduleType })
    simpleRes = await api.checkCode(this.e, simpleRes, 'srChallengeSimple', { deviceFp, schedule_type: scheduleType })
    if (simpleRes.retcode !== 0) {
      // 连简单也出验证码，打住
      return false
    }
    let challengeData = simpleRes
    // 简单的没出验证码，试一下复杂的
    let res = await api.getData('srChallenge', { deviceFp, schedule_type: scheduleType })
    res = await api.checkCode(this.e, res, 'srChallenge', { deviceFp, schedule_type: scheduleType })
    let retcode = Number(res.retcode)
    if (retcode === 0) {
      challengeData = res
    } else {
      logger.warn('星铁忘却之庭详细信息出现验证码，仅显示最后一层信息')
    }
    // await api.checkCode(this.e, challengeData, 'srNote')
    // if (challengeData.retcode !== 0) {
    //   return false
    // }
    const data = { ...challengeData.data }
    data.beginTime = this.timeForamt(data.begin_time)
    data.endTime = this.timeForamt(data.end_time)
    data.all_floor_detail = _.map(data.all_floor_detail, (floor) => {
      return {
        ...floor,
        node_1: {
          ...floor.node_1,
          challengeTime: this.timeForamt(floor.node_1.challenge_time, 'YYYY.MM.DD HH:mm')
        },
        node_2: {
          ...floor.node_2,
          challengeTime: this.timeForamt(floor.node_2.challenge_time, 'YYYY.MM.DD HH:mm')
        }
      }
    })

    await runtimeRender(e, '/challenge/index.html', {
      data,
      uid,
      type: scheduleType
    })
  }

  async challengeStory (e) {
    this.e.isSr = true
    this.isSr = true
    let user = this.e.user_id
    let ats = e.message.filter(m => m.type === 'at')
    if (ats.length > 0 && !e.atBot) {
      user = ats[0].qq
      this.e.user_id = user
      this.User = new User(this.e)
    }

    let uid = e.msg.match(/\d+/)?.[0]
    await this.miYoSummerGetUid()
    uid = uid || (await redis.get(`STAR_RAILWAY:UID:${user}`)) || this.e.user?.getUid('sr')
    if (!uid) {
      await e.reply('尚未绑定uid,请发送#星铁绑定uid进行绑定')
      return false
    }

    let ck = await getCk(e)
    if (!ck || Object.keys(ck).filter(k => ck[k].ck).length === 0) {
      let ckArr = GsCfg.getConfig('mys', 'pubCk') || []
      ck = ckArr[0]
    }
    if (!ck) {
      await e.reply(`尚未绑定Cookie,${this.app2config.docs}`)
      return false
    }

    let scheduleType = '1'
    if (e.msg.indexOf('上期') > -1) {
      scheduleType = '2'
    }

    let api = new MysSRApi(uid, ck)
    let sdk = api.getUrl('getFp')
    let fpRes = await fetch(sdk.url, { headers: sdk.headers, method: 'POST', body: sdk.body })
    fpRes = await fpRes.json()
    let deviceFp = fpRes?.data?.device_fp
    if (deviceFp) {
      await redis.set(`STARRAIL:DEVICE_FP:${uid}`, deviceFp, { EX: 86400 * 7 })
    }
    // 先查simple，大概率simple不出验证码，详细才出
    let simpleRes = await api.getData('srChallengeStorySimple', { deviceFp, schedule_type: scheduleType })
    simpleRes = await api.checkCode(this.e, simpleRes, 'srChallengeStorySimple', { deviceFp, schedule_type: scheduleType })
    if (simpleRes.retcode !== 0) {
      // 连简单也出验证码，打住
      return false
    }
    let challengeData = simpleRes
    // 简单的没出验证码，试一下复杂的
    let res = await api.getData('srChallengeStory', { deviceFp, schedule_type: scheduleType })
    res = await api.checkCode(this.e, res, 'srChallengeStory', { deviceFp, schedule_type: scheduleType })
    let retcode = Number(res.retcode)
    if (retcode === 0) {
      challengeData = res
    } else {
      logger.warn('星铁虚构叙事详细信息出现验证码，仅显示最后一层信息')
    }
    // await api.checkCode(this.e, challengeData, 'srNote')
    // if (challengeData.retcode !== 0) {
    //   return false
    // }
    const data = { ...challengeData.data }
    // data.beginTime = this.timeForamt(data.begin_time)
    // data.endTime = this.timeForamt(data.end_time)
    data.beginTime = this.timeForamt(data.groups[0].begin_time)
    data.endTime = this.timeForamt(data.groups[0].end_time)
    data.all_floor_detail = _.map(data.all_floor_detail, (floor) => {
      return {
        ...floor,
        node_1: {
          ...floor.node_1,
          challengeTime: this.timeForamt(floor.node_1.challenge_time, 'YYYY.MM.DD HH:mm')
        },
        node_2: {
          ...floor.node_2,
          challengeTime: this.timeForamt(floor.node_2.challenge_time, 'YYYY.MM.DD HH:mm')
        }
      }
    })
    // 虚构叙事：计算两边节点的总分
    data.all_floor_detail = _.map(data.all_floor_detail, (floor) => {
      return {
        ...floor,
        score: (parseInt(floor.node_1.score) + parseInt(floor.node_2.score)).toString(),
      }
    })
    await runtimeRender(e, '/challengestory/index.html', {
      data,
      uid,
      type: scheduleType
    })
  }

  async miYoSummerGetUid () {
    let key = `STAR_RAILWAY:UID:${this.e.user_id}`
    let ck = await getCk(this.e)
    if (!ck) return false
    // if (await redis.get(key)) return false
    // todo check ck
    let api = new MysSRApi('', ck)
    let userData = await api.getData('srUser')
    if (!userData?.data || _.isEmpty(userData.data.list)) return false
    userData = userData.data.list[0]
    let { game_uid: gameUid } = userData
    await redis.set(key, gameUid)
    await redis.setEx(
        `STAR_RAILWAY:userData:${gameUid}`,
        60 * 60,
        JSON.stringify(userData)
    )
    return userData
  }

  timeForamt (timeObj, format = 'YYYY.MM.DD') {
    const { year, month, day, hour, minute } = timeObj
    return moment({
      year,
      month: month - 1,
      day,
      hour,
      minute
    }).format(format)
  }

  get app2config () {
    return setting.getConfig('cookieHelp')
  }
}
