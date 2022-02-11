'use strict'

const path = require('path')
const fs = require('fs-extra')
const Command = require('@gating-cli/command')
const log = require('@gating-cli/log')
const Git = require('@gating-cli/git')

class PublishCommand extends Command {
  init() {
    // 处理参数
    log.verbose('publish', this._argv, this._cmd)
    this.options = {
      refreshServer: this._cmd.refreshServer,
      refreshToken: this._cmd.refreshToken,
      refreshOwner: this._cmd.refreshOwner
    }

    this.projectPath = process.env.CLI_PROJECT_PATH || process.cwd()
  }

  async exec() {
    try {
      const startTime = new Date().getTime()
      // 1.初始化检查
      this.prepare()
      // 2.Git Flow自动化
      const git = new Git(this.projectInfo, this.options)
      await git.prepare() // 自动化提交准备和代码仓库初始化
      await git.commit() // 代码自动化提交
      const endTime = new Date().getTime()
      log.info('本次发布耗时：', Math.floor((endTime - startTime) / 1000) + '秒')
    } catch (e) {
      log.error(e.message)
      if (process.env.LOG_LEVEL === 'verbose') {
        console.log(e)
      }
    }
  }

  prepare() {
    // 1.确认项目是否为npm项目
    const projectPath = this.projectPath
    const pkgPath = path.resolve(projectPath, 'package.json')
    log.verbose('package.json', pkgPath)
    if (!fs.existsSync(pkgPath)) {
      throw new Error('package.json不存在！')
    }
    // 2.确认是否包含name、version、scripts
    const pkg = fs.readJsonSync(pkgPath)
    const { name, version, scripts } = pkg
    log.verbose('package.json', name, version, scripts)
    if (!name || !version || !scripts) {
      throw new Error('package.json信息不全，请检查是否存在name、version和scripts')
    }
    this.projectInfo = { name, version, dir: projectPath }
  }
}

function publish(argv) {
  return new PublishCommand(argv)
}

module.exports = publish
module.exports.PublishCommand = PublishCommand
