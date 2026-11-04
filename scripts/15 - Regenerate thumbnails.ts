import Moepictures from "moepics-api"

const regenerateThumbnails = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)

    const posts = await moepics.search.posts({query: "", type: "image", rating: "all+l", style: "all+s", sort: "reverse date", showChildren: true, limit: 999999})
    console.log(posts.length)

    let i = 0
    let skip = 0
    for (const post of posts) {
        i++
        if (Number(post.postID) < skip) continue
        const result = await moepics.posts.regenerateThumbnails(post.postID)
        console.log(`${post.postID} -> ${result}`)
    }
}

export default regenerateThumbnails