---
title: 遇到的奇葩BUG
date: 2025-08-02 11:16:00
tags: 
  - BUG
---

此篇博客记录我学习过程中遇到的奇葩BUG

## `SpringBoot`项目启动失败

![image-20250801212248493](https://dongimagehost-1356670526.cos.ap-nanjing.myqcloud.com/2025/07/image-20250801212248493.png)

如上图，`SpringBoot`项目启动失败。

虽然说是端口占用，但我执行相关命令后没有任何输出，修改启动端口不行，尝试了很多办法都未成功，那只好使出我的终极大招：重启idea。还是不行。幸好我还有终极终极大招：重启电脑。嘿，你猜怎么着，成了！🤣

## 接口测试报错`getaddrinfo ENOTFOUND https`

![image-20250827154544934](https://dongimagehost-1356670526.cos.ap-nanjing.myqcloud.com/2025/07/image-20250827154544934.png)

一次简单的接口测试，出现报错`getaddrinfo ENOTFOUND https`，搜索后得到答案：这通常意味着应用程序无法解析主机名或域名。这可能是由于DNS配置问题、网络连接问题或拼写错误等原因导致的。前两个果断排除，开始以为参数错，但一想那不应该试着错误，后来想可能域名错，但也没找到错误。最后发现是`https:`后面多了个空格。😑

## mysql容器连接报错

情况描述：本机为windows系统，装有wsl。在配置一个项目时使用`docker-compose`命令构建项目所需容器。构建好容器后，我测试mysql是否连接成功，结果出现报错`2013 - Lost connection to server at 'handshake: reading initial communication packet', system error: 0`.

于是到网上搜索解决方案，有注释掉`bind-address = 127.0.0.1`的，有添加配置`skip-name-resolve`的，还有换系统的，但都无法解决我的问题。直到看见这篇博客[CSDN博客](https://blog.csdn.net/liudongyang123/article/details/108381944)。于是我直接修改`docker-compose.yaml`文件，添加`network_mode: host`，同时从豆包处得知：使用 `host` 网络模式后，容器会直接使用宿主机的网络栈，因此 `ports` 配置会被忽略。如果需要 MySQL 监听 3307 端口，需在 MySQL 配置文件（`/etc/my.cnf` 目录下的配置）中添加 `port=3307`，照做后问题解决。

还要记得修改`application.yml`中的端口设置。
