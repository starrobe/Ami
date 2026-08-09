---
title: C++的`\?`
date: 2025-05-11
tags: [C++]
---

## 引言

在重读《C++ Primer》2.1 基本数据类型的时候，发现在C++的转义序列里面有个之前没注意到的细节`\?`

![escape sequence](https://starrobe-blog.oss-cn-beijing.aliyuncs.com/images/cplusplus_escape_sequence.jpg)

遂打开vscode发现`\?`与`?`并没有什么区别

## Trigraph

那么为什么问号需要转义字符来表示它本身，显然它确实有特殊含义

trigraph三字符组，最早设计出来解决某些键盘不能输入某些编程必须的字符问题

| Trigraph | Equivalent |
| ------------- | -------------- |
| `??=` | `#` |
| `??/` | `\` |
| ``??` `` | `^` |
| `??(` | `[` |
| `??)` | `]` |
| `??!` | `\|` |
| `??<` | `{` |
| `??>` | `}` |
| `??-` | `~` |

及当同时使用`??`时，需要对问号进行转义，避免编译器将其误解释为一个trigraph
