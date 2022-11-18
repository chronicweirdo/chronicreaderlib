// https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types

var chronicReaderInstance = null

function imageLoadedPromise(image) {
    return new Promise((resolve, reject) => {
        let imageResolveFunction = function() {
            resolve()
        }
        image.onload = imageResolveFunction
        image.onerror = imageResolveFunction
    })
}
function getFileExtension(filename) {
    let extension = filename.toLowerCase().substring(filename.lastIndexOf('.') + 1)
    return extension
}
function num(s, def) {
    var patt = /[\-]?[0-9\.]+/
    var match = patt.exec(s)
    if (match != null && match.length > 0) {
        var n = match[0]
        if (n.indexOf('.') > -1) {
            return parseFloat(n)
        } else {
            return parseInt(n)
        }
    }
    return def
}
function approx(val1, val2, threshold = 1) {
    return Math.abs(val1 - val2) < threshold
}
function radiansToDegrees(radians) {
    return radians * (180/Math.PI)
}
function computeSwipeParameters(deltaX, deltaY) {
    let highOnPotenuse = Math.sqrt(Math.pow(deltaX, 2) + Math.pow(deltaY, 2))
    if (highOnPotenuse != 0) {
        let swipeSine = deltaY / highOnPotenuse
        let swipeAngle = Math.abs(radiansToDegrees(Math.asin(swipeSine)))
        return {
            length: highOnPotenuse,
            angle: swipeAngle
        }
    } else {
        return {
            length: 0,
            angle: 0
        }
    }
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

class ComicDisplay {
    constructor(element, comic, startPosition = 0) {
        this.element = element
        this.comic = comic
        this.zoomValue = 1
        this.position = startPosition
        this.#buildUI()
        this.displayPageFor(startPosition).then(() => this.#fitPageToScreen())
    }

    #buildUI() {
        //this.element.style.position = "fixed"
        this.element.innerHTML = ""
        this.page = document.createElement("img")
        this.page.style.position = "absolute"
        this.element.appendChild(this.page)
        this.previous = createDivElement(this.element, 0, 0, "10%", "90%", "#ff000055")
        this.previous.onclick = () => { this.#goToPreviousView() }
        this.next = createDivElement(this.element, "90%", 0, "10%", "90%", "#00ff0055")
        this.next.onclick = () => { this.#goToNextView() }
        this.toolsLeft = createDivElement(this.element, 0, "90%", "10%", "10%", "#ff00ff55")
        this.toolsRight = createDivElement(this.element, "90%", "90%", "10%", "10%", "#00ffff55")
        this.gestureControls = createDivElement(this.element, "10%", 0, "80%", "100%", "#ffff0055")

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
        this.#setZoomJump(zoom)
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
    #goToNextView() {
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
    #goToPreviousView() {
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

    #getSwipeLength() {
        return 0.06
    }

    #getSwipeAngleThreshold() {
        return 30
    }

    #getSwipeEnabled() {
        return true
    }

    /* returns true if pan should be disabled / when moving to a different page */
    #pan(x, y, totalDeltaX, totalDeltaY, pinching) {
        if (this.#getSwipeEnabled && (this.swipeNextPossible || this.swipePreviousPossible) && (!pinching)) {
            let horizontalThreshold = this.#getViewportWidth() * this.#getSwipeLength()
            let swipeParameters = computeSwipeParameters(totalDeltaX, totalDeltaY)
            let verticalMoveValid = swipeParameters.angle < this.#getSwipeAngleThreshold()
            if (this.swipeNextPossible && x > 0 ) this.swipeNextPossible = false
            if (this.swipePreviousPossible && x < 0 ) this.swipePreviousPossible = false
            if (verticalMoveValid && totalDeltaX < -horizontalThreshold && this.swipeNextPossible) {
                this.swipeNextPossible = false
                this.swipePreviousPossible = false
                this.#goToNextView()
                return true
            } else if (verticalMoveValid && totalDeltaX > horizontalThreshold && this.swipePreviousPossible) {
                this.swipeNextPossible = false
                this.swipePreviousPossible = false
                this.#goToPreviousView()
                return true
            } else {
                this.#addLeft(x)
                this.#addTop(y)
                this.#update()
                return false
            }
        } else {
            this.#addLeft(x)
            this.#addTop(y)
            this.#update()
            return false
        }
    }

    #getFitComicToScreen() {
        if (this.fitComicToScreen == undefined) this.fitComicToScreen = true
        return this.fitComicToScreen
    }
    #setFitComicToScreen(value) {
        this.fitComicToScreen = value
    }
    #getZoomJump() {
        if (this.zoomJump == undefined) this.zoomJump = 1
        return this.zoomJump
    }
    #setZoomJump(value) {
        this.zoomJump = value
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

    async displayPageFor(position) {
        let pageContent = await this.#getPageFor(position)
        this.page.src = pageContent
        await imageLoadedPromise(this.page)
    }

    async #getPageFor(position) {
        let page = await this.comic.getContentsAt(position)
        return page
    }

    async nextPage() {
        let size = await this.comic.getSize()
        if (this.position < size - 1) {
            this.position = this.position + 1
            this.displayPageFor(this.position).then(() => {
                if (this.#getFitComicToScreen()) {
                    this.#fitPageToScreen()
                } else {
                    this.#goToFirstPosition()
                }
            })
        }
    }

    async previousPage() {
        if (this.position > 0) {
            this.position = this.position - 1
            this.displayPageFor(this.position).then(() => {
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
        this.displayPageFor(startPosition).then(() => {
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