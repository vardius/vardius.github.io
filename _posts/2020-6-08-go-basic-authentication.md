---
layout: post
title: Basic HTTP authentication with Go
comments: true
categories: Go
---

[RFC 7235](https://tools.ietf.org/html/rfc7235) defines the HTTP authentication as follow: 

> HTTP provides a general framework for access control and authentication, via an extensible set of [challenge-response](https://en.wikipedia.org/wiki/Challenge–response_authentication) authentication schemes, which can be used by a server to challenge a client request and by a client to provide authentication information.

Basic access authentication is a method for an HTTP user agent (e.g. a web browser) to provide a user and password when making a request. Usually a client will present a password prompt to the user and will then issue the request including the correct Authorization header.

We can write simple middleware leveraging [BasicAuth](https://golang.org/pkg/net/http/#Request.BasicAuth) method.

> BasicAuth returns the username and password provided in the request's Authorization header, if the request uses HTTP Basic Authentication.

That is all we need. Our middleware will wrap *protected* handlers verifying username and password. Based on this information we can decide to grand or restrict access.

```go
const (
	requiredUser     = "gordon"
	requiredPassword = "secret!"
)

func BasicAuth(next http.Handler) http.Handler {
	fn := func(w http.ResponseWriter, r *http.Request) {
		// Get the Basic Authentication credentials
		user, password, hasAuth := r.BasicAuth()

		if !hasAuth || subtle.ConstantTimeCompare([]byte(user), []byte(requiredUser)) != 1 || subtle.ConstantTimeCompare([]byte(pass), []byte(requiredPassword)) != 1 {
			w.Header().Set("WWW-Authenticate", "Basic realm=Restricted")
			http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
			return
		}

		next.ServeHTTP(w, r)
	}

	return http.HandlerFunc(fn)
}
```

In this example our middleware uses const values for username and password pair. Real life applications most likely would verify this information against values stored in database. Please note that [subtle.ConstantTimeCompare](https://golang.org/pkg/crypto/subtle/#ConstantTimeCompare) still depends on the length, so it is probably possible for attackers to work out the length of the username and password if you do it like this. To get around that you could hash them or add a fixed delay.

Lets create two routes with different handlers. One id going to be publicly accessible and the other one is going to be protected with basic authentication.

We could do it as follow:

```go
func index(w http.ResponseWriter, _ *http.Request) {
    fmt.Fprint(w, "Not protected!\n")
}

func protected(w http.ResponseWriter, _ *http.Request) {
    fmt.Fprint(w, "Protected!\n")
}

func main() {
	http.HandleFunc("/", index)
	http.Handle("/protected", BasicAuth(http.HandlerFunc(protected)))

	log.Fatal(http.ListenAndServe(":8080", nil))
}
```

Trying to access index route `/` we are not required to provide user name and password. However `/protected` route should prompt us for authentication details.

# Conclusion

This simple example of how to use basic authentication method teaches us how simple it is and on top of that we learned how to create simple middleware function, to be reused with multiple handlers. Full code snippet available [here](https://gist.github.com/vardius/a8da23717acb20c16cdf113647de0e2b)
