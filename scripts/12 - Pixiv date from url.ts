import Moepictures from "moepics-api"
import functions from "../functions/Functions"

const parseDate = (pximgLink: string) => {
    const parts = pximgLink.split("/")
    const i = parts.indexOf("img")
    const [year, month, day] = parts.slice(i + 1, i + 4)
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
}

const updateBadDates = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)
    const posts = await moepics.search.posts({query: "", type: "image", rating: "all+l", style: "all+s", sort: "reverse date", showChildren: true, limit: 99999})
    const noDate = posts.filter((p) => !p.posted)
    console.log(noDate.length)

    let i = 0
    let skip = 0
    for (const post of noDate) {
        i++
        if (Number(post.postID) < skip) continue
        let image = post.images[0]
        if (image.directLink?.includes("pximg.net")) {
            let date = parseDate(image.directLink)
            console.log(`${post.postID} -> ${date}`)
            await moepics.posts.update(post.postID, "posted", date)
        }
    }
}

const isLater = (a: string, b: string) => {
    const d1 = new Date(a)
    const d2 = new Date(b)
    if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return false
    
    return d1.getTime() > d2.getTime()
}

const fixInvalidDates = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)
    const posts = await moepics.search.posts({query: "", type: "image", rating: "all+l", style: "all+s", sort: "reverse date", showChildren: true, limit: 99999})

    let i = 0
    let skip = 0
    for (const post of posts) {
        i++
        if (Number(post.postID) < skip) continue
        let image = post.images[0]
        if (image.directLink?.includes("pximg.net")) {
            let date = parseDate(image.directLink)
            let posted = functions.formatDate(new Date(post.posted))
            if (isLater(posted, date)) {
                console.log(`${post.postID} -> ${date}`)
                await moepics.posts.update(post.postID, "posted", date)
            }
        }
    }
}

export default fixInvalidDates