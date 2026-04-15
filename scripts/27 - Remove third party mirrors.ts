import Moepictures from "moepics-api"

const removeThirdPartyMirrors = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)

    const posts = await moepics.search.posts({query: "", type: "all", rating: "all+l", style: "all+s", sort: "reverse date", showChildren: true, limit: 999999})
    console.log(posts.length)

    let i = 0
    let skip = 0
    for (const post of posts) {
        i++
        if (Number(post.postID) < skip) continue
        if (Object.keys(post.mirrors ?? {}).length) {
            const mirrors = post.mirrors || {}
            delete mirrors.danbooru
            delete mirrors.gelbooru
            delete mirrors.safebooru
            delete mirrors.konachan
            delete mirrors.eshuushuu
            delete mirrors.zerochan
            delete mirrors.animepictures
            const jsonObject = JSON.stringify(mirrors)
            await moepics.posts.update(post.postID, "mirrors", jsonObject)
            console.log(`${post.postID}`)
        }
    }
}

export default removeThirdPartyMirrors