/**
 * Procedure for a time report calculating
 * @param {Object} params
 * @param {string} params.interval - time interval to return
 * @param {string} params.period - which period to choose
 * @param {boolean} byEmployees - if true, then return complex report by projects and employees, otherwise just return total hours per projects.
 */
const formReport = async (params, byEmployees = false) => {
  return {}
}
const getChooseIntervalHandler = (interval) => async ({ setData, goToStep }) => {
  await setData({ interval })

  return goToStep('choose_period')
}
const startReportForming = async ({ setData, goToStep }) => {
  const totalData = setData({ interval: 'year', period: 'total' })

  await goToStep('start_report_forming')
  await formReport(totalData)

  return goToStep('inform_about_report')
}

export default {
  initial: {
    message: 'Здесь можно получить отчет о времени разработки по проектам',
    commands: [
      [
        {
          name: 'start',
          label: 'Начать',
          color: 'primary',
          handler: async ({ resetData, goToStep }) => {
            await resetData()

            return goToStep('choose_interval')
          }
        }
      ]
    ]
  },
  choose_interval: {
    message: 'Выберите временной интервал',
    commands: [
      [
        {
          name: 'day',
          label: 'День',
          color: 'primary',
          handler: getChooseIntervalHandler('day')
        },
        {
          name: 'week',
          label: 'Неделя',
          color: 'primary',
          handler: getChooseIntervalHandler('week')
        },
        {
          name: 'month',
          label: 'Месяц',
          color: 'primary',
          handler: getChooseIntervalHandler('month')
        }
      ],
      [
        {
          name: 'year',
          label: 'Год',
          color: 'secondary',
          handler: getChooseIntervalHandler('year')
        },
        {
          name: 'total',
          label: 'Полностью',
          color: 'secondary',
          handler: startReportForming
        }
      ]
    ]
  },
  choose_period: {
    message: 'Какой период интересует?',
    commands: [
      [
        {
          name: 'current',
          label: 'Текущий',
          color: 'primary',
          handler: startReportForming
        },
        {
          name: 'previous',
          label: 'Предыдущий',
          color: 'primary',
          handler: startReportForming
        },
        'system_stepback'
      ]
    ]
  },
  start_report_forming: {
    message: 'Формирование отчета. Ожидайте',
    commands: []
  },
  inform_about_report: {
    message: 'Отчет готов',
    commands: [
      [
        'system_startover'
      ]
    ]
  }
}
