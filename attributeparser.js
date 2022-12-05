function parseAttributes(content) {
    attributes = []
    let accumulator = ""
    let lookingForAttributeName = false
    let readingAttributeName = false
    let lookingForAttributeValue = false
    let readingAttributeValue = false
    let attributeValueQuotes = null
    let attributeName = null
    let attributeValue = null
    for (var i = 0; i < content.length; i++) {
        let c = content.charAt(i)
        accumulator += c
        if (c == ' ' || c == '\t') {
            if (lookingForAttributeName) {
                // discard and continue looking
                accumulator = ""
            } else if (readingAttributeName) {
                // finished reading attribute name
                readingAttributeName = false
                lookingForAttributeValue = true
                attributeName = accumulator.substring(0, accumulator.length - 1)
                accumulator = ""
            } else if (lookingForAttributeValue) {
                // continue looking, space is not a value
            } else if (readingAttributeValue) {
                // continue reading
            } else {
                // discard
                accumulator = ""
                lookingForAttributeName = true
            }
        } else if (c == '=') {
            if (readingAttributeName) {
                // finished reading attribute name
                readingAttributeName = false
                lookingForAttributeValue = true
                attributeName = accumulator.substring(0, accumulator.length - 1)
                accumulator = ""
            } else if (lookingForAttributeValue) {
                // we are on the right track, but we keep looking
            } else {
                // error
                throw "wild = discovered at position " + i
            }
        } else if (c == attributeValueQuotes) {
            if (readingAttributeValue) {
                // may be end of attribute value read unless escaped
                if (accumulator.charAt(accumulator.length - 2) != '\\') {
                    // finish reading attribute value and save attribute
                    readingAttributeValue = false
                    lookingForAttributeValue = false
                    readingAttributeName = false
                    lookingForAttributeName = true
                    attributeValue = accumulator.substring(0, accumulator.length - 1)
                    accumulator = ""
                    this.attributes.push({
                        "name": attributeName,
                        "value": attributeValue
                    })
                    attributeName = null
                    attributeValue = null
                    attributeValueQuotes = null
                }
            } else {
                throw "wild ending " + attributeValueQuotes + " discovered at position " + i
            }
        } else if (c == '"' || c == "'") {
            if (lookingForAttributeValue) {
                // start reading attribute value
                lookingForAttributeValue = false
                readingAttributeValue = true
                attributeValueQuotes = c
                accumulator = ""
            } if (readingAttributeValue) {
                // continue
            } else {
                throw "wild " + c + " discovered at position " + i
            }
        } else {
            if (lookingForAttributeName) {
                lookingForAttributeName = false
                readingAttributeName = true
            } else if (lookingForAttributeValue) {
                // not going to find a value, starting with a new name
                readingAttributeValue = false
                lookingForAttributeValue = false
                readingAttributeName = false
                lookingForAttributeName = true
                attributeValue = null
                accumulator = ""
                this.attributes.push({
                    "name": attributeName,
                    "value": attributeValue
                })
                attributeName = null
                attributeValue = null
                attributeValueQuotes = null
            }
            // continue
        }
    }
    return attributes
}

try {
    console.log(parseAttributes('<dc:identifier opf:scheme="URI" id = "id" crazy0 crazy1="this is\'bonkers\' boy" crazy1="\\"withquotes\\""></dc:identifier>'))
} catch (error) {
    console.log(error)
}