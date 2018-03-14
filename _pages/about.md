---
layout: page
title: About
permalink: /about/
---

[![profile for Vardius on Stack Exchange, a network of free, community-driven Q&A sites](https://stackexchange.com/users/flair/2481586.png "profile for Vardius on Stack Exchange, a network of free, community-driven Q&A sites")](https://stackexchange.com/users/2481586)

## Some of my work:


<div id="archives">
{% for category in site.categories %}
  <div class="archive-group">
    {% capture category_name %}{{ category | first }}{% endcapture %}
    <div id="#{{ category_name | slugize }}"></div>
    <p></p>
    
    <h3 class="category-head">{{ category_name }}</h3>
    <a name="{{ category_name | slugize }}"></a>

    <ul>
      {% for project in site.projects %}
        {% for pc in page.categories %}
          {% if pc == category_name %}
          <li>
            <a href="{{ page.title }}]({{ page.url }}">{{post.title}}  &mdash; {{ page.description }}</a>
          </li>
          {% endif %}
        {% endfor %}
      {% endfor %}
      <li>
        <a href="https://github.com/vardius?utf8=%E2%9C%93&tab=repositories&q=&type=source&language={{ category_name }}">...and more</a>
      </li>
    </ul>
  </div>
{% endfor %}
</div>

Please find all my work on [Github Profile](https://github.com/vardius)
