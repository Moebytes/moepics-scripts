import Moepictures, {Tag} from "moepics-api"
import axios from "axios"
import phash from "sharp-phash"
import dist from "sharp-phash/distance"
import sharp from "sharp"
import wanakana from "wanakana"
import pinyin from "pinyin"
import * as hangul from "hangul-romanization"
import path from "path"
import fs from "fs"

const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)

export default class Functions {
    public static timeout = (ms: number) => {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }
    
    public static removeDuplicates = <T>(array: T[]) => {
        const set = new Set<string>()
        return array.filter(item => {
            const serialized = JSON.stringify(item)
            if (set.has(serialized)) {
                return false
            } else {
                set.add(serialized)
                return true
            }
        })
    }
    
    public static binaryToHex = (bin: string) => {
        return bin.match(/.{4}/g)?.reduce(function(acc, i) {
            return acc + parseInt(i, 2).toString(16).toUpperCase()
        }, "") || ""
    }
    
    public static imageBuffer = async (link: string, headers?: {[key: string]: string}) => {
        const response = await axios.get(link, {responseType: "arraybuffer", 
        headers: {Referer: "https://www.pixiv.net/", ...headers}}).then((r) => r.data)
        return Buffer.from(response)
    }
    
    public static pHash = async (buffer: Buffer) => {
        return phash(buffer).then((hash: string) => this.binaryToHex(hash))
    }

    public static getDanbooruArtistTag = async (tag: string) => {
        const posts = await moepics.search.posts({query: tag})
        for (const post of posts) {
            if (post.mirrors?.danbooru) {
                let id = post.mirrors.danbooru.match(/\d+/)?.[0]
                let danbooruPost = await fetch(`https://danbooru.donmai.us/posts/${id}.json`).then((r) => r.json())
                if (danbooruPost.tag_string_artist?.split(" ").length > 1) continue
                const danbooruArtistTag = danbooruPost.tag_string_artist?.split(" ")[0]
                return danbooruArtistTag as string
            }
        }
        return ""
    }

    public static cropToSquare = async (image: ArrayBuffer) => {
        const metadata = await sharp(Buffer.from(image)).metadata()
        const side = Math.min(metadata.width, metadata.height)
        const left = Math.floor((metadata.width - side) / 2)
        const top = Math.floor((metadata.height - side) / 2)
    
        const buffer = await sharp(Buffer.from(image))
            .extract({left, top, width: side, height: side})
            .toBuffer()
    
        return Object.values(new Uint8Array(buffer))
    }

    public static fixTwitterTag = (tag: string) => {
        return tag.toLowerCase().replaceAll("_", "-").replace(/^[-]+/, "").replace(/[-]+$/, "")
    }

    public static detectCJK = (text: string) => {
        const result = {
            chinese: false,
            japanese: false,
            korean: false,
            diacritics: false
        }
    
        const chineseRegex = /[\u4E00-\u9FFF]/
        const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FF\u4E00-\u9FFF]/
        const koreanRegex = /[\uAC00-\uD7AF\u1100-\u11FF]/
        const diacriticsRegex = /[\u00C0-\u017F\u1E00-\u1EFF\u0300-\u036F]/
    
        if (chineseRegex.test(text)) result.chinese = true
        if (japaneseRegex.test(text)) result.japanese = true
        if (koreanRegex.test(text)) result.korean = true
        if (diacriticsRegex.test(text.normalize("NFD"))) result.diacritics = true
    
