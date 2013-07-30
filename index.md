---
layout: index
type: project
title: reveal-md
---

# reveal-md

Markdown server for [reveal.js](http://lab.hakim.se/reveal-js/#/).

## Installation

``` bash
npm install -g reveal-md
```

## Quick demo

``` bash
reveal-md demo
```

## Usage

To open specific Markdown file as Reveal.js slideshow:

``` bash
reveal-md slides.md
```

Show (recursive) directory listing of Markdown files:

``` bash
reveal-md dir/
```

Show directory listing of Markdown files in current directory:

``` bash
reveal-md
```

Override theme (default: `default`):

``` bash
reveal-md slides.md --theme solarized
```

Override slide separator (default: `\n---\n`):

``` bash
reveal-md slides.md --separator "^\n\n\n"
```

Override port (default: `1948`):

``` bash
reveal-md slides.md --port 8888
```

## Slide separators

* To separate slides in Markdown, use three dashes (`---`, a ruler in Markdown), surrounded by empty lines. Or override as shown above.
* Reveal.js supports "vertical" slides as well. Use `----` by default (also surround by newlines). This can also be overridden using `--vertical` from CLI.

## Notes

* `reveal-md` always starts a local server and opens the default browser
* From any presentation, navigate to the root (e.g. [http://localhost:1948](http://localhost:1948)) to get directory listing of (linked) Markdown files. Root folder is resolved from Markdown file (or directory) `reveal-md` was started with.

## License

[MIT](http://webpro.mit-license.org)
