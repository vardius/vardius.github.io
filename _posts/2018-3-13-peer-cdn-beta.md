---
layout: post
title: Lightweight library providing peer to peer CDN - beta version!
categories: Tech
---

I have released [**beta** version](https://github.com/vardius/peer-cdn/releases/tag/1.0.0-beta) of my [peer-cdn](https://github.com/vardius/peer-cdn). What I would expect out of this version is **feedback** on the matter of **browser support** and the issues I haven't thing of. This version is released in case of finding out what is need to be done before actual release.

# Overview
The main idea of **[peer-cdn](https://github.com/vardius/peer-cdn)** is to use **WebRTC** and **Service Worker** to allow assets such as *scripts*, *images*, *videos*, *styles* and other files to be shared between peers reducing server usage.

By importing **[peer-cdn](https://github.com/vardius/peer-cdn)** into your service worker you get the access to exported `PeerCDN` class, [Plugins](https://github.com/vardius/peer-cdn/wiki/Plugins) and [Strategies](https://github.com/vardius/peer-cdn/wiki/Strategies).

**[peer-cdn](https://github.com/vardius/peer-cdn)** allow you to register listeners and add middleware to fetch event. For more information, see [Middleware](https://github.com/vardius/peer-cdn/wiki/Middleware).

For full example please check [this directory](https://github.com/vardius/peer-cdn/blob/master/example)

# Things to consider:
- peer matching algorithms (ways of improving - pick best direction to go from here, beta version keeps it simple - pick first)
- browser support [WebRTC](https://webrtc.org)
- browser support [`client.postMessage()`](https://developer.mozilla.org/en-US/docs/Web/API/Client/postMessage#Browser_compatibility)
- media supported (there might be issues with range request)

For now I know there might be some issues with:
- [`client.postMessage()`](https://developer.mozilla.org/en-US/docs/Web/API/Client/postMessage#Browser_compatibility) problems on **Google Chrome Version 64.0.3282.167 (Official Build) (64-bit)** however works on **Mozilla Firefox Quantum 58.0.2 (64-bit)**
- [range requests](https://github.com/vardius/peer-cdn/issues/7)

Would love to get any feedback nad/or contributions! Check [help wanted](https://github.com/vardius/peer-cdn/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) issues and [contribute](https://github.com/vardius/peer-cdn/blob/master/CONTRIBUTING.md#development). Also feel free to contact me.

# Next steps:
-  add more tests
-  resolve browser support
-  create web pack plugin
-  improve signalling server

Cheers guy!