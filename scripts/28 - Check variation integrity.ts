import Moepictures from "moepics-api"
import Pixiv, {PixivIllust} from "pixiv.ts"
import functions from "../functions/Functions"
import fs from "fs"
import path from "path"

const checkVariationIntegrity = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)

    const posts = await moepics.search.posts({query: "", type: "all", rating: "all+l", 
        style: "all+s", sort: "reverse date", showChildren: false, limit: 999999})
    console.log(posts.length)

    let mismatch = [] as string[]

    let writeTag = false

    let i = 0
    let skip = 0
    for (const post of posts) {
        i++
        if (i < skip) continue
        if (post.tags.includes("skip-variation-integrity")) continue

        if (post.sourceImageCount && post.sourceImageCount > 1) {
            let counter = Number(post.variationCount)
            if (post.hasChildren) {
                const children = await moepics.posts.children(post.postID)
                counter += children.length
            }
            if (post.isGrouped) {
                const groups = await moepics.groups.groups(post.postID)
                for (const group of groups) {
                    counter += (Number(group.postCount) - 1)
                }
            }
            if (post.sourceImageCount > counter) {
                mismatch.push(post.postID)
                console.log(`(${i}) mismtach: ${post.postID}`)
                if (writeTag) {
                    moepics.posts.addTags(post.postID, ["skip-variation-integrity"])
                } else {
                    fs.writeFileSync("mismatch.json", JSON.stringify(mismatch))
                }
            }
        }
    }
    if (!writeTag) {
        fs.writeFileSync("mismatch.json", JSON.stringify(mismatch))
    }
}

const downloadVariationIntegrity = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)
    const pixiv = await Pixiv.refreshLogin(process.env.PIXIV_REFRESH_TOKEN!)

    const json = JSON.parse(fs.readFileSync("mismatch.json").toString())

    const sfw = "./dump/sfw"
    const nsfw = "./dump/nsfw"

    if (!fs.existsSync(sfw)) fs.mkdirSync(sfw, {recursive: true})
    if (!fs.existsSync(nsfw)) fs.mkdirSync(nsfw, {recursive: true})

    for (const postID of json) {
        if (Number(postID) < 0) continue
        console.log(postID)

        const post = await moepics.posts.get(postID)
        if (post?.source.includes("pixiv.net")) {
            let illust: PixivIllust
            try {
                illust = await pixiv.illust.get(post.source)
            } catch (e: any) {
                if (String(e)?.includes("access_token")) return console.log("429")
                continue
            }

            const imageLinks = illust.meta_pages.map((m) => m.image_urls.original)
            for (let i = 0; i < imageLinks.length; i++) {
                const link = imageLinks[i]
                const folder = post.rating === "lewd" ? nsfw : sfw
                let dest = `${folder}/${post.postID}-${i + 1}${path.extname(link)}`
                const buffer = await functions.imageBuffer(link)
                fs.writeFileSync(dest, buffer)
            }
        }
    }
}

const imageDepuping = async () => {
    const folderCheck = ""
    const dupeFolder = ""
    const badFolder = ""

    const files = fs.readdirSync(folderCheck)

    let fileMap = {} as any

    for (const file of files) {
        const [postID, order] = file.split("-")
        if (!fileMap[postID]) {
            fileMap[postID] = [file]
        } else {
            fileMap[postID].push(file)
        }
    }

    const imgCountMap = {} as any
    for (const [key, value] of Object.entries(fileMap)) {
        let items = (value as any).length
        if (!imgCountMap[items]) {
            imgCountMap[items] = [key]
        } else {
            imgCountMap[items].push(key)
        }
    }

    for (const [key, value] of Object.entries(imgCountMap).reverse()) {
        let postIDs = value as any
        const hashMap = {} as any

        loop1:
        for (const postID of postIDs) {
            let hashes = [] as string[]
            const files = fileMap[postID]
            for (const file of files) {
                const filePath = path.join(folderCheck, file)
                const buffer = fs.readFileSync(filePath)
                if (!buffer.byteLength) {
                    const badPath = path.join(badFolder, file)
                    fs.renameSync(filePath, badPath)
                    continue

                }
                const hash = await functions.pixelHash(buffer)
                hashes.push(hash)

                //Check the hash map, if there is a matching pixel hash this set is
                //almost certainly a duplicate
                for (const [key, value] of Object.entries(hashMap)) {
                    const hashes = value as string[]
                    if (hashes.includes(hash)) {
                        //duplicate, move the entire set
                        console.log(`dupe: ${postID}`)
                        for (const file of files) {
                            const filePath = path.join(folderCheck, file)
                            const destPath = path.join(dupeFolder, file)
                            try {
                                fs.renameSync(filePath, destPath)
                            } catch {}
                        }
                        continue loop1
                    }
                }

            }
            hashMap[postID] = hashes
        }
    }
}

const renamePosts = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)

    const folderCheck = ""
    const files = fs.readdirSync(folderCheck)

    for (const file of files) {
        if (file === ".DS_Store") continue
        const filePath = path.join(folderCheck, file)
        const [postID, order] = file.split("-")
        const post = await moepics.posts.get(postID)
        if (!post) continue
        if (post.source.includes("pixiv.net")) {
            const pixivID = post.source.match(/\d+/)?.[0]
            let i = 0
            let newPath = path.join(folderCheck, `${pixivID}_g0${path.extname(file)}`)
            while (fs.existsSync(newPath)) {
                i++
                newPath = path.join(folderCheck, `${pixivID}_g${i}${path.extname(file)}`)
            }
            fs.renameSync(filePath, newPath)
        }
    }
}

export default checkVariationIntegrity