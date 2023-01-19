var NOT_IMPLEMENTED_EXCEPTION = "not implemented";

var delayExecutionTriggerTimestamp = null;

function executeWithDelay(func, ms) {
    let now = Date.now();
    delayExecutionTriggerTimestamp = now;
    let getExecuteWithDelayFunction = function(triggerTimestamp) {
        return () => {
            if (triggerTimestamp == delayExecutionTriggerTimestamp) {
                func();
            }
        };
    }
    window.setTimeout(getExecuteWithDelayFunction(now), ms);
}

function imageLoadedPromise(image) {
    return new Promise((resolve, reject) => {
        let imageResolveFunction = function() {
            resolve();
        }
        image.onload = imageResolveFunction;
        image.onerror = imageResolveFunction;
    });
}

function waitForImagesToLoad(images) {
    return new Promise((resolve, reject) => {
        let imagePromises = [];
        for (var i = 0; i < images.length; i++) {
            imagePromises.push(imageLoadedPromise(images[i]));
        }
        Promise.all(imagePromises).then(() => {
            resolve();
        });
    });
}

function getFileExtension(filename) {
    let extension = filename.toLowerCase()
        .substring(filename.lastIndexOf('.') + 1);
    return extension;
}

function typeCheck(value) {
    const return_value = Object.prototype.toString.call(value);
    const type = return_value.substring(
        return_value.indexOf(" ") + 1, 
        return_value.indexOf("]")
    );
  
    return type.toLowerCase();
}

function num(s, def) {
    var patt = /[\-]?[0-9\.]+/;
    var match = patt.exec(s);
    if (match != null && match.length > 0) {
        var n = match[0];
        if (n.indexOf('.') > -1) {
            return parseFloat(n);
        } else {
            return parseInt(n);
        }
    }
    return def;
}

function approx(val1, val2, threshold = 1) {
    return Math.abs(val1 - val2) < threshold;
}

function radiansToDegrees(radians) {
    return radians * (180/Math.PI);
}

function computeSwipeParameters(deltaX, deltaY) {
    let highOnPotenuse = Math.sqrt(Math.pow(deltaX, 2) + Math.pow(deltaY, 2));
    if (highOnPotenuse != 0) {
        let swipeSine = deltaY / highOnPotenuse;
        let swipeAngle = Math.abs(radiansToDegrees(Math.asin(swipeSine)));
        return {
            length: highOnPotenuse,
            angle: swipeAngle
        };
    } else {
        return {
            length: 0,
            angle: 0
        };
    }
}

function getFileMimeType(filename) {
    let extension = getFileExtension(filename);
    if (extension == "png" || extension == "jpeg"
        || extension == "avif" || extension == "bmp" || extension == "gif"
        || extension == "tiff" || extension == "webp") {
        return "image/" + extension;
    } else if (extension == "jpg") {
        return "image/jpeg";
    } else if (extension == "tif") {
        return "image/tiff";
    } else if (extension == "svg") {
        return "image/svg+xml";
    } else if (extension == "ico") {
        return "image/vnd.microsoft.icon";
    } else {
        return "text/plain";
    }
}

function createDivElement(parent, left, top, width, height, color) {
    let element = document.createElement("div");
    element.style.position = "absolute";
    element.style.top = top;
    element.style.left = left;
    element.style.width = width;
    element.style.height = height;
    if (color != undefined && color != null) {
        element.style.backgroundColor = color;
    }
    parent.appendChild(element);
    return element;
}

class EbookNode {
    static LEAF_ELEMENTS = ["img", "tr", "image", "svg"];

    constructor(name, content, parent = null, children = [], start = null, 
        end = null, id = null)
    {
        this.name = name;
        this.content = content;
        this.parent = parent;
        this.children = children;
        this.start = start;
        this.end = end;

        if (this.name != null) {
            try {
                this.attributes = EbookNode.#parseAttributes(this.content);
            } catch (error) {
                console.log(error);
            }
        }
    }

