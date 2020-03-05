# Vk Chat Bot
## Schema structure
It's an object of steps, where keys are step name, and values are step schema

```js
{
  initial: {
    message: 'Initial step',
    commands: [
      [
        {
          name: 'start',
          label: 'Start',
          color: 'primary',
          handler: async ({ resetData, goToStep }) => {
            await resetData()

            return goToStep('another_step')
          }
        }
      ]
    ]
  },
  another_step: {
    message: 'Another step',
    commands: [
      [
        {
          name: 'command',
          label: 'Custom command',
          color: 'positive',
          handler: async ({ setData, data, goToStep }) => {
            // get something from data object
            await setData({ param: 'value' })

            return goToStep('one_more_step')
          }
        },
        'system_stepback'
      ]
    ]
  },
  one_more_step: {
    message: 'One more step',
    commands: [
      [
        'system_startover'
      ]
    ]
  }
}
```

So, here `initial`, `another_step`, `one_more_step` are step names.
Let's get closer to
### step schema
It's an object with `message` and `commands` props.
`message` is for text that appears on chat bot response. `commands` is an array of message commands, which are looking like buttons, also they are acceptable as text commands.
#### commands
`name`, `type`, `label`, `color` params are from https://vk.com/dev/bots_docs_3?f=4.%2BКлавиатуры%2Bдля%2Bботов
`handler` is a function that is calling by chat bot on incoming message event from user
```js
({
  data, // is an object with a whole chat bot data related to current user
  setData, // is an async function to update the data
  goToStep, // is an async function that shows another step to user
  resetData // is an async function that makes the data empty
}) => {
  // do something
  return goToStep('next_step')
}
```
