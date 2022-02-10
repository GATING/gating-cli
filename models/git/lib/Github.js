const { request, get, post } = require('@gating-cli/request')
const GitServer = require('./GitServer')

class Github extends GitServer {
  constructor() {
    super('github')
  }

  /**
   * 设置token
   * @param { string } token token
   */
  setToken(token) {
    super.setToken(token)
    request.defaults.baseURL = 'https://api.github.com'
    request.defaults.headers.common['Authorization'] = `token ${this.token}`
    this.get = get
    this.post = post
  }

  /**
   * 获取用户信息
   */
  getUser() {
    return this.get('/user')
  }

  /**
   * 获取组织信息
   * @param { string } username 用户名
   */
  getOrg() {
    return this.get(`/user/orgs`, {
      page: 1,
      per_page: 100
    })
  }

  getRepo(login, name) {
    return this.get(`/repos/${login}/${name}`)
  }

  /**
   * 创建仓库
   * @param { string } name 仓库名称
   */
  createRepo(name) {
    return this.post(
      '/user/repos',
      {
        name
      },
      {
        Accept: 'application/vnd.github.v3+json'
      }
    )
  }

  createOrgRepo(name, login) {
    return this.post(
      `/orgs/${login}/repos`,
      {
        name
      },
      {
        Accept: 'application/vnd.github.v3+json'
      }
    )
  }

  getTokenUrl() {
    return 'https://github.com/settings/tokens'
  }

  /**
   * 获取仓库git地址
   * @param { string } login 用户名
   * @param { string } name 仓库名称
   */
  getRemote(login, name) {
    return `git@github.com:${login}/${name}.git`
  }
}

module.exports = Github