    static #parseAttributes(content) {
        let attributes = {};
        let accumulator = "";
        let lookingForAttributeName = false;
        let readingAttributeName = false;
        let lookingForAttributeValue = false;
        let readingAttributeValue = false;
        let attributeValueQuotes = null;
        let attributeName = null;
        let attributeValue = null;
        for (var i = 0; i < content.length; i++) {
            let c = content.charAt(i);
            accumulator += c;
            if (c == ' ' || c == '\t') {
                if (lookingForAttributeName) {
                    // discard and continue looking
                    accumulator = "";
                } else if (readingAttributeName) {
                    // finished reading attribute name
                    readingAttributeName = false;
                    lookingForAttributeValue = true;
                    attributeName = accumulator
                        .substring(0, accumulator.length - 1);
                    accumulator = "";
                } else if (lookingForAttributeValue) {
                    // continue looking, space is not a value
                } else if (readingAttributeValue) {
                    // continue reading
                } else {
                    // discard
                    accumulator = "";
                    lookingForAttributeName = true;
                }
            } else if (c == '=') {
                if (readingAttributeName) {
                    // finished reading attribute name
                    readingAttributeName = false;
                    lookingForAttributeValue = true;
                    attributeName = accumulator
                        .substring(0, accumulator.length - 1);
                    accumulator = "";
                } else if (lookingForAttributeValue) {
                    // we are on the right track, but we keep looking
                } else if (readingAttributeValue) {
                    // all fine, continue reading
                } else {
                    // error
                    throw "wild = discovered at position " + i 
                        + " in: " + content;
                }
            } else if (c == attributeValueQuotes) {
                if (readingAttributeValue) {
                    // may be end of attribute value read unless escaped
                    if (accumulator.charAt(accumulator.length - 2) != '\\') {
                        // finish reading attribute value and save attribute
                        readingAttributeValue = false;
                        lookingForAttributeValue = false;
                        readingAttributeName = false;
                        lookingForAttributeName = true;
                        attributeValue = accumulator
                            .substring(0, accumulator.length - 1);
                        accumulator = "";
                        attributes[attributeName] = attributeValue;
                        attributeName = null;
                        attributeValue = null;
                        attributeValueQuotes = null;
                    }
                } else {
                    throw "wild ending " + attributeValueQuotes 
                        + " discovered at position " + i + " in: " + content;
                }
            } else if (c == '"' || c == "'") {
                if (lookingForAttributeValue) {
                    // start reading attribute value
                    lookingForAttributeValue = false;
                    readingAttributeValue = true;
                    attributeValueQuotes = c;
                    accumulator = "";
                } if (readingAttributeValue) {
                    // continue
                } else {
                    throw "wild " + c + " discovered at position " + i 
                        + " in: " + content;
                }
            } else {
                if (lookingForAttributeName) {
                    lookingForAttributeName = false;
                    readingAttributeName = true;
                } else if (lookingForAttributeValue) {
                    // not going to find a value, starting with a new name
                    readingAttributeValue = false;
                    lookingForAttributeValue = false;
                    readingAttributeName = false;
                    lookingForAttributeName = true;
                    attributeValue = null;
                    accumulator = "";
                    attributes[attributeName] = attributeValue;
                    attributeName = null;
                    attributeValue = null;
                    attributeValueQuotes = null;
                }
                // continue
            }
        }
        return attributes;
    }

    static #shouldBeLeafElement(tagName) {
        return tagName != null && EbookNode.LEAF_ELEMENTS
            .includes(tagName.toLowerCase())
    }

    static #isTag(str) {
        return /^<\/?[^>]+>$/.exec(str) != null;
    }
      
    static #isEndTag(str) {
        return /^<\/[^>]+>$/.exec(str) != null;
    }
        
    static isBothTag(str) {
        return str.startsWith("<!--") 
            || (str.startsWith("<") && str.endsWith("/>"))
            || (str.startsWith("<?xml") && str.endsWith("?>"));
    }
      
    static #getTagName(str) {
        var tagNamePattern = /<\/?([^>\s]+)/;
        var match = tagNamePattern.exec(str);
        if (match != null) {
          return match[1];
        }
        return null;
    }

    static parseHtmlToEbookNode(html, entrancePosition, filename, ebook) {
        var body = EbookNode.#getHtmlBody(html);
        if (body != null) {
          return EbookNode.#parseBody(body, entrancePosition, filename, ebook);
        }
        return null;
    }

    static parseXmlToEbookNode(xml) {
        return EbookNode.#parseBody(xml, null, null, null);
    }

    static #getHtmlBody(html) {
        var bodyStartPattern = /<body[^>]*>/;
        var bodyStartMatch = bodyStartPattern.exec(html);
      
        var bodyEndPattern = /<\/body\s*>/;
        var bodyEndMatch = bodyEndPattern.exec(html);
      
        if (bodyStartMatch != null && bodyEndMatch != null) {
          var from = bodyStartMatch.index + bodyStartMatch[0].length;
          var to = bodyEndMatch.index;
          return html.substring(from, to);
        } else {
          return null;
        }
    }

    static async #parseBody(body, entrancePosition, filename, ebook) {
        var bodyNode = new EbookNode("body", "");
        var current = bodyNode;
      
        var content = "";
      
        for (var i = 0; i < body.length; i++) {
            var c = body.charAt(i);
      
            if (c == '<') {
                // starting a new tag
                // save what we have in content
                if (EbookNode.#isTag(content)) {
                    throw "this should not happen";
                } else {
                    // can only be a text node or nothing
                    if (content.length > 0) {
                        current.#addChild(new EbookNode(null, content));
                        content = "";
                    }
                }
            }

            // accumulate content
            content += c;
      
            if (c == '>') {
                // ending a tag
                if (EbookNode.#isTag(content)) {
                    var name = EbookNode.#getTagName(content);
                    // can only be a tag
                    if (EbookNode.#isEndTag(content)) {
                        if (name != current.name) {
                            throw "incompatible end tag " + name + " for "
                                + current.name;
                        }
                        // move current node up
                        current = current.parent;
                    } else if (EbookNode.isBothTag(content)) {
                        // just add this tag without content
                        current.#addChild(new EbookNode(name, content));
                    } else {
                        // a start tag
                        var newNode = new EbookNode(name, content);
                        current.#addChild(newNode);
                        current = newNode;
                    }
                    // reset content
                    content = "";
                } else {
                    throw "wild > encountered";
                }
            }
        }

        // add the last text node, if there is still such a thing remaining
        if (content.length > 0) {
            if (EbookNode.#isTag(content)) {
                throw "this should not happen";
            } else {
                // can only be a text node or nothing
                if (content.length > 0) {
                    current.#addChild(new EbookNode(null, content));
                }
            }
        }

        if (entrancePosition != null) {
            bodyNode.#collapseLeaves();
            bodyNode.#updatePositions(entrancePosition);
        }
        return bodyNode;
    }

    // find position of the id, if it exists
    getIdPosition(id) {
        if (this.attributes && this.attributes.id && this.attributes.id != null
            && this.attributes.id == id)
        {
            return this.start;
        }
        if (this.children.length > 0) {
            for (var i = 0; i < this.children.length; i++) {
                let position = this.children[i].getIdPosition(id);
                if (position != null) {
                    return position;
                }
            }
        }
        return null;
    }

    #addChild(node) {
        this.children.push(node);
        node.parent = this;
    }
      
    getLength() {
        return this.end - this.start + 1;
    }

    #updatePositions(entrancePosition = 0) {
        var position = entrancePosition;
        this.start = position;
        if (this.name == null) {
            this.end = this.start + this.content.length - 1;
        } else if (EbookNode.#shouldBeLeafElement(this.name)) {
            // occupies a single position
            this.end = this.start;
        } else if (this.children.length == 0) {
            // an element without children, maybe used for spacing, should
            // occupy a single position
            this.end = this.start;
        } else {
            // compute for children and update
            for (var i = 0; i < this.children.length; i++) {
                var child = this.children[i];
                child.#updatePositions(position);
                position = child.end + 1;
            }
            this.end = this.children[this.children.length - 1].end;
        }
    }

    #collapseLeaves() {
        if (EbookNode.#shouldBeLeafElement(this.name) 
            && this.children.length > 0)
        {
            // extract content from children
            this.content = this.getContent();
            this.children = [];
        } else {
            for (var i = 0; i < this.children.length; i++) {
                this.children[i].#collapseLeaves();
            }
        }
    }

    getContent() {
        if (this.name == null) {
            return this.content;
        } else if (this.name == "body") {
            var result = "";
            for (var i = 0; i < this.children.length; i++) {
                result += this.children[i].getContent();
            }
            return result;
        } else if (EbookNode.#shouldBeLeafElement(this.name) 
            && this.children.length == 0) 
        {
            return this.content;
        } else {
            var result = this.content;
            for (var i = 0; i < this.children.length; i++) {
                result += this.children[i].getContent();
            }
            result += "</" + this.name + ">";
            return result;
        }
    }

    setContent(newContent) {
        this.content = newContent;
        if (this.name != null) {
            try {
                this.attributes = EbookNode.#parseAttributes(this.content);
            } catch (error) {
                console.log(error);
            }
        }
    }

    #nextNode() {
        // is this a leaf?
        var current = this;
        if (current.children.length == 0) {
            // go up the parent line until we find next sibling
            var parent = current.parent;
            while (parent != null 
                && parent.children.indexOf(current)
                == parent.children.length - 1)
            {
                current = parent;
                parent = current.parent;
            }
            if (parent != null) {
                // we have the next sibling node
                current = parent.children[parent.children.indexOf(current) + 1];
                return current;
            } else {
                // we have reached root, this was the last leaf, there is no other
                return null;
            }
        } else {
            current = current.children[0];
            return current;
        }
    }
    
    #nextNodeOfName(nodeNameRegex) {
        let current = this.#nextNode();
        while (current != null) {
            if (current.name && current.name.match(nodeNameRegex)) {
                return current;
            }
            current = current.#nextNode();
        }
        return null;
    }

    #nextLeaf() {
        // is this a leaf?
        var current = this;
        if (current.children.length == 0) {
            // go up the parent line until we find next sibling
            var parent = current.parent;
            while (parent != null 
                && parent.children.indexOf(current) 
                == parent.children.length - 1) 
            {
                current = parent;
                parent = current.parent;
            }
            if (parent != null) {
                // we have the next sibling in current, must find first leaf
                current = parent.children[parent.children.indexOf(current) + 1];
            } else {
                // we have reached root, this was the last leaf, there is no other
                return null;
            }
        }
        // find first child of the current node
        while (current.children.length > 0) {
            current = current.children[0];
        }
        return current;
    }

    #getRoot() {
        var current = this;
        while (current.parent != null) current = current.parent;
        return current;
    }
      
    getDocumentStart() {
        return this.#getRoot().start;
    }
      
    getDocumentEnd() {
        return this.#getRoot().end;
    }

    #previousLeaf() {
        var current = this;
        var parent = current.parent;
        while (parent != null && parent.children.indexOf(current) == 0) {
            // keep going up
            current = parent;
            parent = current.parent;
        }
        if (parent != null) {
            current = parent.children[parent.children.indexOf(current) - 1];
            // go down on the last child track
            while (current.children.length > 0) {
                current = current.children[current.children.length - 1];
            }
            return current;
        } else {
            return null;
        }
    }

    #leafAtPosition(position) {
        if (position < this.start || this.end < position) {
            return null;
        } else {
            var currentNode = this;
            while (currentNode != null && currentNode.children.length > 0) {
                var i = 0;
                while (i < currentNode.children.length 
                    && (currentNode.children[i].start > position 
                        || currentNode.children[i].end < position
                    ))
                {
                    i = i + 1;
                }
                if (i < currentNode.children.length) {
                    currentNode = currentNode.children[i];
                } else {
                    currentNode = null;
                }
            }
            return currentNode;
        }
    }

    findChapterEnd(position) {
        var leaf = this.#leafAtPosition(position);
        if (leaf) {
            let nextHeader = leaf.#nextNodeOfName(/h[1-2]/);
            if (nextHeader) {
                return nextHeader.start;
            }
        }
        return this.getDocumentEnd();
    }

    findSpaceAfter(position) {
        var spacePattern = /\s/;
        // first get leaf at position
        var leaf = this.#leafAtPosition(position);
        // for a text node, next space may be in the text node, next space
        // character after position
        // if other kind of node, next space is the start of next leaf
        if (leaf != null && leaf.end == position) {
            // we need to look in the next node
            leaf = leaf.#nextLeaf();
        }
        if (leaf != null && leaf.name == null) {
            var searchStartPosition = (position - leaf.start + 1 > 0) 
                ? position - leaf.start + 1 
                : 0;
            var m = spacePattern.exec(
                leaf.content.substring(searchStartPosition)
            );
            if (m != null) {
                return m.index + position + 1;
            }
        }
        if (leaf != null) {
            return leaf.end;
        } else {
            return this.getDocumentEnd();
        }
    }

    findSpaceBefore(position) {
        var spacePattern = /\s[^\s]*$/;
        var leaf = this.#leafAtPosition(position);
        if (leaf != null && leaf.name == null) {
            var searchText = leaf.content.substring(0, position - leaf.start);
            var m = spacePattern.exec(searchText);
            if (m != null) {
                return m.index + leaf.start;
            }
        }
        if (leaf != null) {
            leaf = leaf.#previousLeaf();
        }
        if (leaf != null) {
            return leaf.end;
        } else {
            return this.getDocumentStart();
        }
    }

    copy(from, to) {
        if (this.name == null) {
            if (from <= this.start 
                && this.end <= to
            ) {
                // this node is copied whole
                return new EbookNode(
                    null, 
                    this.content, 
                    null, 
                    [], 
                    this.start, 
                    this.end
                );
            } else if (from <= this.start 
                && this.start <= to 
                && to<= this.end
            ) {
                // copy ends at this node
                return new EbookNode(
                    this.name, 
                    this.content.substring(0, to - this.start + 1), 
                    null, 
                    [], 
                    this.start, 
                    to
                );
            } else if (this.start <= from 
                && from <= this.end 
                && this.end <= to
            ) {
                // copy starts at this node
                return new EbookNode(
                    this.name, 
                    this.content.substring(from - this.start), 
                    null, 
                    [], 
                    from, 
                    this.end
                );
            } else if (this.start <= from 
                && to < this.end
            ) {
                // we only copy part of this node
                return new EbookNode(
                    this.name, 
                    this.content.substring(
                        from - this.start, 
                        to - this.start + 1
                    ), 
                    null, 
                    [], 
                    from, 
                    to
                );
            } else {
                return null;
            }
        } else if (EbookNode.#shouldBeLeafElement(this.name)) {
            if (from <= this.start && this.end <= to) {
                // include element in selection
                return new EbookNode(
                    this.name, 
                    this.content, 
                    null, 
                    [], 
                    this.start, 
                    this.end
                );
            } else {
                return null;
            }
        } else {
            if (this.end < from || this.start > to) {
                // this node is outside the range and should not be copied
                return null;
            } else {
                var newNode = new EbookNode(this.name, this.content);
                var newChildren = [];
                for (var i = 0; i < this.children.length; i++) {
                    var copiedChild = this.children[i].copy(from, to);
                    if (copiedChild != null) {
                        copiedChild.parent = newNode;
                        newChildren.push(copiedChild);
                    }
                }
                newNode.children = newChildren;
                if (newNode.children.length == 0) {
                    newNode.start = this.start;
                    newNode.end = this.end;
                } else {
                    newNode.start = newNode.children[0].start;
                    newNode.end = 
                        newNode.children[newNode.children.length - 1].end;
                }
                return newNode;
            }
        }
    }

    getResources() {
        if (this.name === 'img') {
            var rg = /src="([^"]+)"/g;
            return [...this.content.matchAll(rg)].map(m => m[1]);
        } else if (this.name === 'image') {
            var rg = /xlink:href="([^"]+)"/g;
            return [...this.content.matchAll(rg)].map(m => m[1]);
        } else if (this.name === 'a') {
            var rgHref = /href="([^"]+)"/g;
            return [...this.content.matchAll(rgHref)].map(m => m[1]);
        } else if (this.name === "tr") {
            var rgSrc = /src="([^"]+)"/g;
            var rgHref = /href="([^"]+)"/g;
            return [...this.content.matchAll(rgSrc)].map(m => m[1])
                .concat([...this.content.matchAll(rgHref)].map(m => m[1]));
        } else if (this.children.length > 0) {
            return this.children.flatMap(c => c.getResources());
        } else {
            return [];
        }
    }

    findChildrenWithTag(tagName, deep = false) {
        let result = [];
        for (let i = 0; i < this.children.length; i++) {
            if (this.children[i].name == tagName) {
                result.push(this.children[i]);
            }
            if (deep) {
                result = result.concat(
                    this.children[i].findChildrenWithTag(tagName, deep)
                );
            }
        }
        return result;
    }
}

class ArchiveWrapper {

    static factory(type, bytes = null) {
        if ((type == "zip" || type == "epub" || type == "cbz") && bytes != null) {
            return new ZipWrapper(bytes)
        } else if ((type == "rar" || type == "cbr") && bytes != null) {
            return new RarWrapper(bytes)
        } else {
            return null
        }
    }

    constructor(bytes) {
        this.data = bytes
    }
    async getFiles() {
        throw NOT_IMPLEMENTED_EXCEPTION
    }
    async getFileContents(filename) {
        throw NOT_IMPLEMENTED_EXCEPTION
    }
    async getBase64FileContents(filename) {
        throw NOT_IMPLEMENTED_EXCEPTION
    }
    async getTextFileContents(filename) {
        throw NOT_IMPLEMENTED_EXCEPTION
    }
}

class ZipWrapper extends ArchiveWrapper {
    constructor(bytes) {
        super(bytes)
    }
    async #getZip() {
        if (this.zip == undefined) {
            var zip = new JSZip()
            var z = await zip.loadAsync(this.data)
            this.zip = z
        }
        return this.zip
    }
    async getFiles() {
        let zip = await this.#getZip()
        let files = Object.entries(zip.files)
            .filter(v => v[1].dir == false)
            .map(v => v[0])
        return files.sort()
    }
    // https://stuk.github.io/jszip/documentation/api_zipobject/async.html
    async #getFileContents(filename, filekind) {
        let zip = await this.#getZip()
        let entry = zip.files[filename]
        if (entry) {
            let contents = await entry.async(filekind)
            return contents
        } else {
            return null
        }
    }
    async getFileContents(filename) {
        return this.#getFileContents(filename, "binarystring")
    }
    async getBase64FileContents(filename) {
        return this.#getFileContents(filename, "base64")
    }
    async getTextFileContents(filename) {
        return this.#getFileContents(filename, "text")
    }
}

