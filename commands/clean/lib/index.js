'use strict'

const { resolve } = require('path')
const fs = require('fs-extra')

const Command = require('@gating-cli/command')
const log = require('@gating-cli/log')
const { CACHE_DIR } = require('@gating-cli/config')

class CleanCommand extends Command {
  init() {
    log.verbose('clean', this._argv, this._cmd)
    this.cleanAll = this._cmd.all
    this.cleanCache = this._cmd.cache
    this.homePath = process.env.CLI_HOME_PATH
  }

  exec() {
    if (this.cleanAll) {
      return this.clean()
    }
    if (this.cleanCache) {
      const cachePath = resolve(this.homePath, CACHE_DIR)
      if (fs.existsSync(cachePath)) {
        fs.emptyDirSync(cachePath)
        log.success('清空依赖文件成功', cachePath)
      } else {
        log.success('文件夹不存在', cachePath)
      }
    }
    return this.clean()
  }

  clean() {
    const homePath = this.homePath
    if (fs.existsSync(homePath)) {
      fs.emptyDirSync(homePath)
      log.success('清空全部缓存文件成功', homePath)
    } else {
      log.success('文件夹不存在', homePath)
    }
  }
}

function clean(argv) {
  return new CleanCommand(argv)
}

module.exports = clean
module.exports.CleanCommand = CleanCommand
