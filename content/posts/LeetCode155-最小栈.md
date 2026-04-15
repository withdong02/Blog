---
title: LeetCode155.最小栈
date: 2026-02-26 14:17:10
tags:
  - 力扣
  - 栈
categories: 算法
---
第二次碰到这道题了，又学了两种解题方法，记录一下。

### 题目介绍

设计一个支持 `push` ，`pop` ，`top` 操作，并能在常数时间内检索到最小元素的栈。

实现 `MinStack` 类:

- `MinStack()` 初始化堆栈对象。
- `void push(int val)` 将元素val推入堆栈。
- `void pop()` 删除堆栈顶部的元素。
- `int top()` 获取堆栈顶部的元素。
- `int getMin()` 获取堆栈中的最小元素。

### 解法一：使用辅助栈

这个也是最简单的，题目没有空间限制，考虑使用两个栈，主栈正常记录元素进出，辅助栈记录每个元素对应最小值的进出，辅助栈的栈顶保持为主栈所有元素的最小值。

当元素入栈时，比较该元素和辅助栈的栈顶，如果该元素更小，那么将其推入主栈的同时也将其推入辅助栈。

当元素出栈时，如果主栈栈顶元素值和辅助栈的栈顶元素值相等。那么将该元素从两个栈里同时弹出，否则正常弹出主栈栈顶元素。

```Java
class MinStack {
    Deque<Integer> stack1;
    Deque<Integer> stack2;
    public MinStack() {
        stack1 = new ArrayDeque<>();
        stack2 = new ArrayDeque<>();
    }
    
    public void push(int val) {
        stack1.push(val);
        if (stack2.isEmpty() || val <= stack2.peek()) {
            stack2.push(val);
        }
    }
    
    public void pop() {
        int num = stack1.pop();
        if (num == stack2.peek()) stack2.pop();
    }
    
    public int top() {
        return stack1.peek();
    }
    
    public int getMin() {
        return stack2.peek();
    }
}
```

### 解法二：使用自定义链表

评论区有评论说面试官要求使用栈以外的数据结构来设计，所以找到这种方法。

每个节点存储三个值：该节点的值，整个链表的最小值，指向下一个节点的指针。我设计的是头插法，`head` 指向表头，也可以看作栈顶。

```Java
class Node {
    int val;
    int minVal;
    Node next;
    public Node(int val, int minVal) {
        this.val = val;
        this.minVal = minVal;
    }
    public Node(int val, int minVal, Node next) {
        this.val = val;
        this.minVal = minVal;
        this.next = next;
    }
}
class MinStack {

    Node head;
    public MinStack() {
        
    }
    
    public void push(int val) {
        if (head == null) {
            head = new Node(val, val);
        } else {
            head = new Node(val, Math.min(val, head.minVal), head);
        }
    }
    
    public void pop() {
        head = head.next;
    }
    
    public int top() {
        return head.val;
    }
    
    public int getMin() {
        return head.minVal;
    }
}
```

### 解法三：使用O(1)的辅助空间

如果只是存储节点值使用 int 即可，而中间要计算差值，考虑到溢出的可能性，所以使用 long 类型来存储。注意 long 和 int 之间的转换。

```java
class MinStack {
    Deque<Long> stack = new ArrayDeque<>();
    long min;
    public MinStack() {

    }

    public void push(int val) {
        if (stack.isEmpty()) {
            stack.push(0L);
            min = val;
        } else {
            long diff = val - min;//栈里存储的是差值
            stack.push(diff);
            if (diff < 0) min = val;//差值小于0，说明要更新min
        }
    }

    public void pop() {
        Long pop = stack.pop();
        if (pop < 0) min -= pop;
        //如果pop小于0.说明当时推入栈时val<min，min被更新了。
        //而现在这个值要弹出，min也要恢复之前较大的状态。
    }

    public int top() {
        Long peek = stack.peek();
        //如果peek小于0，说明栈顶就是最小值
        if (peek < 0) return (int)min;
        //否则计算正常值，因为栈中存储的是偏移量
        return (int)min + peek.intValue();
    }

    public int getMin() {
        return (int)min;
    }
}
```