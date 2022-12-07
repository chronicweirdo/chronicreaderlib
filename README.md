# chronicreaderlib

Embeddable web library for loading and displaying EPUB, CBZ files.

Depends on the [JSZip](https://stuk.github.io/jszip/) library.

This project is one of the successors of the
[Chronic Reader service](https://github.com/chronicweirdo/reader), with the
purpose of making the ebook and comic display functionality from that project
available as a library that can be used on any website by anyone.

## Usage

Add required dependencies to your web page:

``` html
<script src="/libs/jszip.js"></script>
<script src="/libs/reader.js"></script>
```

Add a div element where to display the book:

``` html
<div id="bookDisplayDiv" class="book"></div>
```

Style the element to specify the dimensions of the book on your page:

``` html
<style>
    .book {
        position: relative;
        width: 500px;
        height: 800px;
        overflow: hidden;
    }
</style>
```

Initialize the reader by providing a URL to the book and a component on your page:

``` html
<script>
    reader = new ChronicReader(url, document.getElementById("bookDisplayDiv"))
</script>
```

## Demo

You can see a live demo on the [github pages site](https://chronicweirdo.github.io/chronicreaderlib/) for this repository.

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