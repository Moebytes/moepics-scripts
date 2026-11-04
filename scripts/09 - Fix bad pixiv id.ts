import Moepictures from "moepics-api"
import Pixiv, {PixivIllust} from "pixiv.ts"

const fixBadPixivID = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)
    const pixiv = await Pixiv.refreshLogin(process.env.PIXIV_REFRESH_TOKEN!)

    const posts = await moepics.search.posts({query: "bad-pixiv-id", type: "image", rating: "all+l", style: "all+s", sort: "reverse date", showChildren: true, limit: 99999})
    console.log(posts.length)
  
    let i = 0
    let skip = 0
    for (const post of posts) {
        i++
        if (i < skip) continue
        console.log(i)
        if (post.source?.includes("pixiv.net")) {
            const id = post.source.match(/\d+/)?.[0] ?? ""
            let illust: PixivIllust
            try {
                illust = await pixiv.illust.get(id)
            } catch (e: any) {
                if (String(e)?.includes("access_token")) return console.log("429")
                continue
            }
            if (illust.image_urls.medium.includes("unknown_360")) continue
            console.log(`${i} exists -> ${illust.id}`)
            await moepics.posts.removeTags(post.postID, ["bad-pixiv-id"])
        }
    }
}

export default fixBadPixivID