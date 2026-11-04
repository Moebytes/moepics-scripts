import Moepictures from "moepics-api"
import functions from "../functions/Functions"

const translateCommentaries = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)

    const posts = await moepics.search.posts({query: "", type: "image", rating: "all+l", style: "all+s", sort: "reverse date", showChildren: true, limit: 99999})
    console.log(posts.length)
  
    let i = 0
    let skip = 54798
    for (const post of posts) {
        i++
        if (Number(post.postID) < skip) continue
        
        let updated = false
        if (post.title) {
            let englishTitle = post.englishTitle || post.title
            if (functions.hasForeignCharacters(englishTitle)) {
                const text = await functions.googleTranslate(post.title, "en")
                if (text) {
                    await moepics.posts.update(post.postID, "englishTitle", text)
                    updated = true
                }
            }
        }

        if (post.commentary) {
            let englishCommentary = post.englishCommentary || post.commentary
            if (functions.hasForeignCharacters(englishCommentary)) {
                const text = await functions.googleTranslate(post.commentary, "en")
                if (text) {
                    await moepics.posts.update(post.postID, "englishCommentary", text)
                    updated = true
                }
            }
        }

        if (updated) {
            console.log(`${i} -> ${post.postID}`)
        }
    }
}

export default translateCommentaries