---
title: Java反射
date: 2025-08-10 15:06:57
tags:
  - Java
  - 反射
categories: Java基础
---

## 什么是反射

在`spring`项目中，只需要写个`@Service`或者`@Component`，然后在别的地方用`@Autowired`声明一个接口变量，`Spring`就能返回给我们一个实现了该接口的具体对象。这是如何实现的呢？它不可能在编译时就知道加了注解的类与类之间的关系，所以只能是在程序启动**运行时**，Spring动态地发现了这些类，读取了他们的结构，然后创建对象。这背后的技术支撑又是什么？答案就是反射。

反射是Java提供的一种在**程序运行时**

- 检查/获取类、接口、字段、方法、构造器等结构信息的能力。
- 操作/调用对象、字段、方法的能力。

它就像一面镜子，让程序在运行时“照见”自己的结构。

## 反射的基石：`Class`对象

编译器在编译 Java 源代码时会生成 `.class` 文件（字节码文件）。当 JVM 需要用到某个类时，它的类加载器会读取并解析对应的 `.class` 文件，在方法区（或元空间）构建该类的运行时数据结构，同时在堆内存中创建一个代表该类的 **`java.lang.Class`** **对象**。每个被加载的类在 JVM 中都有且只有一个对应的 `Class` 对象（在同一个类加载器命名空间内）。

这里的`Class`是一个类的名字，不要和`class`关键字搞混。

有三种方法获取`Class`对象

```Java
Person person = new Person("me", 20);
//法一：通过对象实例
Class< ? extends Person> clazz1 = person.getClass();
//法二：自带属性（基本数据类型也有）
Class<Person> clazz2 = Person.class;
//法三：Class类的静态方法 forName
try {
	Class<?> clazz3 = Class.forName("org.myblog.reflection.Person");
} catch (ClassNotFoundException e) {
	throw new RuntimeException(e);
}
```

解释一下这三种方法泛型的使用：法一使用`Class<? extends Person> ` 因为`Class`对象是在运行时从`Person`实例获取的，而`Person`实例的具体类型只能在运行时创建和确定，编译阶段无法判断，所以使用通配符 ，又因为`person`可能是`Person`实例，也可能是`Person`的子类实例，所以最终写成`Class< ? extends Person>`；法二使用`Class<Person>`因为编译时已知具体类型；法三使用`Class<?>`因为通过字符串动态加载类，编译时无法确定具体类型，所以使用通配符。这三个 Class 对象都是同一个（上面也提到了，一个类唯一对应一个 Class 对象）。

**最常用、最灵活的是法三**

## 反射的核心操作

`Person`类具体代码如下：

```Java
public class Person {
    public String name;
    private int age;
    public static String species = "Human";

    public Person() {
        this("Unknown", 0);
    }
    public Person(String name, int age) {
        this.name = name;
        this.age = age;
    }
    private Person(String name) {
        this.name = name;
        this.age = 18;
    }
    public void greet(String name) {
        System.out.println("Hello " + name + ",I'm " + this.name);
    }
    private void celebrateBirthday() {
        age++;
        System.out.println(name + " is now " + age + " years old!");
    }
    public static void describeSpecies() {
        System.out.println("We are all " + species);
    }
}
```

### 获取类的信息

```Java
Class<?> clazz = Class.forName("org.example.myblog.reflection.Person");
System.out.println("类名：" + clazz.getName());
System.out.println("包名：" + clazz.getPackage().getName());
System.out.println("父类：" + clazz.getSuperclass());
System.out.println("接口：" + Arrays.toString(clazz.getInterfaces()));
System.out.println("修饰符：" + Modifier.toString(clazz.getModifiers()));
```

```txt
类名：org.example.myblog.reflection.Person
包名：org.example.myblog.reflection
父类：class java.lang.Object
接口：[]
修饰符：public
```

### 操作字段

```Java
System.out.println("操作字段+++++++++++++++++++++++++++++++++");
Field[] allFields = clazz.getDeclaredFields();
for (Field f : allFields) {
	System.out.println("- " + Modifier.toString(f.getModifiers()) + " " +
                    f.getType().getSimpleName() + " " + f.getName());
}
Person me = new Person("me", 20);
//访问public字段
Field nameField = clazz.getField("name");
System.out.println(nameField.get(me));
//访问private字段
Field ageField = clazz.getDeclaredField("age");
ageField.setAccessible(true);
System.out.println(ageField.get(me));
ageField.set(me, 18);
System.out.println("修改后年龄: " + ageField.get(me));
//访问static字段
Field speciesField = clazz.getField("species");
System.out.println(speciesField.get(null));
```

```Java
- public String name
- private int age
- public static String species
me
20
修改后年龄: 18
Human
```

说明几点：

1. `getDeclaredFields()`是获取所有字段，并返回一个数组，`getField`则是根据参数返回指定字段，返回的是`Field`实例。
2. 最后一行`speciesField.get(null)`传入参数`null`，因为静态字段是属于这个类的，当然也可以传入对象`me`。
3. `ageField.setAccessible(true);`这个方法传入参数`true`表示**屏蔽Java语言的访问检查**。看下面这个例子
   ```Java
   Field[] allFields = clazz.getDeclaredFields();
   for (Field f : allFields) {
   	Object target = Modifier.isStatic(f.getModifiers()) ? null : me;
       System.out.println("  可访问性: " + f.canAccess(target));
   }
   ```
   ```
   public String name
   可访问性: true
   private int age
   可访问性: false
   public static String species
   可访问性: true
   ```

