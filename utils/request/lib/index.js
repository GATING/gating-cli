'use strict'
const axios = require('axios')
const { get: getIn } = require('@gating-cli/utils')
const spinner = require('@gating-cli/spinner')

const { errorStatus } = require('./variables')

let loadingNum = 0
let globalLoading = null
const setLoading = () => {
  loadingNum += 1
  if (loadingNum === 1) {
    globalLoading = spinner()
  }
}
const deleteLoading = () => {
  loadingNum -= 1
  if (loadingNum === 0) {
    // 关闭loading
    globalLoading && globalLoading.stop(true)
  }
}

const request = axios.create({
  timeout: 10000
})

// request.defaults.baseURL = '';

const errorHandler = error => {
  deleteLoading()
  const status = getIn(error, 'response.status')
  error.message = errorStatus[status] || '未知错误'
  return Promise.reject(error)
}

// 请求拦截器
request.interceptors.request.use(
  config => {
    const { loading } = config
    if (typeof loading === 'undefined' || loading === true) {
      setLoading()
    }
    return config
  },
  error => errorHandler(error)
)

// 响应拦截器
request.interceptors.response.use(
  response => {
    const { data, config } = response
    const { loading } = config
    if (typeof loading === 'undefined' || loading === true) {
      deleteLoading()
    }
    return data
  },
  error => errorHandler(error)
)

function post(url, ...config) {
  return request.post(url, ...config)
}
function put(url, ...config) {
  return request.put(url, ...config)
}
function del(url, params, config) {
  return request.delete(url, {
    params,
    ...config
  })
}
function get(url, params, config) {
  return request.get(url, {
    params,
    ...config
  })
}

module.exports = {
  get,
  post,
  put,
  del,
  request
}
