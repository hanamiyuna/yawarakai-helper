let nodejieba = require('nodejieba')
let Bayes = require('zh-classify').Bayes
var fnv = require('fnv-plus')

let Nlp = {
    /**
     * Tag the words that within the sentance
     * @using nodejieba
     * @param {string} text - The text message for tag
     */
    tag: (text) => {
        let stepone = nodejieba.tag(text)

        // References to the following websites
        // ICTCLAS 汉语词性标注集 https://www.cnblogs.com/chenbjin/p/4341930.html
        // 汉语分词标准汇总 https://blog.csdn.net/baobao3456810/article/details/53490067
        // 中科院ICTCLAS分词汉语词性标记集 https://blog.csdn.net/u010454729/article/details/40045815

        // Types of tags
        let tagTypes = {
            Ag: "形语素", a: "形容词", ad: "副形词", an: "名形词",
            b: "区别词", c: "连词", Dg: "副语素", d: "副词",
            e: "叹词", f: "方位词", g: "语素", h: "前接成分",
            i: "成语", j: "简称略语", k: "后接成分", l: "习用语",
            m: "数词", Ng: "名语素", n: "名词", nr: "人名",
            ns: "地名", nt: "机构团体", nz: "其他专名", o: "拟声词",
            p: "介词", q: "量词", r: "代词", s: "处所词",
            Tg: "时语素", t: "时间词", u: "助词", Vg: "动语素",
            v: "动词", vd: "副动词", vn: "名动词", w: "标点符号",
            x: "非语素字", y: "语气词", z: "状态词",
        }

        let steptwo = []
        for (let i = 0; i < stepone.length; i++) {
            let wordobj = stepone[i]
            let word = wordobj.word
            let tag = wordobj.tag
            let types = Object.keys(tagTypes)
            for (let i = 0; i < types.length; i++) {
                if (types[i] === tag) {
                    let tagObj = { word: '', tag: '', tagName: ''}
                    tagObj['tagName'] = tagTypes[types[i]]
                    tagObj['tag'] = tag
                    tagObj['word'] = word
                    steptwo.push(tagObj)
                }
            }
        }

        return steptwo
    },
    /**
     * Use the SimHash to calculate the simularity of the sentances on massive text situation
     * Reference: http://static.googleusercontent.com/media/research.google.com/en//pubs/archive/33026.pdf
     * Implemented by @HanamiYuna and special thanks to @netkiddy
     * @param {string} input    - The sentence that await for match
     * @param {string} input2   - The second sentence that await for match
     */
    Simhash(input, input2) {
        // Extract the words into arrays along with the weights
        let oneWithWeight = nodejieba.extract(input, 10)
        let twoWithWeight = nodejieba.extract(input2, 10)

        // Pre-processing
        let dataone = new Array()
        oneWithWeight.forEach(item => {
            let result = {
                fingerprint: NlpLib.toFringerPrint(item.word),
                weight: Math.round(item.weight)
            }
            dataone.push(NlpLib.addWeight(result.fingerprint, result.weight))
        })

        let datatwo = new Array()
        twoWithWeight.forEach(item => {
            let result = {
                fingerprint: NlpLib.toFringerPrint(item.word),
                weight: Math.round(item.weight)
            }
            datatwo.push(NlpLib.addWeight(result.fingerprint, result.weight))
        })

        // Merge the arrays
        let fingerprint = new Array(64)
        for (let i = 0; i < fingerprint.length; i++) {
            fingerprint[i] = 0
        }
        for (let i = 0; i < dataone.length; i++) {
            if (dataone[i].length < 64) {
                while (dataone[i].length < 64) {
                    dataone[i].push(0)
                }
            }
            fingerprint = fingerprint.map((num, idx) => {
                return num + dataone[i][idx];
            })
        }
        let fingerprint2 = new Array(64)
        for (let i = 0; i < fingerprint2.length; i++) {
            fingerprint2[i] = 0
        }
        for (let i = 0; i < datatwo.length; i++) {
            if (datatwo[i].length < 64) {
                while (datatwo[i].length < 64) {
                    datatwo[i].push(0)
                }
            }
            fingerprint2 = fingerprint2.map((num, idx) => {
                return num + datatwo[i][idx];
            })
        }

        // Output the bits fingerprint for this one sentence
        fingerprint = fingerprint.map((num, idx) => {
            return num = num > 0 ? 1 : 0
        })
        fingerprint2 = fingerprint2.map((num, idx) => {
            return num = num > 0 ? 1 : 0
        })

        // Calculate the Hamming distance
        let distance
        fingerprint.map((num, idx) => {
            if (num == fingerprint2[idx]) {
                distance += 1
            }
            else {
                distance = 0
            }
        })
        return distance
    },
    /**
     * Use Cossim to calculate the simularity of the sentences in the situation of fewer words
     * @param {string} input    - The sentence that await for match
     * @param {string} input2   - The second sentence that await for match
     */
    Cossim(input, input2) {
        let result = nodejieba.cutHMM(input)
        let result2 = nodejieba.cutHMM(input2)
        let palette = NlpLib.merge(result, result2)
        let table = NlpLib.count(result, result2, palette)
        let numerator = 0
        let srcSq = 0
        let desSq = 0

        table.a.map((srcCount, index) => {
            let desCount = table.b[index]
            numerator = numerator + srcCount * desCount
            srcSq = srcSq + srcCount * srcCount
            desSq = desSq + desCount * desCount
        })

        let denominator = Math.sqrt(srcSq * desSq)
        return numerator / denominator
    }
}

