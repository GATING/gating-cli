'use strict'

const fs = require('fs-extra')
const { resolve } = require('path')
const SimpleGit = require('simple-git')
const inquirer = require('inquirer')
const terminalLink = require('terminal-link')
const semver = require('semver')
const log = require('@gating-cli/log')
const spinnerStart = require('@gating-cli/spinner')
const { VERSION_RELEASE, VERSION_DEVELOP, getGitConfig } = require('@gating-cli/config')

const Github = require('./Github')
const Gitee = require('./Gitee')
const getPrompt = require('./gitPrompt')

// git服务配置文件
const GIT_SERVER_FILE = '.git_server'
const GIT_ROOT_DIR = '.git'
const GIT_IGNORE_FILE = '.gitignore'
const GITEE = 'gitee'
const GITHUB = 'github'
const REPO_OWNER_USER = 'user'
const REPO_OWNER_ORG = 'org'

const GIT_SERVER_TYPE = [
  {
    name: 'Github',
    value: GITHUB
  },
  {
    name: 'Gitee',
    value: GITEE
  }
]

const GIT_OWNER_TYPE_ONLY = [
  {
    name: '个人',
    value: REPO_OWNER_USER
  }
]

const GIT_OWNER_TYPE = [
  ...GIT_OWNER_TYPE_ONLY,
  {
    name: '组织',
    value: REPO_OWNER_ORG
  }
]

class Git {
  constructor(
    { name, version, dir },
    { refreshServer = false, refreshToken = false, refreshOwner = false }
  ) {
    this.name = name // 项目名称
    this.version = version // 项目版本
    this.dir = dir // 源码目录
    this.homePath = process.env.CLI_HOME_PATH // 本地缓存目录
    this.git = SimpleGit(dir) // SimpleGit实例
    this.gitServer = null // GitServer实例
    this.user = null // 用户信息
    this.orgs = null // 用户所属组织列表
    this.owner = null // 远程仓库类型
    this.login = null // 远程仓库登录名
    this.repo = null // 远程仓库信息
    this.refreshServer = refreshServer // 是否强制刷新远程仓库
    this.refreshToken = refreshToken // 是否强化刷新远程仓库token
    this.refreshOwner = refreshOwner // 是否强化刷新远程仓库类型
    this.branch = null // 本地开发分支
    this.gitConfig = null // git配置文件
  }

  async prepare() {
    this.checkHomePath() // 检查缓存主目录
    await this.checkGitServer() // 检查用户远程仓库类型
    await this.checkGitToken() // 获取远程仓库Token
    await this.getUserAndOrgs() // 获取远程仓库用户和组织信息
    await this.checkGitOwner() // 确认远程仓库类型
    await this.checkRepo() // 检查并创建远程仓库
    this.checkGitIgnore() // 检查并创建.gitignore文件
    await this.init() // 完成本地仓库初始化
  }

  async init() {
    if (await this.getRemote()) {
      return
    }
    await this.initAndAddRemote()
    await this.initCommit()
  }

  async commit() {
    // 1.生成开发分支
    await this.getCorrectVersion()
    // 2.检查stash区
    await this.checkStash()
    // 3.检查代码冲突
    await this.checkConflicted()
    // 4.切换开发分支
    await this.checkoutBranch(this.branch)
    // 5.合并远程master分支和开发分支代码
    await this.pullRemoteMasterAndBranch()
    // 6.将开发分支推送到远程仓库
    await this.pushRemoteRepo(this.branch)
  }

  async pullRemoteMasterAndBranch() {
    log.info(`合并 [master] -> [${this.branch}]`)
    await this.pullRemoteRepo('master')
    log.success('合并远程 [master] 分支代码成功')
    await this.checkConflicted()
    log.info('检查远程开发分支')
    const remoteBranchList = await this.getRemoteBranchList()
    if (remoteBranchList.indexOf(this.version) >= 0) {
      log.info(`合并 [${this.branch}] -> [${this.branch}]`)
      await this.pullRemoteRepo(this.branch)
      log.success(`合并远程 [${this.branch}] 分支代码成功`)
      await this.checkConflicted()
    } else {
      log.success(`不存在远程分支 [${this.branch}]`)
    }
  }

