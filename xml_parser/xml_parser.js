const { readFile } = require('fs/promises')

class XmlNode {
    static VOID_ELEMENTS = ["area","base","br","col","hr","img","input","link","meta","param","keygen","source","image","svg:image","?dp", "?pagebreak", "?xml"]
    static LEAF_ELEMENTS = ["img", "tr", "image"]

    constructor(tag, content) {
        this.tag = tag
        this.content = content
        this.children = []
    }

    static #isVoidElement(tagName) {
        let vd = XmlNode.VOID_ELEMENTS.includes(tagName.toLowerCase()) || tagName.startsWith("!--")
        //console.log("is void: " + tagName + " ? " + vd)
        return vd
    }

    static #isTag(str) {
        return /^<\/?[^>]+>$/.exec(str) != null
    }
      
    static #isEndTag(str) {
        return /^<\/[^>]+>$/.exec(str) != null
    }
        
    static #isBothTag(str) {
        let bth = /^<[^>]+\/>$/.exec(str) != null
        //console.log("is both: " + str + " ? " + bth)
        return bth
    }
      
    static #getTagName(str) {
        var tagNamePattern = /<\/?([^>\s]+)/
        var match = tagNamePattern.exec(str)
        if (match != null) {
          return match[1]
        }
        return null
    }

    static parse(text) {
        var documentNode = new XmlNode("document", "")
        var current = documentNode
      
        var content = ""
      
        for (var i = 0; i < text.length; i++) {
            var c = text.charAt(i)
            
            if (c == '<') {
                // starting a new tag
                // save what we have in content
                if (XmlNode.#isTag(content)) {
                    throw "this should not happen"
                } else {
                    // can only be a text node or nothing
                    if (content.length > 0) {
                        current.#addChild(new XmlNode("text", content))
                        content = ""
                    }
                }
            }

            // accumulate content
            content += c

            if (c == '>') {
                // ending a tag
                if (XmlNode.#isTag(content)) {
                    var tag = XmlNode.#getTagName(content)
                    // can only be a tag
                    if (XmlNode.#isEndTag(content)) {
                        // we check that this tag closes the current node correctly
                        // todo: if not, maybe we need to go back until we find the parent that is closed
                        if (XmlNode.#isVoidElement(tag)) {
                            // the last child should have the correct name
                            var lastChild = current.children[current.children.length - 1]
                            if (tag != lastChild.tag) {
                                throw "incompatible end " + tag + " for void tag " + lastChild.tag
                            } else {
                                lastChild.content += content
                            }
                        } else {
                            // the current node should have the correct name, and it is getting closed
                            if (tag != current.tag) {
                                throw "incompatible end tag " + tag + " for " + current.tag
                            }
                            // move current node up
                            current = current.parent
                        }
                    } else if (XmlNode.#isBothTag(content) || XmlNode.#isVoidElement(tag)) {
                        // just add this tag without content
                        //console.log("adding child: " + content)
                        current.#addChild(new XmlNode(tag, content))
                    } else {
                        // a start tag
                        //console.log("adding child: " + content)
                        var newNode = new XmlNode(tag, content)
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

        return documentNode
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
        this.#printAtLevel(level, this.tag /*+ "[" + this.start + "," + this.end*/ + "]: " + this.content)
        for (var i = 0; i < this.children.length; i++) {
            this.children[i].prettyPrint(level+1)
        }
    }
}


async function content(path) {  
    return await readFile(path, 'utf8')
}
  
content('./content.opf').then(content => XmlNode.parse(content)).then(node => node.prettyPrint())