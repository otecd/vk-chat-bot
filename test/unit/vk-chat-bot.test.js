/* eslint-disable no-unused-expressions */
import { rewiremock } from '../rewiremock.es6'
import schema from '../fixtures/chat-bot-schema'

describe('Unit / vk-chat-bot', function () {
  let VkChatBot
  let prepareSchema

  this.timeout(6000)
  beforeEach(async () => {
    const module = await rewiremock.module(() => import('../../src/vk-chat-bot'), () => {
      rewiremock(() => import('@noname.team/helpers/for/server'))
        .with({
          request: () => Promise.resolve(JSON.stringify([
            { key: 'bot_steps_history', value: '' },
            { key: 'bot_data', value: '' }
          ]))
        })
    })

    rewiremock.enable()
    VkChatBot = module.default
    prepareSchema = module.prepareSchema
  })
  afterEach(() => {
    rewiremock.disable()
  })

  it('exports the VkChatBot class by default', () => {
    const bot = new VkChatBot()

    expect(bot).to.be.an.instanceOf(VkChatBot)
  })
  it('prepares a working schema from source schema', () => {
    const testStepHandler = () => 'another_step'
    const botSchema = prepareSchema({
      test_step: {
        message: 'Test message',
        commands: [
          [
            {
              name: 'start',
              label: 'Начать',
              color: 'primary',
              handler: testStepHandler
            }
          ]
        ]
      }
    })

    expect(botSchema).to.deep.equal({
      test_step: {
        message: 'Test message',
        commands: [
          [
            {
              name: 'start',
              label: 'Начать',
              color: 'primary',
              handler: testStepHandler
            }
          ]
        ]
      },
      system_stepback: {
        message: 'Точно?',
        commands: [
          [
            {
              name: 'no',
              label: 'Нет',
              color: 'secondary'
            },
            {
              name: 'yes',
              label: 'Да',
              color: 'negative'
            }
          ]
        ]
      },
      system_startover: {
        message: 'Точно?',
        commands: [
          [
            {
              name: 'no',
              label: 'Нет',
              color: 'secondary'
            },
            {
              name: 'yes',
              label: 'Да',
              color: 'negative'
            }
          ]
        ]
      }
    })
  })

  describe('listen vk chat bot events', () => {
    it('confirmation', async () => {
      const vkChatBotSecret = 'test'
      const vkChatBotConfirmationData = 'conf'
      const vkGroupId = 123
      const bot = new VkChatBot(schema, {
        VK_CHAT_BOT_SECRET: vkChatBotSecret,
        VK_GROUP_ID: vkGroupId,
        VK_CHAT_BOT_CONFIRMATION_DATA: vkChatBotConfirmationData
      })
      const response = await bot.listen({
        httpMethod: 'POST',
        body: JSON.stringify({
          secret: vkChatBotSecret,
          type: 'confirmation',
          group_id: `${vkGroupId}`
        })
      })

      expect(response).to.deep.equal({
        statusCode: 200,
        headers: { 'Content-Type': 'text/plain' },
        isBase64Encoded: false,
        body: 'conf'
      })
    })
    it('message_new', async () => {
      const vkChatBotSecret = 'test'
      const vkGroupToken = 'token'
      const vkApiVersion = '5.103'
      const vkLang = 'ru'
      const vkGroupId = 123
      const userId = 12
      const bot = new VkChatBot(schema, {
        VK_CHAT_BOT_SECRET: vkChatBotSecret,
        VK_API_VERSION: vkApiVersion,
        VK_GROUP_TOKEN: vkGroupToken,
        VK_GROUP_ID: vkGroupId,
        VK_LANG: vkLang
      })
      const response = await bot.listen({
        httpMethod: 'POST',
        body: JSON.stringify({
          secret: vkChatBotSecret,
          type: 'message_new',
          group_id: `${vkGroupId}`,
          object: { message: { peer_id: userId } }
        })
      })

      expect(response).to.deep.equal({
        statusCode: 200,
        headers: { 'Content-Type': 'text/plain' },
        isBase64Encoded: false,
        body: 'ok'
      })
    })
  })
})