let NlpLib = {
    /**
     * Removes the duplicates
     * @param {Array} array     - The array that contains the all elements
     * @returns {Array}         - The array that removed 
     */
    merge(array, array2) {
        array = array.concat(array2)
        let a = array.concat()
        for (var i = 0; i < a.length; ++i) {
            for (var j = i + 1; j < a.length; ++j) {
                if (a[i] === a[j])
                    a.splice(j--, 1)
            }
        }
        return a
    },

    /**
     * Count the times that these words were shown in the array
     * Pop out the element and test it
     * @param {Array} a         - The first array of the first sentence that being cut
     * @param {Array} b         - The second array of the second sentence that being cut
     * @param {Array} palette   - The collection array that contains the two arrays' elements
     * @returns 
     */
    count(a, b, palette) {
        let x = palette.map(element => a.filter(item => element == item).length)
        let y = palette.map(element => b.filter(item => element == item).length)
        return hashTable = {
            a: x,
            b: y
        }
    },
    /**
     * Returns the fingerprint of the input word
     * @param {string} data     - The word that needs to be encoded
     * @returns {string}        - The bit fingerprint
     */
    toFringerPrint(data) {
        let passto = fnv.hash(data, 64)
        passto = parseInt(passto.hex(), 16)
        return passto.toString(2)
    },

    /**
     * Returns the fingerprint of all the words
     * @param {Array} data  - The array that contains all the words
     * @returns {Array}     - The array that contains all bits fingerprint
     */
    toFringerPrintArray(data) {
        let store = new Array()
        data.forEach(element => {
            let passto = fnv.hash(element, 64)
            passto = parseInt(passto.hex(), 16)
            store.push(passto.toString(2))
        })
        return store
    },

    /**
     * Calculate the weight for fingerprint and return the result
     * @param {string} data     - The bits that needs to be processed
     * @param {int} weight      - The weight for the word
     * @returns {binary}        - The fingerprint
     */
    addWeight(data, weight) {
        let store = new Array()
        data.split("").forEach(item => {
            if (item == 1) {
                store.push(item * weight)
            }
            if (item == 0) {
                store.push(-1 * weight)
            }
        })
        return store
    }
}

exports.NLP = Nlp
exports.NLPLib = NlpLib