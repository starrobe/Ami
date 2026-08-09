---
title: MESI协议以及内存屏障
date: 2023-08-10
tags: [并发编程]
---

## 缓存一致性

由于L1/L2 Cache是多个核心各自独有的，会带来缓存一致性的问题

> CPU Cache是由多个Cache Line组成，Cache Line也是CPU从内存读取数据的基本单位

![cpu](https://starrobe-blog.oss-cn-beijing.aliyuncs.com/images/cpu.png)

## MESI协议

- Modified，已修改
- Exclusive，独占
- Shared，共享
- Invalidated，已失效

![cpu memory1](https://starrobe-blog.oss-cn-beijing.aliyuncs.com/images/memory1.png)

> CPU要从主存读写数据，需要向总线发起事务(读事务或写事务)来从主存读取或者写入数据

假设有两个CPU，A与B，内存中n的值为1

| 操作 | CPU A Cache 中数据的状态 | CPU B Cache 中的数据的状态 |
|:---------------- | :---------------: | :---------------: |
| 1. B读取n时，此时Cache B中没有，从主存中读取 | - | n变为独占状态 |
| 2. A获取n时，此时Cache A中没有，而B收到总线通知，将n拷贝到Cache A| n变为共享状态 | n变为共享状态 |
| 3. A要修改n的值时，通过总线发送失效指令，A收到B的ACK后才能进行修改 | n变为独占状态 | n变为失效状态 |
| 4. A修改完毕后，如令n=2 | n变为已修改状态 | n变为失效状态 |
| 5. 当B再次获取n时，发现自己是失效的，需要向A请求 | n变为共享状态 | n变为共享状态 |


### Store Buffer

通过MESI保证了缓存一致性，即保证A与B缓存中的数据一致。但A的每次修改都需要等待B的ACK，会占用CPU的
利用率，因此引用Store Buffer

当CPU发送失效指令后，将修改的数据放入Store Buffer，然后执行其他命令。当其他CPU都响应了ACK后，
CPU Cache再从Store Buffer读取数据

### Store Forward

当修改后的数据还在Store Buffer，Cache中的数据仍是旧值时，CPU如果接到读取指令，会从Cache中读取到旧值。
因此，当CPU读取数据时，会先查看Store Buffer中有没有，如果有则直接读取Store Buffer里的值，如果没有才
读取Cache中的数据，这便是Store Forward

### 失效队列

所有的数据的修改都会存在Store Buffer中，而当Store Buffer满了后，CPU仍然需要等待ACK后才能进行修改。
当其他CPU收到失效指令后，要先将数据置为失效状态，然后再响应ACK，而此时CPU可能很忙，不能及时处理

因此加入失效队列，当CPU收到失效指令时，将其放入失效队列中，并直接返回ACK，等到空闲时再处理队列中的消息

![cpu memory2](https://starrobe-blog.oss-cn-beijing.aliyuncs.com/images/memory2.png)

> CPU的指令乱序执行是由Store Buffer以及失效队列造成的
>
> 假设缓存A，B中都有a，b。当CPU A先修改a后修改b时，可能会先收到b的ACK再收到a的ACK，即先修改b再修改a

## 内存屏障

Store Buffer不能保证最新的修改更新到主存，而CPU没有及时的读取失效队列的消息导致
缓存数据没能及时变为失效状态，而直接被读取

内存屏障简单的说就是禁用Store Buffer以及失效队列

- 在写入数据时，保证所有写入指令都执行完毕(Store Buffer都写入到Cache)
- 在读取数据时，保证所有失效队列的消息已经完成
