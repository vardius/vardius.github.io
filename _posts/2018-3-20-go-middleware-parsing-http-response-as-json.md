---
layout: post
title: Go middleware - parsing HTTP response as json
comments: true
categories: Go
---

When writing HTTP application with Go, parsing a response is the first thing you have to solve. While being future proof, you want to keep it clean and simple. This is where the idea of doing it with a middleware comes in. Middleware solves many problems here. For example:
1. Single responsibility - meaning that your actual handler doesn't know and it shouldn't, how the response is parsed
2. Common reuse - allows you to reuse the same logic in an easy way among many handlers

... and many more.

## How should it work ?

Middleware should wrap handlers, which brings the question how should we pass the payload from a handler to a middleware ? Here is where context comes in. Lets see how the end result should look like, based on example below we will implement the API of our package. In our example we will use [gorouter](github.com/vardius/gorouter) this simple router allows as to use middleware and route variables.

```go
package main

import (
    "fmt"
    "log"
    "net/http"
	
    "github.com/vardius/gorouter"
)

// Person holds the data we will return
type Person struct {
	Name string `json:"name"`
}

// Hello implements http.HandlerFunc and will handle request
func Hello(w http.ResponseWriter, r *http.Request) {
	params, err := gorouter.FromContext(r.Context())

	if err != nil {
		response.WithError(r.Context(), response.HTTPError{
			Code:    http.StatusBadRequest,
			Error:   err,
			Message: "Invalid request",
		})
		return
	}

	response.WithPayload(r.Context(), &Person{
		Name: params.Value("name"),
	})
}

func main() {
    router := gorouter.New(
		AsJSON, // our middleware
    )

    router.GET("/hello/{name}", http.HandlerFunc(Hello))

    log.Fatal(http.ListenAndServe(":8080", router))
}
```

This small example returns *json* response based on the url: `localhost:8080/hello/John`. Request will return following json `{"name":"John"}`.

## Lets get to work!

Except our middleware, we will expose two methods: `WithPayload` and `WithError` allowing us to pass data to our middleware where it can be parsed to json.

### Context and response

```go
import (
	"context"
)

type responseKey struct{}

type response struct {
	payload interface{}
}

func (r *response) write(payload interface{}) {
	r.payload = payload
}

func contextWithResponse(ctx context.Context) context.Context {
	return context.WithValue(ctx, responseKey{}, &response{})
}

func fromContext(ctx context.Context) (*response, bool) {
	r, ok := ctx.Value(responseKey{}).(*response)

	return r, ok
}

// WithPayload adds payload to context for response
// Will panic if response middleware wasn't used first
func WithPayload(ctx context.Context, payload interface{}) {
	response, ok := fromContext(ctx)
	if !ok {
		panic("Faild to write payload. Use response middleware first")
	}

	response.write(payload)
}
```

### Response and errors

The very important thing you have to remember are the errors. You want to be consistent, the good idea is to create `HTTPError` type that will later be used with our middleware allowing us to return error messages keeping same error structure.

```go
// HTTPError allows you yo return nice error responses
type HTTPError struct {
	Code    int
	Error   error
	Message string `json:"message"`
}

// WithError adds error to context for response
// Will panic if response middleware wasn't used first
func WithError(ctx context.Context, err HTTPError) {
	WithPayload(ctx, err)
}
```

### The middleware

And the final part is the middleware itself. It is a simple function with the following signature: `func AsJSON(next http.Handler) http.Handler {}` which accepts one `http.Handler` and returns another. Our function will have following responsibilities:
1. Set proper HTTP headers
2. Call wrapped handler
3. Encode response to *json*

```go
import (
	"encoding/json"
	"net/http"
)

// AsJSON wraps handler and parse payload to json response
func AsJSON(next http.Handler) http.Handler {
	fn := func(w http.ResponseWriter, r *http.Request) {
		// set http header
		w.Header().Set("Content-Type", "application/json")

		// create context with response holder
		ctx := contextWithResponse(r.Context())

		// call wrapped handler and pass request with new context
		next.ServeHTTP(w, r.WithContext(ctx))

		// get the response payload from context
		if response, ok := fromContext(ctx); ok {
			switch t := response.payload.(type) {
			case HTTPError:
				w.WriteHeader(t.Code)
			case *HTTPError:
				w.WriteHeader(t.Code)
			}

			encoder := json.NewEncoder(w)
			encoder.SetEscapeHTML(true)
			encoder.SetIndent("", "")

			if response.payload != nil {
				err := encoder.Encode(response.payload)

				if err != nil {
					w.WriteHeader(http.StatusInternalServerError)
					encoder.Encode(HTTPError{
						Code:    http.StatusInternalServerError,
						Error:   err,
						Message: http.StatusText(http.StatusInternalServerError),
					})

					return
				}
			}

			if f, ok := w.(http.Flusher); ok {
				f.Flush()
			} else {
				// Write nil in case of setting http.StatusOK header if header not set
				w.Write(nil)
			}
		}
	}

	return http.HandlerFunc(fn)
}
```

## Conclusion

Using middleware to parse response is a simple technique, yet very powerful. In this blog post I presented how to use them taking advantage of context package. This way our application doesn't have to be aware of the response layer and we are able to change it anytime (for example by implementing `asXML` middleware and using it instead). From the code above I have created a [package](https://godoc.org/github.com/vardius/go-api-boilerplate/pkg/common/http/response). Feel free to contribute [here](github.com/vardius/go-api-boilerplate/pkg/common/http/response). I Hope you liked my post. If you have any questions please leave a comment below.