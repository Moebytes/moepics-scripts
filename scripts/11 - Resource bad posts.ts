import Moepictures, {PostSearch, SourceLookup} from "moepics-api"
import functions from "../functions/Functions"
import Pixiv from "pixiv.ts"
import dist from "sharp-phash/distance"
import sharp from "sharp"
import NodeFormData from "form-data"
import axios from "axios"
import path from "path"
import fs from "fs"

let pixiv: Pixiv
const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)

const saucenaoSearch = async (buffer: Buffer) => {
    let pngBuffer = await sharp(buffer, {limitInputPixels: false})
        .resize(2000, 2000, {fit: "inside"}).png()
        .toBuffer()
    
    const form = new NodeFormData()
    form.append("db", "999")
    form.append("api_key", process.env.SAUCENAO_KEY!)
    form.append("output_type", 2)
    form.append("file", pngBuffer, {
        filename: `file.png`,
        contentType: "image/png"
    })

    let results = await axios.post("https://saucenao.com/search.php", form, {headers: form.getHeaders()}).then((r) => r.data.results)
    results = results.sort((a, b) => Number(b.header.similarity) - Number(a.header.similarity))
    results = results.filter((r) => Number(r.header.similarity) > 70)

    const pixivResults = results.filter((r) => r.header.index_id === 5)
    return pixivResults?.[0]?.data.pixiv_id ?? ""
}
const updateSource = async (post: PostSearch, pixivID?: string, pixivOnly?: boolean) => {
    let image = post.images[0]
    let imageLink = moepics.links.getImageLink(post.images[0], false)
    const buffer = await moepics.api.fetch(imageLink).then((r) => r.arrayBuffer())

    let ext = path.extname(image.filename).replace(".", "")
    let sourceData = {} as SourceLookup
    if (!pixivOnly) {
        sourceData = await moepics.misc.sourceLookup({
            rating: post.rating,
            current: {
                ext,
                bytes: Object.values(new Uint8Array(buffer)),
                height: image.height,
                width: image.width,
                name: pixivID ? `${pixivID}.png` : image.filename,
                size: image.size,
                link: imageLink,
                originalLink: imageLink,
                thumbnail: "",
                thumbnailExt: "",
                altSource: image.altSource,
                directLink: image.directLink
            }
        })
    }
    
    let source = sourceData.source?.source || (pixivID ? `https://www.pixiv.net/artworks/${pixivID}` : "")
    let title = sourceData.source?.title
    let englishTitle = sourceData.source?.englishTitle
    let artist = sourceData.source?.artist
    let posted = sourceData.source?.posted
    let commentary = sourceData.source?.commentary
    let englishCommentary = sourceData.source?.englishCommentary
    let bookmarks = functions.safeNumber(sourceData.source?.bookmarks)
    let pixivTags = sourceData.source?.pixivTags
    let userProfile = sourceData.source?.userProfile
    let drawingTools = sourceData.source?.drawingTools
    let sourceImageCount = sourceData.source?.sourceImageCount
    let mirrors = [...(sourceData.source?.mirrors?.split("\n") ?? []), 
        ...Object.values(post.mirrors ?? {})].filter(Boolean).join("\n")
    let buyLink = ""

    if (!posted && pixivID) {
        if (!pixiv) pixiv = await Pixiv.refreshLogin(process.env.PIXIV_REFRESH_TOKEN!)
        const illust = await pixiv.illust.get(pixivID).catch(() => null)
        if (illust) {
            title = illust.title
            commentary = `${functions.decodeEntities(illust.caption.replace(/<\/?[^>]+(>|$)/g, ""))}` 
            posted = functions.formatDate(new Date(illust.create_date), true)
            userProfile = `https://www.pixiv.net/users/${illust.user.id}`
            source = illust.url!
            artist = illust.user.name
            bookmarks = illust.total_bookmarks
            sourceImageCount = illust.page_count
            pixivTags = illust.tags.map((t) => t.name)
            drawingTools = illust.tools
            const translated = await moepics.misc.translate([title, commentary])
            if (translated) {
                englishTitle = translated[0]
                englishCommentary = translated[1]
            }
        }
    }

    if (!source) return
    if (pixivOnly && !posted) return Promise.reject("bad item")

    let data = {
        postID: post.postID,
        type: post.type,
        rating: post.rating,
        style: post.style,
        source: {
            source,
            title,
            englishTitle,
            artist,
            posted,
            commentary,
            englishCommentary,
            bookmarks,
            pixivTags,
            userProfile,
            drawingTools,
            sourceImageCount,
            buyLink,
            mirrors
        }
    }
    await moepics.posts.quickEdit({...data, silent: true})
}

