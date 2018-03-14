---
layout: page
title: About
permalink: /about/
---

[![profile for Vardius on Stack Exchange, a network of free, community-driven Q&A sites](https://stackexchange.com/users/flair/2481586.png "profile for Vardius on Stack Exchange, a network of free, community-driven Q&A sites")](https://stackexchange.com/users/2481586)

## Some of my work:

{% for category in site.categories %}
  {% capture category_name %}{{ category | first }}{% endcapture %}
  ### {{ category_name }}
  {% for page in site.pages %}
    {% if page.project == true %}
      {% for pc in page.categories %}
        {% if pc == category_name %}
          - [{{ page.title }}]({{ page.url }}) &mdash; {{ page.description }}
        {% endif %}
      {% endfor %}
    {% endif %}
  {% endfor %}
    - [...and more](https://github.com/vardius?utf8=%E2%9C%93&tab=repositories&q=&type=source&language={{ category_name }})
{% endfor %}

Please find all my work on [Github Profile](https://github.com/vardius)
