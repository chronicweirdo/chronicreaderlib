// https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types

var chronicReaderInstance = null

function getFileExtension(filename) {
    let extension = filename.toLowerCase().substring(filename.lastIndexOf('.') + 1)
    return extension
}
function getFileMimeType(filename) {
    let extension = getFileExtension(filename)
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
function createDivElement(parent, left, top, width, height, color) {
    let element = document.createElement("div")
    element.style.position = "absolute"
    element.style.top = top
    element.style.left = left
    element.style.width = width
    element.style.height = height
    element.style.backgroundColor = color
    parent.appendChild(element)
    return element
}

/*
zip wrapper:
- get list of files
- get file contents as text or as bytes
*/

class ZipWrapper {
    constructor(url, bytes) {
        this.url = url
        this.data = bytes
    }
    getUrl() {
        return this.url
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

    getUrl() {
        return this.archive.getUrl()
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
            let file = files[position]
            let contents = await this.archive.getBase64FileContents(file)
            return "data:" + getFileMimeType(file) + ";base64," + contents
        } else {
            return null
        }
    }
}

class ComicDisplay {
    constructor(element, comic, startPosition = 0) {
        this.element = element
        this.comic = comic
        this.position = startPosition
        this.#buildUI()
        this.displayPageFor(startPosition)
    }

    #buildUI() {
        //this.element.style.position = "fixed"
        this.element.innerHTML = ""
        this.page = document.createElement("img")
        this.element.appendChild(this.page)
        this.previous = createDivElement(this.element, 0, 0, "10%", "90%", "#ff000055")
        this.previous.onclick = () => { this.previousPage() }
        this.next = createDivElement(this.element, "90%", 0, "10%", "90%", "#00ff0055")
        this.next.onclick = () => { this.nextPage() }
        this.toolsLeft = createDivElement(this.element, 0, "90%", "10%", "10%", "#ff00ff55")
        this.toolsRight = createDivElement(this.element, "90%", "90%", "10%", "10%", "#00ffff55")
        this.gestureControls = createDivElement(this.element, "10%", 0, "80%", "100%", "#ffff0055")
    }

    async displayPageFor(position) {
        let pageContent = await this.#getPageFor(position)
        this.page.src = pageContent
    }

    async #getPageFor(position) {
        let page = await this.comic.getContentsAt(position)
        return page
    }

    async nextPage() {
        let size = await this.comic.getSize()
        if (this.position < size - 1) {
            this.position = this.position + 1
            this.displayPageFor(this.position)
        }
    }

    async previousPage() {
        if (this.position > 0) {
            this.position = this.position - 1
            this.displayPageFor(this.position)
        }
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

class EbookWrapper {
    constructor(archive) {
        this.archive = archive
    }

    getUrl() {
        return this.archive.getUrl()
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

    async parseNcx() {
        let ncx = await this.#getNcx()
        let ncxXmlText = ncx.contents
        let parser = new DOMParser()
        let xmlDoc = parser.parseFromString(ncxXmlText, "text/xml")

        let navPoints = Array.from(xmlDoc.getElementsByTagName("navPoint"))
        let toc = []
        for (let i = 0; i < navPoints.length; i++) {
            let element = navPoints[i]
            let playOrder = element.getAttribute("playOrder")
            let name = element.getElementsByTagName("navLabel")[0].getElementsByTagName("text")[0].innerHTML
            let content = element.getElementsByTagName("content")[0]
            let contentSrc = content.getAttribute("src")
            let position = await this.getPositionForLink(ncx.name, contentSrc)
            toc.push({
                'name': name,
                'order': playOrder,
                'position': position
            })
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
        return "data:" + getFileMimeType(fileName) + ";base64," + (await this.archive.getBase64FileContents(this.computeAbsolutePath(this.getContextFolder(contextFile), fileName)))
    }

    async getPositionForLink(contextFile, link) {
        if (link == undefined || link == null) return null
        let linkSplit = link.split("#")
        let file = linkSplit.length == 2 ? linkSplit[0] : contextFile
        let id = linkSplit.length == 2 ? linkSplit[1] : linkSplit[0]

        let contextFolder = this.getContextFolder(contextFile)
        let absoluteLink = this.computeAbsolutePath(contextFolder, file)
        let nodes = await this.getNodes()
        if (nodes) {
            let node = nodes[absoluteLink]
            let position = node.getIdPosition(id)
            return position
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
                return node.findSpaceAfter(position)
            }
        }
        return null
    }
}

class EbookDisplay {
    constructor(element, ebook, startPosition = 0) {
        this.element = element
        this.ebook = ebook
        this.#buildUI()
        this.displayPageFor(startPosition).then(value => {
            //this.ebook.getToc().then(console.log)
            this.triggerComputationForAllPages()
        })
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
        this.ebook.getSize()
            .then(size => this.#getPageFor(size)
                .then((page) => {
                    if (page != null) console.log("computed final page " + page.start + " - " + page.end)
                })
            )
    }

    

    #buildUI() {
        //this.element.style.position = "fixed"
        this.element.innerHTML = ""
        this.previous = createDivElement(this.element, 0, 0, "10%", "90%", "#ff0000")
        this.previous.onclick = () => { this.previousPage() }
        this.next = createDivElement(this.element, "90%", 0, "10%", "90%", "#00ff00")
        this.next.onclick = () => { this.nextPage() }
        this.toolsLeft = createDivElement(this.element, 0, "90%", "10%", "10%", "#ff00ff")
        this.toolsRight = createDivElement(this.element, "90%", "90%", "10%", "10%", "#00ffff")
        this.page = createDivElement(this.element, "10%", 0, "80%", "100%", "#ffffff")
        this.shadowPage = createDivElement(this.element, "10%", 0, "80%", "100%", "#ffffff")
        this.shadowPage.style.visibility = "hidden"
        this.shadowPage.style.overflow = "auto"
        this.shadowElement = this.shadowPage
        this.tools = createDivElement(this.element, 0, 0, "100%", "100%", "#ffffffee")
        this.tools.style.display = "none"
        this.tools.style.overflow = "scroll"
        this.toolsLeft.onclick = () => {this.tools.style.display = "block"}
        this.toolsRight.onclick = () => {this.tools.style.display = "block"}
        this.tools.onclick = () => {this.tools.style.display = "none"}
        this.#buildToolsUI()
    }

    async #buildToolsUI() {
        let toc = await this.ebook.getToc()
        console.log(toc)
        let toolsContents = document.createElement("div")
        toolsContents.style.position = "absolute"
        toolsContents.style.top = 0
        toolsContents.style.left = "10%"
        toolsContents.style.width = "80%"
        let tocElement = document.createElement("ul")
        for (let i = 0; i < toc.length; i++) {
            let item = document.createElement("li")
            let link = document.createElement("a")
            link.innerHTML = toc[i].name
            link.onclick = () => this.displayPageFor(toc[i].position)
            item.appendChild(link)
            tocElement.appendChild(item)
        }
        toolsContents.appendChild(tocElement)
        this.tools.innerHTML = ""
        this.tools.appendChild(toolsContents)
    }

    async fixLinks(contextFilename) {
        let links = this.page.getElementsByTagName("a")
        for (let i = 0; i < links.length; i++) {
            let linkElement = links[i]
            let linkHref = linkElement.getAttribute("href")
            if (linkHref != null && linkHref.length > 0) {
                let position = await this.ebook.getPositionForLink(contextFilename, linkHref)
                if (position != null) {
                    linkElement.onclick = () => this.displayPageFor(position)
                    linkElement.removeAttribute("href")
                }
            }
        }
    }

    async displayPageFor(position) {
        let page = await this.#getPageFor(position)
        if (page != null) {
            this.currentPage = page
            this.page.innerHTML = await this.ebook.getContentsAt(page.start, page.end)
            let node = await this.ebook.getNodeAt(page.start)
            this.fixLinks(node.key)
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
        let url = this.ebook.getUrl()
        let el = this.element
        let fontSize = window.getComputedStyle(el, null).getPropertyValue('font-size')
        return url + "_" + el.offsetHeight + "x" + el.offsetWidth + "x" + fontSize
    }

    #deserializePageCache(pageCacheKey) {
        let simpleValue = window.localStorage.getItem(pageCacheKey)
        return PageCache.deserialize(pageCacheKey, simpleValue)
    }

    #serializePageCache(pageCache) {
        window.localStorage.setItem(pageCache.key, pageCache.serialize())
    }

    #getPagesCache() {
        if (this.pages == undefined) this.pages = {}
        let pageCacheKey = this.#getPageSizeKey()
        if (this.pages[pageCacheKey] == undefined) {
            this.pages[pageCacheKey] = this.#deserializePageCache(pageCacheKey)
        }
        return this.pages[pageCacheKey]
    }

    async #getPageFor(position) {
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
        while ((await this.#overflowTriggerred()) == false && previousEnd != end && end != null) {
            previousEnd = end
            end = await this.ebook.findSpaceAfter(previousEnd)
            this.shadowElement.innerHTML = await this.ebook.getContentsAt(start, end)
        }
        if (previousEnd != null) {
            return new Page(start, previousEnd)
        } else {
            return new Page(start, start)
        }
    }

    async #computePageFor(position) {
        if (this.computationInProgress == undefined || this.computationInProgress == false) {
            this.computationInProgress = true
            let originalPageCache = this.#getPagesCache()
            let currentPageCache = originalPageCache
            let start = originalPageCache.getEnd()
            if (start > 0) start = start + 1
            let page = await this.#computeMaximalPage(start)
            originalPageCache.addPage(page)
            let lastSavedTimestamp = Date.now()
            while (! page.contains(position) && originalPageCache == currentPageCache) {
                let newStart = page.end + 1
                page = await this.#computeMaximalPage(newStart)
                originalPageCache.addPage(page)
                if (Date.now() - lastSavedTimestamp > 30000) {
                    this.#serializePageCache(originalPageCache)
                    lastSavedTimestamp = Date.now()
                }
                currentPageCache = this.#getPagesCache()
                await this.#timeout(10)
            }
            this.#serializePageCache(originalPageCache)
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

    getPageFor(position) {
        if (this.value) {
            for (var i = 0; i < this.value.length; i++) {
                if (this.value[i].contains(position)) return this.value[i]
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
    constructor(url, element, settings = {}) {
        this.url = url
        this.element = element
        this.settings = settings
        this.#init()
        chronicReaderInstance = this
    }

    #init() {
        let extension = getFileExtension(this.url)
        let type = ""
        if (extension == "epub") {
            type = "book"
        } else if (extension == "cbr" || extension == "cbz") {
            type = "comic"
        }

        fetch(this.url)
            .then(res => res.blob())
            .then(blob => new ZipWrapper(this.url, blob))
            .then(zip => {
                if (type == "book") {
                    return new EbookWrapper(zip)
                } else if (type == "comic") {
                    return new ComicWrapper(zip)
                } else {
                    return null
                }
            }).then(wrapper => {
                if (wrapper) {
                    if (type == "book") {
                        this.display = new EbookDisplay(this.element, wrapper, 3500)
                    } else if (type == "comic") {
                        this.display = new ComicDisplay(this.element, wrapper, 0)
                    }
                }
            })
    }

    displayPageFor(position) {
        if (this.display) {
            this.display.displayPageFor(position)
        }
    }
}

function jumpTo(position) {
    if (chronicReaderInstance) {
        chronicReaderInstance.displayPageFor(position)
    }
}