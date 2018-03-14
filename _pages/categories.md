---
layout: page
permalink: /categories/
title: Categories
---

{% for category in site.categories %}
    {% capture category_name %}{{ category | first }}{% endcapture %}
    ### {{ category_name }}
    [{{ category_name | slugize }}]({{ category_name | slugize }})
    {% for post in site.categories[category_name] %}
    #### [{{post.title}}]({{ site.baseurl }}{{ post.url }})
    {% endfor %}
{% endfor %}
