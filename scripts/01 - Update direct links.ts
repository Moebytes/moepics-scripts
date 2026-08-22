import Moepictures from "moepics-api"
import Pixiv, {PixivIllust} from "pixiv.ts"
import dist from "sharp-phash/distance"
import functions from "../functions/Functions"

const getSourceLinks = async (illust: PixivIllust) => {
    let sourceLinks = [] as {link: string, hash: string}[]

    let rawLinks = [] as string[]
    if (illust.meta_pages.length) {
        rawLinks = illust.meta_pages.map((m) => m.image_urls.original)
    } else if (illust.meta_single_page.original_image_url) {
        rawLinks = [illust.meta_single_page.original_image_url]
    }

    for (const link of rawLinks) {
        const buffer = await functions.imageBuffer(link)
        const hash = await functions.pHash(buffer)
        sourceLinks.push({link, hash})
    }
    
    return sourceLinks
}

const resolveSourceLink = (hash: string, order: number, sourceLinks: {link: string, hash: string}[]) => {
    let first = sourceLinks[order - 1]
    if (first && dist(hash, first.hash) < 6) return first.link

    for (const current of sourceLinks) {
        if (dist(hash, current.hash) < 6) return current.link
    }

    return null
}

const updateDirectLinks = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)
    const pixiv = await Pixiv.refreshLogin(process.env.PIXIV_REFRESH_TOKEN!)

    const posts = await moepics.search.posts({query: "", type: "image", rating: "all+l", style: "all+s", sort: "reverse date", showChildren: true, limit: 99999})
  
    let i = 0
    let skip = 48504
    for (const post of posts) {
        i++
        if (i < skip) continue
        if (post.images[0]?.directLink) continue
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
            const sourceLinks = await getSourceLinks(illust)
            for (const image of post.images) {
                const directLink = resolveSourceLink(image.hash, image.order, sourceLinks)
                await moepics.images.update(image.imageID, "directLink", directLink)
            }
        }
    }
}

export const updateOtherDirectLinks = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)

    const posts = await moepics.search.posts({query: "", type: "image", rating: "all+l", style: "all+s", sort: "reverse date", showChildren: true, limit: 99999})
  
    let i = 0
    let skip = 0
    for (const post of posts) {
        i++
        if (i < skip) continue
        if (post.images.length > 1) continue
        if (post.images[0].directLink) continue
        console.log(i)
        // @ts-ignore
        if (post.mirrors?.danbooru) {
            // @ts-ignore
            let id = post.mirrors.danbooru.match(/\d+/)?.[0] ?? ""
            const json = await fetch(`https://danbooru.donmai.us/posts/${id}.json`, {headers: {"user-agent": "user #576533"}}).then((r) => r.json())
            if (json.source?.includes("pximg.net") || json.source?.includes("pbs.twimg")) {
                let image = post.images[0]
                await moepics.images.update(image.imageID, "directLink", json.source)
            }
        }
    }
}

export default updateOtherDirectLinks