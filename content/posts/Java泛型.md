---
title: Java泛型
date: 2025-10-14 14:40:44
tags:
  - Java
  - 泛型
categories: Java基础
---

## 泛型定义

先看这样一个例子：

```Java
public static void main(String[] args) {
	List list = new ArrayList();
	list.add("aaa");
	list.add("bbb");
	list.add("ccc");
	for (int i = 0; i < list.size(); i++) {
		System.out.println((String)list.get(i));
	}
}
```

`ArrayList`集合中可以加入任何类型的对象，我本意是用这个集合来存储字符串（因为`ArrayList`默认存储的是`Object`类型的对象，所以输出时需要强转 ），但我粗心的写错了`list.add(123)`，在我运行后发现报错`java.lang.ClassCastException`，显然报错原因就是输出时`Integer`类型并不能强转为`String`类型。那么如何避免这种情况呢，答案就是**泛型**。

借用一下维基百科的定义：

> 泛型程序设计是程序设计语言的一种风格或范型，泛型允许程序员在强类型程序设计语言中 编写代码时 使用一些 以后才指定的类型，在实例化时作为参数指明这些类型。

说一下我的理解，泛字让我联想到了一个词语：泛泛而谈，指那些浮浅平淡，不深入的谈话。这里也可以这样理解，定义时我模糊的说明一下参数，不指明参数具体是哪种类型，等我使用时再说明。

有这样一种说法：泛型的本质就是“参数化类型”。想象一下，定义一个方法需要形参，待你调用时，又需要传递实参。泛型亦是如此，定义时形式上意思意思，真正使用时再说明。其实都一个意思。

下面我将从**泛型类**、**泛型方法**、**泛型接口**、**通配符**、**类型擦除**五个方面来对Java泛型进行详细说明。

## 泛型类

来看一下`ArrayList`这个类的定义

```Java
public class ArrayList<E> extends AbstractList<E>
        implements List<E>, RandomAccess, Cloneable, java.io.Serializable
{...}
```

相比其他普通类，这个类的类名称后面多了个`<E>`，这就是泛型类的核心标识，其中 E 为类型参数，理论上可以为任何字母，但有一些约定俗成的习惯

- T：代表一般的任何类
- E：element 元素的意思
- K：代表 key 的意思
- V：代表 value 的意思，经常和 K 搭配作为键值对

关于类型参数怎么用，来看个例子。

```Java
public class Vehicle<T> {
    private T brand;//属性
    public T getBrand() {//方法返回值
        return brand;
    }
    public void setBrand(T newBrand) {//方法形参
        this.brand = newBrand;
    }
}
```

一共有三种使用方法，代码中已做标注。注意：**静态属性和静态方法中不能使用泛型类声明的类型参数**。否则编译报错：`'org.example.myblog.generics.Vehicle.this' cannot be referenced from a static context`

原因如下：静态成员是属于类本身的，不属于任何实例。当类加载时，泛型参数 `T` 还没有被具体类型替换（因为此时还没有任何实例被创建），编译器无法确定 `T` 的具体类型，自然也就无法为静态成员使用 `T` 分配内存或验证类型。有一个小例外，静态方法自身可以是泛型方法，详情见下文（坑1挖）。

如果把 T 视为一个真实存在的类型，其实它的使用方法与其他类型并无区别。类型参数也可以是多个，用`,`分隔。

## 泛型接口

泛型接口和泛型类差不多，下面是`List`接口的定义。

```Java
public interface List<E> extends SequencedCollection<E> {...}
```

说几点与泛型类不同的地方

1. 因为接口中的属性的修饰符默认是`public static final`，所以属性不能使用类型参数声明。除静态方法外其他方法可以使用类型参数。

2. 在接口A继承接口B时，如果接口B是泛型接口，那么接口A可以选择确定父接口的类型参数（成为非泛型接口），也可以选择保留泛型参数并传递给父接口（自身仍是泛型接口，如`List`接口），示例如下

   ```Java
   // 父接口：泛型接口，T 是它的类型参数
   interface IUsb<T> {
       void connect(T device); // 连接设备（设备类型为 T）
   }
   // 子接口：保留泛型参数 E，并传递给父接口 IUsb 的 T
   interface IA<E> extends IUsb<E> { 
       // 此时父接口 IUsb 的 T 被“替换”为子接口的 E
       // 所以 IA 继承的方法实际是：void connect(E device)
   }
   ```

3. 当一个类实现接口时，可以选择将自身泛型参数传递给接口，成为泛型实现类，也可以指定接口的泛型参数，成为一个普通的实现类。当接口有多个泛型参数时，实现类不允许部分指定（接口继承接口也不允许部分指定）。

**泛型类与泛型接口的类型推断**：

1. 类型参数的确定时机：类型参数在创建实例（泛型类）或声明子类型（泛型接口）时确定。

2. 不指定类型参数时的类型推断：会退化为“原始类型”，将所有泛型参数视为`Object`（坑2挖），不会进行类型检查，不推荐这样使用。

