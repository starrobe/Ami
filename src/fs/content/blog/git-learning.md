---
title: Git学习记录
date: 2023-02-03
tags: [Git]
---

> git官网书籍[《Pro Git》](https://git-scm.com/book/zh/v2)

## 目录

- 基础
    - 更新与提交：add, status, diff, commit, rm, mv
    - 提交历史：log
    - 撤销：restore
    - 远程仓库: remote
    - 标签：tag
    - 别名
    - .gitingore
- 分支
    - 远程分支
    - 变基：rebase
- 原理
    - 对象
    - 引用
- ...

## Git基础

### 更新与提交

工作目录下的文件只有两种状态：***已跟踪***, ***未跟踪***，对于已跟踪的文件，只有暂存的文件才会被提交

- `git status`查看状态
- `git add <file>`跟踪文件以及将文件暂存(staged)
- `git diff`查看未暂存的修改
    - `--staged`或`--cached`查看暂存文件与上次提交的文件差异
- `git commit`提交文件，提交前`git status`下确认所需文件是否在暂存区
    - `-a`可跳过暂存阶段，直接将跟踪文件暂存提交
- `git rm <file>`删除已跟踪文件。相当于`rm <file>`后，`git add`进暂存区，与创建文件后`git add<file>`对应~~个人理解，可能有误~~。

    当`<file>`修改过或已暂存后，可使用：

    - `-f`安全特性，防止未添加到快照的数据误删
    - `--cached`仅仅从暂存区删除，文件还在

- `git mv <file_a> <file_b>`等价于：

    ~~~
    $ mv file_a file_b
    $ git rm file_a
    $ git add file_b
    ~~~

### 查看提交历史

`git log`

- `-p`或`--patch`，以**补丁**的格式输出每次提交的所引入的差异
- `--stat`每次提交的简略统计信息
- `--pretty=oneline`一行显示一条提交，其他样式`--pretty=short`，`--pretty=full`，`--pretty=fuller`仅信息详细程度不同
- `--pretty=format`自定义输出格式
- `--graph`更形象的显示分支
- `-<n>`如`git log -2`显示两条记录
- `--since=<time_a>`与`--until=<time_b>` ，显示从`time_a`到`time_b`的提交
- `--after=<time_a>`与`--before=<time_b>`与上条相同
- `-S <string>`过滤器，只显示增加或删除该字符串的提交
- 其他。。。

比如：

~~~
$ git log --pretty="%h - %s" --author='Junio C Hamano' --since="2008-10-01" \
   --before="2008-11-01" --no-merges -- t/
~~~

`-- t/`指对t文件夹的提交

### 撤销操作

- `git commit --amend`重新提交，替代上一次的提交结果，如：

    ~~~
    $ git commit -m 'initial commit'
    $ git add forgotten_file
    $ git commit --amend
    ~~~

- `git restore --staged <file>`取消暂存
- `git restore <file>`撤销修改

~~上两条与《Pro Git》不同，可能更新了~~

### 远程仓库

- `git remote`查看远程仓库
    - `-v`显示远程仓库以及url
    - `add <shortname> <url>`添加新的远程仓库并指定简写
    - `show <remote>`查看`remote`的信息
    - `rename <remote> <new_remote>`远程仓库重命名
    - `remove <remote>`或者`rm <remote>`移除`remote`仓库
- `git fetch <remote>`访问`remote`仓库，拉取没有的数据
- `git push <reomte> <branch>`推送

### 标签

`git tag`列出所有标签可带`-l`或`--list`。

而标签分为轻量与附注，附注标签包含打标签人的信息、日期等，另外可以附加标签信息

- `git tag <tagname>`创建轻量标签
- `git tag -a <tagname> -m <tag_message>`创建附注标签
- `git tag -a <tagname> <commit>`为`commit`打标签，`commit`为提交的完整或部分校验和
- `git show <tagname>`查看标签信息与对应的提交信息
- `git push <remote> <tagname>`推送标签，或`git push <remote> --tags`推送所有标签
- `git tage -d <tagname>`删除标签，同时`git push <remote>:refs/tags/<tagname>`或`git push <remote> --delete <tagname>`删除远程仓库的标签
- `git checkout <tagname>`检出标签

### 别名

~~敬请期待~~

## Git分支

- `git branch`列出分支
    - `-v`查看每个分支的最后一次提交
    - `<branch>`创建分支
    - `-d <branch>`删除分支
    - `--merged`和`--no-merged`已经与当前分支合并和未合并的分支
- `git checkout <branch>`分支切换
    - `git checkout -b <branch>`创建并切换分支
- `git merge <branch>`合并分支
    - 顺着分支能到达另一分支时，只会简单的指针前进（右移），合并操作并无分歧，叫做`fast-forward`
    - 两分支岔开（diverged），会与两分支的共同祖先三方合并，创建一个新的提交。而遇到*冲突*，即两个分支对同一文件进行修改，会进行合并但没创建提交，需修改后自行提交

### 远程分支

远程跟踪分支*检出*本地分支会自动创建"跟踪分支"（所跟踪的分支称为上游分支），使用
`git checkout -b <branch> <remote>/<branch>`或`git checkout --track <remote>/<branch>`

而*已有的*本地分支需要跟踪或者修改上游分支则可以使用：
`git branch -u <remote>/<branch>`或着`--set-upstream-to`

同时可以使用`@{u}`或`@{upstream}`代表上游分支，如`git merge @{u}`代替`git merge origin/main`
可使用`git branch -vv`来查看本地与上游分支的更多信息

删除远程分支`git push <remote> --delete <branch>`

### 变基

`git rebase <branch>`
待续。。。

---

## Git内部原理

~~太无聊了~~
`.git`中重要文件：`HEAD`文件、`index`文件、`objects`目录、`refs`目录

### objects目录

保存所有数据，以Key-Value存储。通过`git hash-object`演示存储效果：

~~~
$ echo "hello" | git hash-object -w --stdin
ce013625030ba8dba906f756967f9e9ca394464a
~~~

`-w`写入数据库，`--stdin`从标准输入读取，或直接`git hash-object -w <file>`。通过`git cat-file`读取数据：

~~~
$ git cat-file -p ce013625030ba8dba906f756967f9e9ca394464a
hello
~~~

只保存了文件内容没有文件名等信息，该类型对象称为数据对象（blob object）。通过`-t`读取数据类型

~~~
$ git cat-file -t ce013625030ba8dba906f756967f9e9ca394464a
blob
~~~

#### 树对象

一个树对象有一条或多条树对象记录（tree entry），每条记录指向：文件模式、类型、数据对象或者子树对象的指针、文件名信息。

~~~
$ git cat-file -p main^{tree}
100644 blob 45f16d261584a37f3c3f3f631c7c08d0958baa2a    init.lua
100644 blob 7bf88613cead41206b364137ca310a829645f228    lazy-lock.json
040000 tree aff0b5e3d38b57a379d538056f60fa6f7a386fd0    lua
~~~

#### 提交对象

包含树对象的SHA-1值、父提交对象、作者信息以及提交注释

#### 对象存储

假设数据为`content = "hello"`，令`header = "blob #{content.length}\0"`，
头部信息为对象类型 + 空格 + 数据的字节数 + 空字节。即`blob 5\u0000`

而`store = heander + content`，Git会对`store`计算SHA-1校验和（作为Key）。
由zlib压缩后即为对象的内容（Value）数据对象的`content`无限制但树对象与提交对象的内容固定

### 引用

`.git/refs`目录下的含有SHA-1值的文件

- `echo 1a410efbd13591db07496601ebc7a059dd55cfe9 > .git/refs/heads/master`
- `git update-ref refs/heads/master 1a410efbd13591db07496601ebc7a059dd55cfe9`，git提供的方法更安全

> Git分支的本质就是一个指向某一系列提交之首的指针或引用

#### HEAD引用

运行`git branch <branch>`时，通过HEAD文件获取最新提交的SHA-1值

> HEAD文件通常是一个符号引用，即指向其他引用的指针

#### 标签引用

除三种主要对象类型外，还有标签对象。

而标签就是一个引用

- 轻量标签：

    ~~~
    $ git update-ref refs/tags/v1.0 cac0cab538b970a37ea1e769cbbde608743bc96d
    ~~~

- 附注标签：

    ~~~
    $ git tag -a v1.1 1a410efbd13591db07496601ebc7a059dd55cfe9 -m 'test tag'
    $ cat .git/refs/tags/v1.1
    9585191f37f7b0fb9444f35a9bf50de191beadc2
    ~~~

    先创建标签对象再通过*引用*指向标签对象，通过`git cat-file -p`得到：

    ~~~
    $ git cat-file -p 9585191f37f7b0fb9444f35a9bf50de191beadc2
    object 1a410efbd13591db07496601ebc7a059dd55cfe9
    type commit
    tag v1.1
    tagger Scott Chacon <schacon@gmail.com> Sat May 23 16:48:58 2009 -0700

    test tag
    ~~~

    > 标签对象并不一定需要指向提交对象，也可以为数据对象或树对象打标签

#### 远程引用

保存在`refs/remotes`下。当添加了远程仓库并进行推送，Git会记录最近一次推送的每一个分支对应的值，并保存在`refs/remotes`目录下：

~~~
$ git remote add origin git@github.com:schacon/simplegit-progit.git
$ git push origin master
Counting objects: 11, done.
Compressing objects: 100% (5/5), done.
Writing objects: 100% (7/7), 716 bytes, done.
Total 7 (delta 2), reused 4 (delta 1)
To git@github.com:schacon/simplegit-progit.git
   a11bef0..ca82a6d  master -> master
~~~

而查看`refs/remotes/origin/master`文件

~~~
$ cat .git/refs/remotes/origin/master
ca82a6dff817ec66f44342007202690a93763949
~~~

即为`origin/master`分支的SHA-1值

---

> 学习[Learn Git Branching](https://learngitbranching.js.org/?locale=zh_CN)记录

### 相对引用

- `^`，例如`HEAD^`表示`HEAD`的上一次提交
    - `^{num}`，一个提交可能有多个父节点，`num`表示选择第几个父节点
- `~{num}`，例如`main~3`表示`main`的上三次提交

### 扩展

- `git branch -f <branch> <commit>`将`branch`分支指向`commit`提交
- `git switch -c <branch>`等同于`git checkout -b <branch>`

#### 撤销变更

- `git reset <commit>`将当前分支回退到`commit`提交上
- `git revert <commit>`反做`commit`的操作后添加提交



待续。。。

