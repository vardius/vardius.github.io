---
layout: post
title: HTTP how to stream download response
comments: true
categories: Go
---

When writing download handler for files most of the times best solution is to use `io.Copy` which will handle big part of the logic for us. This works great however what if we need to generate bytes for our response while having the user downloading the file seeing how it is growing when we write to `ResponseWriter` ?

[<img src="{{ site.baseurl }}/images/2020-5-26-go-http-stream-download.gif" alt="Stream response example" style="width: 400px;"/>]({{ site.baseurl }}/images/2020-5-26-go-http-stream-download.gif)

I have seen questions online how to stream download response many times. Even though it seems pretty simple many people expect complex logic here.

Lets start from the begging.

## Standard example

Lets assume we have simple `main.go` file with one handler. **main** function could look as follow:

```go
func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/", downloadHandler)

	http.ListenAndServe(":3000", mux)
}
```

and if we were using simple approach with  `io.Copy` it probably would look like this:

```go
func downloadHandler(w http.ResponseWriter, r *http.Request) {
	resp, err := http.Get("https://golangcode.com/logo.svg")
	if err != nil {
		http.Error(w, "could not write response", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", "logo.svg"))
	w.Header().Set("Content-Type", "image/svg+xml")
	w.Header().Set("Last-Modified", time.Now().UTC().Format(http.TimeFormat))

	n, err := io.Copy(w, resp.Body)
	if err != nil {
		http.Error(w, "could not read body", http.StatusInternalServerError)
		return
	}
}
```

In the example above we simply stream to user the file we got from the url. Works like a charm.

## CSV Writer

If its the case and we want to generate CSV file, best idea is to use 

```go
import (
	"encoding/csv"
)

func downloadHandler(w http.ResponseWriter, r *http.Request) {
    // previous code...

    cw := csv.NewWriter(w)

	for _, record := range records {
		if err = cw.Write(record); err != nil {
            http.Error(w, "could not write record", http.StatusInternalServerError)
			return
		}
		cw.Flush()
	}
}
```

Write writes a single CSV record to w along with any necessary quoting. A record is a slice of strings with each string being one field. Writes are buffered, so Flush must eventually be called to ensure that the record is written to the underlying io.Writer.

## Stream response

But wait !? We want to generate buffer from chunks! How could we return them to user in a similar way csv writer does.

To not make things overly complicated lets say we reuse bytes of our file from before instead of generating them. Pretending we do some work and generate each byte then write it to response. Lets simply iterate over the bytes of our file and assume each byte is a chunk we generated. We will wait for about 200 microsecond to see some work being done (file we are using in this example is small).

```go
for _, chunk := range body {
	if _, err := rw.Write(chunk); err != nil {
		http.Error(w, "could not write chunk", http.StatusInternalServerError)
		return
	}

	time.Sleep(200 * time.Microsecond)
}
```

This should work just fine, our file will start download and we can see how its size grows in the browser.

## ServeContent

> [ServeContent](https://godoc.org/net/http#ServeContent) replies to the request using the content in the provided ReadSeeker. The main benefit of ServeContent over io.Copy is that it handles Range requests properly, sets the MIME type, and handles If-Match, If-Unmodified-Since, If-None-Match, If-Modified-Since, and If-Range requests.

> If the response's Content-Type header is not set, ServeContent first tries to deduce the type from name's file extension and, if that fails, falls back to reading the first block of the content and passing it to DetectContentType. The name is otherwise unused; in particular it can be empty and is never sent in the response.

```go
func downloadHandler(w http.ResponseWriter, r *http.Request) {
	resp, err := http.Get("https://golangcode.com/logo.svg")
	if err != nil {
		http.Error(w, "could not write response", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, "could not read body", http.StatusInternalServerError)
		return
	}

	http.ServeContent(w, r, "logo.svg", time.Now(), bytes.NewReader(body))
}
```

With that in mind we could implement our own [Seeker](https://golang.org/pkg/io/#Seeker)

```go
type Seeker interface {
    Seek(offset int64, whence int) (int64, error)
}
```

> Seeker is the interface that wraps the basic Seek method.

> Seek sets the offset for the next Read or Write to offset, interpreted according to whence: SeekStart means relative to the start of the file, SeekCurrent means relative to the current offset, and SeekEnd means relative to the end. Seek returns the new offset relative to the start of the file and an error, if any.

This way we could fetch each chunk at seek method and then return it during write operation. It could look like this:

```go
type stream struct {
	chunk     []byte
	i         int64                     // current reading index
	fetch     func(offset int64) []byte // fetch callback
	totalSize func() int64              // total size callback
}

func (s *stream) Read(b []byte) (n int, err error) {
	if len(s.chunk) == 0 {
		return 0, io.EOF
	}

	// simply copy our chunk
	n = copy(b, s.chunk)
	s.i += int64(n)

	return
}

func (s *stream) Seek(offset int64, whence int) (int64, error) {
	var abs int64
	switch whence {
	case io.SeekStart:
		abs = offset
	case io.SeekCurrent:
		abs = s.i + offset
	case io.SeekEnd:
		abs = s.totalSize() + offset
	default:
		return 0, errors.New("stream..Reader.Seek: invalid whence")
	}
	if abs < 0 {
		return 0, errors.New("stream..Reader.Seek: negative position")
	}

	s.i = abs
	s.chunk = s.fetch(abs) // fetch chunk and set to buffer

	return abs, nil
}

func downloadHandler(w http.ResponseWriter, r *http.Request) {
	resp, err := http.Get("https://golangcode.com/logo.svg")
	if err != nil {
		http.Error(w, "could not write response", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, "could not read body", http.StatusInternalServerError)
		return
	}

	s := stream{
		// this is our asynchronous callback to get each chunk
		fetch: func(offset int64) []byte {
			return body[offset:]
		},
		// this callback provides total size
		totalSize: func() int64 {
			return int64(len(body))
		},
	}

	// we set the type as we know it and ServeContent doesn't have to guess it
	// we as well do not want it to return whole content at once if it can not guess the type
	w.Header().Set("Content-Type", "image/svg+xml")
	http.ServeContent(w, r, "logo.svg", time.Now(), &s)
}
```

As before for simplicity we use our body bytes here assuming we would have some logic to generate them.

## Conclusion

There is no magic here, coming from another environment like PHP or Python I hear many question how to stream response. The answer simply is **write to response writer**~ I hope my post will help many those looking for answer while its right in front of them. Do not look for complicated logic.
