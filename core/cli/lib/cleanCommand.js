const fs = require('fs-extra')
const log = require('@gating-cli/log')
const { CACHE_DIR } = require('@gating-cli/config')

function cleanAll() {
  const homePath = process.env.CLI_HOME_PATH
  if (fs.existsSync(homePath)) {
    fs.emptyDirSync(homePath)
    log.success('清空全部缓存文件成功', homePath)
  } else {
    log.success('文件夹不存在', homePath)
    console.log(homePath)
  }
}

module.exports = function (options) {
  if (options.cache) {
    const cachePath = resolve(process.env.CLI_HOME_PATH, CACHE_DIR)
    if (fs.existsSync(cachePath)) {
      fs.emptyDirSync(cachePath)
      log.success('清空依赖文件成功', cachePath)
    } else {
      log.success('文件夹不存在', cachePath)
    }
  }
  return cleanAll()
}
