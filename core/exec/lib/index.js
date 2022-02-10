'use strict'
const { resolve } = require('path')
const log = require('@gating-cli/log')
const Package = require('@gating-cli/package')
const { exec: spawn } = require('@gating-cli/utils')
const { COMMANDS, CACHE_DIR } = require('@gating-cli/config')

async function exec() {
  let targetPath = process.env.CLI_TARGET_PATH
  const projectPath = process.env.CLI_PROJECT_PATH || process.cwd()
  const homePath = process.env.CLI_HOME_PATH
  let storeDir = ''
  let pkg
  log.verbose('targetPath', targetPath)
  log.verbose('homePath', homePath)

  const cmdObj = arguments[arguments.length - 1]
  const cmdName = cmdObj.name()
  const packageName = COMMANDS[cmdName]
  const packageVersion = 'latest'

  if (!targetPath) {
    targetPath = resolve(homePath, CACHE_DIR) // 生成缓存路径
    storeDir = resolve(targetPath, 'node_modules')
    log.verbose('targetPath', targetPath)
    log.verbose('storeDir', storeDir)
    pkg = new Package({
      targetPath,
      storeDir,
      packageName,
      packageVersion
    })
    if (await pkg.exists()) {
      // 更新package
      await pkg.update()
    } else {
      // 安装package
      await pkg.install()
    }
  } else {
    pkg = new Package({
      targetPath,
      packageName,
      packageVersion
    })
  }
  const rootFile = pkg.getRootFilePath()
  if (rootFile) {
    try {
      // 在当前进程中调用
      // require(rootFile).call(null, Array.from(arguments));
      // 在node子进程中调用
      const args = Array.from(arguments)
      const cmd = args[args.length - 1]
      const o = Object.create(null)
      Object.keys(cmd).forEach(key => {
        if (cmd.hasOwnProperty(key) && !key.startsWith('_') && key !== 'parent') {
          o[key] = cmd[key]
        }
      })
      args[args.length - 1] = o
      const code = `require('${rootFile}').call(null, ${JSON.stringify(args)})`
      const child = spawn('node', ['-e', code], {
        cwd: projectPath,
        stdio: 'inherit'
      })
      child.on('error', e => {
        log.error(e.message)
        process.exit(1)
      })
      child.on('exit', e => {
        log.verbose('命令执行成功:' + e)
        process.exit(e)
      })
    } catch (e) {
      log.error(e.message)
    }
  }
}

module.exports = exec
