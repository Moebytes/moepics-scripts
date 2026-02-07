import Moepictures from "moepics-api"
import functions from "../functions/Functions"

const fixBadSlugs = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)

    const posts = await moepics.search.posts({query: "", type: "all", rating: "all+l", 
    style: "all+s", sort: "reverse date", showChildren: true, limit: 99999})
  
    let i = 0
    let skip = 0
    for (const post of posts) {
        i++
        if (i < skip) continue
        if (post.slug.includes("?") || post.slug.includes("#") || post.slug.includes("&")) {
            console.log(i)
            const slug = functions.generateSlug(post.englishTitle || post.title)
            // @ts-ignore
            await moepics.posts.update(post.postID, "slug", slug)
        }
    }
}

export default fixBadSlugs