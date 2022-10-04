/*
zip wrapper:
- get list of files
- get file contents as text or as bytes
*/

class ZipWrapper {
    constructor(bytes) {
        this.data = bytes
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
        return files
    }
    // https://stuk.github.io/jszip/documentation/api_zipobject/async.html
    async #getFileContents(filename, filekind) {
        let zip = await this.#getZip()
        let entry = zip.files[filename]
        let contents = await entry.async(filekind)
        return contents
    }
    async getBase64FileContents(filename) {
        return this.#getFileContents(filename, "base64")
    }
    async getTextFileContents(filename) {
        return this.#getFileContents(filename, "text")
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

class ComicWrapper {
    constructor(archive) {
        this.archive = archive
    }

    async getSize() {
        let files = await this.archive.getFiles()
        return files.length
    }

    async getCover() {
        if (await this.getSize() > 0) {
            let files = await this.archive.getFiles()
            return await this.archive.getBase64FileContents(files[0])
        } else {
            return null
        }
    }

    async getContentsAt(position) {
        if (position >= 0 && position < await this.getSize()) {
            let files = await this.archive.getFiles()
            return await this.archive.getBase64FileContents(files[position])
        } else {
            return null
        }
    }
}

class CachedObject {
    constructor(key) {
        this.key = key
    }

    #timeout(ms) {
        return new Promise((resolve, reject) => {
            window.setTimeout(function() {
                resolve()
            }, ms)
        })
    }

    #persist(timestamp) {
        if (timestamp == this.saveTimestamp) {
            window.localStorage.setItem(this.key, JSON.stringify(this.value))
        } else {
            console.log("not saving yet")
        }
    }
    load() {
        let stringValue = window.localStorage.getItem(this.key)
        if (stringValue) {
            this.value = JSON.parse(stringValue)
        }
    }
    set(value) {
        this.value = value
        let localSaveTimestamp = Date.now()
        this.saveTimestamp = localSaveTimestamp
        this.#timeout(100).then(() => {
            this.#persist(localSaveTimestamp)
        })
        
    }
    get() {
        if (this.value == undefined) {
            this.load()
        }
        return this.value
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

class EbookWrapper extends CachedObject {
    constructor(archive) {
        super("book")
        this.archive = archive
    }

    #getParsed() {
        let simpleValue = this.get()
        if (simpleValue) {
            let complexValue = {}
            for (var name in simpleValue) {
                complexValue[name] = EbookNode.expand(simpleValue[name])
            }
            return complexValue
        }
        return undefined
    }

    #setParsed(complexValue) {
        if (complexValue) {
            let simpleValue = {}
            for (var name in complexValue) {
                simpleValue[name] = complexValue[name].simplify()
            }
            this.set(simpleValue)
        }
    }

    async getNodes() {
        let nodes = this.#getParsed()
        if (nodes == undefined) {
            nodes = {}
            let spine = await this.getSpine()
            let entrancePosition = 0
            for (var i = 0; i < spine.length; i++) {
                let resourceNode = await this.#getResourceNode(spine[i], entrancePosition)
                nodes[spine[i]] = resourceNode
                entrancePosition = resourceNode.end + 1
            }
            for (var node in this.nodes) {
                await this.nodes[node].updateLinks(node, this)
            }
            console.log(nodes)
            this.#setParsed(nodes)
        }
        return nodes
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
            return contextFolder + "/" + filename
        } else {
            return filename
        }
    }

    async parseOpf() {
        let opf = await this.#getOpf()
        let opfXmlText = opf.contents
        let parser = new DOMParser()
        let xmlDoc = parser.parseFromString(opfXmlText, "text/xml")

        // get spine
        let spine = Array.from(xmlDoc.getElementsByTagName("itemref")).map(element => {
            let item = xmlDoc.getElementById(element.getAttribute("idref"))
            return item.getAttribute("href")
        }).map(element => this.computeAbsolutePath(this.getContextFolder(opf.name), element))
        this.spine = spine
        return spine
    }

    async getSpine() {
        if (this.spine == undefined) {
            await this.parseOpf()
        }
        return this.spine
    }

    async #getResourceNode(filename, entrancePosition) {
        let xmlText = await this.archive.getTextFileContents(filename)
        let bookNode = await EbookNode.parseHtmlToEbookNode(xmlText, entrancePosition, filename, this)
        return bookNode
    }

    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types
    #getFileMimeType(filename) {
        let extension = filename.toLowerCase().substring(filename.lastIndexOf('.') + 1)
        if (extension == "png" || extension == "jpeg"
            || extension == "avif" || extension == "bmp" || extension == "gif"
            || extension == "tiff" || extension == "webp") {
            return "image/" + extension
        } else if (extension == "jpg") {
            return "image/jpeg"
        } else if (extension == "tif") {
            return "image/tiff"
        } else if (extension == "svg") {
            return "image/svg+xml"
        } else if (extension == "ico") {
            return "image/vnd.microsoft.icon"
        } else {
            return "text/plain"
        }
    }

    async getImageBase64(contextFile, fileName) {
        return "data:" + this.#getFileMimeType(fileName) + ";base64," + (await this.archive.getBase64FileContents(this.computeAbsolutePath(this.getContextFolder(contextFile), fileName)))
    }

    async getPositionForLink(contextFile, link) {
        if (link == undefined || link == null) return null
        let linkSplit = link.split("#")
        let file = linkSplit.length == 2 ? linkSplit[0] : contextFile
        let id = linkSplit.length == 2 ? linkSplit[1] : linkSplit[0]

        let contextFolder = this.getContextFolder(contextFile)
        let absoluteLink = this.computeAbsolutePath(contextFolder, file)
        let nodes = await this.getNodes()
        let node = nodes[absoluteLink]
        let position = node.getIdPosition(id)
        return position
    }

    async getContentsAt(start, end) {
        let size = await this.getSize()
        if (start < 0 || end < 0 || start > end || start >= size || end >= size) return null;

        let nodes = await this.getNodes()
        for (var index in nodes) {
            let node = nodes[index]
            if (node.start <= start && start <= node.end) {
                // content is here
                // can only retrieve content from a single section
                let actualEnd = (end > node.end) ? node.end : end
                return node.copy(start, actualEnd).getContent()
            }
        }
        return null
    }

    async findSpaceAfter(position) {
        let size = await this.getSize()
        if (position < 0 || position >= size) return null
        let nodes = await this.getNodes()
        for (var index in nodes) {
            let node = nodes[index]
            if (node.start <= position && position <= node.end) {
                // content is here
                // can only retrieve content from a single section
                return node.findSpaceAfter(position)
            }
        }
        return null
    }
}

