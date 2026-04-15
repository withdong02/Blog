---
title: Java序列化与反序列化
date: 2025-07-07 21:03:57
tags:
  - Java
  - 序列化
categories: Java基础
---



##  什么是序列化和反序列化

序列化，人话讲就是将对象转换为字节序列（也可以是JSON、XML等文本格式），反序列化就是把这个过程倒置。

下面是维基百科关于序列化的介绍

> **序列化**（serialization）在[计算机科学](https://zh.wikipedia.org/wiki/計算機科學)的资料处理中，是指将[数据结构](https://zh.wikipedia.org/wiki/資料結構)或[对象](https://zh.wikipedia.org/wiki/物件_(计算机科學))状态转换成可取用格式（例如存成文件，存于缓冲，或经由网络中发送），以留待后续在相同或另一台计算机环境中，能恢复原先状态的过程。依照序列化格式重新获取[字节](https://zh.wikipedia.org/wiki/位元组)的结果时，可以利用它来产生与原始对象相同语义的副本。对于许多对象，像是使用大量[引用](https://zh.wikipedia.org/wiki/參照)的复杂对象，这种序列化重建的过程并不容易。面向对象中的对象序列化，并不概括之前原始对象所关系的函数。这种过程也称为对象编组（marshalling）。从一系列字节提取数据结构的反向操作，是**反序列化**（也称为解编组、deserialization、unmarshalling）。

对于Java这种面向对象的编程语言来说，是对实例化后的对象进行序列化，而对于C++这种半面向对象的编程语言来说，序列化的目标不仅有对象（class）还有数据结构（struct）

## 序列化的使用场景

1. 数据存储：比如序列化可以将存储在 JVM 堆区中的对象转换成字节序列，从而实现持久化。

2. 网络通信：将对象转换为字节序列方便其在网络中进行传递和接收。

## 使用Java实现序列化

以 JDK 自带序列化方法为例，实现`java.io.Serializable`接口

```java
@Data
public class Cat implements Serializable {
    private int age;
    private String name;
    private Date birth;
}
```

序列化演示：

```Java	
public class serializeTest {
    public static void main(String[] args) {
        Cat cat = new Cat();
        cat.setName("tom");
        cat.setAge(2);
        cat.setBirth(new Date());
        //使用ObjectOutputStream将cat对象序列化并存入test1.txt文件中
        try (FileOutputStream fileOutputStream = new FileOutputStream("test1.txt");
             ObjectOutputStream objectOutputStream = new ObjectOutputStream(fileOutputStream)) {
            objectOutputStream.writeObject(cat);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
```

反序列化演示：

```Java
public class deserializeTest {
    public static void main(String[] args) {
        //使用ObjectInputStream对test.txt文件读取并反序列化
        try (FileInputStream fileInputStream = new FileInputStream("test1.txt");
             ObjectInputStream objectInputStream = new ObjectInputStream(fileInputStream)) {
            Cat cat = (Cat) objectInputStream.readObject();
            System.out.println(cat);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
```

反序列化结果如下:

```
Cat(age=2, name=tom, birth=Fri Jul 04 21:37:13 CST 2035)
```

接下来让我们走进`Serializable`的源代码

```Java
public interface Serializable {
}
```

你没看错，`Serializable`接口中没有任何方法和字段，它的作用仅仅是告诉JVM：实现该接口的类可以被序列化，

其实除了实现`Serializable`接口外，还有一个选择就是实现`Externalizable`接口（该接口是`Serializable`的子接口），不过需要重写两个方法，示例如下：

```Java
@Data
public class Cat implements Externalizable {
    private int age;
    private String name;
    private Date birth;
    @Override
    public void writeExternal(ObjectOutput out) throws IOException {
        out.writeObject(name);
        out.writeObject(birth);
    }
    @Override
    public void readExternal(ObjectInput in) throws IOException, ClassNotFoundException {
        name = (String) in.readObject();
        birth = (Date) in.readObject();
    }
}
```

序列化和反序列化代码一样，最终结果如下：

```
Cat(age=0, name=tom, birth=Fri Jul 04 21:43:23 CST 2025)
```

`writeExternal`和`readExternal`可以自定义哪些字段需要序列化，我这个例子中就没有对`age`进行操作，在反序列化后它被赋初值0。需要注意的是

> The readExternal method must read the values in the same sequence and with the same types as were written by writeExternal.

翻译过来意思就是这两个方法应该用相同的顺序和相同的类型对字段进行读写，相同的顺序容易理解，相同的类型意思就是在`readExternal`中强转的目标类型必须和`writeExternal`原类型保持一致。在实现`Externalizable`接口时，还有一点需要注意的是序列化对象中必须提供无参构造，以Cat类为例,当我加入一个有参构造覆盖默认无参构造后，序列化正常运行，反序列化出现报错

![image-20250705112136780](https://dongimagehost-1356670526.cos.ap-nanjing.myqcloud.com/2025/07/image-20250705112136780.png)

**关于序列化有几点需要注意：**

1. 只有实现该接口的类才可以被序列化。

2. 可序列化类的所有子类是可以被序列化的。不可序列化类的子类型可以被序列化。

3. 如果不想对某个变量序列化，可以用`transient`关键字修饰，它只能修饰变量，不能修饰类和方法。`transient` 修饰的变量，在反序列化后变量值将会被置成类型的默认值。例如，如果是修饰 `int` 类型，那么反序列后结果就是 `0`。

4. 序列化运行时会为每个可序列化类分配一个版本号`serialVersionUID`该版本号在序列化机制中用于验证类的版本是否一致，如果反序列化时的UID和原来序列化的UID不同，则会抛出`InvalidClassException`。

   这个字段可以手动显示声明，也可以自动生成。如果显示声明，这个字段必须是`static` `final`且类型为`long`的。如果该字段未被显示声明，JVM会根据该类的结构自动生成一个`serialVersionUID`，枚举类的`serialVersionUID`会被定义为0L。

   官方强烈建议除了枚举类型以外的所有可序列化类显示声明`serialVersionUID`值，因为生成算法对类的细节非常敏感（如方法、字段等的变化都会导致`serialVersionUID`改变），从而导致兼容性问题。显式设置 `serialVersionUID `可以确保在类发生非兼容更改时由开发者主动决定是否更新 UID，而不是因为类结构微小变化而导致反序列化失败。同时官方建议使用private来声明`serialVersionUID`，因为该字段不会被子类继承使用，因此没必要设置为`public`或`protected`。下面是一个完整的示例

   ```Java
       @Serial//Java14后建议添加
       private static final long serialVersionUID = 1L;
   ```
   
   这时小明举手说：老师老师，如果`serialVersionUID`被`static`修饰，那他就属于这个类，而不属于实例化后的对象了，那怎么将这个字段序列化呢？老师说：好问题，~~我也不知道。~~ 序列化保存的是对象的状态，也就是实例变量的值，然而`serialVersionUID`是一个特例，它本身确实不作为对象状态被序列化，但它的值被序列化机制特殊处理了。屏幕前的你明白了吗，反正我还是有点糊涂，我觉得把它视为一个特例就好了，要真正弄懂怕是要搞明白JVM，那要很久以后了。

## Java反序列化漏洞

这里我推荐观看[5i1encee](https://5i1encee.top/)的相关博客，关于反序列化漏洞我简要介绍一下。

当攻击者通过构造恶意输入，让反序列化产生非预期的的对象，那么在反序列化这个过程中就可能执行恶意代码。已经有多个版本的库或框架被发现存在反序列化漏洞，如`Apache Commons Collections` 。借用[一位大哥](https://www.zhihu.com/question/37562657/answer/1916596031)的例子来简单说明

```Java
public class VulnerabilityTest{
    public static void main(String args[]) throws Exception{
        MyObject myObj = new MyObject();
        myObj.name = "hi";
        FileOutputStream fos = new FileOutputStream("object");
        ObjectOutputStream os = new ObjectOutputStream(fos);
        os.writeObject(myObj);
        os.close();

        FileInputStream fis = new FileInputStream("object");
        ObjectInputStream ois = new ObjectInputStream(fis);
        MyObject objectFromDisk = (MyObject)ois.readObject();
        System.out.println(objectFromDisk.name);
        ois.close();
    }
}

class MyObject implements Serializable {
    public String name;
    private void readObject(ObjectInputStream in) throws IOException, ClassNotFoundException{
        in.defaultReadObject();
        Runtime.getRuntime().exec("calc");
    }
}

```

在`MyObject`这个类中，自定义了`readObject`这个方法，相当于可以自己决定对哪些字段反序列化。在`readObject`这个方法里通过调用`defaultReadObject`来实现默认的反序列化机制。之后执行了名为`calc`的系统命令，这是`Windows`下启动计算器的命令。当我进行反序列化操作时，电脑上的计算器也随之启动。实际上，Java 反序列化漏洞产生的原因大多数是因为反序列化时没有进行校验，或者有些校验使用黑名单方式又被绕过，最终使得包含恶意代码的序列化对象在服务器端被反序列化执行。

## 其他序列化协议

上述有关代码的举例均是 JDK 自带的序列化协议，但它在开发中很少被使用，主要原因如下：

1. 严重的安全风险：正如例子中提到的`readObject`方法，攻击者可构造恶意序列化数据触发任意代码执行
2. 跨语言兼容性差：该协议序列化后的二进制数据只能被 Java 程序识别，无法与其他语言交互，多语言协作困难。
3. 性能低下：序列化后的二进制数据体积远大于 JSON 或其他二进制协议。同时因为需要反射和递归处理对象图，导致速度较慢。

常用的序列化协议有Hessian、Kryo、 Protobuf、 ProtoStuff 等，这些都是基于二进制的序列化协议。SpringBoot 项目中也可以集成 Jackson、Fastjson 等将对象序列化为JSON格式的库。

第一篇博客先写到这里，个人理解难免有偏差，欢迎评论区指正。我以后也会继续更新，欢迎收藏[我的网站](https://withdong02.top)。

参考文章：

- [Java 序列化详解 | JavaGuide](https://javaguide.cn/java/basis/serialization.html)
- [(6 封私信 / 70 条消息) Java反序列化安全漏洞怎么回事? - 知乎](https://www.zhihu.com/question/37562657/answer/1916596031)
