'use strict'
const { resolve } = require('path')
const { homedir } = require('os')

const ejs = require('ejs')
const glob = require('glob')
const fs = require('fs-extra')
const semver = require('semver')
const inquirer = require('inquirer')

const Command = require('@gating-cli/command')
const Package = require('@gating-cli/package')

const log = require('@gating-cli/log')
const { get } = require('@gating-cli/request')
const spinnerStart = require('@gating-cli/spinner')
const { execAsync } = require('@gating-cli/utils')
const { DEFAULT_CLI_HOME } = require('@gating-cli/config')

// 用户主目录
const userHome = homedir()

const TEMPLATE_TYPE_NORMAL = 'normal'
const TEMPLATE_TYPE_CUSTOM = 'custom'

const WHITE_COMMAND = ['npm', 'cnpm', 'pnpm', 'yarn']

class InitCommand extends Command {
  init() {
    this.projectName = this._argv[0] || ''
    this.force = !!this._cmd.force
    this.projectPath = process.env.CLI_PROJECT_PATH || process.cwd()
    log.verbose('projectName', this.projectName)
  }

  /**
   * 执行init命令
   */
  async exec() {
    try {
      // 1. 准备阶段
      const projectInfo = await this.prepare()
      if (projectInfo) {
        // 2. 下载模板
        log.verbose('projectInfo', projectInfo)
        this.projectInfo = projectInfo
        await this.downloadTemplate()
        // 3. 安装模板
        await this.installTemplate()
      }
    } catch (e) {
      if (process.env.LOG_LEVEL === 'verbose') {
        console.log(e)
      } else {
        log.error(e.message)
      }
    }
  }

  /**
   * 安装模板
   */
  async installTemplate() {
    log.verbose('templateInfo', this.templateInfo)
    if (this.templateInfo) {
      if (!this.templateInfo.type) {
        this.templateInfo.type = TEMPLATE_TYPE_NORMAL
      }
      if (this.templateInfo.type === TEMPLATE_TYPE_NORMAL) {
        // 标准安装
        await this.installNormalTemplate()
      } else if (this.templateInfo.type === TEMPLATE_TYPE_CUSTOM) {
        // 自定义安装
        await this.installCustomTemplate()
      } else {
        throw new Error('无法识别项目模板类型！')
      }
    } else {
      throw new Error('项目模板信息不存在！')
    }
  }

  /**
   * 检查白名单的命令，避免rm -rf这些误操作
   * @param { string } cmd 命令
   */
  checkCommand(cmd) {
    if (WHITE_COMMAND.includes(cmd)) {
      return cmd
    }
    return null
  }

  /**
   * 执行命令
   * @param { strting } command 命令
   * @param { strting } errMsg 错误信息
   * @returns { string } 执行的结果
   */
  async execCommand(command, errMsg) {
    let ret
    if (command) {
      const cmdArray = command.split(' ')
      const cmd = this.checkCommand(cmdArray[0])
      if (!cmd) {
        throw new Error('命令不存在！命令：' + command)
      }
      const args = cmdArray.slice(1)
      ret = await execAsync(cmd, args, {
        stdio: 'inherit',
        cwd: this.projectPath
      })
    }
    if (ret !== 0) {
      throw new Error(errMsg)
    }
    return ret
  }

  /**
   * 渲染模板
   * @param { object } options render 配置
   * @param { string } options.ignore 忽略文件
   * @returns
   */
  async ejsRender(options) {
    const dir = this.projectPath
    const projectInfo = this.projectInfo
    return new Promise((resolve, reject) => {
      glob(
        '**',
        {
          cwd: dir,
          ignore: options.ignore || '',
          nodir: true
        },
        function (err, files) {
          if (err) {
            reject(err)
          }
          Promise.all(
            files.map(file => {
              const filePath = path.join(dir, file)
              return new Promise((resolve1, reject1) => {
                ejs.renderFile(filePath, projectInfo, {}, (err, result) => {
                  if (err) {
                    reject1(err)
                  } else {
                    fs.writeFileSync(filePath, result)
                    resolve1(result)
                  }
                })
              })
            })
          )
            .then(() => {
              resolve()
            })
            .catch(err => {
              reject(err)
            })
        }
      )
    })
  }

