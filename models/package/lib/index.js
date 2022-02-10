'use strict'

const path = require('path')
const fs = require('fs-extra')
const pkgDir = require('pkg-dir').sync
const npminstall = require('npminstall')
const { get, isObject } = require('@gating-cli/utils')
const { getDefaultRegistry, getNpmLatestVersion } = require('@gating-cli/get-npm-info')

class Package {
  constructor(options) {
    if (!options) {
      throw new Error('Package类的options参数不能为空！')
    }
    if (!isObject(options)) {
      throw new Error('Package类的options参数必须为对象！')
    }
    // package的目标路径
    this.targetPath = options.targetPath
    // 缓存package的路径
    this.storeDir = options.storeDir
    // package的name
    this.packageName = options.packageName
    // package的version
    this.packageVersion = options.packageVersion
    // package的缓存目录前缀
    this.cacheFilePathPrefix = this.packageName.replace('/', '_')
  }

  async prepare() {
    if (this.storeDir && !fs.pathExists(this.storeDir)) {
      fs.mkdirpSync(this.storeDir)
    }
    if (this.packageVersion === 'latest') {
      this.packageVersion = await getNpmLatestVersion(this.packageName)
    }
  }

  /**
   * 当前Package的缓存路径
   */
  get cacheFilePath() {
    return path.resolve(
      this.storeDir,
      `_${this.cacheFilePathPrefix}@${this.packageVersion}@${this.packageName}`
    )
  }

  /**
   * 获取指定版本的文件路径
   * @param { string } packageVersion
   * @returns
   */
  getSpecificCacheFilePath(packageVersion) {
    return path.resolve(
      this.storeDir,
      `_${this.cacheFilePathPrefix}@${packageVersion}@${this.packageName}`
    )
  }

  /**
   * 判断当前Package是否存在
   */
  async exists() {
    if (this.storeDir) {
      await this.prepare()
      return fs.pathExists(this.cacheFilePath)
    } else {
      return fs.pathExists(this.targetPath)
    }
  }

  /**
   * 安装Package
   */
  async install() {
    await this.prepare()
    return npminstall({
      root: this.targetPath,
      storeDir: this.storeDir,
      registry: getDefaultRegistry(),
      pkgs: [
        {
          name: this.packageName,
          version: this.packageVersion
        }
      ]
    })
  }

  /**
   * 更新Package
   */
  async update() {
    await this.prepare()
    // 1. 获取最新的npm模块版本号
    const latestPackageVersion = await getNpmLatestVersion(this.packageName)
    // 2. 查询最新版本号对应的路径是否存在
    const latestFilePath = this.getSpecificCacheFilePath(latestPackageVersion)
    // 3. 如果不存在，则直接安装最新版本
    if (!fs.pathExists(latestFilePath)) {
      await npminstall({
        root: this.targetPath,
        storeDir: this.storeDir,
        registry: getDefaultRegistry(),
        pkgs: [
          {
            name: this.packageName,
            version: latestPackageVersion
          }
        ]
      })
      this.packageVersion = latestPackageVersion
    } else {
      this.packageVersion = latestPackageVersion
    }
  }

  /**
   * 兼容window路径
   * @param { string } p 路径
   * @returns
   */
  formatPath(p) {
    if (p && typeof p === 'string') {
      const sep = path.sep
      if (sep === '/') {
        return p
      } else {
        return p.replace(/\\/g, '/')
      }
    }
    return p
  }

  /**
   * 获取入口文件的路径
   */
  getRootFilePath() {
    const _getRootFile = targetPath => {
      // 1. 获取package.json所在目录
      const dir = pkgDir(targetPath)
      if (dir) {
        // 2. 读取package.json
        const pkgFile = require(path.resolve(dir, 'package.json'))
        // 3. 寻找main/lib
        if (get(pkgFile, 'main')) {
          return this.formatPath(path.resolve(dir, pkgFile.main))
        }
      }
      return null
    }
    if (this.storeDir) {
      return _getRootFile(this.cacheFilePath)
    } else {
      return _getRootFile(this.targetPath)
    }
  }
}

module.exports = Package
