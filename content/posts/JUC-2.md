---
title: JUC-2
date: 2026-09-04 21:03:57
tags:
  - Java
  - 并发编程
  - 锁
categories: Java基础
---

上一篇的概念是真多，这一篇应该代码多，大头是 AQS。

## Lock 接口

上一篇结尾讲到了 synchronized，但它由于设计上的原因，有几个无法满足灵活需求的特性：

- 不可中断：获取锁的线程可以无限阻塞。
- 默认非公平：哪个线程能抢到锁看运气。
- 无超时机制：无法设置获取锁的最大等待时间。

显然不够灵活，为此，JUC 在 `java.util.concurrent.locks` 包下提供了 `Lock` 接口，在保留互斥语义的同时，扩展了更多可控能力。

```Java
public interface Lock {
    //获取锁，调用后一直阻塞，期间不响应中断
    void lock();
    //获取锁支持响应中断，被中断抛异常
    void lockInterruptibly() throws InterruptedException;
    //尝试获取锁，成功返回true，失败返回false
    boolean tryLock();
    //指定时间内尝试获取锁，超时未获取到锁返回false
    boolean tryLock(long time, TimeUnit unit) throws InterruptedException;
    //解锁
    void unlock();
    //创建一个绑定到当前 Lock 的 Condition，用于更精细的等待/唤醒
    Condition newCondition();
}
```

## 线程间的协作

### 常见的线程创建形式：

- 继承 `Thread` 类，重写 run() 方法。
- 实现 `Runnable` 接口，重写 run() 方法。
- 实现 `Callable` 接口，重写 call() 方法
- 使用线程池。

```Java
public class createThread {
    public static void main(String[] args) throws ExecutionException, InterruptedException {
        T1 thread1 = new T1();
        thread1.start();
        T2 t2 = new T2();
        Thread thread2 = new Thread(t2);
        thread2.start();
        T3 t3 = new T3();
        FutureTask<String> stringFutureTask = new FutureTask<>(t3);
        Thread thread3 = new Thread(stringFutureTask);
        thread3.start();
        System.out.println(stringFutureTask.get());
    }
}
class T1 extends Thread {
    @Override
    public void run() {
        System.out.println("我通过继承Thread创建线程。" + Thread.currentThread().getName());
    }
}
class T2 implements Runnable {
    @Override
    public void run() {
        System.out.println("我通过实现Runnable创建线程。" + Thread.currentThread().getName());
    }
}
class T3 implements Callable<String> {
    @Override
    public String call() throws Exception {
        System.out.println("我通过实现Callable创建线程。" + Thread.currentThread().getName());
        return "我是call返回结果";
    }
}
```

### 线程的6种状态

| 状态          | 说明                                      |
| ------------- | ----------------------------------------- |
| NEW           | 线程被创建但未启动                        |
| RUNNABLE      | 线程处于就绪（等待 CPU 时间片）或运行状态 |
| BLOCKED       | 线程被阻塞，等待获取锁                    |
| WAITING       | 线程等待其他线程的通知或中断              |
| TIMED_WAITING | 超时等待，时间结束返回运行状态            |
| TERMINATED    | 线程执行结束，生命周期终止                |

线程多种状态之间的切换如下图。

