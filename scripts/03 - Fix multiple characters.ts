import Moepictures, {Tag} from "moepics-api"
import functions from "../functions/Functions"

const fixMultipleCharacters = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)

    const posts = await moepics.search.posts({query: "", type: "image", rating: "all+l", style: "all+s", sort: "reverse date", showChildren: true, limit: 99999})
  
    let i = 0
    let skip = 0
    for (const post of posts) {
        i++
        if (i < skip) continue
        console.log(i)
        // @ts-ignore
        if (post.mirrors?.danbooru) {
            // @ts-ignore
            const id = post.mirrors.danbooru.match(/\d+/)?.[0] ?? ""
            const danbooruPost = await fetch(`https://danbooru.donmai.us/posts/${id}.json`, {headers: {"user-agent": "user #576533"}}).then((r) => r.json())
            let tags = danbooruPost.tag_string_general.split(/ +/g)
            await moepics.posts.removeTags(post.postID, ["multiple-characters", "solo"])
            if (tags.includes("multiple_girls")) {
                await moepics.posts.addTags(post.postID, ["multiple-characters"])
            } else {
                await moepics.posts.addTags(post.postID, ["solo"])
            }
        }
    }
}

const fixMultipleCharactersOther = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)

    const posts = await moepics.search.posts({query: "", type: "image", rating: "all+l", 
    style: "all+s", sort: "reverse date", showChildren: true, limit: 99999, withTags: true})

    let tags = await moepics.tags.list([])
    let tagMap = {} as {[key: string]: Tag}
    for (const tag of tags) {
        tagMap[tag.tag] = tag
    }
  
    let i = 0
    let skip = 0
    for (const post of posts) {
        i++
        if (i < skip) continue
        console.log(i)
        // @ts-ignore
        if (post.mirrors?.danbooru) continue
        if (post.tags?.includes("multiple-characters")) {
            let characterTags = post.tags.filter((r) => tagMap[r].type === "character")
            characterTags = characterTags.map((c) => c.split("-(")[0])
            characterTags = functions.removeDuplicates(characterTags)
            if (characterTags.length === 1) {
                await moepics.posts.removeTags(post.postID, ["multiple-characters", "solo"])
                await moepics.posts.addTags(post.postID, ["solo"])
            }
        }
    }
}

export default fixMultipleCharacters