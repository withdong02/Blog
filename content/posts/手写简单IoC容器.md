---
title: 手写简单IoC容器
date: 2026-03-07 15:22:01
tags:
  - 反射
  - 八股
  - 泛型
  - Spring
---
学习 Spring，跟着二哥简单写个 IoC 容器。


```Java
@Target(ElementType.FIELD)  
@Retention(RetentionPolicy.RUNTIME)  
@interface MyAutowired {  
}  
  
@Target(ElementType.TYPE)  
@Retention(RetentionPolicy.RUNTIME)  
@interface MyComponent {  
}  
  
public class SimpleIoC {  
    Map<Class<?>, Object> beans = new HashMap<>();  
  
    //扫描  
    public void scan(String packageName) {  
        List<Class<?>> classes = getClassesInPackage(packageName);  
        for (Class<?> clazz : classes) {  
            if (clazz.isAnnotationPresent(MyComponent.class)) {  
                registerBean(clazz);  
            }  
        }  
        di();  
    }  
  
    //获取包下的类，简化实现  
    private List<Class<?>> getClassesInPackage(String packageName) {  
        // 实际实现需要扫描classpath，这里简化处理.  
        return Arrays.asList(UserDao.class, UserService.class);  
    }  
  
    //注册bean  
    private void registerBean (Class<?> clazz) {  
        try {  
            Object instance = clazz.getDeclaredConstructor().newInstance();  
            beans.put(clazz, instance);  
        } catch (Exception e) {  
            throw new RuntimeException("创建bean失败");  
        }  
    }  
    //获取bean  
    @SuppressWarnings("unchecked")  
    public <T> T getBean(Class<T> clazz) {  
        return (T)beans.get(clazz);  
    }  
    //依赖注入  
    private void di() {  
        for (Object bean : beans.values()) {  
            Field[] fields = bean.getClass().getDeclaredFields();  
            for (Field field : fields) {  
                if (field.isAnnotationPresent(MyAutowired.class)) {  
                    field.setAccessible(true);  
                    Object dependency = getBean(field.getType());  
                    try {  
                        field.set(bean, dependency);  
                    } catch (Exception e) {  
                        throw new RuntimeException("依赖注入失败");  
                    }  
                }  
            }  
        }  
    }  
}  
//DAO层  
@MyComponent  
class UserDao {  
    public void save(String user) {  
        System.out.println("保存用户: " + user);  
    }  
}  
  
// Service层  
@MyComponent  
class UserService {  
    @MyAutowired  
    private UserDao userDao;  
  
    public void createUser(String name) {  
        userDao.save(name);  
        System.out.println("用户创建完成");  
    }  
}  
  
class Test {  
    public static void main(String[] args) {  
        SimpleIoC ioc = new SimpleIoC();  
        ioc.scan("package");  
        UserService bean = ioc.getBean(UserService.class);  
        bean.createUser("dong");  
    }  
}
```

参考链接：

[ 二哥的Java进阶之路](https://javabetter.cn/sidebar/sanfene/spring.html#_17-%E8%83%BD%E8%AF%B4%E4%B8%80%E4%B8%8Bioc%E7%9A%84%E5%AE%9E%E7%8E%B0%E6%9C%BA%E5%88%B6%E5%90%97)

[Java反射 | withdong02](https://withdong02.top/2025/08/10/Java%E5%8F%8D%E5%B0%84/)

[Java泛型 | withdong02](https://withdong02.top/2025/10/14/Java%E6%B3%9B%E5%9E%8B/)