  async checkoutBranch(branch) {
    const localBranchList = await this.git.branchLocal()
    if (localBranchList.all.indexOf(branch) >= 0) {
      await this.git.checkout(branch)
    } else {
      await this.git.checkoutLocalBranch(branch)
    }
    log.success(`分支切换到${branch}`)
  }

  async checkStash() {
    log.info('检查stash记录')
    const stashList = await this.git.stashList()
    if (stashList.all.length > 0) {
      await this.git.stash(['pop'])
      log.success('stash pop成功')
    }
  }

  async getCorrectVersion() {
    // 1.获取远程分布分支
    // 版本号规范：release/x.y.z，dev/x.y.z
    // 版本号递增规范：major/minor/patch
    log.info('获取代码分支')
    const remoteBranchList = await this.getRemoteBranchList(VERSION_RELEASE)
    let releaseVersion = null
    if (remoteBranchList && remoteBranchList.length > 0) {
      releaseVersion = remoteBranchList[0]
    }
    log.verbose('线上最新版本号', releaseVersion)
    // 2.生成本地开发分支
    const devVersion = this.version
    if (!releaseVersion) {
      this.branch = `${VERSION_DEVELOP}/${devVersion}`
    } else if (semver.gt(this.version, releaseVersion)) {
      log.info('当前版本大于线上最新版本', `${devVersion} >= ${releaseVersion}`)
      this.branch = `${VERSION_DEVELOP}/${devVersion}`
    } else {
      log.info('当前线上版本大于本地版本', `${releaseVersion} > ${devVersion}`)
      const incType = (
        await inquirer.prompt({
          type: 'list',
          name: 'incType',
          message: '自动升级版本，请选择升级版本类型',
          default: 'patch',
          choices: [
            {
              name: `小版本（${releaseVersion} -> ${semver.inc(releaseVersion, 'patch')}）`,
              value: 'patch'
            },
            {
              name: `中版本（${releaseVersion} -> ${semver.inc(releaseVersion, 'minor')}）`,
              value: 'minor'
            },
            {
              name: `大版本（${releaseVersion} -> ${semver.inc(releaseVersion, 'major')}）`,
              value: 'major'
            }
          ]
        })
      ).incType
      const incVersion = semver.inc(releaseVersion, incType)
      this.branch = `${VERSION_DEVELOP}/${incVersion}`
      this.version = incVersion
    }
    log.verbose('本地开发分支', this.branch)
    // 3.将version同步到package.json
    this.syncVersionToPackageJson()
  }

  syncVersionToPackageJson() {
    const pkg = fs.readJsonSync(`${this.dir}/package.json`)
    if (pkg && pkg.version !== this.version) {
      pkg.version = this.version
      fs.writeJsonSync(`${this.dir}/package.json`, pkg, { spaces: 2 })
    }
  }

  readFile(path) {
    if (fs.existsSync(path)) {
      return fs.readFileSync(path).toString()
    }
    return null
  }

  async getRemoteBranchList(type) {
    const remoteList = await this.git.listRemote(['--refs'])
    let reg
    if (type === VERSION_RELEASE) {
      reg = /.+?refs\/tags\/release\/(\d+\.\d+\.\d+)/g
    } else {
      reg = /.+?refs\/heads\/dev\/(\d+\.\d+\.\d+)/g
    }
    return remoteList
      .split('\n')
      .map(remote => {
        const match = reg.exec(remote)
        reg.lastIndex = 0
        if (match && semver.valid(match[1])) {
          return match[1]
        }
      })
      .filter(_ => _)
      .sort((a, b) => {
        if (semver.lte(b, a)) {
          if (a === b) return 0
          return -1
        }
        return 1
      })
  }

  async initCommit() {
    await this.checkConflicted()
    await this.checkNotCommitted()
    if (await this.checkRemoteMaster()) {
      await this.pullRemoteRepo('master', {
        '--allow-unrelated-histories': null
      })
    } else {
      await this.pushRemoteRepo('master')
    }
  }

