'use strict'

// 所有的cli命令，和commands目录保持一致
const COMMANDS = {
  init: '@gating-cli/init',
  clean: '@gating-cli/clean',
  publish: '@gating-cli/publish'
}

// 最低的node版本
const LOWEST_NODE_VERSION = '12.0.0'

// 缓存依赖目录
const CACHE_DIR = '.gating-cli-cache'

// cli主目录
const DEFAULT_CLI_HOME = '.gating-cli'

// 线上版本命名,release/x.y.z
const VERSION_RELEASE = 'release'

// 本地版本,dev/x.y.z
const VERSION_DEVELOP = 'dev'

/**
 * 获取git配置
 * @param { ('gitee' | 'github') } gitType git类型
 * @returns { object } git配置
 */
const getGitConfig = gitType => ({
  // git token配置文件
  GIT_TOKEN_FILE: `.${gitType}_token`,
  // git 拥有者类型配置文件
  GIT_OWN_FILE: `.${gitType}_own`,
  // git 登录用户名
  GIT_LOGIN_FILE: `.${gitType}_login`
})

module.exports = {
  COMMANDS,
  CACHE_DIR,
  LOWEST_NODE_VERSION,
  DEFAULT_CLI_HOME,
  VERSION_RELEASE,
  VERSION_DEVELOP,
  getGitConfig
}
