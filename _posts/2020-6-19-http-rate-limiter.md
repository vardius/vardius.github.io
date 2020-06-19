---
layout: post
title: How to rate limit HTTP requests
comments: true
categories: Go
---

In this article we are going to learn how to use [rate limiting](https://en.wikipedia.org/wiki/Rate_limiting) middleware to protect our server against [DoS attacks](https://en.wikipedia.org/wiki/Denial-of-service_attack).

> rate limiting is used to control the rate of requests sent or received by a network interface controller

We will do few things:

1. get user IP address from request
2. write http middleware for rate limit
3. expose rate limit information via [exparv](https://golang.org/pkg/expvar/)

	If you are familiar with my blog, in my previous article: [Profiling Go HTTP service with pprof and expvar](https://rafallorenz.com/go/go-profiling-http-service-with-pprof-and-expvar/) I have already mentioned **exparv** and how to create middleware to expose this data. We will use that today.

# User IP

lets create simple function to get **IP address** from [http.Request](https://golang.org/pkg/net/http/#Request)

```go
func IpAddress(r *http.Request) (net.IP, error) {
	addr := r.RemoteAddr
	if xReal := r.Header.Get("X-Real-Ip"); xReal != "" {
		addr = xReal
	} else if xForwarded := r.Header.Get("X-Forwarded-For"); xForwarded != "" {
		addr = xForwarded
	}

	ip, _, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, fmt.Errorf("addr: %q is not IP:port", addr)
	}

	userIP := net.ParseIP(ip)
	if userIP == nil {
		return nil, fmt.Errorf("ip: %q is not a valid IP address", ip)
	}

	return userIP, nil
}
```

`IpAddress` returns user's IP address from request, it checks for `X-Real-IP` and `X-Forwarded-For` headers (we assume our proxy is going to be trusted if any). Unless you have a trusted reverse proxy, you shouldn't use this function, the client can set headers to any arbitrary value it wants.

# Middleware

As usual we want a function that will return [Handler](https://golang.org/pkg/net/http/#Handler) wrapper.
Before we write our rate limiter lets see how should our middleware look like:

```go
func RateLimit(r rate.Limit, b int, frequency time.Duration) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		if r == rate.Inf {
			return next
		}

		rl := &rateLimiter{
			rate:     r,
			burst:    b,
			visitors: make(map[string]*visitor),
		}

		go rl.cleanup(frequency)

		fn := func(w http.ResponseWriter, r *http.Request) {
			ip, err := request.IpAddress(r)
			if err != nil {
				http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
				return
			}

			if rl.allow(string(ip)) {
				next.ServeHTTP(w, r)
			}

			http.Error(w, http.StatusText(http.StatusTooManyRequests), http.StatusTooManyRequests)
			return
		}

		return http.HandlerFunc(fn)
	}
}
```

So what is going on here ? `RateLimit` returns a new HTTP middleware that allows request per visitor (IP address). If limit is set (`0` is a valid value and will block all requests) then the instance of `rateLimiter` is created and cleanup goroutine is spawned. It controls how frequently user requests are allowed to happen. In any large enough time, the `RateLimit` limits the rate to `r` requests per second with a maximum burst size of `b` requests. As a special case, if `r == Inf` (the infinite rate), middleware ignores limits. `frequency` decides how often map will be cleanup from expired entries.

See https://en.wikipedia.org/wiki/Token_bucket for more about token buckets.

## Implementing rateLimiter

At the time when I was writing this post there was already plenty of tools written by other people. We will use [golang.org/x/time/rate](https://pkg.go.dev/golang.org/x/time/rate?tab=doc)

```go
import (
	"net/http"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

type visitor struct {
	*rate.Limiter

	lastSeen time.Time
}

type rateLimiter struct {
	sync.RWMutex

	burst    int
	rate     rate.Limit
	visitors map[string]*visitor
}

// allow checks if given ip has not exceeded rate limit
func (l *rateLimiter) allow(ip string) bool {
	l.RLock()
	v, exists := l.visitors[ip]
	l.RUnlock()

	if !exists {
		v = &visitor{
			Limiter: rate.NewLimiter(l.rate, l.burst),
		}
		l.Lock()
		l.visitors[ip] = v
		l.Unlock()
	}

	v.lastSeen = time.Now()

	m.rl.Add(ip, 1)

	return v.Allow()
}

// cleanup deletes old entries
func (l *rateLimiter) cleanup(frequency time.Duration) {
	for {
		time.Sleep(frequency)

		l.Lock()
		for ip, v := range l.visitors {
			if time.Since(v.lastSeen) > frequency {
				delete(l.visitors, ip)

				m.rl.Delete(ip)
			}
		}
		l.Unlock()
	}
}
```

Our `rateLimiter` exposes two methods internally: `allow` and `cleanup`. As you can see our code sample already includes two lines for [exparv](https://golang.org/pkg/expvar/) metrics we are going to expose.

```go
m.rl.Add(ip, 1)
```

and 

```go
m.rl.Add(ip, 1)
```

# Expose rate limits

```go
import "expvar"

var m = struct {
	rl  *expvar.Map
}{
	rl:  expvar.NewMap("rateLimits"),
}
```

We create global variable (which we have used in previous snippet) with a [Map](https://golang.org/pkg/expvar/#Map) property.

> Map is a string-to-Var map variable that satisfies the Var interface.

You can read more [how to expose this data via HTTP debug server](https://rafallorenz.com/go/go-profiling-http-service-with-pprof-and-expvar/#usage). Following this instructions you can see exported `rateLimits` at http://localhost:6060/debug/vars in your browser.

# Conclusion

We learned today how to use [rate limiting](https://en.wikipedia.org/wiki/Rate_limiting) middleware to protect our server against [DoS attacks](https://en.wikipedia.org/wiki/Denial-of-service_attack). Simple yet powerful way of exposing this information via HTTP interface, allows us to easily verify IP suspicious addresses.

If you liked my post or maybe you didn't ? Either way please leave some feedback in a comment below.

Full code snippet available [here](https://gist.github.com/vardius/d06c255982a0f95261956d06a5774eb8) you can run it on [The Go Playground](https://play.golang.org/p/NVhqAJ4s_oq).