  async pullRemoteRepo(branchName, options) {
    log.info(`同步远程${branchName}分支代码`)
    await this.git.pull('origin', branchName, options).catch(err => {
      log.error(err.message)
    })
  }

  async pushRemoteRepo(branchName) {
    log.info(`推送代码至${branchName}分支`)
    await this.git.push('origin', branchName)
    log.success('推送代码成功')
  }

  /**
   * 检查是否穿在masta
   */
  async checkRemoteMaster() {
    const refsList = await this.git.listRemote(['--refs'])
    console.log(refsList)
    return refsList.indexOf('refs/heads/master') >= 0
  }

  async checkNotCommitted() {
    const status = await this.git.status()
    if (
      status.not_added.length > 0 ||
      status.created.length > 0 ||
      status.deleted.length > 0 ||
      status.modified.length > 0 ||
      status.renamed.length > 0
    ) {
      log.verbose('status', status)
      await this.git.add(status.not_added)
      await this.git.add(status.created)
      await this.git.add(status.deleted)
      await this.git.add(status.modified)
      await this.git.add(status.renamed)
      const message = await getPrompt()
      await this.git.commit(message)
      log.success('本次commit提交成功')
    }
  }

  /**
   * 代码冲突检查
   */
  async checkConflicted() {
    log.info('代码冲突检查')
    const status = await this.git.status()
    if (status.conflicted.length > 0) {
      throw new Error('当前代码存在冲突，请手动处理合并后再试！')
    }
    log.success('代码冲突检查通过')
  }

  /**
   * 获取git远程地址
   */
  getRemote() {
    const gitPath = resolve(this.dir, GIT_ROOT_DIR)
    this.remote = this.gitServer.getRemote(this.login, this.name)
    if (fs.existsSync(gitPath)) {
      log.success('git已完成初始化')
      return true
    }
  }

  async initAndAddRemote() {
    log.info('执行git初始化')
    await this.git.init(this.dir)
    log.info('添加git remote')
    const remotes = await this.git.getRemotes()
    log.verbose('git remotes', remotes)
    if (!remotes.find(item => item.name === 'origin')) {
      await this.git.addRemote('origin', this.remote)
    }
  }

  checkHomePath() {
    log.verbose('home', this.homePath)
    fs.ensureDirSync(this.homePath)
    if (!fs.existsSync(this.homePath)) {
      throw new Error('用户主目录获取失败！')
    }
  }

  async checkGitServer() {
    const gitServerPath = this.createPath(GIT_SERVER_FILE)
    let gitServer = this.readFile(gitServerPath)
    if (!gitServer || this.refreshServer) {
      gitServer = (
        await inquirer.prompt({
          type: 'list',
          name: 'gitServer',
          message: '请选择您想要托管的Git平台',
          default: GITHUB,
          choices: GIT_SERVER_TYPE
        })
      ).gitServer
      fs.writeFileSync(gitServerPath, gitServer)
      log.success('git server写入成功', `${gitServer} -> ${gitServerPath}`)
    } else {
      log.success('git server获取成功', gitServer)
    }
    this.gitServer = this.createGitServer(gitServer)
    if (!this.gitServer) {
      throw new Error('GitServer初始化失败！')
    }
    // 设置git配置文件
    this.gitConfig = getGitConfig(gitServer)
  }

  /**
   * 检查用户git token
   */
  async checkGitToken() {
    const tokenPath = this.createPath(this.gitConfig.GIT_TOKEN_FILE)
    let token = this.readFile(tokenPath)
    if (!token || this.refreshToken) {
      console.log(
        this.gitServer.type + ' token未生成，',
        '请先生成' +
          this.gitServer.type +
          ' token，' +
          terminalLink('链接', this.gitServer.getTokenUrl(), {
            fallback(text, url) {
              return `${text}: ${url}`
            }
          })
      )
      token = (
        await inquirer.prompt({
          type: 'password',
          name: 'token',
          message: '请将token复制到这里',
          default: ''
        })
      ).token
      fs.writeFileSync(tokenPath, token)
      log.success('token写入成功', `${token} -> ${tokenPath}`)
    } else {
      log.success('token获取成功', tokenPath)
    }
    this.token = token
    this.gitServer.setToken(token)
  }