class RarWrapper extends ArchiveWrapper {
    constructor(bytes) {
        super(bytes)
    }
    async #getRar() {
        if (this.rar == undefined) {
            var content = this.data
            if (typeCheck(this.data) == "blob") {
                content = await this.data.arrayBuffer()
            }
            var rar = readRARContent([{
                "name": "name.cbr",
                "content": new Uint8Array(content)
            }], null, null)
            this.rar = rar
        }
        return this.rar
    }
    #getFilesRecursive(entry) {
        if (entry.ls != undefined) {
            let result = []
            for (let k of Object.keys(entry.ls)) {
                result = result.concat(this.#getFilesRecursive(entry.ls[k]))
            }
            return result
        } else {
            return [entry]
        }
    }
    async getFiles() {
        var rar = await this.#getRar()
        let files = this.#getFilesRecursive(rar)
        return files.map(f => f.fullFileName).sort()
    }

    #toByteArray(dataArr) {
        var encoder = new TextEncoder("ascii");
        var base64Table = encoder.encode('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=');

        var padding = dataArr.byteLength % 3;
        var len = dataArr.byteLength - padding;
        padding = padding > 0 ? (3 - padding) : 0;
        var outputLen = ((len/3) * 4) + (padding > 0 ? 4 : 0);
        var output = new Uint8Array(outputLen);
        var outputCtr = 0;
        for(var i=0; i<len; i+=3){              
            var buffer = ((dataArr[i] & 0xFF) << 16) | ((dataArr[i+1] & 0xFF) << 8) | (dataArr[i+2] & 0xFF);
            output[outputCtr++] = base64Table[buffer >> 18];
            output[outputCtr++] = base64Table[(buffer >> 12) & 0x3F];
            output[outputCtr++] = base64Table[(buffer >> 6) & 0x3F];
            output[outputCtr++] = base64Table[buffer & 0x3F];
        }
        if (padding == 1) {
            var buffer = ((dataArr[len] & 0xFF) << 8) | (dataArr[len+1] & 0xFF);
            output[outputCtr++] = base64Table[buffer >> 10];
            output[outputCtr++] = base64Table[(buffer >> 4) & 0x3F];
            output[outputCtr++] = base64Table[(buffer << 2) & 0x3F];
            output[outputCtr++] = base64Table[64];
        } else if (padding == 2) {
            var buffer = dataArr[len] & 0xFF;
            output[outputCtr++] = base64Table[buffer >> 2];
            output[outputCtr++] = base64Table[(buffer << 4) & 0x3F];
            output[outputCtr++] = base64Table[64];
            output[outputCtr++] = base64Table[64];
        }

        return output
    }

    #toBase64(dataArr) {
        var decoder = new TextDecoder("ascii");
        
        let output = this.#toByteArray(dataArr)
        
        var ret = decoder.decode(output);
        output = null;
        dataArr = null;
        return ret;
    }

    async #getFileContents(filename) {
        let rar = await this.#getRar()
        let files = this.#getFilesRecursive(rar)
        let file = files.find(f => f.fullFileName == filename)
        if (file != undefined) {
            let fileContent = file.fileContent
            return fileContent
        } else {
            return null
        }
    }

    async getFileContents(filename) {
        return await this.#getFileContents(filename)
    }

    async getBase64FileContents(filename) {
        return this.#toBase64(await this.#getFileContents(filename))
    }

    async getTextFileContents(filename) {
        throw NOT_IMPLEMENTED_EXCEPTION
    }
}

class BookWrapper {

    static factory(id, archive, extension) {
        if (extension == "epub") {
            return new EbookWrapper(id, archive)
        } else if (extension == "cbz" || extension == "cbr") {
            return new ComicWrapper(id, archive)
        } else {
            return null
        }
    }

    constructor(id, archive) {
        this.id = id
        this.archive = archive
    }

    async getSize() {
        return 0
    }

    async getCover() {
        return null
    }

    async getContentsAt(position) {
        return null
    }

    async getToc() {
        return []
    }
}

/*
comic wrapper
- contains a zip or a rar wrapper
- get size
- get title
- get cover
- get contents for position(s)
*/

class ComicWrapper extends BookWrapper {
    constructor(id, archive) {
        super(id, archive)
    }

    async getSize() {
        let files = await this.#getImageFiles()
        return files.length
    }

    async getCover() {
        if (this.cover == undefined) {
            if (await this.getSize() > 0) {
                this.cover = await this.getContentsAt(0)
            } else {
                this.cover = null
            }
        }
        return this.cover
    }

    async getToc() {
        let size = await this.getSize()
        let magnitude = size.toString().length

        let toc = []
        if (magnitude >= 2) {
            let miniToc = []
            for (let i = 0; i < size; i++) {
                miniToc.push({
                    "name": "Page " + (i + 1),
                    "position": i
                })
                if (i % 10 == 9 || i == size - 1) {
                    toc.push({
                        "name": "Pages " + (miniToc[0].position + 1) + " to " + (miniToc[miniToc.length - 1].position + 1),
                        "position": miniToc[0].position,
                        "children": miniToc
                    })
                    miniToc = []
                }
            }
        } else {
            for (let i = 0; i < size; i++) {
                toc.push({
                    "name": "Page " + (i + 1),
                    "position": i
                })
            }
        }
        return toc
    }

    async #getImageFiles() {
        let files = await this.archive.getFiles()
        let validFiles = files.filter(f => f.toLowerCase().match(/(.jpg|.jpeg|.png|.gif)$/))
        return validFiles
    }

    async getContentsAt(position) {
        if (position >= 0 && position < await this.getSize()) {
            let files = await this.#getImageFiles()
            let file = files[position]
            let contents = await this.archive.getBase64FileContents(file)
            return "data:" + getFileMimeType(file) + ";base64," + contents
        } else {
            return null
        }
    }
}

class Gestures {
    constructor(element, resetSwipeFunction, getZoomFunction, setZoomFunction, panFunction, singleClickFunction, doubleClickFunction, mouseScrollFunction) {
        this.element = element
        this.clickCache = []
        this.DOUBLE_CLICK_THRESHOLD = 400
        this.CLICK_DISTANCE_THRESHOLD = 5
        this.resetSwipe = resetSwipeFunction
        this.getZoom = getZoomFunction
        this.setZoom = setZoomFunction
        this.pan = panFunction
        this.singleClick = singleClickFunction
        this.doubleClick = doubleClickFunction
        this.mouseScroll = mouseScrollFunction

        if (this.isTouchEnabled()) {
            this.element.addEventListener("touchstart", this.getTouchStartHandler(), false)
            this.element.addEventListener("touchmove", this.getTouchMoveHandler(), false)
            this.element.addEventListener("touchend", this.getTouchEndHandler(), false)
        } else {
            this.element.addEventListener("pointerdown", this.getTouchStartHandler(), false)
            this.element.addEventListener("pointermove", this.getTouchMoveHandler(), false)
            this.element.addEventListener("pointerup", this.getTouchEndHandler(), false)
            this.element.addEventListener("wheel", this.getMouseWheelScrollHandler(), false)
            this.element.addEventListener("contextmenu", this.getContextMenuHandler(), false)
        }
    }
    getContextMenuHandler() {
        let self = this
        function contextMenuHandler(event) {
            self.disableEventNormalBehavior(event)
            return false
        }
        return contextMenuHandler
    }
    getMouseWheelScrollHandler() {
        let self = this
        function mouseWheelScrollHandler(event) {
            let scrollCenterX = event.clientX
            let scrollCenterY = event.clientY
            let scrollValue = event.deltaY

            if (self.mouseScroll) self.mouseScroll(scrollCenterX, scrollCenterY, scrollValue)
        }
        return mouseWheelScrollHandler
    }
    isTouchEnabled() {
        return window.matchMedia("(pointer: coarse)").matches
    }
    disableEventNormalBehavior(event) {
        event.preventDefault()
        event.stopPropagation()
    }
    pushClick(timestamp) {
        this.clickCache.push(timestamp)
        while (this.clickCache.length > 2) {
            this.clickCache.shift()
        }
    }
    getTouchStartHandler() {
        let self = this
        function touchStartHandler(event) {
            self.disableEventNormalBehavior(event)
            self.pushClick(Date.now())
            self.panEnabled = true

            if (self.getTouchesCount(event) >= 1) {
                self.originalCenter = self.computeCenter(event)
                self.previousCenter = self.originalCenter
                if (self.resetSwipe) self.resetSwipe()
            }
            if (self.getTouchesCount(event) == 2) {
                self.originalPinchSize = self.computeDistance(event)
                if (self.getZoom) self.originalZoom = self.getZoom()
            }
            return false
        }
        return touchStartHandler
    }
    getTouchesCount(event) {
        if (event.type.startsWith("touch")) {
            return event.targetTouches.length
        } else {
            if (event.buttons > 0) {
                return 1
            } else {
                return 0
            }
        }
    }
    computeDistance(pinchTouchEvent) {
        if (pinchTouchEvent.targetTouches.length == 2) {
            return this.computePointsDistance({
                x: pinchTouchEvent.targetTouches[0].clientX,
                y: pinchTouchEvent.targetTouches[0].clientY
            }, {
                x: pinchTouchEvent.targetTouches[1].clientX,
                y: pinchTouchEvent.targetTouches[1].clientY
            })
        } else {
            return null
        }
    }
    computePointsDistance(p1, p2) {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2))
    }
    computeCenter(event) {
        if (event.type.startsWith("touch")) {
            let centerX = 0
            let centerY = 0
            for (let i = 0; i < event.targetTouches.length; i++) {
                centerX = centerX + event.targetTouches[i].clientX
                centerY = centerY + event.targetTouches[i].clientY
            }
            centerX = centerX / event.targetTouches.length
            centerY = centerY / event.targetTouches.length
            return {
                x: centerX,
                y: centerY
            }
        } else if (event.type.startsWith("pointer")) {
            return {
                x: event.clientX,
                y: event.clientY
            }
        } else {
            return null
        }
    }
    #getPanSpeed() {
        return 3
    }
    getTouchMoveHandler() {
        let self = this
        function touchMoveHandler(ev) {
            self.disableEventNormalBehavior(ev)
            if (self.getTouchesCount(ev) == 2) {
                self.pinching = true
                let pinchSize = self.computeDistance(ev)
                let currentZoom = pinchSize / self.originalPinchSize
                let newZoom = self.originalZoom * currentZoom
                if (self.setZoom) {
                    self.setZoom(newZoom, self.originalCenter.x, self.originalCenter.y)
                }
            } else if (self.getTouchesCount(ev) == 1) {
                self.pinching = false
            }
            if (self.panEnabled && self.getTouchesCount(ev) > 0 && self.getTouchesCount(ev) <= 2) {
                let currentCenter = self.computeCenter(ev)
                let deltaX = currentCenter.x - self.previousCenter.x
                let deltaY = currentCenter.y - self.previousCenter.y
                let totalDeltaX = currentCenter.x - self.originalCenter.x
                let totalDeltaY = currentCenter.y - self.originalCenter.y
                self.previousCenter = currentCenter
                if (self.pan) {
                    let stopPan = self.pan(
                        deltaX * self.#getPanSpeed(), 
                        deltaY * self.#getPanSpeed(), 
                        totalDeltaX, 
                        totalDeltaY, 
                        self.pinching
                    )
                    if (stopPan) self.panEnabled = false
                }
            }
            return false
        }
        return touchMoveHandler
    }
    isDoubleClick() {
        if (this.clickCache.length >= 2) {
            let timeDifference = this.clickCache[this.clickCache.length - 1] - this.clickCache[this.clickCache.length - 2]
            return timeDifference < this.DOUBLE_CLICK_THRESHOLD
        } else {
            return false
        }
    }
    isLastClickRelevant() {
        if (this.clickCache.length >= 1) {
            let clickNotTooOld = Date.now() - this.clickCache[this.clickCache.length - 1] < this.DOUBLE_CLICK_THRESHOLD
            let panNotTooLarge = this.computePointsDistance(this.originalCenter, this.previousCenter) < this.CLICK_DISTANCE_THRESHOLD
            return clickNotTooOld && panNotTooLarge && this.panEnabled
        } else {
            return false
        }
    }
    getTouchEndHandler() {
        let self = this
        function touchEndHandler(ev) {
            self.disableEventNormalBehavior(ev)

            if (self.getTouchesCount(ev) >= 1) {
                self.originalCenter = self.computeCenter(ev)
                self.previousCenter = self.originalCenter
            }
            if (self.isLastClickRelevant()) {
                if (self.isDoubleClick()) {
                    if (self.doubleClick) self.doubleClick(self.originalCenter.x, self.originalCenter.y)
                } else {
                    if (self.singleClick) self.singleClick(self.originalCenter.x, self.originalCenter.y)
                }
            }
            return false
        }
        return touchEndHandler
    }
}

