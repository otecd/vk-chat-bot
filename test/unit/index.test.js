import VkChatBot, { prepareSchema } from '../../src/vk-chat-bot'

describe('Unit / vk-chat-bot', () => {
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
})
