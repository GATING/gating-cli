const fs = require('fs')
const editor = require('editor')
const temp = require('temp').track()
const inquirer = require('inquirer')
const findConfig = require('find-config')
const buildCommit = require('cz-customizable/buildCommit')

const log = require('@gating-cli/log')
const { get } = require('@gating-cli/utils')

const CZ_CONFIG_NAME = '.cz-config.js'

const readConfigFile = () => {
  // First try to find the .cz-config.js config file
  const czConfig = findConfig.require(CZ_CONFIG_NAME, { home: false })
  if (czConfig) {
    return czConfig
  }

  let pkg = findConfig('package.json', { home: false })
  if (pkg) {
    const pkgDir = path.dirname(pkg)
    pkg = require(pkg)
    const czConfig = get(pkg, 'config.cz-customizable.config')
    if (czConfig) {
      // resolve relative to discovered package.json
      const pkgPath = path.resolve(pkgDir, czConfig)
      log.info('>>> Using cz-customizable config specified in your package.json: ', pkgPath)
      return require(pkgPath)
    }
  }
  return require('@gating-cli/config/lib/.cz-config')
}

module.exports = function () {
  return new Promise((resolve, reject) => {
    const config = readConfigFile()
    const questions = require('cz-customizable/questions').getQuestions(config, inquirer)
    config.subjectLimit = config.subjectLimit || 100
    log.info(`除第一行外，所有行都将在 ${config.subjectLimit} 个字符后换行。`)

    inquirer.prompt(questions).then(answers => {
      if (answers.confirmCommit === 'edit') {
        temp.open(null, (err, info) => {
          if (!err) {
            fs.writeSync(info.fd, buildCommit(answers, config))
            fs.close(info.fd, () => {
              editor(info.path, code => {
                if (code === 0) {
                  const commitStr = fs.readFileSync(info.path, {
                    encoding: 'utf8'
                  })
                  resolve(commitStr)
                } else {
                  log.info(`编辑器返回非零值。提交消息是:\n${buildCommit(answers, config)}`)
                }
              })
            })
          }
        })
      } else if (answers.confirmCommit === 'yes') {
        const commitStr = buildCommit(answers, config)
        resolve(commitStr)
      } else {
        reject()
        throw new Error('提交已被取消。')
      }
    })
  })
}
