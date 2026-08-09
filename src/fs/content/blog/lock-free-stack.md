---
title: 无锁的线程安全栈
date: 2023-08-13
tags: [C++, 并发编程]
---

> 选自《C++ Concurrency In Action》7.2.4

## 数据结构

```cpp
template <typename T>
class LockFreeStack {
 private:
  struct Node;
  struct CountNodePtr {
    int external_count;
    Node* ptr;
  };
  struct Node {
    std::shared_ptr<T> data;
    std::atomic<int> internal_count;
    CountNodePtr next;

    Node(const T& value)
        : data(std::make_shared<T>(value)), internal_count(0) {}
  };
  std::atomic<CountNodePtr> head;
};
```

> `std::atomic<CountNodePtr>`超过8字节，~~可能~~并不是无锁的，主要学习如何通过计数避免资源过早释放

### 为什么引用计数

正常通过链表实现的无锁栈

```cpp
class LockFreeStack {
private:
  struct Node {
    std::shared_ptr<T> data;
    Node* next;
  };
  std::atomic<Node*> head;

public:
  std::shared_ptr<T> pop() {
    Node* old_head = head.load(); // 1
    while(old_head && !head.compare_exchange_weak(old_head, old_head->next)); // 2
    std::shared_ptr<T> res = old_head ? old_head->data : std::make_shared<T>();
    delete old_head;
    return res;
  }
};
```

主要基于出栈时，线程a运行完步骤1后，线程b删除了该节点。因此线程a中的`old_head`变成了
悬空指针(并不是nullptr，但指向的空间被释放)，而步骤2中，调用CAS前需要计算实参`old_head->next`的值

因此在确保没有线程使用该结点前，不能释放该结点，引用计数可以解决该问题

### 为什么拆分引用计数

> https://stackoverflow.com/questions/67371033/how-does-the-split-reference-counting-work-in-a-lock-free-stack

~~还是看stackoverflow里老哥的回答吧，我也不明白为什么这么设计~~

将计数分为两个阶段

1. 计数器被拆分(`external_count`与`internal_count`)，两个的和才是结点的真正计数

    - 引用结点时，外部计数加一，结束访问时，内部计数减一
    - `external_count == -internal_count`时，引用为0，删除结点

2. 将外部计数加入到内部计数中，此时内部计数表示真正的计数

    内部计数为0时，删除结点

当其他线程引用结点时，外部计数加一。如果没有内部计数，在不再引用时，会递减计数，此时就需要
与递增时一样(`IncreaseHeadCount()`)循环调用CAS

## 入栈

1. 将当前结点的`next`指向栈顶`head`
2. 将当前结点设置为`head`

```cpp
void push(const T& value) {
  // 1. 创建结点，并计数
  CountNodePtr new_node;
  new_node.ptr = new Node(value);
  new_node.external_count = 1;

  // 2. 将新结点的next指向head
  new_node.ptr->next = head;

  // 3. 确保新结点的next指向的是最新的head
  // 并将新节点设为head
  while(!head.compare_exchange_weak(new_node.ptr->next, new_node));
}
```

## 出栈

出栈就是将栈顶(`head`)的`next`设为栈顶，然后删除旧的栈顶

```cpp
void IncreaseHeadCount(CountNodePtr& old_counter) {
  // new_counter只是个临时量
  counted_node_ptr new_counter;
  do {
    new_counter = old_counter;
    ++new_counter.external_count;
    // 如果head没变，head的外部计数加一
    // 如果head改变，old_counter拷贝head，然后head的外部计数加一
  } while(!head.compare_exchange_strong(old_counter, new_counter));
  old_counter.external_count = new_counter.external_count;
}

std::shared_ptr<T> pop() {
  CountNodePtr old_head = head.load();
  while (1) {
    // 获取头节点以及其外部计数
    IncreaseHeadCount(old_head);
    node* old_head_ptr = old_head.ptr;
    if (!old_head_ptr) return std::shared_ptr<T>();

    // 某个线程(线程a)进入后，其他线程就无法获取到当前结点了
    // 其他线程就两种情况:
    // 1. 刚进入pop，还没有IncreaseHeadCount()，那就与当前节点无关了，加载的是另外的结点
    // 2. 经过了这个IncreaseHeadCount()，引用的是与线程a相同的结点，此时只能结束对当前结点的引用
    // 内部计数减一，即执行else if的内容
    if (head.compare_exchange_strong(old_head, old_head_ptr->next)) {

      std::shared_ptr<T> res;
      res.swap(old_head_ptr->data);

      // head不再引用该结点，因此减一
      // 当前的old_head也将要超出作用域，再次减一
      // 该代码好像有些误导，需要看下面的部分才能明白此处的含义
      const int count_increase = old_head.external_count - 2;

      // 当前线程退出引用后，计数的第一阶段结束
      // 此时外部计数为external_count，而内部计数为internal_count - 2
      // 判断总计数 = external_count + (internal_count - 2)是否为0
      // 即判断internal_count == -(external_count - 2)
      // 此处解释了上面count_increase的定义，以及下面的if判断

      // 计数进入第二阶段，将外部计数加入到内部计数
      // internal_count = (internal_count - 2) + external_count
      // 也就是internal_count.fetch_add(external_count - 2)
      if (old_head_ptr->internal_count.fetch_add(count_increase) ==
          -count_increase) {
        delete old_head_ptr;
      }
      return res;
    } else if (old_head_ptr->internal_count.fetch_sub(1) == 1) {
      // internal_count.fetch_sub(-1)很好理解，其他线程退出对当前结点的引用，详情见if(CAS)处的注释
      // 对于internal_count == 1的判断
      // 一般来说internal_count肯定为0或者负数，即线程退出结点的引用而递减
      // 当internal_count为正数时，表示当前节点的计数由内部计数来表达(计数的第二阶段)
      // internal_count为1，表示只有当前线程持有该节点，因此退出引用，删除节点
      delete old_head_ptr;
    }
  }
}
```

## 内存模型

~~这部分更是重量级，个人水平有限~~