  /**
   * 安装标准模板
   */
  async installNormalTemplate() {
    log.verbose('templateNpm', this.templateNpm)
    // 拷贝模板代码至当前目录
    let spinner = spinnerStart('正在安装模板...')
    try {
      const templatePath = resolve(this.templateNpm.cacheFilePath, 'template')
      const targetPath = this.projectPath
      fs.ensureDirSync(templatePath)
      fs.ensureDirSync(targetPath)
      fs.copySync(templatePath, targetPath)
    } catch (e) {
      throw e
    } finally {
      spinner.stop(true)
      log.success('模板安装成功')
    }
    const templateIgnore = this.templateInfo.ignore || []
    const ignore = ['**/node_modules/**', ...templateIgnore]
    await this.ejsRender({ ignore })
    const { installCommand, startCommand } = this.templateInfo

    // 依赖安装
    if (installCommand) {
      await this.execCommand(installCommand, '依赖安装失败！')
    }

    // 启动命令执行
    if (startCommand) {
      await this.execCommand(startCommand, '启动执行命令失败！')
    }
  }

  /**
   * 安装自定义模板
   */
  async installCustomTemplate() {
    // 查询自定义模板的入口文件
    if (await this.templateNpm.exists()) {
      const rootFile = this.templateNpm.getRootFilePath()
      if (fs.existsSync(rootFile)) {
        log.notice('开始执行自定义模板')
        const templatePath = resolve(this.templateNpm.cacheFilePath, 'template')
        const options = {
          templateInfo: this.templateInfo,
          projectInfo: this.projectInfo,
          sourcePath: templatePath,
          targetPath: this.projectPath
        }
        const code = `require('${rootFile}')(${JSON.stringify(options)})`
        log.verbose('code', code)
        await execAsync('node', ['-e', code], {
          stdio: 'inherit',
          cwd: this.projectPath
        })
        log.success('自定义模板安装成功')
      } else {
        throw new Error('自定义模板入口文件不存在！')
      }
    }
  }

  /**
   * 下载模板
   */
  async downloadTemplate() {
    const { projectTemplate } = this.projectInfo
    const templateInfo = this.template.find(item => item.npmName === projectTemplate)
    const targetPath = resolve(userHome, DEFAULT_CLI_HOME, 'template')
    const storeDir = resolve(userHome, DEFAULT_CLI_HOME, 'template', 'node_modules')
    const { npmName, version } = templateInfo
    this.templateInfo = templateInfo
    const templateNpm = new Package({
      targetPath,
      storeDir,
      packageName: npmName,
      packageVersion: version
    })
    if (!(await templateNpm.exists())) {
      const spinner = spinnerStart('正在下载模板...')
      try {
        await templateNpm.install()
      } catch (e) {
        throw e
      } finally {
        spinner.stop(true)
        if (await templateNpm.exists()) {
          log.success('下载模板成功')
          this.templateNpm = templateNpm
        }
      }
    } else {
      const spinner = spinnerStart('正在更新模板...')
      try {
        await templateNpm.update()
      } catch (e) {
        throw e
      } finally {
        spinner.stop(true)
        if (await templateNpm.exists()) {
          log.success('更新模板成功')
          this.templateNpm = templateNpm
        }
      }
    }
  }