class ColorMap {
    constructor() {
        this.map = new Map()
    }
    #col(r, g, b) {
        return r + ',' + g + ',' + b
    }
    #components(str) {
        let c = str.split(",")
        return [Number(c[0]), Number(c[1]), Number(c[2])]
    }
    add(imageData) {
        let colorArray = imageData.data
        let color = this.#col(colorArray[0], colorArray[1], colorArray[2])
        if (this.map.has(color)) {
            let currentExpression = this.map.get(color)
            this.map.set(color, currentExpression + 1)
        } else {
            this.map.set(color, 1)
        }
    }
    getMostExpressed() {
        let orderedColors = Array.from(this.map).sort((a, b) => b[1] - a[1])
        let mostRepresented = orderedColors[0]
        let selectedColors = orderedColors.filter(v => v[1] / mostRepresented[1] > .1)
        let r = 0
        let g = 0
        let b = 0
        for (let i = 0; i < selectedColors.length; i++) {
            let c = this.#components(selectedColors[i][0])
            r = r + c[0]
            g = g + c[1]
            b = b + c[2]
        }
        r = r / selectedColors.length
        g = g / selectedColors.length
        b = b / selectedColors.length
        return [r, g, b]
    }
}

class Display {

    static factory(element, settings, extension) {
        if (extension == "epub") {
            return new EbookDisplay(element, settings)
        } else if (extension == "cbz" || extension == "cbr") {
            return new ComicDisplay(element, settings)
        } else {
            return null
        }
    }

    LOADING_ANIMATION_STYLE_ID = "loadingAnimationStyle"
    SVG_NAMESPACE = "http://www.w3.org/2000/svg"
    TOC_HIGHLIGHT_CLASS = "highlighted"
    constructor(element, settings) {
        this.element = element
        this.settings = settings
        this.configure()
        this.buildUi()
        this.showLoading()
    }

    setBook(book) {
        this.book = book
        if (this.settings.showTools) {
            this.buildToolsUi()
        }
    }

    setDefault(settingName, defaultValue) {
        if (this.settings[settingName] == undefined) {
            this.settings[settingName] = defaultValue
        }
    }

    configure() {
        this.setDefault("position", 0)
        this.setDefault("leftMarginPercent", 10)
        this.setDefault("topMarginPercent", 5)
        this.setDefault("toolsButtonPercent", 10)
        this.setDefault("displayControls", true)
        this.setDefault("controlsColor", "#000000")
        //this.setDefault("displayPageForCallback", )
        this.setDefault("showTools", true)
        this.setDefault("swipeLength", 0.06)
        this.setDefault("swipeAngleThreshold", 30)
        this.setDefault("enableKeyboard", false)
        this.setDefault("toolsContents", ["cover", "toc", "progress"])
        this.setDefault("flipToolsAlignment", false)
    }

    getPosition() {
        return this.settings.position
    }

    setPosition(position) {
        return this.settings.position = position
    }

    createSvg(topX, topY, bottomX, bottomY, left, top, width, height) {
        let svg = document.createElementNS(this.SVG_NAMESPACE, "svg")
        svg.setAttribute("viewBox", topX + " " + topY + " " + bottomX + " " + bottomY)
        svg.style.position = "absolute"
        svg.style.width = width
        svg.style.height = height
        svg.style.top = top
        svg.style.left = left
        return svg
    }

    createPath(d, strokeWidth) {
        let path = document.createElementNS(this.SVG_NAMESPACE, "path")
        path.setAttribute("d", d)
        path.setAttribute("stroke-width", strokeWidth)
        path.setAttribute("stroke-linecap", "round")
        path.setAttribute("fill", "none")
        return path
    }
    
    getNextSvg() {
        let svg = this.createSvg(0, 0, 10, 40, "30%", "40%", "40%", "auto")
        let path = this.createPath("M 2 2 L 8 20 L 2 38", 3)
        svg.appendChild(path)
        return svg
    }

    getPreviousSvg() {
        let svg = this.createSvg(0, 0, 10, 40, "30%", "40%", "40%", "auto")
        let path = this.createPath("M 8 2 L 2 20 L 8 38", 3)
        svg.appendChild(path)
        return svg
    }

    getToolsSvg() {
        let svg = this.createSvg(0, 0, 12, 12, "30%", "30%", "40%", "auto")
        svg.appendChild(this.createPath("M 2 2 L 10 2", 3))
        svg.appendChild(this.createPath("M 2 6 L 10 6", 3))
        svg.appendChild(this.createPath("M 2 10 L 10 10", 3))
        return svg
    }

    getLoadingSvg() {
        let svg = this.createSvg(-5, -5, 110, 110, "45%", "45%", "10%", "10%")
        let path = this.createPath("M 50 50 m -50, 0 a 50,50 0 1,0 100,0 a 50,50 0 1,0 -100,0", 10)
        path.style.strokeDasharray = 320
        path.style.strokeDashoffset = 0
        path.style.animation = "loadinganimation 2s linear infinite"
        svg.appendChild(path)
        
        if (!document.getElementById(this.LOADING_ANIMATION_STYLE_ID)) {
            var animationStyle = document.createElement('style')
            animationStyle.id = this.LOADING_ANIMATION_STYLE_ID
            animationStyle.innerHTML = "\
                @keyframes loadinganimation {\
                    from {\
                        stroke-dashoffset: 640;\
                    }\
                    to {\
                        stroke-dashoffset: 0;\
                    }\
                }\
            "
            document.body.appendChild(animationStyle)
        }
        
        return svg
    }

    async goToNextView() {

    }

    async goToPreviousView() {

    }

    // trigger an update
    update() {
    }

    hideTools() {
        if (this.settings.showTools) {
            this.tools.style.display = "none"
            this.toolsMinimizeLeft.style.display = "none"
            this.toolsMinimizeRight.style.display = "none"
        }
    }

    #addControlHoverActions(element, svg) {
        svg.style.opacity = .2
        element.appendChild(svg)
        element.onmouseover = () => svg.style.opacity = 1
        element.onmouseout = () => svg.style.opacity = .2
    }

    buildUi() {
        if (this.settings.showTools == false) {
            this.settings.toolsButtonPercent = 0
        }
       
        this.element.innerHTML = ""
        this.page = document.createElement("img")
        this.page.style.position = "absolute"
        this.element.appendChild(this.page)
        this.previous = createDivElement(this.element, 0, 0, (this.settings.leftMarginPercent) + "%", (100-this.settings.toolsButtonPercent) + "%", "#ff000000")
        if (this.settings.displayControls) {
            this.#addControlHoverActions(this.previous, this.getPreviousSvg())
        }
        this.previous.onclick = () => { this.goToPreviousView() }
        this.next = createDivElement(this.element, (100-this.settings.leftMarginPercent) + "%", 0, (this.settings.leftMarginPercent) + "%", (100-this.settings.toolsButtonPercent) + "%", "#00ff0000")
        if (this.settings.displayControls) {
            this.#addControlHoverActions(this.next, this.getNextSvg())
        }
        this.next.onclick = () => { this.goToNextView() }
        let displayToolsFunction = null
        if (this.settings.showTools) {
            this.toolsLeft = createDivElement(this.element, 0, (100-this.settings.toolsButtonPercent) + "%", this.settings.leftMarginPercent + "%", this.settings.toolsButtonPercent + "%", null)
            if (this.settings.displayControls) {
                this.#addControlHoverActions(this.toolsLeft, this.getToolsSvg())
            }
            this.toolsRight = createDivElement(this.element, (100-this.settings.leftMarginPercent) + "%", (100-this.settings.toolsButtonPercent) + "%", this.settings.leftMarginPercent + "%", this.settings.toolsButtonPercent + "%", null)
            if (this.settings.displayControls) {
                this.#addControlHoverActions(this.toolsRight, this.getToolsSvg())
            }
        
            this.tools = createDivElement(this.element, this.settings.leftMarginPercent + "%", 0, (100-this.settings.leftMarginPercent*2) + "%", "100%", null)
            this.tools.classList.add(Display.CLASS_TOOLS)
            this.tools.style.display = "none"
            this.tools.style.overflow = "scroll"
            this.tools.style.zIndex = 1000

            this.toolsMinimizeLeft = createDivElement(this.element, 0, 0, this.settings.leftMarginPercent + "%", "100%", null)
            this.toolsMinimizeLeft.classList.add(Display.CLASS_TOOLS)
            this.toolsMinimizeLeft.style.display = "none"
            this.toolsMinimizeLeft.style.zIndex = 1000
            
            this.toolsMinimizeRight = createDivElement(this.element, (100-this.settings.leftMarginPercent) + "%", 0, this.settings.leftMarginPercent + "%", "100%", null)
            this.toolsMinimizeRight.classList.add(Display.CLASS_TOOLS)
            this.toolsMinimizeRight.style.display = "none"
            this.toolsMinimizeRight.style.zIndex = 1000

            displayToolsFunction = (alignedRight) => {
                this.tools.style.display = "block"
                this.toolsMinimizeLeft.style.display = "block"
                this.toolsMinimizeRight.style.display = "block"
                if (this.settings.flipToolsAlignment == true) {
                    if (alignedRight) {
                        this.tools.style.textAlign = "right"
                        this.tools.style.direction = "rtl"
                    } else {
                        this.tools.style.textAlign = "left"
                        this.tools.style.direction = "ltr"
                    }
                }
            }
            this.toolsLeft.onclick = () => displayToolsFunction(false)
            this.toolsRight.onclick = () => displayToolsFunction(true)
            this.toolsMinimizeLeft.onclick = () => this.hideTools()
            this.toolsMinimizeRight.onclick = () => this.hideTools()
        }
        this.loading = createDivElement(this.element, this.settings.leftMarginPercent + "%", 0, (100 - 2 * this.settings.leftMarginPercent) + "%", "100%", "#ffffff00")
        this.loading.appendChild(this.getLoadingSvg())
        this.loading.style.zIndex = 2000
        this.setControlsColor(this.settings.controlsColor)

        if (this.settings.enableKeyboard) {
            this.#enableKeyboardGestures({
                "leftAction": () => this.goToPreviousView(),
                "rightAction": () => this.goToNextView(),
                "escapeAction": () => displayToolsFunction(false)
            })
        }
    }

    #enableKeyboardGestures(actions) {
        document.onkeydown = function(e) {
            if (e.keyCode == '38' || e.keyCode == '87') {
                // up arrow or w
                if (actions.upAction) actions.upAction()
            }
            else if (e.keyCode == '40' || e.keyCode == '83') {
                // down arrow or s
                if (actions.downAction) actions.downAction()
            }
            else if (e.keyCode == '37' || e.keyCode == '65') {
                // left arrow or a
                if (actions.leftAction) actions.leftAction()
            }
            else if (e.keyCode == '39' || e.keyCode == '68') {
                // right arrow or d
                if (actions.rightAction) actions.rightAction()
            }
            else if (e.keyCode == '27') {
                // escape
                if (actions.escapeAction) actions.escapeAction()
            }
        }
    }

    async addCoverToToolsUi(toolsContents) {
        // add cover
        let coverBase64 = await this.book.getCover()
        if (coverBase64) {
            let coverElement = document.createElement("img")
            coverElement.style.maxWidth = "100%"
            coverElement.src = coverBase64
            toolsContents.appendChild(coverElement)
        }
    }

    async addTocToToolsUi(toolsContents) {
        // add toc
        let buildTocListFunction = (node) => {
            let item = document.createElement("li")
            let link = document.createElement("a")
            link.innerHTML = node.name
            link.setAttribute("position", node.position)
            link.style.direction = "ltr"
            //link.style.display = "inline-block"
            link.onclick = () => {
                this.hideTools()
                this.displayPageFor(node.position)
            }
            item.appendChild(link)
            if (node.children && node.children.length > 0) {
                let sublist = document.createElement("ul")
                sublist.style.listStyleType = "none"
                for (let i = 0; i < node.children.length; i++) {
                    let sublistItem = buildTocListFunction(node.children[i])
                    sublist.appendChild(sublistItem)
                }
                sublist.style.display = "none"
                let button = document.createElement("span")
                button.innerHTML = "+"
                button.style.display = "inline-block"
                button.style.padding = "5px"
                button.style.cursor = "pointer"
                button.onclick = () => {
                    if (sublist.style.display == "none") {
                        sublist.style.display = "block"
                        button.innerHTML = "-"
                    } else {
                        sublist.style.display = "none"
                        button.innerHTML = "+"
                    }
                }
                item.prepend(button)
                item.appendChild(sublist)
            } else {
                let button = document.createElement("span")
                button.innerHTML = "-"
                button.style.display = "inline-block"
                button.style.padding = "5px"
                item.prepend(button)
            }
            return item
        }
        let toc = await this.book.getToc()
        if (toc.length > 0) {
            let tocList = document.createElement("ul")
            tocList.style.listStyleType = "none"
            tocList.style.padding = "0"
            for (let i = 0; i < toc.length; i++) {
                let item = buildTocListFunction(toc[i])
                tocList.appendChild(item)
            }
            toolsContents.appendChild(tocList)
            this.tocElement = tocList
        }
    }

    async addProgressToToolsContents(toolsContents) {
        this.progressDisplay = document.createElement("p")
        this.progressDisplay.style.direction = "ltr"
        this.progressDisplay.innerHTML = "remaining"
        toolsContents.appendChild(this.progressDisplay)
    }

    static CLASS_TOOLS = "tools"
    static CLASS_TOOLS_CONTENTS = "toolsContents"
    async buildToolsUi() {
        let toolsContents = document.createElement("div")
        toolsContents.classList.add(Display.CLASS_TOOLS_CONTENTS)
        toolsContents.style.position = "absolute"
        toolsContents.style.top = 0
        toolsContents.style.left = 0
        toolsContents.style.width = "100%"

        console.log(this.settings.toolsContents)
        for (let content of this.settings.toolsContents) {
            if (content == "cover") {
                await this.addCoverToToolsUi(toolsContents)
            } else if (content == "toc") {
                await this.addTocToToolsUi(toolsContents)
            } else if (content == "progress") {
                await this.addProgressToToolsContents(toolsContents)
            } else {
                //custom content
                if (typeof content == "function") {
                    let element = await content()
                    toolsContents.appendChild(element)
                }
            }
        }
        
        this.tools.innerHTML = ""
        this.tools.appendChild(toolsContents)        
    }

    tocFindParentLink(currentLink) {
        if (currentLink.parentElement.tagName == "LI"
            && currentLink.parentElement.parentElement.tagName == "UL"
            && currentLink.parentElement.parentElement.parentElement.tagName == "LI") {
            let links = currentLink.parentElement.parentElement.parentElement.getElementsByTagName("a")
            if (links.length > 1) {
                return links[0]
            }
        }
        return null
    }

    highlightTocPosition(position) {
        if (this.tocElement) {
            let highlighted = Array.from(this.tocElement.getElementsByClassName(this.TOC_HIGHLIGHT_CLASS))
            for (let i = 0; i < highlighted.length; i++) {
                highlighted[i].classList.remove(this.TOC_HIGHLIGHT_CLASS)
            }
            let links = this.tocElement.getElementsByTagName("a")
            for (let i = links.length - 1; i >= 0; i--) {
                let linkPosition = Number.parseInt(links[i].getAttribute("position"))
                if (linkPosition == position || linkPosition < position) {
                    links[i].classList.add(this.TOC_HIGHLIGHT_CLASS)
                    let parent = this.tocFindParentLink(links[i])
                    while (parent != null) {
                        parent.classList.add(this.TOC_HIGHLIGHT_CLASS)
                        parent = this.tocFindParentLink(parent)
                    }
                    break
                }
            }
        }
    }

    showLoading() {
        this.loading.style.display = "block"
    }

    hideLoading() {
        this.loading.style.display = "none"
    }
}