![三分恶面渣逆袭：Java线程状态变化](https://cdn.paicoding.com/tobebetterjavaer/images/sidebar/sanfene/javathread-7.png)

其中 `wait()`、`notify()`、`notifyAll()` 是顶层父类的方法。实现原理决定着他们必须配合 synchronized 使用。

当线程调用共享对象的 wait 方法时，会进入该对象的等待池（WaitSet），释放已经持有的锁，进入等待状态；当调用 notify 方法时，会唤醒等待池中的一个线程，使其进入锁池（EntryList），等待获取锁，注意：**被唤醒不代表立刻执行，而是要排队抢锁。**

有类似机制的还有 `Condition` 接口中的 `await()`、`signal()`、`signalAll()`，这些方法调用前必须持有对应的 `Lock.lock()`。

### wait() 和 sleep() 的区别

这两个方法都可以让线程进入等待状态，但略有不同。

- 所属类不同：前者 `Object`，后者 `Thread`。
- 锁行为不同：调用 `wait()` 会释放已持有的锁，而 `sleep()` 不会。
- 使用条件不同：`wait()` 调用前提是持有对象的锁（否则抛 `IllegalMonitorStateException`），而 `sleep()` 可以在任何地方调用。
- 唤醒方式不同：`sleep()` 时间结束后，线程会从 TIMED_WAITING 自动恢复到 RUNNABLE，等待 CPU 时间片；调用 `wait()` 后要么等待 `notify()`（无参），要么时间结束自动恢复 RUNNABLE（有参）。

### 经典实践：生产者消费者

```Java
public class ProducerConsumerExample {
    private static Object lock = new Object();
    private static int MAX = 10;
    private static Deque<Integer> queue = new ArrayDeque<>();
    private static Random rand = new Random();
    private static void produce() throws InterruptedException {
        synchronized (lock) {
            while (queue.size() == MAX) {
                System.out.println("it is full");
                lock.wait();
            }
            int value = rand.nextInt(100);
            queue.offer(value);
            System.out.println("produce:" + value + ", queue.size = " + queue.size());
            lock.notifyAll();
            //lock.wait();
        }
    }
    private static void consume() throws InterruptedException {
        synchronized (lock) {
            while (queue.isEmpty()) {
                System.out.println("it is empty");
                lock.wait();
            }
            Integer value = queue.poll();
            System.out.println("consume:" + value + ", queue.size = " + queue.size());
            lock.notifyAll();
            //lock.wait();
        }
    }
    public static void main(String[] args) {
        Thread t1 = new Thread(() -> {
            while (true) {
                try {
                    produce();
                } catch (InterruptedException e) {
                    throw new RuntimeException(e);
                }
            }
        });
        Thread t2 = new Thread(() -> {
            while (true){
                try {
                    consume();
                } catch (InterruptedException e) {
                    throw new RuntimeException(e);
                }
            }
        });
        t1.start();
        t2.start();
    }
}
```

当前代码输出类似生产十个消费十个的轮回。

假设初始队列为空，生产者先获得锁，生产一个，然后调用 `notifyAll()` 把消费者线程从等待池唤出到锁池。等生产者 synchronized 块结束，两个线程重新争抢锁，因为 CPU 调度策略的关系，总是让生产者继续占有锁（这是我从"连续生产 10 个才让出"这个现象推断出来的，并不绝对）。当生产满十个后，生产者释放锁并进入等待池，消费者线程才迎来机会进行消费。如果把注释去掉，则可以实现"生产一个、消费一个"的效果——因为消费者线程被唤醒进入锁池后，发现生产者没有和它竞争，便直接占有锁开始消费。

除了用 `wait/notify` 实现，还可以通过**前文讲到的** `Condition` 搭配 `await` 和 `signal`，通过创建两个 `Condition` 来实现精确唤醒。

```Java
package org.example.myblog.JUC;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Random;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

public class ProducerConsumerExample {
    private static int MAX = 10;
    private static Deque<Integer> queue = new ArrayDeque<>();
    private static Random rand = new Random();
    private static Lock lockPlus = new ReentrantLock(true);
    private static Condition notFull = lockPlus.newCondition();
    private static Condition notEmpty = lockPlus.newCondition();
    private static void producePlus() throws InterruptedException {
        /*
        * await 的本意是等一个能让其继续干活的条件，等一个率绿灯信号，而生产者的绿灯就是“队列不满”。
        * await 等待的永远是你“缺乏”的东西，而不是“拥有”的东西。
        * 一般命名的标准范式就是“not + 负面状态”
        * */
        lockPlus.lock();
        try {
            while (queue.size() == MAX) {
                System.out.println("it is full");
                notFull.await();//如果队列满了，就等待“不满”这个条件发生。
            }
            int value = rand.nextInt(100);
            queue.offer(value);
            System.out.println("produce:" + value + ", queue.size = " + queue.size());
            notEmpty.signal();
        } finally {
            lockPlus.unlock();
        }
    }
    private static void consumePlus() throws InterruptedException {
        lockPlus.lock();
        try {
            while (queue.isEmpty()) {
                System.out.println("it is empty");
                notEmpty.await();//如果队列空了，就等待“不空”这个条件发生。
            }
            Integer value = queue.poll();
            System.out.println("consume:" + value + ", queue.size = " + queue.size());
            notFull.signal();
        } finally {
            lockPlus.unlock();
        }
    }
    public static void main(String[] args) {
        Thread t1 = new Thread(() -> {
            while (true) {
                try {
                    producePlus();
                } catch (InterruptedException e) {
                    throw new RuntimeException(e);
                }
            }
        });
        Thread t2 = new Thread(() -> {
            while (true){
                try {
                    consumePlus();
                } catch (InterruptedException e) {
                    throw new RuntimeException(e);
                }
            }
        });
        t1.start();
        t2.start();
    }
}

```

总的来说 wait/notify 简单轻量，但唤醒粒度粗，`Condition` 一个 Lock 可以绑定多个条件，唤醒更准确。Lock 的底层，正是 JUC 的灵魂——AQS。

## AQS

在学习 AQS 之前，简单介绍一下 Doug Lea。Doug  Lea 是纽约州立大学奥斯威戈分校的计算机科学教授。他对 Java 最大的贡献，是主持制定了 [JSR-166](https://jcp.org/en/jsr/detail?id=166) 规范，这个规范的核心成果，就是在 JDK5.0 中引入了 `java.util.concurrent` 包，AQS 就是这个包的核心。Doug Lea 不仅为 Java 提供了并发工具，更奠定了一种严谨、优雅解决并发问题的范式，学习 AQS ，会有一种与大师对话的感觉😍。

AQS 全称为 `AbstractQueuedSynchronizer`，是整个 JUC 包的基石，`ReentrantLock`、`CountDownLatch`、`Semaphore` 等锁框架或者同步工具类都是基于 AQS 这个抽象类实现的。

下面我将按照这个类源码上方的注释来讲解 AQS：

### AQS 是什么

>Provides a framework for implementing blocking locks and related synchronizers (semaphores, events, etc) that rely on first-in-first-out (FIFO) wait queues. This class is designed to be a useful basis for most kinds of synchronizers that rely on a single atomic int value to represent state.

AQS 提供了一个框架用来实现依赖 FIFO 等待队列的阻塞锁和同步器（如信号量、事件等），它是一个类，绝大多数基于“一个原子 int 值表示状态”的同步器都可以用 AQS 来实现。

### 核心设计：state(volatile) + queue

AQS 把状态管理和排队机制进行了职责分离。

- AQS 负责线程排队、阻塞、唤醒等底层机制（final 方法，子类不能改）；
- 子类负责定义 state 的含义，以及如何获取/释放状态（protected 方法，子类必须重写）。

子类需要重写的方法有五个

| 方法                      | 模式 | 作用                                                         |
| ------------------------- | ---- | ------------------------------------------------------------ |
| tryAcquire(int arg)       | 独占 | 尝试获取资源，成功返回 true                                  |
| tryRelease(int arg)       | 独占 | 尝试释放资源，成功返回 true                                  |
| tryAcquireShared(int arg) | 共享 | 尝试获取资源，负数表示失败，0 表示无剩余资源，正数表示成功且有剩余 |
| tryReleaseShared(int arg) | 共享 | 尝试释放资源，成功返回 true                                  |
| isHeldExclusively()       | 独占 | 判断当前线程是否独占持有资源                                 |

AQS 就像地铁站的闸机系统，把人拦住（阻塞），把下一个人叫进来（唤醒）都是它的活；子类重写的方法就像验票规则，告诉闸机什么情况下验票通过。注意：AQS 是完全相信方法返回的布尔值的，如果在 `tryAcquire` 中返回了 true，但忘记把 state 由0改为1，AQS 仍认为当前线程获取了锁，当下一个线程进来，`tryAcquire` 仍然返回 true，仍然会放行，这样两个线程同时获取了资源，锁失效了。AQS 是信任你写的这五个方法的，不要让它失望。

这个设计就是模板方法模式。

### 独占与共享

| 模式     | 特点                           | 代表工具                  |
| -------- | ------------------------------ | ------------------------- |
| 独占模式 | 同一时刻只能有一个线程持有资源 | ReentrantLock             |
| 共享模式 | 同一时刻能有多个线程持有资源   | Semaphore, CountDownLatch |

两个模式共享同一个等待队列，比如 `ReentrantReadWriteLock`，读锁（共享）和写锁（独占）的线程在同一个队列中排队。

原注释以伪代码的形式给出了 AQS 的核心流（独占模式）

```Java
Acquire:
     while (!tryAcquire(arg)) {
        enqueue thread if it is not already queued;
        possibly block current thread;
     }

 Release:
     if (tryRelease(arg))
        unblock the first queued thread;
(Shared mode is similar but may involve cascading signals.)
```

### Condition 的支持

AQS 有个内部类 `ConditionObject`，用于**支持独占模式下的条件等待**。每个 `Condition` 都有自己的等待队列，线程调用 `await` 时，会从同步队列转移到条件队列，当被 `signal` 唤醒时，再从条件队列移回同步队列。这也是 `ReentrantLock` 能提供 `newCondition` 方法的原因。

### 插队 （Barge ahead）

AQS 默认允许"插队"，一个新来的线程可以在排队线程之前尝试获取锁，这样做的好处是减少上下文切换开销、提高吞吐量；另外还能避免 "convoy 效应"——即队首线程因某些原因没能拿到锁，导致后续线程全部陪葬、锁空闲浪费。

如果想实现公平锁，就在 `tryAcquire` 中调用 `hasQueuedPredecessors`，如果队列中有比当前线程更早的等待着，就返回 false，让当前线程去排队。

### 操作 AQS 的三个核心方法

| 方法                                       | 作用                                   |
| ------------------------------------------ | -------------------------------------- |
| getState                                   | 读取 state                             |
| setState(int)                              | 设置 state，非原子，拿到锁再用         |
| compareAndSetState(int expect, int update) | cas 方式更新 state，原子，用于竞争场景 |

第三个方法依赖 `unsafe` 类的 CAS 指令，它和 volatile 配合：volatile 保证可见性——当前线程看到的是从主内存读到的最新值——CAS 在此基础上做无锁更新；如果没有 volatile，CAS 的结果就可能不准，因为比较的可能是一个旧值。

### 完整示例

Doug Lea 在注释中还给出了一个完整的不可重入的互斥锁示例。在学习示例之前我想解释一个奇怪的现象，所有基于 AQS 构建的同步器，都去选择定义一个私有的静态内部类去继承 AQS，而不是让外部类本体直接继承。比如 `ReentrantLock` 的源码

```Java
public class ReentrantLock implements Lock, java.io.Serializable {
    private final Sync sync;
    abstract static class Sync extends AbstractQueuedSynchronizer {...}
}
```

Doug Lea 在注释中是这样说的

> Subclasses should be defined as non-public internal helper classes that are used to implement the synchronization properties of their enclosing class.

我觉得这样设计有两点考量：

1. 这是“有一个”，而不是“是一个”（组合优于继承）。`ReentrantLock` 是一个锁，他有一个排队器（AQS）而不是“是一个排队器”。也就是组合优于继承，继承是静态的、绑死的；组合是动态的、可控的，如果用继承，AQS 里的 `acquire()`、 `release()` 等方法全部对用户可见，用户可以调用 `lock.acquire()` 来绕过 `lock.lock()`，破坏了锁的语义。
2. 内部类 + 私有 = 隐藏实现细节。用户到手的 ReentrantLock 只需要用 lock/unlock，不需要知道底层复杂的等待队列。

至于为什么是 `private static final`，为什么 private 不解释。加 final 是为了保证 sync 在构造后的可见性，当对象被正确构造后，其他线程看到的 final 字段一定是初始化完成的值，不会是 null 或半成品（效果和上一篇的 volatile 类似，上篇末尾提了一下）。为什么不加 static，看一下 deepseek 的解释：

> - **如果不加 `static`**：内部类会隐式持有一个指向外部类 `ReentrantLock` 实例的引用（即 `this$0`）。这意味着只要 `Sync` 对象还活着，`ReentrantLock` 对象就永远无法被 GC 回收，存在内存泄漏风险。
> - **加了 `static` 之后**：`Sync` 和 `ReentrantLock` 之间没有隐式的引用关系。`Sync` 只负责排队逻辑，不需要访问 `ReentrantLock` 的任何实例字段和方法。它需要的外部信息（如公平策略）都通过构造函数传入，而不是通过持有外部类引用来获取。

接下来开始学习示例代码，这部分结束这篇就结束了。

示例代码是一个不可重入、不处理中断、非公平的独占锁。

#### 第一层：整体骨架

```Java
class Mutex implements Lock, java.io.Serializable {
    // 内部辅助类：继承 AQS
    private static class Sync extends AbstractQueuedSynchronizer { ... }
    
    // 持有一个 Sync 实例（组合）
    private final Sync sync = new Sync();
    
    // 对外暴露的 API —— 全部委托给 sync
    public void lock() { sync.acquire(1); }
    public void unlock() { sync.release(1); }
    // ...
}
```

#### 第二层：Sync 的五个关键方法

为什么有的 public，有的 protected？怎么知道要写哪些方法，不是五个吗

```Java
// public 是因为被设计为供外部类直接调用的 API，下文 tryLock 里会直接调用
public boolean tryAcquire(int acquires) {
    // 先进行断言，该锁不涉及重入，每次只需要把 state 从 0 变为 1
    assert acquires == 1;
    // 原子操作，如果抢锁成功，则设置当前持有锁的线程为“持有锁的线程”
    if (compareAndSetState(0, 1)) {
        setExclusiveOwnerThread(Thread.currentThread());
        return true;
    }
    return false; // 锁被占用，获取失败
}

// protected 是因为 unlock 并没有直接调用，而是直接调用 sync.release(1)
// release(1) 是 AQS 定义的，内部自动回调 tryRelease。
// 所以 tryRelease 对外部类 Mutex 不可见。
protected boolean tryRelease(int releases) {
    assert releases == 1; // 同上
    // 如果当前线程不是持有锁的线程就抛异常
    if (!isHeldExclusively())
        throw new IllegalMonitorStateException();
    setExclusiveOwnerThread(null);
    setState(0); // 不需要原子操作，因为走到这一步说明当前线程已经持有锁
    return true;
}

public boolean isHeldExclusively() {
    // a data race, but safe due to out-of-thin-air guarantees
    //标记一下这个注释，我觉得现阶段我理解不了，或许几个月后再回过头来我会有新的体会
    return getExclusiveOwnerThread() == Thread.currentThread();
}

public boolean isLocked() {
    return getState() != 0;
}

public Condition newCondition() {
    return new ConditionObject(); // 看清楚
}
```

#### 第三层：外部类

```java
private final Sync sync = new Sync();

public void lock()              { sync.acquire(1); }
public boolean tryLock()        { return sync.tryAcquire(1); }
public void unlock()            { sync.release(1); }
public Condition newCondition() { return sync.newCondition(); }
public boolean isLocked()       { return sync.isLocked(); }
public boolean isHeldByCurrentThread() { return sync.isHeldExclusively(); }
public boolean hasQueuedThreads() { return sync.hasQueuedThreads(); }
public void lockInterruptibly() throws InterruptedException {
    sync.acquireInterruptibly(1);
}
public boolean tryLock(long timeout, TimeUnit unit) throws InterruptedException {
    return sync.tryAcquireNanos(1, unit.toNanos(timeout));
}
```

基本结束了，还有一点，就是关于 AQS 序列化和反序列化的问题。

同步队列的节点在 AQS 父类中被 transient 修饰，表示序列化时不考虑这些字段。序列化时只处理非 transient 字段，但对于 ReentrantLock 来说，只会序列化 Sync 对象，而 Sync 里的 state 等关键状态会被保存；反序列化时，Sync 类中重写了 readObject 方法，确保无论锁在序列化前处于什么状态，反序列化后都会变成一个全新的，处于未锁定状态的锁。

这篇写了好几天，反复问 deepseek 老师，还让它打磨了一下，内容实在太多了，源码编写者太强了。下一篇讲 AQS 具体的实现。