const resourceBadPosts = async () => {
    const posts = await moepics.search.posts({query: "", type: "image", rating: "all+l", style: "all+s", sort: "reverse date", showChildren: true, limit: 99999})
    const unsourced = posts.filter((p) => !p.source)
    console.log(unsourced.length)

    let i = 0
    let skip = 0
    for (const post of unsourced) {
        i++
        if (Number(post.postID) < skip) continue
        console.log(`${i} -> ${post.postID}`)
        let imageLink = moepics.links.getImageLink(post.images[0], false)
        const buffer = await moepics.api.fetch(imageLink).then((r) => r.arrayBuffer())
        let pixivID = ""
        // @ts-ignore
        if (post.mirrors?.danbooru) {
            // @ts-ignore
            let id = post.mirrors?.danbooru?.match(/\d+/)?.[0]
            let json = await fetch(`https://danbooru.donmai.us/posts/${id}.json`, {headers: {"user-agent": "user #576533"}}).then((r) => r.json())
            if (json.source?.includes("pximg.net") || json.source?.includes("pixiv.net")) {
                pixivID = path.basename(json.source).match(/\d+/)?.[0] ?? ""
            }
        }
        if (!pixivID) pixivID = await saucenaoSearch(Buffer.from(buffer))
        if (!pixivID) continue
        await updateSource(post, pixivID)
    }
}

const resourceBadPostsFromRef = async () => {
    const posts = await moepics.search.posts({query: "", type: "image", rating: "all+l", style: "all+s", sort: "reverse date", showChildren: true, limit: 99999})
    const unsourced = posts.filter((p) => !p.source)
    console.log(unsourced.length)

    let referenceFolder = process.env.FOLDER!
    const files = fs.readdirSync(referenceFolder).filter((f) => !f.includes(".DS_Store"))
    .sort(new Intl.Collator(undefined, {numeric: true, sensitivity: "base"}).compare)

    let hashMap = {} as {[key: string]: string}
    for (const file of files) {
        const buffer = fs.readFileSync(path.join(referenceFolder, file))
        const hash = await functions.pHash(buffer)
        let pixivID = file.split(".")[0].split("_")[0]
        hashMap[hash] = pixivID
    }
    console.log(hashMap)

    let i = 0
    let skip = 53758
    for (const post of unsourced) {
        i++
        if (Number(post.postID) < skip) continue
        let imageLink = moepics.links.getImageLink(post.images[0], false)
        const buffer = await moepics.api.fetch(imageLink).then((r) => r.arrayBuffer())
        const hash = await functions.pHash(Buffer.from(buffer))

        let pixivID = ""
        for (const [key, value] of Object.entries(hashMap)) {
            if (dist(hash, key) < 6) {
                pixivID = value
                break
            }
        }
        if (!pixivID) continue
        console.log(`(${i}) ${post.postID} -> ${pixivID}`)
        await updateSource(post, pixivID)
    }
}

const updateBadPixivPosts = async () => {
    const posts = await moepics.search.posts({query: "", type: "image", rating: "all+l", style: "all+s", sort: "reverse date", showChildren: true, limit: 99999})
    const badSource = posts.filter((p) => !p.posted)
    console.log(badSource.length)

    let i = 0
    let skip = 0
    for (const post of badSource) {
        i++
        if (Number(post.postID) < skip) continue
        if (post.source?.includes("pixiv.net")) {
            let pixivID = post.source?.match(/\d+/)?.[0] ?? ""
            try {
                await updateSource(post, pixivID, true)
                console.log(`${i} -> ${post.postID}`)
            } catch {
                continue
            }
        }
    }
}

export default updateBadPixivPosts