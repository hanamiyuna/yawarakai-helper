let fs = require('fs')
let path = require('path')
let Bayes = require('zh-classify').Bayes
let Database = require('nedb')

// Local
let nlp = require('../nlp/module')

function parseItem(str) {
    let obj = { name: '', id: 0 }
    let next = str.split(' ')
    obj['id'] = parseInt(next.pop().match(/(\d+|(-\d+))/)[0])
    obj['name'] = next.join(' ')
    return obj
}

function parse(line) {

    let datePattern = /\[\d{4}-\d{2}-\d{2}T(\d{2}:){2}\d{2}\.\d{3}]/
    let other = ' [INFO] Message - '
    let obj = { date: new Date(), from: '', group: '', groupId: 0, user: '', userId: 0, text: '', nlp: [], sentiment: {} }

    if (line.match(/\d{4}-\d{2}-\d{2}T(\d{2}:){2}\d{2}\.\d{3}/) != null) {
        
        // date to date
        let dateStr = line.match(/\d{4}-\d{2}-\d{2}T(\d{2}:){2}\d{2}\.\d{3}/)
        let next = line.replace('[' + dateStr[0] + ']' + other, '')

        // user to userId
        // pattern USER NAME [NUMBER]
        let userPattern = /(来自|From): .* (\[|<)\d+(\]|>)/
        let userStr = next.match(userPattern)
        userStr = userStr[0].replace(/(来自|From): /, '')
        let userData = parseItem(userStr)
        next = next.replace(next.match(userPattern)[0], '')

        // group to groupId
        // pattern GROUP [GROUPID]
        let groupPattern = /(群组|Group): .* (\[|<)-\d+(\]|>)/
        let groupData = { name: '', id: 0 }
        if (groupPattern.test(next)) {
            let groupStr = next.match(groupPattern)
            groupStr = groupStr[0].replace(/(群组|Group): /, '')
            groupData = parseItem(groupStr)
            next = next.replace(next.match(groupPattern)[0], '')
        }

        // from
        let from = ''
        if (groupData.id != 0) {
            from = 'group'
        }
        else {
            'private'
        }

        // text parse
        let useless = /( \| : |: )/gi
        let text = next.replace(useless, '')

        // sentiment
        const sentiment = new Bayes()
        let senti = sentiment.clf(text)

        // fill in data
        obj['date'] = new Date(dateStr[0])
        obj['from'] = from
        obj['group'] = groupData.name
        obj['groupId'] = groupData.id
        obj['user'] = userData.name
        obj['userId'] = userData.id
        obj['text'] = text
        obj['nlp'] = nlp.NLP.tag(text)
        obj['sentiment'] = senti

        return obj
    }

    return undefined
}

let mergeLine = new Array()

function checker(line, next) {

    mergeLine.push(line)

    if (mergeLine.length == 0) {
        return
    }

    let header = /\[\d{4}-\d{2}-\d{2}T(\d{2}:){2}\d{2}\.\d{3}\]/
    let result = {}

    if (next == false) {
        result = parse(mergeLine.join(' '))
        mergeLine = new Array()
        return result
    }
    else if (header.test(next)) {
        result = parse(mergeLine.join(' '))
        mergeLine = new Array()
        return result
    }

}

const logDir = path.join(__dirname, '/log')
let logFiles = fs.readdirSync(logDir)

function main() {

    let db = new Database({filename: "./history.db", autoload: true})
    let count = 0

    // Read in and prepare
    logFiles.forEach((value, index) => {
        if (value.endsWith('.log')) {
            let logPath = path.join(logDir + '/' + value)

            if (fs.existsSync(logPath)) {
                let logStream = fs.createReadStream(logPath)
                let logLines = fs.readFileSync(logPath, 'utf-8').split(/\r?\n/)

                logLines.forEach((line, lineNum) => {
                    let next = ''
                    if (lineNum == (logLines.length - 1)) {
                        next = false
                    }
                    else {
                        next = logLines[lineNum + 1]
                    }
                    ++count
                    console.log('written line: ', count)
                    db.insert(checker(line, next), (err, newLine) => {
                        
                    })
                })
            }
            else {
                return
            }
        }
    })

    console.log('finished!')
}

main()