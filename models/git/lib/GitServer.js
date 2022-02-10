function error(methodName) {
  throw new Error(`${methodName} must be implemented!`)
}

class GitServer {
  constructor(type) {
    this.type = type
    this.token = null
  }

  /**
   * 设置token
   * @param { string } token token
   */
  setToken(token) {
    this.token = token
  }

  createRepo() {
    error('createRepo')
  }

  createOrgRepo() {
    error('createOrgRepo')
  }

  getRemote() {
    error('getRemote')
  }

  getUser() {
    error('getUser')
  }

  getOrg() {
    error('getOrg')
  }

  getRepo() {
    error('getRepo')
  }

  getTokenUrl() {
    error('getTokenUrl')
  }
}

module.exports = GitServer
