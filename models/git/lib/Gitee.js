const { request, get, post } = require('@gating-cli/request')
const GitServer = require('./GitServer')

class Gitee extends GitServer {
  constructor() {
    super('gitee')
  }

  /**
   * 设置token
   * @param { string } token token
   */
  setToken(token) {
    super.setToken(token)
    request.defaults.baseURL = 'https://gitee.com/api/v5'
    this.get = (url, params, config) =>
      get(
        url,
        {
          ...params,
          access_token: token
        },
        config
      )
    this.post = (url, data, config) =>
      post(url, data, {
        ...config,
        params: {
          access_token: token
        }
      })
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
  getOrg(username) {
    return this.get(`/users/${username}/orgs`, {
      page: 1,
      per_page: 100
    })
  }

  /**
   * 获取远程仓库
   * @param { string } login 用户名
   * @param { string } name 仓库名称
   */
  getRepo(login, name) {
    return this.get(`/repos/${login}/${name}`)
  }

  /**
   * 创建仓库
   * @param { string } name 仓库名称
   */
  createRepo(name) {
    return this.post('/user/repos', {
      name
    })
  }

  /**
   * 创建仓库名称
   * @param { string } name 仓库名称
   * @param { string } login 组织名
   */
  createOrgRepo(name, login) {
    return this.post(`/orgs/${login}/repos`, {
      name
    })
  }

  getTokenUrl() {
    return 'https://gitee.com/personal_access_tokens'
  }

  /**
   * 获取仓库git地址
   * @param { string } login 用户名
   * @param { string } name 仓库名称
   */
  getRemote(login, name) {
    return `git@gitee.com:${login}/${name}.git`
  }
}

module.exports = Gitee
