module.exports = {
  czConfig: {
    type: '选择你提交的信息类型:',
    scope: '选择本次提交的改变所影响的范围？',
    customScope: '本次提交的改变所影响的范围？',
    subject: '写一个简短的变化描述，尽量包含主谓宾结构，杜绝简单的单词：\n',
    body: '提供更详细的变更描述 (按 enter 跳过). 使用 "|" 换行：\n',
    breaking: '列出所有的不兼容变更 (按 enter 跳过)：\n',
    footer: '列出此次改动解决的所有 issues （如："#123, #234"）(按 enter 跳过)：\n',
    confirmCommit: '确认提交以上内容信息？'
  }
}
