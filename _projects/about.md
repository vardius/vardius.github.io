---
layout: page
title: About
permalink: /about/
---

[![profile for Vardius on Stack Exchange, a network of free, community-driven Q&A sites](https://stackexchange.com/users/flair/2481586.png "profile for Vardius on Stack Exchange, a network of free, community-driven Q&A sites")](https://stackexchange.com/users/2481586)

## Some of my work:

{% for cat in site.categories %}
### {{ cat }}
<ul>
  {% for page in site.pages %}
    {% if page.project == true %}
      {% for pc in page.categories %}
        {% if pc == cat %}
          <li><a href="{{ page.url }}">{{ page.title }}</a> - {{ page.description }}</li>
        {% endif %}   <!-- cat-match-p -->
      {% endfor %}  <!-- page-category -->
    {% endif %}   <!-- resource-p -->
  {% endfor %}  <!-- page -->
          <li><a href="https://github.com/vardius?utf8=%E2%9C%93&tab=repositories&q=&type=source&language={{ cat }}">...and more</a></li>
</ul>
{% endfor %}  <!-- cat -->

Please find all my work on [Github Profile](https://github.com/vardius)