​		输出如上，`age`是不可访问的，在`setAccessible(true)`后可以访问并修改。否则会报错。

1. 如果想要访问`private`或其他非`public`字段，必须使用`getDeclaredField()`，**注意里面有`Declared`，这个规律同样适用后面的`Method`和`Constructor`。**

### 操作方法

```Java
System.out.println("\n==== 方法操作 ====");
Person Dong = new Person("dong", 18);
Method[] allMethods = clazz.getDeclaredMethods();
System.out.println("所有方法:");
for (Method m : allMethods) {
	System.out.println("- " + m.getName() + "()");
}
// 调用public方法
Method greetMethod = clazz.getMethod("greet", String.class);
greetMethod.invoke(Dong, "李明");
// 调用private方法
Method birthdayMethod = clazz.getDeclaredMethod("celebrateBirthday");
birthdayMethod.setAccessible(true);
birthdayMethod.invoke(Dong);
System.out.println("新年龄: " + ageField.get(Dong)); // 验证年龄增加
// 调用static方法
Method speciesMethod = clazz.getMethod("describeSpecies");
speciesMethod.invoke(null);
```

```
所有方法:
- celebrateBirthday()
- describeSpecies()
- greet()
Hello 李明,I'm dong
dong is now 19 years old!
新年龄: 19
We are all Human
```

其实和操作字段有很多相似之处，这里说一下`invoke`方法

```Java
Method greetMethod = clazz.getMethod("greet", String.class);
greetMethod.invoke(Dong, "李明");
```

`getMethod`方法有两个参数，一个是方法名称，一个是参数的`class`对象

`greetMethod`方法同样有两个参数，一个是对象实例（如果是静态方法则传入`null`），一个是传递的参数。这两个方法的参数个数不是固定的(其实是个数组)，这取决于目标方法的参数个数。

### 操作构造器

```Java
// 获取所有构造器
Constructor<?>[] constructors = clazz.getDeclaredConstructors();
System.out.println("所有构造器:");
for (Constructor<?> c : constructors) {
	System.out.println("参数数量: " + c.getParameterCount());
}
// 使用public无参构造器创建对象
Constructor<?> emptyConstructor = clazz.getConstructor();
Person unknown = (Person) emptyConstructor.newInstance();
System.out.println("无参构造创建: " + unknown.name);
// 使用public带参构造器创建对象
Constructor<?> paramConstructor = clazz.getConstructor(String.class, int.class);
Person sarah = (Person) paramConstructor.newInstance("Sarah", 28);
System.out.println("带参构造创建: " + sarah.name + ", " + ageField.get(sarah));
// 使用private构造器创建对象
Constructor<?> privateConstructor = clazz.getDeclaredConstructor(String.class);
privateConstructor.setAccessible(true);
Person secret = (Person) privateConstructor.newInstance("Secret");
System.out.println("私有构造创建: " + secret.name + ", " + ageField.get(secret));
```

```
所有构造器:
参数数量: 1
参数数量: 2
参数数量: 0
无参构造创建: Unknown
带参构造创建: Sarah, 28
私有构造创建: Secret, 18
```

经过前面叙述，这里的相关方法也是很好理解，`getConstructor`方法的参数取决于你拿到的构造器的参数（其实也是个数组）。

`newInstance()`方法可以根据你拿到的构造器来创建该构造器所在类的实例，参数同上理解。例子中是直接强转类型了，如果`clazz`是用法二得到的，也可以使用`cast`方法进行类型转换。一般来说这个方法创建的实例用`Object`来接收，因为创建的对象是在运行时动态生成的，编译阶段无法知道。**建议使用反射直接调用和操作对象的方法和字段，而不是先进行类型转换，毕竟如果在编写阶段已经明确了要转换的类型，那么直接显示地调用更合适，而不必依赖于反射。反射的真正价值在于处理编译时未知的类型，从而编写更具有通用性的代码。**

示例里用`Constructor<?>`接收`clazz.getConstructor()`创建的实例是因为`clazz`的创建就使用的是通配符。如果在创建时指定类，那便可以指定泛型参数，相当于构造器就知道自己要构造的对象是什么类型了。

## 结尾

上述内容只是反射部分的冰山一角，我已经尽我所能把这“一角”讲述清楚。

反射很强，它能提供运行时动态操作类和对象的能力，是很多框架的基石，但同时它也带来了很多问题，性能开销大、代码可读性差等等。在日常开发中，程序员还是会优先选择直接调用、接口、设计模式等更清晰、高效的方式。

有机会我也会更新一个与反射有关的实战案例，欢迎收藏我的网站。

2026年3月7日修改：

反射练习请看本站博客：手写IoC容器。

参考文章：

- [大白话说Java反射：入门、使用、原理 - 陈树义 - 博客园](https://www.cnblogs.com/chanshuyi/p/head_first_of_reflection.html)
- [Java基础之—反射（非常重要）-CSDN博客](https://blog.csdn.net/sinat_38259539/article/details/71799078)
- [Java中的反射 Reflection in Java\_哔哩哔哩\_bilibili](https://www.bilibili.com/video/BV1K4421w7zP/?spm_id_from=333.1387.homepage.video_card.click\&vd_source=7ea0b75868faf9dd624fab975b80bfbf)

