'use strict'
const semver = require('semver')
const urlJoin = require('url-join')
const { get } = require('@gating-cli/request')
const { get: getIn } = require('@gating-cli/utils')

/**
 * 获取npm包信息
 * @param { string } npmName 包名
 * @param { string } registry npm源
 * @returns { object } npm包信息
 */
function getNpmInfo(npmName, registry) {
  if (!npmName) {
    return null
  }
  const registryUrl = registry || getDefaultRegistry()
  const npmInfoUrl = urlJoin(registryUrl, npmName)
  return get(npmInfoUrl)
}

/**
 * 获取npm源
 * @param { boolean } isOriginal 是否是npm源
 * @returns { string } npm源
 */
function getDefaultRegistry(isOriginal = false) {
  return isOriginal ? 'https://registry.npmjs.org' : 'https://registry.npmmirror.com/'
}

/**
 * 获取npm包的所有版本
 * @param { string } npmName 包名
 * @param { string } registry npm源
 * @returns { array } npm包的所有版本
 */
async function getNpmVersions(npmName, registry) {
  const data = await getNpmInfo(npmName, registry)
  return Object.keys(getIn(data, 'versions', {}))
}

/**
 * 获取npm包的最新版本
 * @param {*} npmName npm包名
 * @param {*} registry npm源
 * @returns {string} npm的最新版本
 */
async function getNpmLatestVersion(npmName, registry) {
  let versions = await getNpmVersions(npmName, registry)
  return versions.sort((a, b) => ~~~semver.gt(b, a))[0]
}

module.exports = {
  getNpmInfo,
  getNpmVersions,
  getDefaultRegistry,
  getNpmLatestVersion
}
