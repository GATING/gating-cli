# gating-cli

[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

自用的脚手架，配合自用的模板

## Lerna 自定义 CHANGELOG

- [Custom Partials with Lerna and conventional-changelog](https://jaykariesch.medium.com/custom-partials-with-lerna-and-conventional-changelog-959aab0c7c3e)

## 安装：

```bash
npm install -g @gating-cli/cli
```

## 创建项目

项目初始化

```bash
gating-cli init <projectName>
```

> ps: projectName 可选，如果不指定则从当前文件夹创建项目

强制清空当前文件夹

```bash
gating-cli init --force
```

## 发布项目

发布项目

```bash
gating-cli publish
```

强制更新远程 Git 仓库

```bash
gating-cli publish --refreshServer
```

强制更新远程 Git 仓库

```bash
gating-cli publish --refreshToken
```

强制更新远程仓库类型

```bash
gating-cli publish --refreshOwner
```

## 清空缓存

清空所有缓存

```bash
gating-cli clean
```

清空缓存依赖文件

```bash
gating-cli clean --cache
```

## 环境信息

打印有关环境的调试信息

```bash
gating-cli info
```

## 更多

DEBUG 模式：

```bash
gating-cli --debug
```

调试本地包：

```bash
gating-cli init --targetPath xxxx
```

指定创建项目的文件路径：

```bash
gating-cli init --projectPath xxxx
```