  async prepare() {
    // 0. 判断项目模板是否存在
    const template = await get('https://gitee.com/gating/template-json/raw/master/template.json')
    if (!template || template.length === 0) {
      throw new Error('项目模板不存在')
    }
    this.template = template
    // 1. 判断当前目录是否为空
    const localPath = this.projectPath
    if (!this.isDirEmpty(localPath)) {
      let ifContinue = false
      if (!this.force) {
        // 询问是否继续创建
        ifContinue = (
          await inquirer.prompt({
            type: 'confirm',
            name: 'ifContinue',
            default: false,
            message: '当前文件夹不为空，是否继续创建项目？'
          })
        ).ifContinue
        if (!ifContinue) {
          return
        }
      }
      // 2. 是否启动强制更新
      if (ifContinue || this.force) {
        // 给用户做二次确认
        const { confirmDelete } = await inquirer.prompt({
          type: 'confirm',
          name: 'confirmDelete',
          default: false,
          message: '是否确认清空当前目录下的文件？'
        })
        if (confirmDelete) {
          // 清空当前目录
          fs.emptyDirSync(localPath)
        }
      }
    }
    return this.getProjectInfo()
  }

  async getProjectInfo() {
    function isValidName(v) {
      return /^[a-zA-Z]+([-][a-zA-Z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9])*$/.test(v)
    }

    let projectInfo = {}
    let isProjectNameValid = false
    if (isValidName(this.projectName)) {
      isProjectNameValid = true
      projectInfo.projectName = this.projectName
    }
    // 1. 选择创建项目
    const title = '项目'
    const projectNamePrompt = {
      type: 'input',
      name: 'projectName',
      message: `请输入${title}名称`,
      default: '',
      validate: function (v) {
        const done = this.async()
        setTimeout(function () {
          // 1.首字符必须为英文字符
          // 2.尾字符必须为英文或数字，不能为字符
          // 3.字符仅允许"-_"
          if (!isValidName(v)) {
            done(`请输入合法的${title}名称`)
            return
          }
          done(null, true)
        }, 0)
      },
      filter: function (v) {
        return v
      }
    }
    const projectPrompt = []
    if (!isProjectNameValid) {
      projectPrompt.push(projectNamePrompt)
    }
    projectPrompt.push(
      {
        type: 'input',
        name: 'projectVersion',
        message: `请输入${title}版本号`,
        default: '1.0.0',
        validate: function (v) {
          const done = this.async()
          setTimeout(function () {
            if (!!!semver.valid(v)) {
              done('请输入合法的版本号')
              return
            }
            done(null, true)
          }, 0)
        },
        filter: function (v) {
          if (!!semver.valid(v)) {
            return semver.valid(v)
          } else {
            return v
          }
        }
      },
      {
        type: 'list',
        name: 'projectTemplate',
        message: `请选择${title}模板`,
        choices: this.createTemplateChoice()
      }
    )
    // 2. 获取项目的基本信息
    const project = await inquirer.prompt(projectPrompt)
    projectInfo = {
      ...projectInfo,
      ...project
    }
    // 生成classname
    if (projectInfo.projectName) {
      projectInfo.name = projectInfo.projectName
      projectInfo.className = this.kebabCase(projectInfo.projectName)
    }
    if (projectInfo.projectVersion) {
      projectInfo.version = projectInfo.projectVersion
    }
    if (projectInfo.componentDescription) {
      projectInfo.description = projectInfo.componentDescription
    }
    return projectInfo
  }

  /**
   * 转换为kebab case。
   * @param { string } str 字符
   * @returns { string } 转换后的 kebab case 字符串
   */
  kebabCase(str) {
    return str
      .match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
      .join('-')
      .toLowerCase()
  }

  /**
   * 判断是否为空文件夹
   * @param { string } localPath 路径
   * @returns { boolean } 是否为空文件夹
   */
  isDirEmpty(localPath) {
    let fileList = fs.readdirSync(localPath)
    // 文件过滤的逻辑
    fileList = fileList.filter(file => !file.startsWith('.') && ['node_modules'].indexOf(file) < 0)
    return !fileList || fileList.length <= 0
  }

  createTemplateChoice() {
    return this.template.map(item => ({
      value: item.npmName,
      name: item.name
    }))
  }
}

function init(argv) {
  return new InitCommand(argv)
}

module.exports = init
module.exports.InitCommand = InitCommand
