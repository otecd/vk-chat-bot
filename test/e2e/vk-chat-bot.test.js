/* eslint-disable no-unused-expressions */
import sinon from 'sinon'
import { rewiremock } from '../rewiremock.es6'
import schema from '../fixtures/chat-bot-schema'

describe('E2E / VkChatBot', function () {
  let VkChatBot
  let stubs = {}

  this.timeout(6000)
  beforeEach(async () => {
    stubs.nodeFetchJson = sinon.fake.resolves([
      { key: 'bot_steps_history', value: '' },
      { key: 'bot_data', value: '' }
    ])
    stubs.nodeFetch = sinon.fake.resolves({ json: stubs.nodeFetchJson })

    const module = await rewiremock.module(() => import('../../src/vk-chat-bot'), () => {
      rewiremock(() => import('node-fetch'))
        .withDefault(stubs.nodeFetch)
    })

    rewiremock.enable()
    VkChatBot = module.default
  })
  afterEach(() => {
    stubs = {}
    rewiremock.disable()
  })

  describe('send response on user input', () => {
    it('at very start', async () => {
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

      await bot.listen({
        httpMethod: 'POST',
        body: JSON.stringify({
          secret: vkChatBotSecret,
          type: 'message_new',
          group_id: `${vkGroupId}`,
          object: { message: { peer_id: userId } }
        })
      })

      expect(stubs.nodeFetch.callCount).to.be.equal(3)
      expect(stubs.nodeFetch.calledWith(`https://api.vk.com/method/storage.get?user_id=${userId}&keys=bot_steps_history,bot_data&access_token=${vkGroupToken}&v=${vkApiVersion}&lang=${vkLang}`)).to.be.true
      expect(stubs.nodeFetch.calledWith(`https://api.vk.com/method/storage.set?key=bot_steps_history&value=initial&user_id=${userId}&access_token=${vkGroupToken}&v=${vkApiVersion}&lang=${vkLang}`)).to.be.true
    })
  })
})