class EbookDisplay {
    constructor(element, ebook, startPosition = 0) {
        this.element = element
        //this.element.onresize = this.handleResize
        this.ebook = ebook
        this.position = startPosition
        this.createShadowComponent()
        this.displayPageFor(startPosition).then(value => {
            console.log("computing rest of pages " + value)
            this.triggerComputationForAllPages()
        })
    }

    async refresh() {
        console.log("handling resize " + this.currentPage)
        if (this.currentPage) {
            this.displayPageFor(this.currentPage.start).then(value => {
                console.log("computing rest of pages " + value)
                this.triggerComputationForAllPages()
            })
        }
    }

    triggerComputationForAllPages() {
        this.ebook.getSize()
            .then(size => this.#getPageFor(size)
                .then((page) => {
                    if (page != null) console.log("computed final page " + page.start + " - " + page.end)
                })
            )
    }

    createShadowComponent() {
        let shadowElement = this.element.cloneNode(false)
        shadowElement.id = this.element.id + "_shadow"
        shadowElement.style.visibility = "hidden"
        shadowElement.style.overflow = "auto"
        let parent = this.element.parentElement
        parent.appendChild(shadowElement)
        this.shadowElement = shadowElement
    }

    async displayPageFor(position) {
        let page = await this.#getPageFor(position)
        if (page != null) {
            this.currentPage = page
            this.element.innerHTML = await this.ebook.getContentsAt(page.start, page.end)
            await this.#timeout(10)
        }
        return page
    }

