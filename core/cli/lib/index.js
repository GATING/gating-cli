'use strict'
// 内置模块，放在最前面
const path = require('path')
const { homedir } = require('os')

// 第三方模块放在第二位
// 内置fs模块的替代品
const fs = require('fs-extra')
// 语义版本器
const semver = require('semver')
// 控制台中颜色和样式输出
const colors = require('colors/safe')
// 命令行界面
const commander = require('commander')
// 控制台日志打印
const log = require('@gating-cli/log')

// 内部模块放在最后
const exec = require('@gating-cli/exec')
const { DEFAULT_CLI_HOME } = require('@gating-cli/config')

// 获取npm包最新的版本
const { getNpmLatestVersion } = require('@gating-cli/get-npm-info')

const pkg = require('../package.json')

// clean命令
const cleanCommand = require('./cleanCommand')

// 用户主目录
const userHome = homedir()
const program = new commander.Command()

/**
 * 检查当前运行版本
 */
function checkPkgVersion() {
  log.info('cli', pkg.version)
}

/**
 * 检查是否为 root 启动
 */
function checkRoot() {
  // 2.0版采用了 esm，我们这里还是 commonjs，所以不能升级为2.0
  const rootCheck = require('root-check')
  rootCheck(colors.red('请避免使用 root 账户启动本应用'))
}

/**
 * 检查用户主目录
 */
function checkUserHome() {
  if (!userHome || !fs.existsSync(userHome)) {
    throw new Error(colors.red('当前登录用户主目录不存在！'))
  }
}

/**
 * 检查环境变量
 */
function checkEnv() {
  const dotenv = require('dotenv')
  const dotenvPath = path.resolve(userHome, '.env')
  if (fs.pathExistsSync(dotenvPath)) {
    dotenv.config({
      path: dotenvPath
    })
  }
  createDefaultConfig()
}

/**
 * 创建默认配置
 */
function createDefaultConfig() {
  let CLI_HOME
  if (process.env.CLI_HOME) {
    CLI_HOME = path.join(userHome, process.env.CLI_HOME)
  } else {
    CLI_HOME = path.join(userHome, DEFAULT_CLI_HOME)
  }
  process.env.CLI_HOME_PATH = CLI_HOME
}

/**
 * 检查工具是否需要更新
 */
async function checkGlobalUpdate() {
  const currentVersion = pkg.version
  const npmName = pkg.name
  try {
    const lastVersion = await getNpmLatestVersion(npmName)
    if (lastVersion && semver.gt(lastVersion, currentVersion)) {
      log.warn(
        colors.yellow(
          `请手动更新 ${npmName}，当前版本：${currentVersion}，最新版本：${lastVersion} 更新命令： npm install -g ${npmName}`
        )
      )
    }
  } catch (error) {
    log.error('获取 gating-cli 最新版本失败')
  }
}

/**
 * 准备函数
 */
async function prepare() {
  checkPkgVersion()
  checkRoot()
  checkUserHome()
  checkEnv()
  await checkGlobalUpdate()
}

