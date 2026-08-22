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
            // @ts-ignore
            delete mirrors.danbooru
            // @ts-ignore
            delete mirrors.gelbooru
            // @ts-ignore
            delete mirrors.safebooru
            // @ts-ignore
            delete mirrors.konachan
            // @ts-ignore
            delete mirrors.yandere
            // @ts-ignore
            delete mirrors.eshuushuu
            // @ts-ignore
            delete mirrors.zerochan
            // @ts-ignore
            delete mirrors.animepictures
            const jsonObject = JSON.stringify(mirrors)
            await moepics.posts.update(post.postID, "mirrors", jsonObject)
            console.log(`${post.postID}`)
        }
    }
}

export default removeThirdPartyMirrors