class ComicDisplay extends Display {
    constructor(element, settings) {
        super(element, settings)
        this.zoomValue = 1
    }

    setBook(book) {
        super.setBook(book)
        this.displayPageFor(this.getPosition()).then(() => this.#fitPageToScreen())
    }

    setControlsColor(color) {
        this.previous.style.stroke = color
        this.next.style.stroke = color
        if (this.toolsLeft) this.toolsLeft.style.stroke = color
        if (this.toolsRight) this.toolsRight.style.stroke = color
        this.loading.style.stroke = color
    }

    update() {
        console.log("do nothing")
    }

    buildUi() {
        super.buildUi()

        this.gestureControls = createDivElement(this.element, this.settings.leftMarginPercent + "%", 0, (100 - 2 * this.settings.leftMarginPercent) + "%", "100%", "#ffffff00")

        let mouseGestureScroll = (scrollCenterX, scrollCenterY, scrollValue) => {
            var zoomDelta = 1 + scrollValue * this.#getScrollSpeed() * (this.#getInvertScroll() ? 1 : -1)
            var newZoom = this.#getZoom() * zoomDelta
            this.#zoom(newZoom, scrollCenterX, scrollCenterY, true)
        }
        let getZoomFunction = () => {
            return this.#getZoom()
        }
        let zoomFunction = (val, cx, cy, withUpdate) => {
            this.#zoom(val, cx, cy, withUpdate)
        }
        let panFunction = (x, y, totalDeltaX, totalDeltaY, pinching) => {
            this.#pan(x, y, totalDeltaX, totalDeltaY, pinching)
        }
        new Gestures(
            this.gestureControls, 
            () => this.#resetPan(), 
            getZoomFunction, 
            zoomFunction, 
            panFunction, 
            null, 
            (x, y) => this.#zoomJump(x, y), 
            mouseGestureScroll
        )

        window.onresize = () => {
            executeWithDelay(() => { this.#update() }, 500)
        }
    }

    #getScrollSpeed() {
        return 0.001
    }

    #getInvertScroll() {
        return false
    }

    #zoom(zoom, centerX, centerY, withImageUpdate) {
        let sideLeft = centerX - this.#getLeft()
        let ratioLeft = sideLeft / (this.#getWidth() * this.#getZoom())
        let newSideLeft = (this.#getWidth() * zoom) * ratioLeft
        this.#setLeft(centerX - newSideLeft)

        let sideTop = centerY - this.#getTop()
        let ratioTop = sideTop / (this.#getHeight() * this.#getZoom())
        let newSideTop = (this.#getHeight() * zoom) * ratioTop
        this.#setTop(centerY - newSideTop)

        this.#setZoom(zoom)
        if (zoom > this.#getMinimumZoom()) {
            this.#setZoomJump(zoom)
        }
        if (withImageUpdate) this.#update()
    }

    #getLastPosition(imageDimension, viewportDimension, imageValue, viewportJumpPercentage, threshold) {
        return viewportDimension - imageDimension
    }
    #getNextPosition(imageDimension, viewportDimension, imageValue, viewportJumpPercentage, threshold) {
        if (approx(imageValue, viewportDimension - imageDimension, threshold)) return 0
        var proposedNextPosition = (imageValue - viewportDimension * viewportJumpPercentage) | 0
        if (proposedNextPosition < viewportDimension - imageDimension) return viewportDimension - imageDimension
        return proposedNextPosition
    }
    #getPreviousPosition(imageDimension, viewportDimension, imageValue, viewportJumpPercentage, threshold) {
        if (approx(imageValue, 0, threshold)) return viewportDimension - imageDimension
        var proposedPreviousPosition = (imageValue + viewportDimension * viewportJumpPercentage) | 0
        if (proposedPreviousPosition > 0) return 0
        return proposedPreviousPosition
    }
    #getHorizontalJump() {
        return 0.9
    }
    #getVerticalJump() {
        return 0.5
    }
    async goToNextView() {
        if (this.#isEndOfRow()) {
            if (this.#isEndOfColumn()) {
                this.nextPage()
            } else {
                this.#setLeft(this.#getNextPosition(
                    this.#getWidth(), 
                    this.#getViewportWidth(), 
                    this.#getLeft(), 
                    this.#getHorizontalJump(), 
                    this.#getRowThreshold())
                )
                this.#setTop(this.#getNextPosition(
                    this.#getHeight(), 
                    this.#getViewportHeight(), 
                    this.#getTop(), 
                    this.#getVerticalJump(), 
                    this.#getColumnThreshold())
                )
                this.#update()
            }
        } else {
            this.#setLeft(this.#getNextPosition(
                this.#getWidth(), 
                this.#getViewportWidth(), 
                this.#getLeft(), 
                this.#getHorizontalJump(), 
                this.#getRowThreshold())
            )
            this.#update()
        }
    }
    #goToFirstPosition() {
        this.#setLeft(0)
        this.#setTop(0)
    }
    #goToLastPosition() {
        let lastLeft = this.#getLastPosition(
            this.#getWidth(), 
            this.#getViewportWidth(), 
            this.#getLeft(), 
            this.#getHorizontalJump(), 
            this.#getRowThreshold()
        )
        let lastTop = this.#getLastPosition(
            this.#getHeight(), 
            this.#getViewportHeight(), 
            this.#getTop(), 
            this.#getVerticalJump(), 
            this.#getColumnThreshold()
        )
        this.#setLeft(lastLeft)
        this.#setTop(lastTop)
    }
    async goToPreviousView() {
        if (this.#isBeginningOfRow()) {
            if (this.#isBeginningOfColumn()) {
                this.previousPage()
            } else {
                this.#setLeft(this.#getPreviousPosition(
                    this.#getWidth(), 
                    this.#getViewportWidth(), 
                    this.#getLeft(), 
                    this.#getHorizontalJump(), 
                    this.#getRowThreshold())
                )
                this.#setTop(this.#getPreviousPosition(
                    this.#getHeight(), 
                    this.#getViewportHeight(), 
                    this.#getTop(), 
                    this.#getVerticalJump(), 
                    this.#getColumnThreshold())
                )
                this.#update()
            }
        } else {
            this.#setLeft(this.#getPreviousPosition(
                this.#getWidth(), 
                this.#getViewportWidth(), 
                this.#getLeft(), 
                this.#getHorizontalJump(), 
                this.#getRowThreshold())
            )
            this.#update()
        }
    }
    #resetPan() {
        this.#setPanPossible(true)
        if (this.#isEndOfRow() && this.#isEndOfColumn()) {
            this.swipeNextPossible = true
        } else {
            this.swipeNextPossible = false
        }
        if (this.#isBeginningOfRow() && this.#isBeginningOfColumn()) {
            this.swipePreviousPossible = true
        } else {
            this.swipePreviousPossible = false
        }
    }

    #getSwipeEnabled() {
        return true
    }

    /* returns true if pan should be disabled / when moving to a different page */
    #pan(x, y, totalDeltaX, totalDeltaY, pinching) {
        if (this.#getSwipeEnabled && (this.swipeNextPossible || this.swipePreviousPossible) && (!pinching)) {
            let horizontalThreshold = this.#getViewportWidth() * this.settings.swipeLength
            let swipeParameters = computeSwipeParameters(totalDeltaX, totalDeltaY)
            let verticalMoveValid = swipeParameters.angle < this.settings.swipeAngleThreshold
            if (this.swipeNextPossible && x > 0 ) this.swipeNextPossible = false
            if (this.swipePreviousPossible && x < 0 ) this.swipePreviousPossible = false
            if (verticalMoveValid && totalDeltaX < -horizontalThreshold && this.swipeNextPossible) {
                this.swipeNextPossible = false
                this.swipePreviousPossible = false
                this.goToNextView()
                return true
            } else if (verticalMoveValid && totalDeltaX > horizontalThreshold && this.swipePreviousPossible) {
                this.swipeNextPossible = false
                this.swipePreviousPossible = false
                this.goToPreviousView()
                return true
            } else {
                this.#addLeft(x)
                this.#addTop(y)
                this.#update()
                return false
            }
        } else if (this.#getPanPossible()) {
            this.#addLeft(x)
            this.#addTop(y)
            this.#update()
            return false
        } else {
            return false
        }
    }

    #getPanPossible() {
        return this.panPossible
    }

    #setPanPossible(value) {
        this.panPossible = value
    }

    #getFitComicToScreen() {
        if (this.fitComicToScreen == undefined) this.fitComicToScreen = true
        return this.fitComicToScreen
    }
    #setFitComicToScreen(value) {
        this.fitComicToScreen = value
    }
    #getZoomJumpKey() {
        return "zoom_jump_" + this.book.id
    }
    #getZoomJump() {
        if (this.zoomJump == undefined) {
            // try to get from storage
            let savedZoomJump = window.localStorage.getItem(this.#getZoomJumpKey())
            if (savedZoomJump != undefined && savedZoomJump != null) {
                this.zoomJump = JSON.parse(savedZoomJump)
            } else {
                this.zoomJump = 1
            }
        }
        return this.zoomJump
    }
    #setZoomJump(value) {
        this.zoomJump = value
        window.localStorage.setItem(this.#getZoomJumpKey(), JSON.stringify(value))
        this.#setFitComicToScreen(false)
    }
    #zoomJump(x, y) {
        if (this.#getFitComicToScreen()) {
            this.#setFitComicToScreen(false)
            this.#zoom(this.#getZoomJump(), x, y, true)
        } else {
            this.#setFitComicToScreen(true)
            this.#fitPageToScreen()
        }
    }
    reset() {
        this.setWidth(this.getOriginalWidth())
        this.setHeight(this.getOriginalHeight())
        this.setLeft(0)
        this.setTop(0)
        this.updateMinimumZoom()
    }

    #computeImageDominantColor() {
        const canvas = document.createElement('canvas')
        canvas.width = this.page.naturalWidth
        canvas.height = this.page.naturalHeight
        const context = canvas.getContext('2d')
        context.set
        context.drawImage(this.page, 0, 0, this.page.naturalWidth, this.page.naturalHeight);
        let cm = new ColorMap()
        for (let y = 0; y < this.page.naturalHeight; y++) {
            cm.add(context.getImageData(0, y, 1, 1))
            cm.add(context.getImageData(this.page.naturalWidth-1, y, 1, 1))
        }
        for (let x = 0; x < this.page.naturalWidth; x++) {
            cm.add(context.getImageData(x, 0, 1, 1))
            cm.add(context.getImageData(x, this.page.naturalHeight-1, 1, 1))
        }
        let dominantColor = cm.getMostExpressed()
        return dominantColor
    }

    async displayPageFor(position) {
        this.showLoading()
        let pageContent = await this.#getPageFor(position)
        this.setPosition(position)
        this.page.src = pageContent
        await imageLoadedPromise(this.page)
        this.highlightTocPosition(position)
        this.hideLoading()
        if (this.progressDisplay) {
            let size = await this.book.getSize()
            let message = "position " + this.getPosition() + " of " + size
            this.progressDisplay.innerHTML = message
        }
        if (this.settings.displayPageForCallback) {
            let callbackControls = await this.#buildCallbackControls()
            this.settings.displayPageForCallback(callbackControls)
        }
    }

    async #buildCallbackControls() {
        let position = this.getPosition()
        let isLastPage = (position + 1) >= (await this.book.getSize())
        return {
            "position": this.getPosition(),
            "isLastPage": isLastPage,
            "dominantColor": this.#computeImageDominantColor(),
            "setControlsColor": (color) => this.setControlsColor(color)
        }
    }

    async #getPageFor(position) {
        let page = await this.book.getContentsAt(position)
        return page
    }

    async nextPage() {
        let size = await this.book.getSize()
        if (this.getPosition() < size - 1) {
            this.#setPanPossible(false)
            this.displayPageFor(this.getPosition() + 1).then(() => {
                if (this.#getFitComicToScreen()) {
                    this.#fitPageToScreen()
                } else {
                    this.#goToFirstPosition()
                }
            })
        }
    }

    async previousPage() {
        if (this.getPosition() > 0) {
            this.displayPageFor(this.getPosition() - 1).then(() => {
                this.#setPanPossible(false)
                if (this.#getFitComicToScreen()) {
                    this.#fitPageToScreen()
                } else {
                    this.#goToLastPosition()
                }
            })
        }
    }

    #setWidth(width) {
        this.page.width = width
    }
    #getWidth() {
        return this.page.width
    }
    #setHeight(height) {
        this.page.height = height
    }
    #getHeight() {
        return this.page.height
    }
    #getOriginalWidth() {
        return this.page.naturalWidth
    }
    #getOriginalHeight() {
        return this.page.naturalHeight
    }
    #setLeft(left) {
        this.page.style.left = left + "px"
    }
    #getLeft() {
        return num(this.page.style.left, 0)
    }
    #addLeft(x) {
        this.#setLeft(this.#getLeft() + x)
    }
    #setTop(top) {
        this.page.style.top = top + "px"
    }
    #getTop() {
        return num(this.page.style.top, 0)
    }
    #addTop(y) {
        this.#setTop(this.#getTop() + y)
    }
    #setZoom(zoom) {
        this.zoomValue = zoom
    }
    #getZoom() {
        return this.zoomValue
    }
    #getViewportHeight() {
        return this.element.offsetHeight
    }
    #getViewportWidth() {
        return this.element.offsetWidth
    }
    #getMinimumZoom() {
        return Math.min(
            this.#getViewportHeight() / this.#getOriginalHeight(), 
            this.#getViewportWidth() / this.#getOriginalWidth()
        )
    }
    #getZoomForFitToScreen() {
        return Math.min(
            this.#getViewportHeight() / this.#getOriginalHeight(), 
            this.#getViewportWidth() / this.#getOriginalWidth()
        )
    }
    #fitPageToScreen() {
        this.#setZoom(this.#getZoomForFitToScreen())
        this.#update()
    }
    #getRowThreshold() {
        return this.#getWidth() * 0.02
    }
    #getColumnThreshold() {
        return this.#getHeight() * 0.05
    }
    #isEndOfRow() {
        return (this.#getWidth() <= this.#getViewportWidth()) 
            || approx(this.#getLeft() + this.#getWidth(), this.#getViewportWidth(), this.#getRowThreshold())
    }
    #isBeginningOfRow() {
        return (this.#getWidth() <= this.#getViewportWidth()) 
            || approx(this.#getLeft(), 0, this.#getRowThreshold())
    }
    #isEndOfColumn() {
        return (this.#getHeight() <= this.#getViewportHeight()) 
            || approx(this.#getTop() + this.#getHeight(), this.#getViewportHeight(), this.#getColumnThreshold())
    }
    #isBeginningOfColumn() {
        return (this.#getHeight() <= this.#getViewportHeight()) 
            || approx(this.#getTop(), 0, this.#getColumnThreshold())
    }
    #update() {
        let minimumZoom = this.#getMinimumZoom()
        if (this.#getZoom() < minimumZoom) {
            this.#setZoom(minimumZoom)
        }

        let newWidth = this.#getOriginalWidth() * this.#getZoom()
        let newHeight = this.#getOriginalHeight() * this.#getZoom()
        this.#setWidth(newWidth)
        this.#setHeight(newHeight)

        let minimumLeft = (newWidth < this.#getViewportWidth()) 
            ? (this.#getViewportWidth() / 2) - (newWidth / 2) 
            : Math.min(0, this.#getViewportWidth() - newWidth)
        let maximumLeft = (newWidth < this.#getViewportWidth()) 
            ? (this.#getViewportWidth() / 2) - (newWidth / 2) 
            : Math.max(0, this.#getViewportWidth() - newWidth)
        let minimumTop = (newHeight < this.#getViewportHeight()) 
            ? (this.#getViewportHeight() / 2) - (newHeight / 2) 
            : Math.min(0, this.#getViewportHeight() - newHeight)
        let maximumTop = (newHeight < this.#getViewportHeight()) 
            ? (this.#getViewportHeight() / 2) - (newHeight / 2) 
            : Math.max(0, this.#getViewportHeight() - newHeight)

        if (this.#getLeft() < minimumLeft) this.#setLeft(minimumLeft)
        if (this.#getLeft() > maximumLeft) this.#setLeft(maximumLeft)
        if (this.#getTop() < minimumTop) this.#setTop(minimumTop)
        if (this.#getTop() > maximumTop) this.#setTop(maximumTop)
    }
}

/*
ebook wrapper
- contains a zip wrapper
- get size
- get title
- get cover
- get table of contents
- get contents for position(s)
- get contents for resource path as text or bytes
*/

class EbookWrapper extends BookWrapper {
    constructor(id, archive) {
        super(id, archive)
    }

    async getNodes() {
        if (this.nodes == undefined) {
            let spine = await this.getSpine()
            let entrancePosition = 0
            let nodes = {}
            for (var i = 0; i < spine.length; i++) {
                let resourceNode = await this.#getResourceNode(spine[i], entrancePosition)
                nodes[spine[i]] = resourceNode
                entrancePosition = resourceNode.end + 1
            }
            this.nodes = nodes
        }
        return this.nodes
    }

    async getSize() {
        if (this.size == undefined) {
            let size = 0
            let nodes = await this.getNodes()
            for (var node in nodes) {
                size = size + nodes[node].getLength()
            }
            this.size = size
        }
        return this.size
    }

    async #getOpf() {
        let files = await this.archive.getFiles()
        let opfFile = files.find(f => f.toLowerCase().endsWith(".opf"))
        return {
            'name': opfFile,
            'contents': await this.archive.getTextFileContents(opfFile)
        }
    }

    async #getNcx() {
        let files = await this.archive.getFiles()
        let ncxFile = files.find(f => f.toLowerCase().endsWith(".ncx"))
        return {
            'name': ncxFile,
            'contents': await this.archive.getTextFileContents(ncxFile)
        }
    }

    async getCover() {
        if (this.cover == undefined) {
            try {
                let opf = await this.#getOpf()
                let opfFile = opf.name
                let opfContents = opf.contents
                let documentNode = await EbookNode.parseXmlToEbookNode(opfContents)
                if (! documentNode) throw "failed to parse opf xml"
                let metadataNode = documentNode.findChildrenWithTag("metadata", true).pop()
                if (! metadataNode) throw "failed to find metadata node"
                let metaNodes = metadataNode.findChildrenWithTag("meta", true)
                let coverMeta = metaNodes.find((node) => node.attributes && node.attributes["name"] == "cover")
                if (! coverMeta) throw "failed to find cover meta entry"
                let manifestNode = documentNode.findChildrenWithTag("manifest", true).pop()
                if (! manifestNode) throw "failed to find manifest node"
                let coverItem = manifestNode.findChildrenWithTag("item", true).find(item => item.attributes["id"] == coverMeta.attributes["content"])
                let href = coverItem.attributes["href"]
                let coverBase64 = await this.getImageBase64(opfFile, href)
                this.cover = coverBase64
            } catch (error) {
                console.log(error)
                this.cover = null
            }
        }
        return this.cover
    }

    getContextFolder(contextFile) {
        let elems = contextFile.split("/")
        if (elems.length > 1) {
            return elems.slice(0, -1).join("/")
        } else {
            return ""
        }
    }

    computeAbsolutePath(contextFolder, filename) {
        if (contextFolder != null && contextFolder.length > 0) {
            let contextFolderPathComponents = contextFolder.split("/")
            let filenamePathComponents = filename.split("/")
            let completePathComponents = contextFolderPathComponents.concat(filenamePathComponents)
            let resultPath = []
            for (let i = 0; i < completePathComponents.length; i++) {
                if (completePathComponents[i] == "..") {
                    resultPath.pop()
                } else {
                    resultPath.push(completePathComponents[i])
                }
            }
            return resultPath.join("/")
        } else {
            return filename
        }
    }

    async parseOpf() {
        let opf = await this.#getOpf()
        let opfXmlText = opf.contents
        let xmlDoc = await EbookNode.parseXmlToEbookNode(opfXmlText)

        // get spine
        let itemrefs = xmlDoc.findChildrenWithTag("itemref", true)
        let itemIds = itemrefs.map(itemref => itemref.attributes["idref"])
        let items = new Map(
            xmlDoc.findChildrenWithTag("item", true)
            .map(item => {
                let key = item.attributes["id"]
                let href = item.attributes["href"]
                let absolutePath = this.computeAbsolutePath(this.getContextFolder(opf.name), href)
                return [key, absolutePath]
            })
        )
        
        let spine = []
        for (let i = 0; i < itemIds.length; i++) {
            let id = itemIds[i]
            let path = items.get(id)
            if (path) {
                spine.push(path)
            }
        }

        this.spine = spine
        return spine
    }

    async parseNcx() {
        let ncx = await this.#getNcx()
        let ncxXmlText = ncx.contents
        let xmlNode = await EbookNode.parseXmlToEbookNode(ncxXmlText)

        let navMapNode = xmlNode.findChildrenWithTag("navMap", true).pop()

        let transformNavNodeFunction = async (node) => {
            if (node.name == "navPoint") {
                let name = node.findChildrenWithTag("navLabel").pop().findChildrenWithTag("text").pop().findChildrenWithTag(null).pop().getContent()
                let link = node.findChildrenWithTag("content").pop().attributes["src"]
                let position = await this.getPositionForLink(ncx.name, link)
                let result = {
                    "name": name,
                    "position": position
                }
                let resultChildren = []
                let nodeChildren = node.findChildrenWithTag("navPoint")
                for (let i = 0; i < nodeChildren.length; i++) {
                    let childResult = await transformNavNodeFunction(nodeChildren[i])
                    if (childResult != null) {
                        resultChildren.push(childResult)
                    }
                }
                if (resultChildren.length > 0) {
                    result.children = resultChildren
                }
                return result
            } else {
                return null
            }
        }

        let rootNavPoints = navMapNode.findChildrenWithTag("navPoint")
        let toc = []
        for (let i = 0; i < rootNavPoints.length; i++) {
            let rootTocEntry = await transformNavNodeFunction(rootNavPoints[i])
            if (rootTocEntry != null) {
                toc.push(rootTocEntry)
            }
        }

        this.toc = toc
        return toc
    }

    async getSpine() {
        if (this.spine == undefined) {
            await this.parseOpf()
        }
        return this.spine
    }

    async getToc() {
        if (this.toc == undefined) {
            await this.parseNcx()
        }
        return this.toc
    }

    async #getResourceNode(filename, entrancePosition) {
        let xmlText = await this.archive.getTextFileContents(filename)
        let bookNode = await EbookNode.parseHtmlToEbookNode(xmlText, entrancePosition, filename, this)
        return bookNode
    }

    async getImageBase64(contextFile, fileName) {
        let absolutePath = this.computeAbsolutePath(this.getContextFolder(contextFile), fileName)
        return "data:" + getFileMimeType(fileName) + ";base64," + (await this.archive.getBase64FileContents(absolutePath))
    }

    async getPositionForLink(contextFile, link) {
        if (link == undefined || link == null) return null

        let file = null
        let id = null
        if (link.startsWith("http") || link.startsWith("www")) {
            // an absolute link that we do not change
            return null
        } else if (link.startsWith('#')) {
            // we have a reliative link, with the file equal to the context file
            file = contextFile
            id = link.substring(1)
        } else if (link.indexOf('#') > 1) {
            // we have both file and id
            let linkSplit = link.split("#")
            if (linkSplit.length != 2) return null
            let contextFolder = this.getContextFolder(contextFile)
            let absoluteLink = this.computeAbsolutePath(contextFolder, linkSplit[0])
            file = absoluteLink
            id = linkSplit[1]
        } else {
            // just a link to a file
            let contextFolder = this.getContextFolder(contextFile)
            let absoluteLink = this.computeAbsolutePath(contextFolder, link)
            file = absoluteLink
        }
        
        let nodes = await this.getNodes()
        if (nodes) {
            let node = nodes[file]
            if (node) {
                if (id) {
                    let position = node.getIdPosition(id)
                    return position
                } else {
                    return node.start
                }
            }
        }

        return null
    }

    async getNodeAt(position) {
        let nodes = await this.getNodes()
        for (var index in nodes) {
            let node = nodes[index]
            if (node.start <= position && position <= node.end) {
                return { "key": index, "node": node}
            }
        }
        return null
    }

    async getContentsAt(start, end) {
        let size = await this.getSize()
        if (start < 0 || end < 0 || start > end || start >= size || end >= size) return null;

        let nodeResult = await this.getNodeAt(start)
        if (nodeResult) {
            let node = nodeResult.node
            if (node.start <= start && start <= node.end) {
                let actualEnd = (end > node.end) ? node.end : end
                let resultNode = node.copy(start, actualEnd)
                await this.#fixImages(resultNode, nodeResult.key)
                return resultNode.getContent()
            }
        }
        return null
    }

    async #fixImages(node, contextFilename) {
        const srcRegex = /src=\"([^\"]+)\"/

        let images = node.findChildrenWithTag("img", true)
        for (let i = 0; i < images.length; i++) {
            let image = images[i]
            let imageContent = image.getContent()
            let regexResult = srcRegex.exec(imageContent)
            if (regexResult) {
                let matchStart = regexResult.index
                let matchEnd = regexResult.index + regexResult[0].length
                let imgSrc = regexResult[1]
                if (imgSrc != null && imgSrc.length > 0) {
                    let newSrc = await this.getImageBase64(contextFilename, imgSrc)
                    let newContent = imageContent.substring(0, matchStart) + 'src="' + newSrc + '"' + imageContent.substring(matchEnd)
                    image.setContent(newContent)
                }
            }
        }

        const svgHrefRegex = /xlink:href=\"([^\"]+)\"/g
        let svgs = node.findChildrenWithTag("svg", true)
        for (let i = 0; i < svgs.length; i++) {
            let svg = svgs[i]
            let svgContent = svg.getContent()

            let regexResults = [...svgContent.matchAll(svgHrefRegex)]
            if (regexResults) {
                let newContent = ""
                let oldContentPosition = 0
                for (let j = 0; j < regexResults.length; j++) {
                    let regexResult = regexResults[j]
                    let matchStart = regexResult.index
                    let matchEnd = regexResult.index + regexResult[0].length
                    let xlinkHref = regexResult[1]
                    if (xlinkHref != null && xlinkHref.length > 0) {
                        let newXlinkHref = await this.getImageBase64(contextFilename, xlinkHref)
                        newContent += svgContent.substring(oldContentPosition, matchStart) + 'xlink:href="' + newXlinkHref + '"'
                        oldContentPosition = matchEnd
                    } else {
                        newContent += svgContent.substring(oldContentPosition, matchEnd)
                        oldContentPosition = matchEnd
                    }
                }
                newContent += svgContent.substring(oldContentPosition)
                svg.setContent(newContent)
            }
        }
    }

    async findSpaceAfter(position, start = null) {
        let size = await this.getSize()
        let nodes = await this.getNodes()
        for (var index in nodes) {
            let node = nodes[index]
            let nodeSelectPosition = position
            if (start != null) {
                nodeSelectPosition = start
            }
            if (node.start <= nodeSelectPosition && nodeSelectPosition <= node.end) {
                return node.findSpaceAfter(position)
            }
        }
        return null
    }
}

class EbookDisplay extends Display {
    EBOOK_PAGE_STYLE_ID = "ebookPageStyle"

    constructor(element, settings = {}) {
        super(element, settings)
    }

    setBook(book) {
        super.setBook(book)
        this.displayPageFor(this.getPosition()).then(() => {
            this.triggerComputationForAllPages()
        })
    }

    configure() {
        super.configure()
    }

    async #delayedRefresh(timestamp) {
        if (timestamp == this.refreshTimestamp) {
            if (this.currentPage) {
                this.displayPageFor(this.currentPage.start).then(value => {
                    this.triggerComputationForAllPages()
                })
            }
        } else {
            console.log("not refreshing, newer refresh exists")
        }
    }

    async refresh() {
        let ts = Date.now()
        this.refreshTimestamp = ts
        this.#timeout(100).then(() => this.#delayedRefresh(ts))
    }

    triggerComputationForAllPages() {
        this.book.getSize()
            .then(size => {
                this.#computePageFor(size)
                .then((page) => {
                    if (page != null) console.log("computed final page " + page.start + " - " + page.end)
                })
            })
    }

    setControlsColor(color) {
        if (this.settings.displayControls) {
            this.previous.style.stroke = color
            this.next.style.stroke = color
            if (this.toolsLeft) this.toolsLeft.style.stroke = color
            if (this.toolsRight) this.toolsRight.style.stroke = color
        }
        this.loading.style.stroke = color
    }

    #getViewportWidth() {
        return this.page.offsetWidth
    }

    update() {
        if (this.currentPage) {
            this.displayPageFor(this.currentPage.start)
        }
    }

    buildUi() {
        super.buildUi()

        if (!document.getElementById(this.EBOOK_PAGE_STYLE_ID)) {
            var ebookPageStyle = document.createElement('style')
            ebookPageStyle.id = this.EBOOK_PAGE_STYLE_ID
            ebookPageStyle.innerHTML = "\
                .ebookPage img, .ebookPage image {\
                    max-width: 100%;\
                    max-height: 100%;\
                }\
            "
            document.body.appendChild(ebookPageStyle)
        }

        this.page = createDivElement(this.element, this.settings.leftMarginPercent + "%", this.settings.topMarginPercent + "%", (100 - 2 * this.settings.leftMarginPercent) + "%", (100 - 2 * this.settings.topMarginPercent) + "%", "#ffffff00")
        this.page.classList.add("ebookPage")
        
        this.shadowPage = createDivElement(this.element, this.settings.leftMarginPercent + "%", this.settings.topMarginPercent + "%", (100 - 2 * this.settings.leftMarginPercent) + "%", (100 - 2 * this.settings.topMarginPercent) + "%", "#ffffff")
        this.shadowPage.classList.add("ebookPage")
        this.shadowPage.style.visibility = "hidden"
        this.shadowPage.style.overflow = "auto"
        this.shadowElement = this.shadowPage

        window.onresize = () => {
            executeWithDelay(() => { this.update() }, 500)
        }

        let panX = 0
        let panY = 0
        let swipeStart = false
        /*let SETTING_SWIPE_LENGTH = .1
        let SETTING_SWIPE_ANGLE_THRESHOLD = 30*/
        let touchGestureStartPan = (event) => {
            if (event.touches.length == 1 && window.getSelection().type != "Range") {
                panX = event.touches[0].pageX
                panY = event.touches[0].pageY
                swipeStart = true
            }
        }
        let touchGesturePan = (event) => {
            if (event.touches.length == 1 && window.getSelection().type != "Range" && swipeStart) {
                let newX = event.touches[0].pageX
                let newY = event.touches[0].pageY
                let deltaX = newX - panX
                let deltaY = newY - panY
                let swipeParameters = computeSwipeParameters(deltaX, deltaY)
        
                let horizontalThreshold = this.#getViewportWidth() * this.settings.swipeLength
                let verticalMoveValid = swipeParameters.angle < this.settings.swipeAngleThreshold
                if (verticalMoveValid && deltaX < -horizontalThreshold) {
                    swipeStart = false
                    this.goToNextView()
                } else if (verticalMoveValid && deltaX > horizontalThreshold) {
                    swipeStart = false
                    this.goToPreviousView()
                }
            }
        }
        this.page.addEventListener('touchstart', touchGestureStartPan, false)
        this.page.addEventListener('touchmove', touchGesturePan, false)
    }

    async fixLinks(element, contextFilename) {
        let links = element.getElementsByTagName("a")
        for (let i = 0; i < links.length; i++) {
            let linkElement = links[i]
            let linkHref = linkElement.getAttribute("href")
            if (linkHref != null && linkHref.length > 0) {
                let position = await this.book.getPositionForLink(contextFilename, linkHref)
                if (position != null) {
                    linkElement.onclick = () => this.displayPageFor(position)
                    linkElement.removeAttribute("href")
                }
            }
        }
    }

    async displayPageFor(position) {
        this.showLoading() // todo: show loading delayed, so it's not triggerred when no computation time
        let page = await this.#getPageFor(position)
        if (page != null) {
            this.currentPage = page
            this.setPosition(this.currentPage.start)
            let node = await this.book.getNodeAt(page.start)
            if (node != null) {
                let contents = await this.book.getContentsAt(page.start, page.end)
                if (contents == null) {
                    this.page.innerHTML = ""
                } else {
                    this.page.innerHTML = contents
                }
                // links need to be fixed on the actual final element
                // because an onclick event is configured on them
                await this.fixLinks(this.page, node.key)
            } else {
                this.page.innerHTML = ""
            }
            this.highlightTocPosition(position)
            this.hideLoading()
            if (this.progressDisplay) {
                let pagesLeft = await this.#getPagesLeftInChapter()
                let size = await this.book.getSize()
                let message = ""
                if (pagesLeft != null) {
                    message += " " + (pagesLeft) + " pages remaining in chapter, "
                }
                message += "position " + this.getPosition() + " of " + size
                this.progressDisplay.innerHTML = message
            }
            await this.#timeout(10)
            if (this.settings.displayPageForCallback) {
                let callbackControls = await this.#buildCallbackControls()
                this.settings.displayPageForCallback(callbackControls)
            }
        } else {
            console.log("page is NULL!!")
        }
        
        return page
    }

    async #buildCallbackControls() {
        let position = this.getPosition()
        let size = await this.book.getSize()
        let isLastPage = this.currentPage.end >= size
        return {
            "position": this.getPosition(),
            "isLastPage": isLastPage
        }
    }

    async goToNextView() {
        let size = await this.book.getSize()
        if (this.currentPage && this.currentPage.end < size) {
            this.displayPageFor(this.currentPage.end + 1)
        }
    }

    async goToPreviousView() {
        if (this.currentPage && this.currentPage.start > 0) {
            this.displayPageFor(this.currentPage.start - 1)
        }
    }

    #timeout(ms) {
        return new Promise((resolve, reject) => {
            window.setTimeout(function() {
                resolve()
            }, ms)
        })
    }

    #getPageSizeKey() {
        let url = this.book.id
        let el = this.page
        let fontSize = window.getComputedStyle(el, null).getPropertyValue('font-size')
        return url + "_" + el.offsetHeight + "x" + el.offsetWidth + "x" + fontSize
    }

    static async loadPageCache(pageCacheKey) {
        try {
            let simpleValue = window.localStorage.getItem(pageCacheKey)
            return PageCache.deserialize(pageCacheKey, simpleValue)
        } catch (error) {
            console.log(error)
            return new PageCache(pageCacheKey)
        }
    }

    static async savePageCache(pageCache) {
        try {
            window.localStorage.setItem(pageCache.key, pageCache.serialize())
        } catch (error) {
            console.log(error)
        }
    }

    async #getPagesCache() {
        if (this.pages == undefined) this.pages = {}
        let pageCacheKey = this.#getPageSizeKey()
        if (this.pages[pageCacheKey] == undefined) {
            this.pages[pageCacheKey] = await EbookDisplay.loadPageCache(pageCacheKey)
        }
        let cache = this.pages[pageCacheKey]
        return cache
    }

    async #getPagesLeftInChapter() {
        let currentPosition = this.getPosition()
        let currentPage = await this.#getPageFor(currentPosition, true)
        let node = await this.book.getNodeAt(currentPosition)
        if (node != null) {
            let nextChapterPosition = node.node.findChapterEnd(currentPosition)
            let chapterEndPage = await this.#getPageFor(nextChapterPosition, true)
            return chapterEndPage.index - currentPage.index
        } else {
            return null
        }
    }

    async #getPageFor(position, withIndex = true) {
        let pageCache = await this.#getPagesCache()
        let page = pageCache.getPageFor(position, withIndex)
        if (page != null) {
            return page
        } else {
            //console.log("page not in cache, requesting computation")
            this.#computePageFor(position)
            do {
                await this.#timeout(1000)
                //console.log("trying to get page again")
                pageCache = await this.#getPagesCache()
                page = pageCache.getPageFor(position, withIndex)
            } while (page == null)
            return page
        }
        
        /*console.log("page: " + page)
        if (page == null) {
            // trigger page computation
            let computedPage = await this.#computePageFor(position)

            if (withIndex) {
                let pageFromCache = pageCache.getPageFor(position, withIndex)
                return pageFromCache
            } else {
                return computedPage
            }
        } else {
            return page
        }*/
        //return page
    }
    
    #overflowTriggerred() {
        let el = this.shadowElement
        return new Promise((resolve, reject) => {
            var images = el.getElementsByTagName('img')
            if (images.length > 0) {
                waitForImagesToLoad(images).then(() => {
                    if (el.scrollHeight > el.offsetHeight || el.scrollWidth > el.offsetWidth) resolve(true)
                    else resolve(false)
                })
            } else {
                if (el.scrollHeight > el.offsetHeight || el.scrollWidth > el.offsetWidth) resolve(true)
                else resolve(false)
            }
        })
    }

    async #computeMaximalPage(start) {
        let previousEnd = null
        let end = await this.book.findSpaceAfter(start)
        this.shadowElement.innerHTML = ""
        //let steps = 1
        while ((await this.#overflowTriggerred()) == false && previousEnd != end && end != null) {
            previousEnd = end
            end = await this.book.findSpaceAfter(previousEnd)
            //steps += 1
            this.shadowElement.innerHTML = await this.book.getContentsAt(start, end)
        }
        //console.log("maximal page computed in " + steps + " steps")
        if (previousEnd != null) {
            return new Page(start, previousEnd)
        } else {
            return new Page(start, start)
        }
    }

    #updateAveragePageSize(pageSize) {
        if (this.averagePageSize) {
            this.averagePageSize = Math.floor((this.averagePageSize + pageSize) / 2)
        } else {
            this.averagePageSize = pageSize
        }
    }

    #getAveragePageSize() {
        if (this.averagePageSize) {
            return this.averagePageSize
        } else {
            return 1000
        }
    }

    async #computeMaximalPage2(start) {
        let jumpStep = Math.floor(this.#getAveragePageSize() * .9)
        let minimumJumpStep = 10
        let end = start
        this.shadowElement.innerHTML = ""
        //let steps = 1
        let resolved = false

        do {
            //steps += 1
            let tryEnd = end + jumpStep
            let newEnd = await this.book.findSpaceAfter(tryEnd, start)
            if (newEnd != null) {
                let contents = await this.book.getContentsAt(start, newEnd)
                if (contents != null) {
                    //console.log(contents)
                    this.shadowElement.innerHTML = contents
                    let overflow = await this.#overflowTriggerred()
                    //console.log("st te ne ovf " + start + " " + tryEnd + " " + newEnd + ' ' + overflow)
                    if (overflow == false) {
                        if (newEnd == end) {
                            // not making progress, we are probably at the end
                            resolved = true
                        } else {
                            //we can keep looking
                            end = newEnd
                        }
                    } else {
                        if (jumpStep > 0) {
                            // readjust our computation
                            jumpStep = Math.floor(jumpStep / 4)
                            if (jumpStep < minimumJumpStep) jumpStep = 0
                        } else {
                            // we have found the maximal page at the previous step
                            resolved = true
                        }
                    }
                } else {
                    // null content is an issue and we should stop
                    resolved = true
                }
            } else {
                resolved = true
            }
        } while (resolved == false)

        //console.log("computed maximal page in " + steps + ' steps')
        this.#updateAveragePageSize(end - start)
        return new Page(start, end)
    }

    async #computePageFor(position) {
        if (this.computationInProgress == undefined || this.computationInProgress == false) {
            //let startTimestamp = Date.now()
            this.computationInProgress = true
            let originalPageCache = await this.#getPagesCache()
            let currentPageCache = originalPageCache
            let start = originalPageCache.getEnd()
            if (start > 0) start = start + 1
            let page = await this.#computeMaximalPage2(start)
            originalPageCache.addPage(page)
            let lastSavedTimestamp = Date.now()
            while (! page.contains(position) && originalPageCache == currentPageCache && this.stopped != true) {
                let newStart = page.end + 1
                page = await this.#computeMaximalPage2(newStart)
                originalPageCache.addPage(page)
                if (Date.now() - lastSavedTimestamp > 30000) {
                    await EbookDisplay.savePageCache(originalPageCache)
                    lastSavedTimestamp = Date.now()
                }
                currentPageCache = await this.#getPagesCache()
                await this.#timeout(1)
            }
            //console.log("finished computing page for " + position + " in " + (Date.now() - startTimestamp) + " (stopped " + this.stopped + ")")
            await EbookDisplay.savePageCache(originalPageCache)
            if (originalPageCache != currentPageCache) {
                this.computationInProgress = false
                return null
            } else {
                this.computationInProgress = false
                return page
            }
        } else {
            console.log("not starting computation, already in progress")
            return null
        }
    }

}

class Page {
    constructor(start, end) {
        this.start = start
        this.end = end
        this.index = null
    }

    contains(position) {
        return this.start <= position && position <= this.end
    }
}

class PageCache {
    constructor(key) {
        this.key = key
    }

    static deserialize(key, simpleValue) {
        let pageCache = new PageCache(key)
        if (simpleValue) {
            simpleValue = JSON.parse(simpleValue)
            let actualValue = simpleValue.map(e => new Page(e[0], e[1]))
            pageCache.value = actualValue
        } else {
            pageCache.value = []
        }
        return pageCache
    }

    serialize() {
        if (this.value) {
            let simpleValue = this.value.map(e => [e.start, e.end])
            return JSON.stringify(simpleValue)
        } else {
            return []
        }
    }

    addPage(page) {
        // todo: verify and remove conflicts?
        if (this.value == undefined) this.value = []
        this.value.push(page)
    }

    getPageFor(position, withIndex = false) {
        if (this.value) {
            for (var i = 0; i < this.value.length; i++) {
                if (this.value[i].contains(position)) {
                    if (withIndex) this.value[i].index = i
                    return this.value[i]
                }
            }
        }
        return null
    }

    getEnd() {
        let end = 0
        if (this.value) {
            for (var i = 0; i < this.value.length; i++) {
                if (this.value[i].end > end) {
                    end = this.value[i].end
                }
            }
        }
        return end
    }
}

class ChronicReader {
    static getArchiveType(extension) {
        if (extension == "epub" || extension == "cbz") return "zip"
        else if (extension == "cbr") return "rar"
        else return ""
    }
    static async initDisplay(url, element, extension = null, settings = {}) {
        if (extension == null) {
            extension = getFileExtension(url)
        }
        console.log("url " + url + " extension " + extension)
        let archiveType = ChronicReader.getArchiveType(extension)
    
        let display = Display.factory(element, settings, extension)
        
        //let id = this.url.substring("book/".length)
        let response = await fetch(url)
        let content = await response.blob()
    
        let archiveWrapper = ArchiveWrapper.factory(archiveType, content)
        //let archiveWrapper = new RemoteArchive(this.url, "archive", id)
        let bookWrapper = BookWrapper.factory(url, archiveWrapper, extension)
        if (bookWrapper) {
            display.setBook(bookWrapper)
        }

        return display
    }
}