3. 指定类型参数时的类型匹配：所有使用该类型参数的成员需遵循“参数化类型”的约束：

   - 传入的实参必须是 “指定类型” 或其子类型。

   - 返回值会被自动视为 “指定类型”（无需强制转换）。

     ```Java
     List<Number> list = new ArrayList<>();
     list.add(123); //Integer类型
     list.add(1.2);//Double类型
     ```

4. 如果有多个类型参数，不允许部分指定（上文提到过）。

## 泛型方法

在方法的返回值前加个类型参数就是泛型方法。

下面这个方法是泛型方法吗？

```Java
public T getBrand() {
	return brand;
}
```

当然不是，它仅使用了泛型类定义的类型参数，并没有在方法签名中声明`<T>`，不能简单的认为泛型类里的方法就是泛型方法。下面的代码则是泛型方法，泛型方法里也可以同时声明多个类型参数。

```Java
public <T> T test(T t){
	return t;
}
```

```Java
class Test<T> {
    public T method(T t) {
        return t;
    }
    public <E> T genericsMethod(T t, E e) {
        return t;
    }
}
```

看上面的例子，`Test`是一个泛型类，泛型参数是 T ；`method`是泛型类里的一个方法，用到了泛型类的泛型参数 T ；`genericsMethod`是泛型方法，泛型参数是 E，该方法同时用到了两个泛型参数。需要注意的是，这两个泛型参数相互独立，作用域不同，泛型类的泛型参数 T 的作用域是整个类，而泛型方法的泛型参数 E 仅限于这个方法。如果泛型方法里需要同时用到该方法的泛型参数和泛型类的泛型参数，推荐分开命名，提高可读性。（这个例子不太好，方法体里并未使用到泛型参数 E）

前面提到过，在泛型类里，不允许静态方法使用泛型类声明的类型参数。但可以将静态方法声明为泛型方法。代码如下：（坑1填）

```Java
class Test<T> {   
	// 泛型类定义的类型参数 T 不能在静态方法中使用
	// 但可以将静态方法声明为泛型方法，方法中便可以使用其声明的类型参数了
    public static <E> E show(E one) {     
        return null;    
    }    
}  
```

**泛型方法的类型推断**：

1. 确定时机：调用该方法时确定类型参数。

2. 不指定类型参数时的类型推断：优先通过实参推断；结合返回值类型调整；多类型实参时取共同父类（最小上界）

   ```Java
   // 泛型方法：返回两个参数中较大的一个（假设T是可比较的）
   public static <T extends Comparable<T>> T max(T a, T b) {
       return a.compareTo(b) >= 0 ? a : b;
   }
   // 泛型方法：创建包含一个元素的列表
   public static <T> List<T> createList(T element) {
       List<T> list = new ArrayList<>();
       list.add(element);
       return list;
   }
   // 泛型方法：打印两个参数的类型
   public static <T> void printTypes(T a, T b) {
       System.out.println(a.getClass().getSimpleName());
       System.out.println(b.getClass().getSimpleName());
   }
   //**********************************************************************
   Integer result1 = max(3, 5); //根据实参推断 T = Integer
   String result2 = max("apple", "banana"); //根据实参推断 T = String
   
   // 接收变量是 List<Number>，实参是 Integer（Number 的子类）
   // 推断 T = Number（而非 Integer），因为返回值需要匹配 List<Number>
   //如果只有createList(123); 那么编译器仅根据实参推断 T = Integer
   List<Number> numList = createList(123); 
   
   //实参为Integer和String,最小上界为Object，推断 T = Object
   printTypes(123, "123"); 
   ```

3. 指定类型参数时的类型推断：

   ```Java
   // 情况1：推断可能歧义时显式指定
   List<Number> list = createList<>(123); // 等价于 createList<Number>(123)
   
   // 情况2：实参类型与预期不符时强制指定
   List<Object> objList = createList<Object>("hello"); 
   // 显式指定 T = Object，即使实参是 String（String 是 Object 的子类，合法）
   ```

   如果泛型方法没有参数或参数不涉及泛型参数，编译器无法通过实参推断，此时需要显式指定类型参数，或通过返回值接收类型推断。

   ```Java
   // 泛型方法：创建一个空列表
   public static <T> List<T> createEmptyList() {
       return new ArrayList<>();
   }
   // 方式1：通过接收变量类型推断 T = String
   List<String> strList = createEmptyList(); 
   // 方式2：显式指定 T = Integer
   List<Integer> intList = createEmptyList<Integer>(); 
   ```
   

## 类型擦除

在编译期，编译器会将泛型代码中的泛型参数`<T>,<E>`等等替换为边界类型（涉及到通配符的使用，下文有），如果没有边界统一替换为`Object`类型（坑2填）。在运行期，JVM眼中不存在泛型类或泛型方法。

**泛型类/接口的擦除**

```Java
//无边界泛型
class Box<T> { private T value; }
// 擦除后 → class Box { private Object value; }
//有边界泛型
class NumberBox<T extends Number> { private T value; }
// 擦除后 → class NumberBox { private Number value; }
```

**泛型方法的擦除**

