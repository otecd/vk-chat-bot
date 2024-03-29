import request from '@noname.team/helpers/server/request'

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
   * @param {string} env.VK_LONG_POLL_WAIT_TIMEOUT - wait timeout of ling poll request
   */
  constructor (
    schema = {},
    env = {},
    groupEventHandlers = {}
  ) {
    this.schema = prepareSchema(schema)
    this.env = {
      ...env,
      VK_GROUP_ID: +env.VK_GROUP_ID,
      VK_LONG_POLL_WAIT_TIMEOUT: env.VK_LONG_POLL_WAIT_TIMEOUT ? +env.VK_LONG_POLL_WAIT_TIMEOUT : 25
    }
    this.longPollConfig = null
    this.groupEventHandlers = groupEventHandlers
    this.processCommand = this.processCommand.bind(this)
    this.updatesHandler = this.updatesHandler.bind(this)
    this.listen = this.listen.bind(this)
    this.poll = this.poll.bind(this)
  }

  async processCommand ({
    command,
    stepsHistory,
    data,
    userId
  }) {
    const setData = async (oldData = {}, newData = {}) => {
      const totalData = { ...oldData, ...newData }

      try {
        await request(`https://api.vk.com/method/storage.set?key=bot_data&value=${JSON.stringify(totalData)}&user_id=${userId}&access_token=${this.env.VK_GROUP_TOKEN}&v=${this.env.VK_API_VERSION}&lang=${this.env.VK_LANG}`, { method: 'POST' })
      } catch (error) {
        return oldData
      }

      return totalData
    }
    const resetData = () => request(`https://api.vk.com/method/storage.set?key=bot_data&value=&user_id=${userId}&access_token=${this.env.VK_GROUP_TOKEN}&v=${this.env.VK_API_VERSION}&lang=${this.env.VK_LANG}`, { method: 'POST', responseType: 'JSON' })
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
        request(`https://api.vk.com/method/storage.set?key=bot_steps_history&value=${nextStepsHistory.join(',')}&user_id=${userId}&access_token=${this.env.VK_GROUP_TOKEN}&v=${this.env.VK_API_VERSION}&lang=${this.env.VK_LANG}`, { method: 'POST' }),
        request(`https://api.vk.com/method/messages.send?random_id=${Date.now()}&peer_id=${userId}&message=${message}&keyboard=${keyboard}&access_token=${this.env.VK_GROUP_TOKEN}&v=${this.env.VK_API_VERSION}&lang=${this.env.VK_LANG}`, { method: 'POST' })
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
    if (!commandSchema) {
      return
    }

    return commandSchema.handler({
      data,
      setData,
      resetData,
      goToStep
    })
  }

  async updatesHandler ({
    type,
    group_id: groupId,
    object
  } = {}) {
    if (this.groupEventHandlers[type]) {
      this.groupEventHandlers[type](object, this.processCommand)
    }
    switch (type) {
      case 'confirmation':
        return (groupId && +groupId === this.env.VK_GROUP_ID) && this.env.VK_CHAT_BOT_CONFIRMATION_DATA
      case 'message_new': {
        const userId = object.message.peer_id || object.message.user_id
        const storageDataResponse = await request(`https://api.vk.com/method/storage.get?user_id=${userId}&keys=bot_steps_history,bot_data&access_token=${this.env.VK_GROUP_TOKEN}&v=${this.env.VK_API_VERSION}&lang=${this.env.VK_LANG}`, { method: 'POST', responseType: 'JSON' })
        const storageData = (storageDataResponse.response || []).reduce((r, { key, value }) => ({ ...r, [key]: value }), {})
        const stepsHistory = storageData.bot_steps_history
          .split(',')
          .filter(s => s)
        const data = storageData.bot_data ? JSON.parse(storageData.bot_data) : {}
        const payload = object.message.payload ? JSON.parse(object.message.payload) : {}
        const command = payload.command || object.message.text || ''

        await this.processCommand({
          command,
          stepsHistory,
          data,
          userId
        })
        break
      }
      default:
        break
    }

    return 'ok'
  }

  async listen (event = {}) {
    const response = {
      statusCode: 200,
      headers: { 'Content-Type': 'text/plain' },
      isBase64Encoded: false,
      body: 'ok'
    }

    if (event.httpMethod === 'POST' && event.body) {
      const requestBody = JSON.parse(event.body)

      if (requestBody.secret === this.env.VK_CHAT_BOT_SECRET) {
        response.body = await this.updatesHandler(requestBody)

        return response
      }
    }

    return {
      ...response,
      statusCode: 400,
      body: 'error'
    }
  }

  async poll () {
    if (!this.longPollConfig) {
      await this.initLongPoll()
    }

    try {
      const response = await request(`${this.longPollConfig.server}?act=a_check&key=${this.longPollConfig.key}&ts=${this.longPollConfig.ts}&wait=${this.env.VK_LONG_POLL_WAIT_TIMEOUT}`, { responseType: 'JSON' })

      if (response.failed && response.failed > 1) {
        this.longPollConfig = null
      } else {
        this.longPollConfig.ts = response.ts
        response.updates.forEach(this.updatesHandler)
      }
    } catch (error) {
    }

    return this.poll()
  }

  async initLongPoll () {
    const getLongPollServerResponse = await request(`https://api.vk.com/method/groups.getLongPollServer?group_id=${this.env.VK_GROUP_ID}&access_token=${this.env.VK_GROUP_TOKEN}&v=${this.env.VK_API_VERSION}`, { method: 'POST', responseType: 'JSON' })
    const { response, error } = getLongPollServerResponse || {}

    if (response) {
      this.longPollConfig = response
    } else {
      throw new Error(error ? error.error_msg : 'Error is happened while vk long poll server initializing')
    }
  }
}
