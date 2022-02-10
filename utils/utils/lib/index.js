'use strict'

const { spawn } = require('child_process')

/**
 * 获取指定的类型
 * @param { string } type 类型
 */
function isType(type) {
  return function (obj) {
    return {}.toString.call(obj) == '[object ' + type + ']'
  }
}

const isObject = isType('Object')
const isString = isType('String')
const isArray = Array.isArray || isType('Array')

/**
 * 根据对象的 path 路径获取值。 如果解析 value 是 undefined 会以 defaultValue 取代。
 * @param { object } obj 对象
 * @param { string | array } keyList 属性列表 或 字符串用.分割
 * @returns { * } 如果正常访问到，则返回对应的值，否则返回 undefined
 */
function get(obj, keyList, defaultValue) {
  let keys = keyList
  if (!isArray(keyList)) {
    keys = keyList.split('.')
  }
  return keys.reduce((result, key) => result[key] || defaultValue, obj)
}

/**
 * 生成一个新进程执行命令
 * @param { string } command 要运行的命令。
 * @param { string[] } args
 * @param { object } options 字符串参数列表。
 */
function exec(command, args, options) {
  const win32 = process.platform === 'win32'
  const cmd = win32 ? 'cmd' : command
  const cmdArgs = win32 ? ['/c'].concat(command, args) : args
  return spawn(cmd, cmdArgs, options || {})
}

/**
 * 生成一个新进程执行命令，异步方法
 * @param { string } command 要运行的命令。
 * @param { string[] } args
 * @param { object } options 字符串参数列表。
 */
function execAsync(command, args, options) {
  return new Promise((resolve, reject) => {
    const process = exec(command, args, options)
    process.on('error', e => {
      reject(e)
    })
    process.on('exit', c => {
      resolve(c)
    })
  })
}

module.exports = {
  isObject,
  isArray,
  isString,
  exec,
  execAsync,
  get
}
