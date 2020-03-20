import request from '@noname.team/helpers/server/request'

const fetchPost = async (url, options = {}) => {
  const res = await request(url, { ...options, method: 'POST' })

  return JSON.parse(res)
}

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

            resultSchema[stepName].commands[i][j] = { ...system.commands[systemCommand], handler: ({ goToStep }) => goToStep(`system_${systemCommand}`) }
          }
        })
      })
    })

  return resultSchema
}

export default class VkChatBot {
  /**
   * @constructor
   * @param {Object} schema - source schema of vk chat bot.
   * @param {Object} env - env variables.
   * @param {number} env.VK_GROUP_ID - vk group connected to this bot
   * @param {string} env.VK_GROUP_TOKEN - secret token of vk group
   * @param {?string} [env.VK_API_VERSION] - 5.103 is the latest version
   * @param {?string} [env.VK_LANG] - should be equal to ru or something
   * @param {string} env.VK_CHAT_BOT_CONFIRMATION_DATA - unique string from vk chat bot settings which is necessary on confirmation event
   * @param {string} env.VK_CHAT_BOT_SECRET - secret string of vk chat bot
   */
  constructor (schema = {}, env = {}) {
    this.schema = prepareSchema(schema)
    this.env = env
    this.processCommand = this.processCommand.bind(this)
    this.listen = this.listen.bind(this)
  }

  async processCommand ({
    command,
    stepsHistory,
    data,
    userId,
    ycToken
  }) {
    const setData = async (oldData, newData) => {
      const totalData = { ...oldData, ...newData }

      try {
        await fetchPost(`https://api.vk.com/method/storage.set?key=bot_data&value=${JSON.stringify(totalData)}&user_id=${userId}&access_token=${this.env.VK_GROUP_TOKEN}&v=${this.env.VK_API_VERSION}&lang=${this.env.VK_LANG}`)
      } catch (error) {
        return oldData
      }

      return totalData
    }
    const resetData = () => fetchPost(`https://api.vk.com/method/storage.set?key=bot_data&value=&user_id=${userId}&access_token=${this.env.VK_GROUP_TOKEN}&v=${this.env.VK_API_VERSION}&lang=${this.env.VK_LANG}`)
    const prepareNextStep = (nextStep, nextStepsHistory) => {
      const { message = '', commands = [] } = this.schema[nextStep]
      const buttons = commands.map(group => (group || []).map(commandData => ({
        action: {
          type: commandData.type || 'text',
          payload: JSON.stringify({ command: commandData.name }),
          label: commandData.label || 'Command'
        },
        color: commandData.color || 'secondary'
      })))
      const keyboard = buttons && JSON.stringify({ buttons, one_time: !buttons.length })

      return Promise.all([
        fetchPost(`https://api.vk.com/method/storage.set?key=bot_steps_history&value=${nextStepsHistory.join(',')}&user_id=${userId}&access_token=${this.env.VK_GROUP_TOKEN}&v=${this.env.VK_API_VERSION}&lang=${this.env.VK_LANG}`),
        fetchPost(`https://api.vk.com/method/messages.send?random_id=${Date.now()}&peer_id=${userId}&message=${message}&keyboard=${keyboard}&access_token=${this.env.VK_GROUP_TOKEN}&v=${this.env.VK_API_VERSION}&lang=${this.env.VK_LANG}`)
      ])
    }
    const goToStep = (nextStep) => {
      const nextStepsHistory = stepsHistory.concat(nextStep)

      return prepareNextStep(nextStep, nextStepsHistory)
    }
    const goToPreviousStep = (commandToStepBackAmount) => {
      const nextStepsHistory = stepsHistory.slice(0, 0 - commandToStepBackAmount)

      return prepareNextStep(nextStepsHistory[nextStepsHistory.length - 1], nextStepsHistory)
    }
    const goToInitialStep = () => {
      const nextStepsHistory = stepsHistory.slice(0, 0)
        .concat('initial')

      return prepareNextStep(nextStepsHistory[nextStepsHistory.length - 1], nextStepsHistory)
    }
    const currentStep = stepsHistory.length && stepsHistory[stepsHistory.length - 1]
    let commandSchema

    if (!currentStep) {
      return goToInitialStep()
    }

    if (currentStep === 'system_stepback') {
      const commandToStepBackAmounts = { yes: 2, no: 1 }

      return goToPreviousStep(commandToStepBackAmounts[command])
    }

    if (currentStep === 'system_startover') {
      switch (command) {
        case 'yes':
          return goToInitialStep()
        case 'no':
        default:
          return goToPreviousStep(1)
      }
    }

    this.schema[currentStep].commands.find((group) => {
      if (commandSchema) {
        return true
      }

      commandSchema = group.find((c) => c.name === command)

      return false
    })

    return (commandSchema || {}).handler({
      data,
      setData,
      resetData,
      ycToken,
      goToStep
    })
  }

  async listen (event = {}, ctx = {}) {
    const ycToken = ctx.token
    const response = {
      statusCode: 200,
      headers: { 'Content-Type': 'text/plain' },
      isBase64Encoded: false,
      body: 'ok'
    }

    if (event.httpMethod === 'POST' && event.body) {
      const requestBody = JSON.parse(event.body)

      if (requestBody.secret === this.env.VK_CHAT_BOT_SECRET) {
        switch (requestBody.type) {
          case 'confirmation':
            if (requestBody.group_id && +requestBody.group_id === +this.env.VK_GROUP_ID) {
              response.body = this.env.VK_CHAT_BOT_CONFIRMATION_DATA
            }
            break
          case 'message_new': {
            const userId = requestBody.object.message.peer_id || requestBody.object.message.user_id
            const storageDataResponse = await fetchPost(`https://api.vk.com/method/storage.get?user_id=${userId}&keys=bot_steps_history,bot_data&access_token=${this.env.VK_GROUP_TOKEN}&v=${this.env.VK_API_VERSION}&lang=${this.env.VK_LANG}`)
            const storageData = (storageDataResponse.response || []).reduce((r, { key, value }) => ({ ...r, [key]: value }), {})
            const stepsHistory = storageData.bot_steps_history
              .split(',')
              .filter(s => s)
            const data = storageData.bot_data ? JSON.parse(storageData.bot_data) : {}
            const payload = requestBody.object.message.payload ? JSON.parse(requestBody.object.message.payload) : {}
            const command = payload.command || requestBody.object.message.text || ''

            await this.processCommand({
              command,
              stepsHistory,
              data,
              userId,
              ycToken
            })
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
