export default {
  initial: {
    message: 'Здесь можно получить отчет о времени разработки по проектам',
    commands: [
      [
        {
          name: 'start',
          label: 'Начать',
          color: 'primary',
          target: 'choose_interval'
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
          target: 'choose_period'
        },
        {
          name: 'week',
          label: 'Неделя',
          color: 'primary',
          target: 'choose_period'
        },
        {
          name: 'month',
          label: 'Месяц',
          color: 'primary',
          target: 'choose_period'
        }
      ],
      [
        {
          name: 'year',
          label: 'Год',
          color: 'secondary',
          target: 'choose_period'
        },
        {
          name: 'total',
          label: 'Полностью',
          color: 'secondary',
          target: 'start_report_forming'
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
          target: 'start_report_forming'
        },
        {
          name: 'previous',
          label: 'Предыдущий',
          color: 'primary',
          target: 'start_report_forming'
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
