# chronicreaderlib

Embeddable web library for loading and displaying EPUB, CBZ files.

Depends on the [JSZip](https://stuk.github.io/jszip/) library.

## Usage

Add required dependencies to your web page:

```
<script src="/libs/jszip.js"></script>
<script src="/libs/reader.js"></script>
```

Initialize the reader by providing a URL to the book and a component on your page:

``` html
<script>
    reader = new ChronicReader(url, document.getElementById("bookDisplayDiv"))
</script>
```

## Demo

You can see a live demo on the [github pages site](https://chronicweirdo.github.io/chronicreaderlib/) for this repository.

## Interfaces

- inputs
    - file url
    - page element to transform into reader section
    - whether to show controls or not, margins, stuff like that

Todo:

- add loading animation (svg)
- add next, prev, tools icons (svg)
- add resize handlers
- save some status to local storage (current position, jump zoom)
- add local storage clearing tools
- make things configurable

## Release process

### Minify

Install [UglifyJS](https://github.com/mishoo/UglifyJS/):

```
npm install uglify-js -g
```

Run minify command:

```
uglifyjs --compress --output reader.min.js  -- static/libs/reader.js
```