  /**
   * 获取用户和组织信息
   */
  async getUserAndOrgs() {
    this.user = await this.gitServer.getUser()
    if (!this.user) {
      throw new Error('用户信息获取失败！')
    }
    log.verbose('user', this.user)
    this.orgs = await this.gitServer.getOrg(this.user.login)
    if (!this.orgs) {
      throw new Error('组织信息获取失败！')
    }
    log.verbose('orgs', this.orgs)
    log.success(this.gitServer.type + ' 用户和组织信息获取成功')
  }

  /**
   * 检查仓库类型
   */
  async checkGitOwner() {
    const ownerPath = this.createPath(this.gitConfig.GIT_OWN_FILE)
    const loginPath = this.createPath(this.gitConfig.GIT_LOGIN_FILE)
    let owner = this.readFile(ownerPath)
    let login = this.readFile(loginPath)
    if (!owner || !login || this.refreshOwner) {
      owner = (
        await inquirer.prompt({
          type: 'list',
          name: 'owner',
          message: '请选择远程仓库类型',
          default: REPO_OWNER_USER,
          choices: this.orgs.length > 0 ? GIT_OWNER_TYPE : GIT_OWNER_TYPE_ONLY
        })
      ).owner
      if (owner === REPO_OWNER_USER) {
        login = this.user.login
      } else {
        login = (
          await inquirer.prompt({
            type: 'list',
            name: 'login',
            message: '请选择',
            choices: this.orgs.map(item => ({
              name: item.login,
              value: item.login
            }))
          })
        ).login
      }
      fs.writeFileSync(ownerPath, owner)
      fs.writeFileSync(loginPath, login)
      log.success('owner写入成功', `${owner} -> ${ownerPath}`)
      log.success('login写入成功', `${login} -> ${loginPath}`)
    } else {
      log.success('owner获取成功', owner)
      log.success('login获取成功', login)
    }
    this.owner = owner
    this.login = login
  }

  /**
   * 检查远程仓库是否存在，不存在则创建
   */
  async checkRepo() {
    let repo
    try {
      repo = await this.gitServer.getRepo(this.login, this.name)
    } catch (error) {
      log.info(`当前仓库（${this.name}）不存在`)
    }
    if (!repo) {
      let spinner = spinnerStart('开始创建远程仓库...')
      try {
        if (this.owner === REPO_OWNER_USER) {
          repo = await this.gitServer.createRepo(this.name)
        } else {
          repo = await this.gitServer.createOrgRepo(this.name, this.login)
        }
      } catch (e) {
        log.error(e)
      } finally {
        spinner.stop(true)
      }
      if (repo) {
        log.success('远程仓库创建成功')
      } else {
        throw new Error('远程仓库创建失败')
      }
    } else {
      log.success('远程仓库信息获取成功')
    }
    log.verbose('repo', repo)
    this.repo = repo
  }

  /**
   * 检查 .gitignore 文件
   */
  checkGitIgnore() {
    const gitIgnore = resolve(this.dir, GIT_IGNORE_FILE)
    if (!fs.existsSync(gitIgnore)) {
      const filePath = resolve(__dirname, GIT_IGNORE_FILE)
      fs.writeFileSync(gitIgnore, fs.readFileSync(filePath))
      log.success(`自动写入${GIT_IGNORE_FILE}文件成功`)
    }
  }

  /**
   * 创建 git 服务，目前支持 github 和 gitee
   * @param { 'github' | 'gitee' } gitServer git服务
   * @returns
   */
  createGitServer(gitServer) {
    if (gitServer === GITHUB) {
      return new Github()
    } else if (gitServer === GITEE) {
      return new Gitee()
    }
    return null
  }

  /**
   * 创建文件
   * @param { string } file 文件名
   */
  createPath(file) {
    const rootDir = resolve(this.homePath, GIT_ROOT_DIR)
    const filePath = resolve(rootDir, file)
    fs.ensureDirSync(rootDir)
    return filePath
  }
}

module.exports = Git
