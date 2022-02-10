'use strict'

const { Spinner } = require('cli-spinner')

/**
 * 控制台loading
 * @param { string } msg - loading文字
 * @param { string | numnber } spinnerString - 设置微调器字符串,1-20内置
 */
function spinner(msg = '正在加载中...', spinnerString = 15) {
  const spinner = new Spinner(msg + ' %s')
  spinner.setSpinnerString(spinnerString)
  spinner.start()
  return spinner
}

module.exports = spinner