        return result
    }

    public static hasForeignCharacters = (text: string) => {
        let {chinese, japanese, korean, diacritics} = this.detectCJK(text)
        return chinese || japanese || korean || diacritics
    }

    public static romanizeTag = (tag: string, attributes: {chinese: boolean, japanese: boolean, korean: boolean}) => {
        let text = tag
        if (attributes.japanese) {
            text = wanakana.toRomaji(text)
        }
        if (attributes.chinese) {
            text = pinyin(text, {style: pinyin.STYLE_NORMAL}).flat().join("-")
        }
        if (attributes.korean) {
            text = hangul.convert(text)
        }
        return this.cleanTag(this.removeDiacritics(text))
    }

    public static removeDiacritics = (text: string) => {
        return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    }

    public static cleanTag = (tag: string) => {
        return tag.toLowerCase().normalize("NFD").replace(/[^a-z0-9_\-():><&!#@?]/gi, "")
        .replaceAll("_", "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "")
    }

    public static imagesMatch = async (first: string, second: string) => {
        try {
            const oldBuffer = await fetch(first).then((r) => r.arrayBuffer())
            const oldHash = await phash(Buffer.from(oldBuffer)).then((hash) => this.binaryToHex(hash))
            const buffer = await fetch(second).then((r) => r.arrayBuffer())
            const hash = await phash(Buffer.from(buffer)).then((hash) => this.binaryToHex(hash))
            if (dist(hash, oldHash) < 10) {
                return true
            }
            return false
        } catch {
            return false
        }
    }

    public static safeNumber = (text: string) => {
        if (Number.isNaN(Number(text))) return null
        return Number(text)
    }

    public static decodeEntities(encodedString: string) {
        const regex = /&(nbsp|amp|quot|lt|gt);/g
        const translate = {
            nbsp: " ",
            amp : "&",
            quot: "\"",
            lt  : "<",
            gt  : ">"
        }
        return encodedString.replace(regex, function(match, entity) {
            return translate[entity]
        }).replace(/&#(\d+);/gi, function(match, numStr) {
            const num = parseInt(numStr, 10)
            return String.fromCharCode(num)
        })
    }

    public static formatDate(date: Date, yearFirst?: boolean) {
        if (!date || Number.isNaN(date.getTime())) return ""
        let year = date.getFullYear()
        let month = (1 + date.getMonth()).toString()
        let day = date.getDate().toString()
        if (yearFirst) return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
        return `${month}-${day}-${year}`
    }

    public static dumpImage = async (imageBuffer: Buffer) => {
        const folder = path.join(__dirname, "./dump")
        if (!fs.existsSync(folder)) fs.mkdirSync(folder, {recursive: true})

        const filename = `${Math.floor(Math.random() * 100000000)}.png`
        const imagePath = path.join(folder, filename)
        let pngBuffer = await sharp(imageBuffer).png().toBuffer()
        fs.writeFileSync(imagePath, pngBuffer)
        return imagePath
    }

    public static toProperCase = (str: string) => {
        if (!str) return ""
        return str.replace(/\w\S*/g, (txt) => {
                return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
            }
        )
    }

    public static tagStringCategories = (parsedTags: string[], tagMap: {[key: string]: Tag}) => {
        let artists = [] as string[]
        let characters = [] as string[]
        let series = [] as string[]
        let meta = [] as string[]
        let tags = [] as string[] 
        if (!parsedTags) return {artists, characters, series, meta, tags}
        for (let i = 0; i < parsedTags.length; i++) {
            let tag = parsedTags[i] as string
            const foundTag = tagMap[tag]
            if (foundTag) {
                if (foundTag.type === "artist") {
                    artists.push(tag)
                } else if (foundTag.type === "character") {
                    characters.push(tag)
                } else if (foundTag.type === "series") {
                    series.push(tag)
                } else if (foundTag.type === "meta") {
                    meta.push(tag)
                } else {
                    tags.push(tag)
                }
            }
        }
        return {artists, characters, series, meta, tags}
    }

    public static googleTranslate = async (text: string, to = "en") => {
        const TKK = [434217, 1534559001]

        const magicNum = (a: any, b: any) => {
            for (var c = 0; c < b.length - 2; c += 3) {
                var d = b.charAt(c + 2),
                    // @ts-ignore
                    d = "a" <= d ? d.charCodeAt(0) - 87 : Number(d),
                    // @ts-ignore
                    d = "+" == b.charAt(c + 1) ? a >>> d : a << d
                a = "+" == b.charAt(c) ? (a + d) & 4294967295 : a ^ d
            }
            return a
        }

        const generateTK = (a: any, b: any, c: any) => {
            b = Number(b) || 0
            let e = [] as number[]
            let f = 0
            let g = 0
            for (; g < a.length; g++) {
                let l = a.charCodeAt(g)
                128 > l
                    ? (e[f++] = l)
                    : (2048 > l
                            ? (e[f++] = (l >> 6) | 192)
                            : (55296 == (l & 64512) &&
                            g + 1 < a.length &&
                            56320 == (a.charCodeAt(g + 1) & 64512)
                                ? ((l = 65536 + ((l & 1023) << 10) + (a.charCodeAt(++g) & 1023)),
                                    (e[f++] = (l >> 18) | 240),
                                    (e[f++] = ((l >> 12) & 63) | 128))
                                : (e[f++] = (l >> 12) | 224),
                            (e[f++] = ((l >> 6) & 63) | 128)),
                        (e[f++] = (l & 63) | 128));
            }
            a = b;
            for (f = 0; f < e.length; f++) {
                (a += e[f]), (a = magicNum(a, "+-a^+6"))
            }
            a = magicNum(a, "+-3^+b+-f")
            a ^= Number(c) || 0
            0 > a && (a = (a & 2147483647) + 2147483648)
            a %= 1e6
            return a.toString() + "." + (a ^ b)
        }
        let url = `https://translate.googleapis.com/translate_a/single?client=gtx&dj=1&dt=t&dt=at&dt=bd&dt=ex&dt=md&dt=rw&dt=ss&dt=rm`
        url += `&sl=auto&tl=${to}&tk=${generateTK(text, TKK[0], TKK[1])}&q=${encodeURIComponent(text)}`
        const response = await fetch(url).then((r) => r.json())

        let result = ""
        if (response.sentences) {
            for (let i = 0; i < response.sentences.length && response.sentences[i].trans; i++) {
                result += response.sentences[i].trans
            }
        }
        return result
    }

    public static generateSlug = (name: string) => {
        let slug = String(name).trim().toLowerCase().replace(/\s+/g, "-").replaceAll("/", "").replaceAll("\\", "")
        slug = slug.replaceAll("#", "")
        slug = slug.replaceAll("?", "")
        slug = slug.replaceAll("&", "")
        if (!slug) slug = "untitled"
        return slug
    }
}