```Java
//有边界和无边界的擦除规则同上
public static <T> T getFirst(List<T> list) { return list.get(0); }
// 擦除后 → public static Object getFirst(List list) { return list.get(0); }
// 调用时编译器自动补全转换：
List<String> list = new ArrayList<>();
String s = (String) getFirst(list); // 手动写代码时无需加，编译器隐式添加
```

泛型类被继承时，类型擦除可能导致子类方法与父类方法签名不匹配，编译器会自动生成 “桥接方法” 保证多态性，看下面的例子

```Java
class Parent<T> { 
    public void set(T t) {} 
}
class Child extends Parent<String> { 
    @Override public void set(String s) {} // 子类方法
}
// 父类擦除后方法为：public void set(Object t) {},此时父类和子类的该方法形参不一致，不构成重写，但实际上有一个桥接方法
// 编译器为 Child 生成桥接方法：
public void set(Object t) { 
    set((String) t); 
} // 调用子类的 set(String)
```

泛型是 JDK5 引入的特性。类型擦除的设计是为了兼容 JDK5 之前的非泛型代码。但是类型擦除也带来了一定的影响，比如运行期无法获取泛型参数类型，泛型参数不能是基本类型等

## 通配符使用

泛型是类型严格的，虽然`String`是`Object`的子类，但`List<String>`和`List<Object>`之间没有继承关系。通配符可以在保证类型安全的前提下，允许泛型类型之间的“有限兼容”。

### 无界通配符`<?>`（表示任意类型）

特性：可读。适用于 **“只需要读取泛型容器中的元素，不需要关心具体类型”** 的场景

```Java
public static void printList(List<?> list) {
    for (Object obj : list) { // 只能以 Object 类型读取
        System.out.println(obj);
    }
    // list.add("abc"); // 编译报错：无法确定添加的类型是否匹配未知类型
    list.add(null); // 唯一例外：null 可以添加，但无意义
}
// 调用：可接收任何 List 类型
printList(new ArrayList<String>()); 
printList(new ArrayList<Integer>()); 
```

### 上界通配符`<? extends T>`（表示 T 及其子类）

特性：可读（读取的元素可视为 T 类型，即向上转型）。适用于 **“需要读取泛型容器中的元素，且元素类型是 T 的子类型”** 的场景

```Java
// 求和
public static double sum(List<? extends Number> numbers) {
    double total = 0;
    for (Number num : numbers) { // 读取为 Number 类型（安全）
        total += num.doubleValue();
    }
    // numbers.add(10); // 编译报错：无法确定添加的 Integer 是否匹配未知子类型（如 Double），即只知道是子类，不确定添加哪个子类
    return total;
}
// 调用：可接收 List<Integer>、List<Double> 等
sum(new ArrayList<Integer>(Arrays.asList(1, 2, 3))); // 6.0
sum(new ArrayList<Double>(Arrays.asList(1.5, 2.5))); // 4.0
```

### 下界通配符`<? super T>`（表示 T 及其父类）

特性：可写（写入 T 及其子类的元素是安全的），但读取受限（读取的元素只能视为 `Object` 类型）。适用于 **“需要向泛型容器中写入元素，且元素类型是 T 的子类型”** 的场景（如添加元素到容器）。

```java
// 向列表中添加整数（列表类型可以是 Integer 的父类：Number、Object 等）
public static void addIntegers(List<? super Integer> list) {
    list.add(10); // 写入 Integer 及其子类（安全，因为父类容器可接收子类对象）
    list.add(20);
    // Integer num = list.get(0); // 编译报错：读取的元素只能视为 Object，因为不清楚是哪个父类，而Object是顶级父类，所以可以用Object接受
}

// 调用：可接收 List<Integer>、List<Number>、List<Object>
addIntegers(new ArrayList<Integer>());
addIntegers(new ArrayList<Number>());
addIntegers(new ArrayList<Object>());
```

### PECS原则

- **Producer Extends**：如果泛型容器是 “生产者”（主要用于读取元素），使用 `<? extends T>`（如 `List<? extends Number>` 生产 Number 类型元素）。
- **Consumer Super**：如果泛型容器是 “消费者”（主要用于写入元素），使用 `<? super T>`（如 `List<? super Integer>` 消费 Integer 类型元素）。

## 总结

泛型在集合框架（List，Map，Set）和主流框架（Spring，Mybatis）中的频繁出现证明其重要性，所以学会使用泛型还是很重要的。

这篇博客先写到这里，感谢豆包。欢迎评论区指正，我也会继续更新，欢迎收藏[我的网站](https://withdong02.top)。我的眼皮要闭上了😑

2026年3月7日修改：

泛型练习请看本站博客：手写IoC容器。

参考文章

[Java 中的泛型（两万字超全详解）_java 泛型-CSDN博客](https://blog.csdn.net/weixin_45395059/article/details/126006369)

[泛型编程 - Wikiwand](https://www.wikiwand.com/zh/articles/泛型编程)

[Java 泛型 | 菜鸟教程](https://www.runoob.com/java/java-generics.html)
