---
title: 链表
date: 2025-11-28
tags: [算法]
---

```cpp
struct ListNode {
  int val;
  ListNode *next;
  ListNode(int x): val(x), next(nullptr) {}
};
```

## 链表反转

```cpp
ListNode* reverse_list(ListNode *head) {
  ListNode *pre = nullptr, *curr = head, *next = nullptr;
  while(curr) {
    next = curr->next;
    curr->next = pre;
    pre = curr;
    curr = next;
  }
  return pre;
}
```

## 合并两个有序链表

```cpp
ListNode* merge_list(ListNode* l1, ListNode* l2) {
  if(l1 == nullptr)  return l2;
  if(l2 == nullptr)  return l1;

  ListNode* head = (l1->val <= l2->val) ? l1 : l2;
  ListNode* pre = head;
  ListNode* curr1 = head->next;
  ListNode* curr2 = (head == l2) ? l1 : l2;

  while(curr1 != nullptr && curr2 != nullptr) {
    if(curr1->val <= curr2->val) {
      pre->next = curr1;
      curr1 = curr1->next;
    } else {
      pre->next = curr2;
      curr2 = curr2->next;
    }
    pre = pre->next;
  }

  if(curr1 == nullptr) pre->next = curr2;
  if(curr2 == nullptr) pre->next = curr1;
  return head;
}
```

## 链表相加

```cpp
ListNode* add_two_number(ListNode* l1, ListNode* l2) {

}
```

## 划分链表

待续
