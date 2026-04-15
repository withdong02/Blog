---
title: LeetCode8.字符串转换整数
date: 2026-02-15 14:04:24
tags:
  - 力扣
  - Java
categories: 算法
---
一切源于一道题目：[8. 字符串转换整数 (atoi) - 力扣（LeetCode）](https://leetcode.cn/problems/string-to-integer-atoi/description/)

考虑这样一个问题：给你一个数字字符串，如何在32位环境下安全的处理可能超过`[-2^31, 2^31 - 1]`范围的数字，不能使用64位变量临时存储。

因为我熟悉Java， 所以下面提到的数据类型都为 Java 中的数据类型。

```Java
Integer.MAX_VALUE = 2^31 - 1 = 2147483647;
Integer.MIN_VALUE = -2^31 = -2147483648;
```

首先题目说不能使用64位变量，所以 Long 类型不能使用，那就一步一步累加，具体思路就是设置两个变量 `digit, res`，从头到尾遍历字符串每一位，同时计算 `res = res * 10 + digit`。但这样的话，累加过程中 `res` 可能会无征兆直接溢出，程序直接抛异常。那怎么办，介绍一下从 [K神题解](https://leetcode.cn/problems/string-to-integer-atoi/solutions/2361399/8-zi-fu-chuan-zhuan-huan-zheng-shu-atoiq-a2e8/) 里学来的方法。

整体思路也是一步一步累加，但提前预判溢出。

这里有个核心变量 `bndry = 2^31 / 10 = 214748364`，，它是32位有符号整数最大值去掉最后一位的结果。

在执行 `res = res * 10 + digit` 之前，先检查 `res` 与 `bndry` 的关系，有下面两种溢出的可能。

- 情况一：`res > bndry` ，意味着 `res` 乘10后，即使加上最小的数字0，结果也会超过 2147483647，溢出。
- 情况二：`res == bndry`，此时是否溢出取决于要累加的数字  `digit`。
	- 如果 `digit <= 7`，此时正数负数都不会溢出，但等于七对正数来说已经达到最大值。
	- 如果 `digit = 8`，拼接后值为 2147483648，比 `Integer.MAX_VALUE` 大 1，而负数即 -2147483648 还未溢出。
	- 如果 `digit > 8`，正数负数都溢出。

思路还是很清晰的，在下一位拼接前进行判断可以很好的避开溢出问题。下面看一下题解代码

```java
class Solution {
    public int myAtoi(String s) {
        char[] chars = s.trim().toCharArray();
        if (chars.length == 0) return 0;
        int res = 0;
        int bndry = Integer.MAX_VALUE / 10;
        int i = 1, sign = 1;
        if (chars[0] == '-') {
            sign = -1;
        } else if (chars[0] != '+') {
            i = 0;
        }
        for (int j = i; j < chars.length; j++) {
            if (chars[j] < '0' || chars[j] > '9') break;
            if (res > bndry || (res == bndry && chars[j] > '7')) {
                return sign == 1 ? Integer.MAX_VALUE : Integer.MIN_VALUE;
            }
            res = res * 10 + chars[j] - '0';
        }
        return sign * res;
    }
}
```

判断条件 `chars[j] > '7'` 对正数和负数同样有效。当 `digit = 8` 时，正数已溢出，返回 `Integer.MAX_VALUE`；负数虽然未溢出，但此时返回 `Integer.MIN_VALUE` 恰好就是正确结果。

其实除了下面的溢出判断，K神对首字符的处理也很妙，大佬不愧是大佬。