---
layout: post
title: HTTP download stream response
comments: true
categories: Go
---

When writing download handler for files most of the times best solution is to use `io.Copy` which will handle big part of the logic for us. This works great however what if we need to generate bytes for our response while having the user downloading the file seeing how it is growing when we write to `ResponseWriter` ?

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

	n, err := io.Copy(w, resp.Body)
	if err != nil {
		http.Error(w, "could not read body", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", "logo.svg"))
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Content-Size", strconv.FormatInt(n, 10))
	w.Header().Set("Last-Modified", time.Now().UTC().Format(http.TimeFormat))
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

[<img src="{{ site.baseurl }}/images/2020-5-26-go-http-stream-download.gif" alt="Stream response example" style="width: 400px;"/>]({{ site.baseurl }}/images/2020-5-26-go-http-stream-download.gif)

## Conclusion

There is no magic here, coming from another environment like PHP or Python I hear many question how to stream response. The answer simply is **write to response writer**~ I hope my post will help many those looking for answer while its right in front of them. Do not look for complicated logic.