function registerCommand() {
  program
    .name(Object.keys(pkg.bin)[0])
    .usage('<command> [options]')
    .version(pkg.version)
    .option('-d, --debug', '是否开启调试模式')
    .option('-tp, --targetPath <targetPath>', '是否指定本地调试文件路径', '')
    .option('-pp, --projectPath <projectPath>', '是否指定创建项目的文件路径', '')

  program
    .command('init [projectName]')
    .description('项目初始化')
    .option('-f, --force', '是否强制初始化项目')
    .action(exec)

  program
    .command('publish')
    .description('项目发布')
    .option('--refreshServer', '强制更新远程Git仓库')
    .option('--refreshToken', '强制更新远程仓库token')
    .option('--refreshOwner', '强制更新远程仓库类型')
    .action(exec)

  program
    .command('clean')
    .description('清空所有缓存文件')
    .option('-c, --cache', '清空缓存依赖文件')
    .action(cleanCommand)

  program
    .command('info')
    .description('打印有关环境的调试信息')
    .action(cmd => {
      console.log(colors.bold('\n环境信息:'))
      require('envinfo').run(
        {
          System: ['OS', 'CPU', 'Memory', 'Container', 'Shell'],
          Binaries: ['Node', 'Yarn', 'npm', 'Watchman'],
          Managers: [
            'Apt',
            'Cargo',
            'CocoaPods',
            'Composer',
            'Gradle',
            'Homebrew',
            'Maven',
            'pip2',
            'pip3',
            'RubyGems',
            'Yum'
          ],
          Utilities: [
            'Bazel',
            'CMake',
            'Make',
            'GCC',
            'Git',
            'Clang',
            'Mercurial',
            'Subversion',
            'FFmpeg'
          ],
          Servers: ['Apache', 'Nginx'],
          Virtualization: ['Docker', 'Parallels', 'VirtualBox', 'VMware Fusion'],
          SDKs: ['iOS SDK', 'Android SDK', 'Windows SDK'],
          IDEs: [
            'Android Studio',
            'Atom',
            'Emacs',
            'IntelliJ',
            'NVim',
            'Nano',
            'PhpStorm',
            'Sublime Text',
            'VSCode',
            'Visual Studio',
            'Vim',
            'WebStorm',
            'Xcode'
          ],
          Languages: [
            'Bash',
            'Go',
            'Elixir',
            'Erlang',
            'Java',
            'Perl',
            'PHP',
            'Protoc',
            'Python',
            'Python3',
            'R',
            'Ruby',
            'Rust',
            'Scala'
          ],
          Databases: ['MongoDB', 'MySQL', 'PostgreSQL', 'SQLite'],
          Browsers: [
            'Brave Browser',
            'Chrome',
            'Chrome Canary',
            'Edge',
            'Firefox',
            'Firefox Developer Edition',
            'Firefox Nightly',
            'Internet Explorer',
            'Safari',
            'Safari Technology Preview'
          ],
          Monorepos: ['Yarn Workspaces', 'Lerna'],
          npmPackages: '/**/{typescript,*vue*,*react*}',
          npmGlobalPackages: ['@gating-cli']
        },
        {
          showNotFound: false,
          duplicates: true,
          fullTree: true,
          console: true
        }
      )
    })

  // 开启debug模式
  program.on('option:debug', function () {
    const opts = program.opts()
    if (opts.debug) {
      process.env.LOG_LEVEL = 'verbose'
    } else {
      process.env.LOG_LEVEL = 'info'
    }
    log.level = process.env.LOG_LEVEL
  })

  // 指定targetPath
  program.on('option:targetPath', function () {
    const opts = program.opts()
    process.env.CLI_TARGET_PATH = opts.targetPath
  })

  // 指定projectPath
  program.on('option:projectPath', function () {
    const opts = program.opts()
    process.env.CLI_PROJECT_PATH = opts.projectPath
  })

  // 对未知命令监听
  program.on('command:*', function (obj) {
    const availableCommands = program.commands.map(cmd => cmd.name())
    console.log(colors.red('未知的命令：' + obj[0]))
    if (availableCommands.length > 0) {
      console.log(colors.red('可用命令：' + availableCommands.join(',')))
    }
  })

  program.parse(process.argv)

  if (program.args && program.args.length < 1) {
    program.outputHelp()
  }
}

async function core() {
  try {
    await prepare()
    registerCommand()
  } catch (e) {
    console.log(e)
    log.error(e.message)
  }
}

process.on('unhandledRejection', (reason, p) => {
  // 捕获了一个未处理的promise rejection
  // 因为我们已经有了对于未处理错误的后备的处理机制，直接抛出，让它来处理
  if (process.env.LOG_LEVEL == 'verbose') {
    console.log('unhandledRejection', reason, p)
  }
  throw reason
})

process.on('uncaughtException', error => {
  // 我刚收到一个从未被处理的错误，并决定是否需要重启应用
  if (process.env.LOG_LEVEL == 'verbose') {
    console.log('uncaughtException', error)
  }
  process.exit(1)
})

module.exports = core
