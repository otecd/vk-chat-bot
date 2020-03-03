import fetch from 'node-fetch'

const fetchPost = async (url, options) => {
  const res = await fetch(url, { ...options, method: 'POST' })

  return res.json()
}
const {
  VK_GROUP_ID,
  VK_GROUP_TOKEN,
  VK_API_VERSION = '5.103',
  VK_LANG = 'ru',
  VK_CHAT_BOT_CONFIRMATION_DATA,
  VK_CHAT_BOT_SECRET,
  DEBUG
} = process.env

export const prepareSchema = (schema) => {
  const system = {
    commands: {
      stepback: {
        name: 'stepback',
        label: 'Шаг назад',
        color: 'negative'
      },
      startover: {
        name: 'startover',
        label: 'В начало',
        color: 'negative'
      }
    },
    steps: {
      system_stepback: {
        message: 'Точно?',
        commands: [
          [{
            name: 'no',
            label: 'Нет',
            color: 'secondary'
          }, {
            name: 'yes',
            label: 'Да',
            color: 'negative'
          }]
        ]
      },
      system_startover: {
        message: 'Точно?',
        commands: [
          [{
            name: 'no',
            label: 'Нет',
            color: 'secondary'
          }, {
            name: 'yes',
            label: 'Да',
            color: 'negative'
          }]
        ]
      }
    }
  }
  const resultSchema = { ...schema, ...system.steps }

  Object.entries(schema)
    .forEach(([stepName, { commands }]) => {
      commands.forEach((group, i) => {
        group.forEach((command, j) => {
          if (typeof command === 'string' && command.startsWith('system')) {
            const systemCommand = command.replace('system_', '')

            resultSchema[stepName].commands[i][j] = { ...system.commands[systemCommand], handler: () => `system_${systemCommand}` }
          }
        })
      })
    })

  return resultSchema
}

export default class VkChatBot {
  constructor (schema = {}) {
    this.schema = prepareSchema(schema)
    this.processCommand = this.processCommand.bind(this)
    this.listen = this.listen.bind(this)
  }

  processCommand (command, stepsHistory) {
    return {}
  }

  async listen (event, ctx) {
    const ycToken = ctx.token
    const response = {
      statusCode: 200,
      headers: { 'Content-Type': 'text/plain' },
      isBase64Encoded: false,
      body: 'ok'
    }

    if (event.httpMethod === 'POST' && event.body) {
      const requestBody = JSON.parse(event.body)

      if (requestBody.secret === VK_CHAT_BOT_SECRET) {
        switch (requestBody.type) {
          case 'confirmation':
            if (requestBody.group_id && +requestBody.group_id === +VK_GROUP_ID) {
              response.body = VK_CHAT_BOT_CONFIRMATION_DATA
            }
            break
          case 'message_new': {
            const messageError = 'Произошла ошибка, повторите предыдущий шаг, пожалуйста'
            const peerId = requestBody.object.message.peer_id || requestBody.object.message.user_id
            const handleError = async (error) => {
              if (DEBUG) {
                await fetchPost(`https://api.vk.com/method/messages.send?random_id=${Date.now()}&peer_id=${peerId}&message=${'error ' + error.message}&access_token=${VK_GROUP_TOKEN}&v=${VK_API_VERSION}&lang=${VK_LANG}`)
              } else {
                await fetchPost(`https://api.vk.com/method/storage.set?key=bot_steps_history&value=&user_id=${peerId}&access_token=${VK_GROUP_TOKEN}&v=${VK_API_VERSION}&lang=${VK_LANG}`)
                await fetchPost(`https://api.vk.com/method/messages.send?random_id=${Date.now()}&peer_id=${peerId}&message=${messageError}&keyboard=&access_token=${VK_GROUP_TOKEN}&v=${VK_API_VERSION}&lang=${VK_LANG}`)
              }
            }
            let storageData

            try {
              const storageDataResponse = await fetchPost(`https://api.vk.com/method/storage.get?user_id=${peerId}&keys=bot_steps_history,bot_data&access_token=${VK_GROUP_TOKEN}&v=${VK_API_VERSION}&lang=${VK_LANG}`)
              storageData = storageDataResponse.reduce((r, { key, value }) => ({ ...r, [key]: value }), {})
            } catch (error) {
              handleError(error)
            }

            const stepsHistory = storageData.bot_steps_history
              .split(',')
              .filter(s => s)
            const data = storageData.bot_data ? JSON.parse(storageData.bot_data) : {}
            const payload = requestBody.object.message.payload ? JSON.parse(requestBody.object.message.payload) : {}
            const command = payload.command || requestBody.object.message.text
            const { message, buttons, nextStep } = this.processCommand(command, stepsHistory)
            const keyboard = buttons && JSON.stringify({ buttons, one_time: !buttons.length })
            const nextStepsHistory = stepsHistory.concat(nextStep)

            if (DEBUG) {
              fetchPost(`https://api.vk.com/method/messages.send?random_id=${Date.now()}&peer_id=${peerId}&message=${
                ' stepsHistory ' + JSON.stringify(stepsHistory) +
                ' payload ' + JSON.stringify(payload) +
                ' message ' + JSON.stringify(message) +
                ' buttons ' + JSON.stringify(buttons) +
                ' keyboard ' + JSON.stringify(keyboard) +
                ' !buttons.length ' + JSON.stringify(!buttons.length)
              }&access_token=${VK_GROUP_TOKEN}&v=${VK_API_VERSION}&lang=${VK_LANG}`)
            }
            fetchPost(`https://api.vk.com/method/storage.set?key=bot_steps_history&value=${nextStepsHistory.join(',')}&user_id=${peerId}&access_token=${VK_GROUP_TOKEN}&v=${VK_API_VERSION}&lang=${VK_LANG}`)
            fetchPost(`https://api.vk.com/method/messages.send?random_id=${Date.now()}&peer_id=${peerId}&message=${message}&keyboard=${keyboard}&access_token=${VK_GROUP_TOKEN}&v=${VK_API_VERSION}&lang=${VK_LANG}`)
            break
          }
          default:
            break
        }

        return response
      }
    }

    return {
      ...response,
      statusCode: 400,
      body: 'error'
    }
  }
}
