import Moepictures from "moepics-api"
import functions from "../functions/Functions"
import Pixiv, {PixivWebUser} from "pixiv.ts"

const getArtistTag = (user: PixivWebUser) => {
    const twitter = user.social.twitter?.url?.trim().match(/(?<=com\/).*?(?=\?|$)/)?.[0]
    return twitter ? functions.fixTwitterTag(twitter) : functions.romanizeTag(user.name, functions.detectCJK(user.name))
}

const fixUnknownArtists = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)
    const pixiv = await Pixiv.refreshLogin(process.env.PIXIV_REFRESH_TOKEN!)

    const posts = await moepics.search.posts({query: "unknown-artist", type: "image", rating: "all+l", style: "all+s", sort: "reverse date", showChildren: true, limit: 99999})
    console.log(posts.length)

    let i = 0
    let skip = 0
    for (const post of posts) {
        i++
        if (Number(post.postID) < skip) continue
        let artistTag = ""
        if (post.userProfile) {
            const tags = await moepics.search.tags({query: `social:${post.userProfile}`})
            if (tags.length) {
                artistTag = tags[0].tag
            } else {
                if (post.userProfile.includes("pixiv.net")) {
                    let userID = post.userProfile?.match(/\d+/)?.[0] ?? ""
                    const detail = await pixiv.user.webDetail(Number(userID))
                    artistTag = getArtistTag(detail)
                }
            }
        } else if (post.source?.includes("pixiv.net")) {
            const illust = await pixiv.illust.get(post.source?.match(/\d+/)?.[0] ?? "").catch(() => null)
            if (illust) {
                const detail = await pixiv.user.webDetail(illust.user.id)
                artistTag = getArtistTag(detail)
            }
        }
        if (!artistTag) continue

        const exists = await moepics.tags.get(artistTag)
        if (!exists) await moepics.tags.insert(artistTag, "artist", "Artist.")
        await moepics.posts.removeTags(post.postID, ["unknown-artist"])
        await moepics.posts.addTags(post.postID, [artistTag])
        console.log(`${post.postID} -> ${artistTag}`)
    }
}

export default fixUnknownArtists