export default {
  initial: {
    message: 'Привет',
    commands: [
      [
        {
          name: 'start',
          label: 'Начать',
          color: 'primary',
          handler: async ({ resetData, goToStep }) => {
            await resetData()

            return goToStep('step')
          }
        }
      ]
    ]
  },
  step: {
    message: 'Сообщение',
    commands: []
  }
}
