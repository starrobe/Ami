---
title: 二分搜索
date: 2025-11-27
tags: [算法]
---

## 在有序数组中确定num的存在

```cpp
bool binary_search(std::vector<int> &nums, int target) {
  int l = 0, r = nums.size() - 1;
  int m = 0;
  while(l <= r) {
    m = l + (r - l) / 2;
    if(nums[m] == target) return true;
    else if(nums[m] > target ) r = m - 1;
    else l = m + 1;
  }
  return false;
}
```

## 在有序数组中找>=num的最左位置

```cpp
int binary_search(std::vector<int> &nums, int target) {
  int l = 0, r = nums.size() - 1;
  int m = 0;
  int index = -1;
  while(l <= r) {
    m = 1 + (r - l) / 2;
    if(nums[m] >= target) {
      index = m;
      r = m - 1;
    }
    else {
      l = m + 1;
    }
  }
  return index;
}
```

## 在有序数组中找<=num的最右位置

```cpp
int binary_search(std::vector<int> &nums, int target) {
  int l = 0, r = nums.size() - 1;
  int m = 0;
  int index = -1;
  while(l <= r) {
    m = 1 + (r - l) / 2;
    if(nums[m] <= target) {
      index = m;
      l = m + 1;
    }
    else {
      r = m - 1;
    }
  }
  return index;
}
```


## 二分搜索不一定在有序数组上

[leetcode 162.寻找峰值](https://leetcode.cn/problems/find-peak-element/description/)

```cpp
int find_peak(std::vector<int> &nums) {
  int n = nums.size();
  if(n == 1) return 0;
  if(nums[0] > nums[1]) return 0;
  if(nums[n-1] > nums[n-2]) return n-1;

  int l = 1, r = n - 2, m = 0, ans = -1;
  while(l <= r) {
    m = l + (r - l) / 2;
    // 小于左边的数，那么极值点一定在左边
    // 右边可能也有但只要求返回一个极值点，不管右边
    if(nums[m] < nums[m-1]) r = m - 1;
    // 大于左边的数，小于右边的数，极值点一定在右边
    else if(nums[m] < nums[m+1]) l = m + 1;
    // 大于左边又大于右边，返回极值点
    else{
      ans = m;
      break;
    }
  }
  return ans;
}
```

另一种if判断

```cpp
int find_peak(std::vector<int> &nums) {
  int n = nums.size();
  if(n == 1) return 0;
  if(nums[0] > nums[1]) return 0;
  if(nums[n-1] > nums[n-2]) return n-1;

  int l = 1, r = n - 2, m = 0, ans = -1;
  while(l <= r) {
    m = l + (r - l) / 2;
    if(nums[m] > nums[m-1] && nums[m] > nums[m+1]){
      ans = m;
      break;
    }
    else if(nums[m] < nums[m-1]) r = m - 1;
    else l = m + 1;
  }
  return ans;
}
```

注意初始l，r的值，如果`int l = 0, r = n - 1`，当m为0或者n-1时，m-1或m+1会越界


## 二分答案法

待续...
