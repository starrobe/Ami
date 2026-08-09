---
title: 排序
date: 2025-11-26
tags: [算法]
---

## 选择排序

- 0到n-1，选最小值放0位置

- 1到n-1，选最小值放1位置

- i到n-1，选最小值放i位置

```cpp
void select_sort(std::vector<int> &nums) {
  int n = nums.size();
  for(int i = 0; i < n - 1; ++i) {
    int k = i;
    for(int j = i + 1; j < n; ++j) {
      if(nums[j] < nums[k]) {
        k = j;
      }
    }
    std::swap(nums[i], nums[k]);
  }
}
```

## 冒泡排序

- 0到n-1，最大值冒到n-1

- 0到n-2，最大值冒到n-2

- 0到i，最大值冒到i

```cpp
void bubble_sort(std::vector<int> &nums) {
  int n = nums.size();
  for(int i = n - 1; i > 0; --i) {
    for(int j = 0; j < i; ++j) {
      if(nums[j] > nums[j+1]) {
        std::swap(nums[j], nums[j+1]);
      }
    }
  }
}
```

## 插入排序

- 0到0有序，1位置往左插入

- 0到1有序，2位置往左插入

- 0到i-1有序，i位置往左插入

```cpp
void insert_sort(std::vector<int> &nums) {
  int n = nums.size();
  for(int i = 1; i < n; ++i) {
    for(int j = i - 1; j >= 0 && nums[j] > nums[j+1]; --j) {
      std::swap(nums[j], nums[j+1]);
    }
  }
}
```

待续...
