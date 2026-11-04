import Moepictures, {PostSearch} from "moepics-api"
import functions from "../functions/Functions"
import Pixiv, {PixivIllust} from "pixiv.ts"
import fs from "fs"

const findArtistConflicts = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)

    const tags = await moepics.search.tags({type: "artist", sort: "reverse date", limit: 999999})
    console.log(tags.length)

    let conflicts = [] as string[]

    let i = 0
    let skip = 0
    for (const tag of tags) {
        i++
        if (i < skip) continue
        const posts = await moepics.search.posts({query: tag.tag, type: "all", rating: "all+l", style: "all+s", sort: "reverse date", showChildren: true, limit: 999999})
        let uniqueUsers = functions.removeDuplicates(posts.filter((p) => p.userProfile).map((p) => p.userProfile)) as string[]

        if (uniqueUsers.length > 1) {
            console.log(uniqueUsers)
            console.log(`conflict: ${tag.tag}`)
            conflicts.push(tag.tag)
            fs.writeFileSync("conflicts.json", JSON.stringify(conflicts))
        }
    }
    fs.writeFileSync("conflicts.json", JSON.stringify(conflicts))
}

const getConflictInfo = async (pixiv: Pixiv, posts: PostSearch[]) => {
    let info = {} as any
    for (const post of posts) {
        if (!post.userProfile) continue
        if (!info[post.userProfile]) {
            const detail = await pixiv.user.webDetail(Number(post.userProfile?.match(/\d+/)?.[0]))
            const twitter = detail.social.twitter?.url?.trim().match(/(?<=com\/).*?(?=\?|$)/)?.[0]
            let tag = twitter ? functions.fixTwitterTag(twitter) : functions.romanizeTag(detail.name, functions.detectCJK(detail.name))
            info[post.userProfile] = {
                tag,
                posts: [post.postID]
            }
        } else {
            info[post.userProfile].posts.push(post.postID)
        }
    }

    let sortedEntries = Object.entries(info)
        .map(([url, data]: any) => ({url, ...data}))
        .sort((a, b) => b.posts.length - a.posts.length)

    let nameConflicts = [] as string[]
    
    for (let i = 0; i < sortedEntries.length; i++) {
        const entry = sortedEntries[i]
        if (nameConflicts.includes(entry.tag)) {
            let id = entry.url.match(/\d+/)?.[0]
            sortedEntries[i].tag = `${entry.tag}-(${id})`
        } else {
            nameConflicts.push(entry.tag)
        }
    }

    return sortedEntries as [{url: string, tag: string, posts: string[]}]
}

const fixArtistConflicts = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)
    const pixiv = await Pixiv.refreshLogin(process.env.PIXIV_REFRESH_TOKEN!)

    const conflicts = JSON.parse(fs.readFileSync("conflicts.json").toString())

    for (const tag of conflicts) {
        if (tag === "unknown-artist") continue

        const posts = await moepics.search.posts({query: tag, type: "all", rating: "all+l", style: "all+s", sort: "reverse date", showChildren: true, limit: 999999})
        let uniqueUsers = functions.removeDuplicates(posts.filter((p) => p.userProfile).map((p) => p.userProfile)) as string[]
        if (uniqueUsers.length <= 1) continue

        const info = await getConflictInfo(pixiv, posts)

        for (const item of info) {
            const exists = await moepics.tags.get(item.tag)
            if (!exists) await moepics.tags.insert(item.tag, "artist", "Artist.")
            for (const postID of item.posts) {
                await moepics.posts.removeTags(postID, [tag])
                await moepics.posts.addTags(postID, [item.tag])
            }
            console.log(`${item.url} -> ${item.tag}`)
        }
    }
}

export default fixArtistConflicts