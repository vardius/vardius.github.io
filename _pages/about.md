---
layout: page
title: About
permalink: /about/
---

[![profile for Vardius on Stack Exchange, a network of free, community-driven Q&A sites](https://stackexchange.com/users/flair/2481586.png "profile for Vardius on Stack Exchange, a network of free, community-driven Q&A sites")](https://stackexchange.com/users/2481586)

## Some of my work:

{% for cat in site.categories %}
  ### {{ cat }}
  {% for page in site.pages %}
    {% if page.project == true %}
      {% for pc in page.categories %}
        {% if pc == cat %}
          - [{{ page.title }}]({{ page.url }}) &mdash; {{ page.description }}
        {% endif %}
      {% endfor %}
    {% endif %}
  {% endfor %}
    - [...and more](https://github.com/vardius?utf8=%E2%9C%93&tab=repositories&q=&type=source&language={{ cat }})
{% endfor %}

Please find all my work on [Github Profile](https://github.com/vardius)