    async nextPage() {
        let size = await this.ebook.getSize()
        if (this.currentPage && this.currentPage.end < size) {
            this.displayPageFor(this.currentPage.end + 1)
        }
    }

    async previousPage() {
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
        let el = this.element
        let fontSize = window.getComputedStyle(el, null).getPropertyValue('font-size')
        return el.offsetHeight + "x" + el.offsetWidth + "x" + fontSize
    }

    #getPagesCache() {
        if (this.pages == undefined) this.pages = {}
        let pageCacheKey = this.#getPageSizeKey()
        let pageCache = this.pages[pageCacheKey]
        if (pageCache == undefined) {
            pageCache = new PageCache(pageCacheKey)
            this.pages[pageCacheKey] = pageCache
        }
        return pageCache
    }

    async #getPageFor(position) {
        //console.log("get page for " + position)
        let pageCache = this.#getPagesCache()
        let page = pageCache.getPageFor(position)      
        if (page == null) {
            let computedPage = await this.#computePageFor(position)
            return computedPage
        } else {
            return page
        }
    }
    
    async #overflowTriggerred() {
        let el = this.shadowElement
        if (el.scrollHeight > el.offsetHeight || el.scrollWidth > el.offsetWidth) return true
        else return false
    }

    async #computeMaximalPage(start) {
        let previousEnd = null
        let end = await this.ebook.findSpaceAfter(start)
        this.shadowElement.innerHTML = ""
        //console.log("first end " + end)
        while ((await this.#overflowTriggerred()) == false && previousEnd != end && end != null) {
            previousEnd = end
            end = await this.ebook.findSpaceAfter(previousEnd)
            //console.log("new end " + end)
            this.shadowElement.innerHTML = await this.ebook.getContentsAt(start, end)
        }
        if (previousEnd != null) {
            return new Page(start, previousEnd)
        } else {
            return new Page(start, start)
        }
    }

    async #computePageFor(position) {
        console.log("compute page for " + position)
        let originalPageCache = this.#getPagesCache()
        let currentPageCache = originalPageCache
        let start = originalPageCache.getEnd()
        if (start > 0) start = start + 1
        //console.log("starting at " + start)
        let page = await this.#computeMaximalPage(start)
        originalPageCache.addPage(page)
        while (! page.contains(position) && originalPageCache == currentPageCache) {
            let newStart = page.end + 1
            //console.log("compute page starting at " + newStart)
            page = await this.#computeMaximalPage(newStart)
            //console.log("found page " + page.start + " " + page.end)
            originalPageCache.addPage(page)
            currentPageCache = this.#getPagesCache()
            await this.#timeout(10)
        }
        if (originalPageCache != currentPageCache) {
            console.log("stopping computation because page cache changed")
            return null
        } else {
            return page
        }
    }

}

class Page {
    constructor(start, end) {
        this.start = start
        this.end = end
    }

    contains(position) {
        return this.start <= position && position <= this.end
    }
}

class PageCache extends CachedObject {
    constructor(key) {
        super(key)
    }

    #getParsed() {
        let simpleValue = this.get()
        if (simpleValue) {
            let actualValue = simpleValue.map(e => new Page(e[0], e[1]))
            return actualValue
        }
        return undefined
    }

    #setParsed(actualValue) {
        if (actualValue) {
            let simpleValue = actualValue.map(e => [e.start, e.end])
            this.set(simpleValue)
        }
    }

    addPage(page) {
        // todo: verify and remove conflicts?
        let value = this.#getParsed()
        if (value == undefined) value = []
        value.push(page)
        this.#setParsed(value)
    }

    getPageFor(position) {
        let value = this.#getParsed()
        if (value) {
            for (var i = 0; i < value.length; i++) {
                if (value[i].contains(position)) return value[i]
            }
        }
        return null
    }

    getEnd() {
        let end = 0
        let value = this.#getParsed()
        if (value) {
            for (var i = 0; i < value.length; i++) {
                if (value[i].end > end) {
                    end = value[i].end
                }
            }
        }
        return end
    }
}

