'use strict'

const semver = require('semver')
const colors = require('colors/safe')
const log = require('@gating-cli/log')
const { LOWEST_NODE_VERSION } = require('@gating-cli/config')

class Command {
  constructor(argv) {
    if (!argv) {
      throw new Error('参数不能为空！')
    }
    if (!Array.isArray(argv)) {
      throw new Error('参数必须为数组！')
    }
    if (argv.length < 1) {
      throw new Error('参数列表为空！')
    }
    this._argv = argv
    let chain = Promise.resolve()
    chain = chain.then(() => this.checkNodeVersion())
    chain = chain.then(() => this.initArgs())
    chain = chain.then(() => this.init())
    chain = chain.then(() => this.exec())
    chain.catch(err => {
      log.error(err.message)
    })
  }

  /**
   * 检查本地node版本
   */
  checkNodeVersion() {
    // 获取本地 node 版本
    const currentVersion = process.version
    const lowestVersion = LOWEST_NODE_VERSION
    if (!semver.gte(currentVersion, lowestVersion)) {
      throw new Error(colors.red(`gating-cli 需要安装 v${lowestVersion} 以上版本的 Node.js`))
    }
  }

  /**
   * 初始化参数
   */
  initArgs() {
    let len = this._argv.length - 1
    this._cmd = this._argv[0]
    this._argv = this._argv.slice(0, len)
  }

  init() {
    throw new Error('init必须实现！')
  }

  exec() {
    throw new Error('exec必须实现！')
  }
}

module.exports = Command
