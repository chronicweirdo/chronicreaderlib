class EbookNode {
    static VOID_ELEMENTS = ["area","base","br","col","hr","img","input","link","meta","param","keygen","source","image","svg:image","?dp", "?pagebreak"]
    static LEAF_ELEMENTS = ["img", "tr", "image"]

    constructor(name, content, parent = null, children = [], start = null, end = null, id = null) {
        this.name = name
        this.content = content
        this.parent = parent
        this.children = children
        this.start = start
        this.end = end
        this.#parseId()
    }

    static #isVoidElement(tagName) {
        return EbookNode.VOID_ELEMENTS.includes(tagName.toLowerCase())
    }
      
    static #shouldBeLeafElement(tagName) {
        return EbookNode.LEAF_ELEMENTS.includes(tagName.toLowerCase())
    }

    static #isTag(str) {
        return /^<\/?[^>]+>$/.exec(str) != null
    }
      
    static #isEndTag(str) {
        return /^<\/[^>]+>$/.exec(str) != null
    }
        
    static #isBothTag(str) {
        return /^<[^>\/]+\/>$/.exec(str) != null
    }
      
    static #getTagName(str) {
        var tagNamePattern = /<\/?([^>\s]+)/
        var match = tagNamePattern.exec(str)
        if (match != null) {
          return match[1]
        }
        return null
    }

    static parseHtmlToEbookNode(html, entrancePosition, filename, ebook) {
        var body = EbookNode.#getHtmlBody(html)
        if (body != null) {
          return EbookNode.#parseBody(body, entrancePosition, filename, ebook)
        }
        return null
    }

    static #getHtmlBody(html) {
        var bodyStartPattern = /<body[^>]*>/
        var bodyStartMatch = bodyStartPattern.exec(html)
      
        var bodyEndPattern = /<\/body\s*>/
        var bodyEndMatch = bodyEndPattern.exec(html)
      
        if (bodyStartMatch != null && bodyEndMatch != null) {
          var from = bodyStartMatch.index + bodyStartMatch[0].length
          var to = bodyEndMatch.index
          return html.substring(from, to)
        } else {
          return null
        }
    }

    #parseId() {
        let idMatch = this.content.match(/id="([^"]+)"/)

        if (idMatch && idMatch[1] && idMatch[1].length > 0) {
            this.id = idMatch[1]
        }
    }

    static async #parseBody(body, entrancePosition, filename, ebook) {
        var bodyNode = new EbookNode("body", "")
        var current = bodyNode
      
        var content = ""
      
        for (var i = 0; i < body.length; i++) {
            var c = body.charAt(i)
      
            if (c == '<') {
                // starting a new tag
                // save what we have in content
                if (EbookNode.#isTag(content)) {
                    throw "this should not happen"
                } else {
                    // can only be a text node or nothing
                    if (content.length > 0) {
                        current.#addChild(new EbookNode("text", content))
                        content = ""
                    }
                }
            }
      
            // accumulate content
            content += c
      
            if (c == '>') {
                // ending a tag
                if (EbookNode.#isTag(content)) {
                    var name = EbookNode.#getTagName(content)
                    // can only be a tag
                    if (EbookNode.#isEndTag(content)) {
                        // we check that this tag closes the current node correctly
                        if (EbookNode.#isVoidElement(name)) {
                            // the last child should have the correct name
                            var lastChild = current.children[current.children.length - 1]
                            if (name != lastChild.name) {
                                throw "incompatible end " + name + " for void tag " + lastChild.name
                            } else {
                                lastChild.content += content
                            }
                        } else {
                            // the current node should have the correct name, and it is getting closed
                            if (name != current.name) {
                                throw "incompatible end tag " + name + " for " + current.name
                            }
                            // move current node up
                            current = current.parent
                        }
                    } else if (EbookNode.#isBothTag(content) || EbookNode.#isVoidElement(name)) {
                        // just add this tag without content
                        current.#addChild(new EbookNode(name, content))
                    } else {
                        // a start tag
                        var newNode = new EbookNode(name, content)
                        current.#addChild(newNode)
                        current = newNode
                    }
                    // reset content
                    content = ""
                } else {
                    throw "wild > encountered"
                }
            }
        }

        // add the last text node, if there is still such a thing remaining
        if (content.length > 0) {
            if (EbookNode.#isTag(content)) {
                throw "this should not happen"
            } else {
                // can only be a text node or nothing
                if (content.length > 0) {
                    current.#addChild(new EbookNode("text", content))
                }
            }
        }

        bodyNode.#collapseLeaves()
        bodyNode.#updatePositions(entrancePosition)
        await bodyNode.#updateImages(filename, ebook)
        return bodyNode
    }

    static #isImage(tagName) {
        return tagName.toLowerCase() == "img"
    }
    // go through structure and replace src of images with base64 from archive
    async #updateImages(filename, ebook) {
        if (EbookNode.#isImage(this.name)) {
            let parser = new DOMParser()
            console.log(this.getContent())
            let imageDocument = parser.parseFromString(this.getContent(), "text/xml")
            let imageElement = imageDocument.getElementsByTagName(this.name)[0]
            console.log(imageElement)
            let imagePath = imageElement.getAttribute("src")
            let base64 = await ebook.getImageBase64(filename, imagePath)
            imageElement.setAttribute("src", base64)
            this.content = imageElement.outerHTML
            //console.log(this.content)
        } else if (this.children.length > 0) {
            for (var i = 0; i < this.children.length; i++) {
                var child = this.children[i]
                child.#updateImages(filename, ebook)
            }
        }
    }

    static #isLink(tagName) {
        return tagName.toLowerCase() == "a"
    }
    // go through structure and replace href of links with jump to position function calls
    // done after the whole book was scanned
    async updateLinks(filename, ebook, functionName="jumpTo") {
        if (EbookNode.#isLink(this.name)) {
            let parser = new DOMParser()
            
            let linkDocument = parser.parseFromString(this.getContent(), "text/html")
            let linkElement = linkDocument.getElementsByTagName(this.name)[0]
            let linkHref = linkElement.getAttribute("href")
            if (linkHref != null && linkHref.length > 0) {
                let position = await ebook.getPositionForLink(filename, linkHref)
                //console.log(this.getContent() + ": " + position)
                if (position != null) {
                    linkElement.setAttribute("onclick", functionName + "(" + position + ")")
                    linkElement.removeAttribute("href")
                    this.content = linkElement.outerHTML
                    //console.log(this.getContent())
                }
            }
        } else if (this.children.length > 0) {
            for (var i = 0; i < this.children.length; i++) {
                var child = this.children[i]
                child.updateLinks(filename, ebook)
            }
        }
    }

    // find position of the id, if it exists
    getIdPosition(id) {
        if (this.id && this.id != null && this.id == id) {
            return this.start
        }
        if (this.children.length > 0) {
            for (var i = 0; i < this.children.length; i++) {
                let position = this.children[i].getIdPosition(id)
                if (position != null) {
                    return position
                }
            }
        }
        return null
    }

    #addChild(node) {
        this.children.push(node)
        node.parent = this
    }
      
    #printAtLevel(level, text) {
        var message = ""
        for (var i = 0; i <= level; i++) message += "\t"
        message += text
        console.log(message)
    }

    prettyPrint(level = 0) {
        this.#printAtLevel(level, this.name + "[" + this.start + "," + this.end + "]: " + this.content)
        for (var i = 0; i < this.children.length; i++) {
            this.children[i].prettyPrint(level+1)
        }
    }
      
    getLength() {
        return this.end - this.start + 1
    }

    #updatePositions(entrancePosition = 0) {
        var position = entrancePosition
        this.start = position
        if (this.name == "text") {
            this.end = this.start + this.content.length - 1
        } else if (EbookNode.#shouldBeLeafElement(this.name)) {
            // occupies a single position
            this.end = this.start
        } else if (this.children.length == 0) {
            // an element without children, maybe used for spacing, should occupy a single position
            this.end = this.start
        } else {
            // compute for children and update
            for (var i = 0; i < this.children.length; i++) {
                var child = this.children[i]
                child.#updatePositions(position)
                position = child.end + 1
            }
            this.end = this.children[this.children.length - 1].end
        }
    }

    #collapseLeaves() {
        if (EbookNode.#shouldBeLeafElement(this.name) && this.children.length > 0) {
            // extract content from children
            this.content = this.getContent()
            this.children = []
        } else {
            for (var i = 0; i < this.children.length; i++) {
                this.children[i].#collapseLeaves()
            }
        }
    }

    getContent() {
        if (this.name == "text") {
            return this.content
        } else if (this.name == "body") {
            var result = ""
            for (var i = 0; i < this.children.length; i++) {
                result += this.children[i].getContent()
            }
            return result
        } else if (EbookNode.#shouldBeLeafElement(this.name) && this.children.length == 0) {
            return this.content
        } else {
            var result = this.content
            for (var i = 0; i < this.children.length; i++) {
                result += this.children[i].getContent()
            }
            result += "</" + this.name + ">"
            return result
        }
    }

    #nextNode() {
        // is this a leaf?
        var current = this
        if (current.children.length == 0) {
            // go up the parent line until we find next sibling
            var parent = current.parent
            while (parent != null && parent.children.indexOf(current) == parent.children.length - 1) {
                current = parent
                parent = current.parent
            }
            if (parent != null) {
                // we have the next sibling node
                current = parent.children[parent.children.indexOf(current) + 1]
                return current
            } else {
                // we have reached root, this was the last leaf, there is no other
                return null
            }
        } else {
            current = current.children[0]
            return current
        }
    }
    
    #nextNodeOfName(name) {
        let current = this.#nextNode()
        while (current != null) {
            if (current.name == name) return current
            current = current.#nextNode()
        }
        return null
    }

    #nextLeaf() {
        // is this a leaf?
        var current = this
        if (current.children.length == 0) {
            // go up the parent line until we find next sibling
            var parent = current.parent
            while (parent != null && parent.children.indexOf(current) == parent.children.length - 1) {
                current = parent
                parent = current.parent
            }
            if (parent != null) {
                // we have the next sibling in current, must find first leaf
                current = parent.children[parent.children.indexOf(current) + 1]
            } else {
                // we have reached root, this was the last leaf, there is no other
                return null
            }
        }
        // find first child of the current node
        while (current.children.length > 0) {
            current = current.children[0]
        }
        return current
    }

    #getRoot() {
        var current = this
        while (current.parent != null) current = current.parent
        return current
    }
      
    getDocumentStart() {
        return this.#getRoot().start
    }
      
    getDocumentEnd() {
        return this.#getRoot().end
    }

    #previousLeaf() {
        var current = this
        var parent = current.parent
        while (parent != null && parent.children.indexOf(current) == 0) {
            // keep going up
            current = parent
            parent = current.parent
        }
        if (parent != null) {
            current = parent.children[parent.children.indexOf(current) - 1]
            // go down on the last child track
            while (current.children.length > 0) {
                current = current.children[current.children.length - 1]
            }
            return current
        } else {
            return null
        }
    }

    #leafAtPosition(position) {
        if (position < this.start || this.end < position) return null
        else {
            var currentNode = this
            while (currentNode != null && currentNode.children.length > 0) {
                var i = 0;
                while (i < currentNode.children.length 
                    && (currentNode.children[i].start > position || currentNode.children[i].end < position)) {
                    i = i + 1;
                }
            if (i < currentNode.children.length) {
                currentNode = currentNode.children[i]
            } else {
                currentNode = null
            }
        }
            return currentNode
        }
    }

    findSpaceAfter(position) {
        var spacePattern = /\s/
        // first get leaf at position
        var leaf = this.#leafAtPosition(position)
        // for a text node, next space may be in the text node, next space character after position
        // if other kind of node, next space is the start of next leaf
        if (leaf != null && leaf.end == position) {
            // we need to look in the next node
            leaf = leaf.#nextLeaf()
        }
        if (leaf != null && leaf.name == "text") {
            var searchStartPosition = (position - leaf.start + 1 > 0) ? position - leaf.start + 1 : 0
            var m = spacePattern.exec(leaf.content.substring(searchStartPosition))
            if (m != null) {
                return m.index + position + 1
            }
        }
        if (leaf != null) return leaf.end
        else return this.getDocumentEnd()
    }
      
    findSpaceBefore(position) {
        var spacePattern = /\s[^\s]*$/
        var leaf = this.#leafAtPosition(position)
        if (leaf != null && leaf.name == "text") {
            var searchText = leaf.content.substring(0, position - leaf.start)
            var m = spacePattern.exec(searchText)
            if (m != null) {
                return m.index + leaf.start
            }
        }
        if (leaf != null) {
            leaf = leaf.#previousLeaf()
        }
        if (leaf != null) return leaf.end
        else return this.getDocumentStart()
    }

    copy(from, to) {
        if (this.name == "text") {
            if (from <= this.start && this.end <= to) {
                // this node is copied whole
                return new EbookNode("text", this.content, null, [], this.start, this.end)
            } else if (from <= this.start && this.start <= to && to<= this.end) {
                // copy ends at this node
                return new EbookNode(this.name, this.content.substring(0, to - this.start + 1), null, [], this.start, to)
            } else if (this.start <= from && from <= this.end && this.end <= to) {
                // copy starts at this node
                return new EbookNode(this.name, this.content.substring(from - this.start), null, [], from, this.end)
            } else if (this.start <= from && to < this.end) {
                // we only copy part of this node
                return new EbookNode(this.name, this.content.substring(from - this.start, to - this.start + 1), null, [], from, to)
            } else {
                return null
            }
        } else if (EbookNode.#shouldBeLeafElement(this.name)) {
            if (from <= this.start && this.end <= to) {
                // include element in selection
                return new EbookNode(this.name, this.content, null, [], this.start, this.end)
            } else {
                return null
            }
        } else {
            if (this.end < from || this.start > to) {
                // this node is outside the range and should not be copied
                return null
            } else {
                var newNode = new EbookNode(this.name, this.content)
                var newChildren = []
                for (var i = 0; i < this.children.length; i++) {
                    var copiedChild = this.children[i].copy(from, to)
                    if (copiedChild != null) {
                        copiedChild.parent = newNode
                        newChildren.push(copiedChild)
                    }
                }
                newNode.children = newChildren
                if (newNode.children.length == 0) {
                    newNode.start = this.start
                    newNode.end = this.end
                } else {
                    newNode.start = newNode.children[0].start
                    newNode.end = newNode.children[newNode.children.length - 1].end
                }
                return newNode
            }
        }
    }

    // todo: remove this?
    static convert(object) {
        var node = new EbookNode(object.name, object.content)
        node.start = object.start
        node.end = object.end
        for (var i = 0; i < object.children.length; i++) {
            var childNode = EbookNode.convert(object.children[i])
            childNode.parent = node
            node.children.push(childNode)
        }
        return node
    }

    getResources() {
        if (this.name === 'img') {
            var rg = /src="([^"]+)"/g
            return [...this.content.matchAll(rg)].map(m => m[1])
        } else if (this.name === 'image') {
            var rg = /xlink:href="([^"]+)"/g
            return [...this.content.matchAll(rg)].map(m => m[1])
        } else if (this.name === 'a') {
            var rgHref = /href="([^"]+)"/g
            return [...this.content.matchAll(rgHref)].map(m => m[1])
        } else if (this.name === "tr") {
            var rgSrc = /src="([^"]+)"/g
            var rgHref = /href="([^"]+)"/g
            return [...this.content.matchAll(rgSrc)].map(m => m[1]).concat(
                [...this.content.matchAll(rgHref)].map(m => m[1])
            )
        } else if (this.children.length > 0) {
            return this.children.flatMap(c => c.getResources())
        } else {
            return []
        }
    }


}